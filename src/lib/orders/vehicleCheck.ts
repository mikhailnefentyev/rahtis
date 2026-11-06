/*
 * «Та ли машина приехала» (6.11.2026): решение по сверке на погрузке.
 *
 * Чистый модуль без базы и путей @/ — его гоняет node --test
 * (vehicleCheck.test.mjs). Данные собирает база (vehicle_check_evidence),
 * пишет служебная функция (record_vehicle_check).
 *
 * Это флаг для человека, а не блокировка (ст. 22 GDPR): MISMATCH только
 * поднимает отметку и пункт «Требует действия».
 */

export type VehicleVerdict = 'OK' | 'MISMATCH' | 'NO_DATA';

export type VehicleReason =
  | { code: 'PLATE_CONFIRMED' }
  | { code: 'PLATE_MISMATCH'; expected: string; reported: string }
  | { code: 'TRAILER_CONFIRMED' }
  | { code: 'TRAILER_MISMATCH'; expected: string; reported: string }
  | { code: 'GPS_NEAR'; distanceM: number }
  | { code: 'GPS_FAR'; distanceM: number }
  | { code: 'NO_GPS' }
  /* Справочно: на вердикт не влияет. */
  | { code: 'DRIVER_OTHER' };

export type VehicleEvidence = {
  expectedPlate: string | null;
  reportedPlate: string | null;
  expectedTrailer: string | null;
  reportedTrailer: string | null;
  stop: { lat: number; lon: number } | null;
  gps: { lat: number; lon: number; at: string } | null;
  /** Момент отметки точки (ISO). */
  completedAt: string;
  assignedDriverId: string | null;
  actualDriverId: string | null;
  /** В журнале есть смена водителя (change_trip_assignment) — не флаг. */
  driverChangeRecorded: boolean;
};

export type VehicleCheckResult = {
  verdict: VehicleVerdict;
  reasons: VehicleReason[];
  gpsDistanceM: number | null;
  gpsSeenAt: string | null;
  driverMatches: boolean | null;
};

/** Радиус «машина на месте». */
export const GPS_RADIUS_M = 2000;
/* Позиция годится, если снята не раньше часа до отметки и не позже 15 минут после. */
const GPS_BEFORE_MS = 60 * 60_000;
const GPS_AFTER_MS = 15 * 60_000;

/*
 * Отличительные знаки стран (Венская конвенция) и двухбуквенные коды —
 * водитель может написать «FIN ABC-123» или «(PL) WX 12345».
 */
const COUNTRY_SIGNS = new Set([
  'FIN', 'FI', 'S', 'SE', 'N', 'NO', 'DK', 'EST', 'EE', 'LV', 'LT', 'PL', 'D', 'DE', 'NL', 'B', 'BE',
  'F', 'FR', 'CZ', 'SK', 'H', 'HU', 'A', 'AT', 'RUS', 'RU', 'BY', 'UA', 'RO', 'BG', 'I', 'IT', 'E', 'ES',
  'GB', 'UK', 'IRL', 'IE', 'CH', 'L', 'LU', 'SLO', 'SI', 'HR', 'P', 'PT', 'GR', 'TR', 'MD', 'KZ',
]);

/** Номер для сравнения: только буквы и цифры, верхний регистр (как app.plate_key). */
export function normalizePlate(value: string | null | undefined): string {
  return (value ?? '').toUpperCase().replace(/[^0-9A-ZÅÄÖÜ]/g, '');
}

/**
 * Номер без знака страны — только если знак отделён (пробел, дефис,
 * скобки) и после него остаётся номер не короче четырёх знаков: иначе
 * финский «EST-123» потерял бы буквы.
 */
function withoutCountry(value: string): string | null {
  const match = /^\(?([A-Za-z]{1,3})\)?[\s\-–]+(.+)$/.exec(value.trim());
  if (!match || !COUNTRY_SIGNS.has(match[1].toUpperCase())) return null;
  const rest = normalizePlate(match[2]);
  return rest.length >= 4 ? rest : null;
}

/** Один ли это номер: регистр, пробелы, дефисы и знак страны не важны. */
export function samePlate(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = normalizePlate(a);
  const nb = normalizePlate(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const ca = withoutCountry(a ?? '') ?? na;
  const cb = withoutCountry(b ?? '') ?? nb;
  return ca === cb;
}

/** Расстояние по большому кругу, метры. */
export function distanceM(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * 6_371_000 * Math.asin(Math.min(1, Math.sqrt(h))));
}

const blank = (value: string | null | undefined) => !value || normalizePlate(value) === '';

export function vehicleVerdict(e: VehicleEvidence): VehicleCheckResult {
  const reasons: VehicleReason[] = [];

  /* Номер сверяется, только если водитель его прислал и в заказе он есть. */
  if (!blank(e.expectedPlate) && !blank(e.reportedPlate)) {
    reasons.push(
      samePlate(e.expectedPlate, e.reportedPlate)
        ? { code: 'PLATE_CONFIRMED' }
        : { code: 'PLATE_MISMATCH', expected: e.expectedPlate!, reported: e.reportedPlate!.trim() },
    );
  }
  if (!blank(e.expectedTrailer) && !blank(e.reportedTrailer)) {
    reasons.push(
      samePlate(e.expectedTrailer, e.reportedTrailer)
        ? { code: 'TRAILER_CONFIRMED' }
        : { code: 'TRAILER_MISMATCH', expected: e.expectedTrailer!, reported: e.reportedTrailer!.trim() },
    );
  }

  /* GPS: только свежая позиция и только если у точки есть координаты. */
  let gpsDistanceM: number | null = null;
  let gpsSeenAt: string | null = null;
  const done = Date.parse(e.completedAt);
  const seen = e.gps ? Date.parse(e.gps.at) : Number.NaN;
  if (e.gps && e.stop && Number.isFinite(done) && Number.isFinite(seen) && seen >= done - GPS_BEFORE_MS && seen <= done + GPS_AFTER_MS) {
    gpsDistanceM = distanceM(e.gps, e.stop);
    gpsSeenAt = e.gps.at;
    reasons.push(gpsDistanceM > GPS_RADIUS_M ? { code: 'GPS_FAR', distanceM: gpsDistanceM } : { code: 'GPS_NEAR', distanceM: gpsDistanceM });
  } else {
    reasons.push({ code: 'NO_GPS' });
  }

  const driverMatches = e.actualDriverId && e.assignedDriverId ? e.actualDriverId === e.assignedDriverId : null;
  if (driverMatches === false && !e.driverChangeRecorded) reasons.push({ code: 'DRIVER_OTHER' });

  const codes = new Set(reasons.map((r) => r.code));
  const verdict: VehicleVerdict =
    codes.has('PLATE_MISMATCH') || codes.has('TRAILER_MISMATCH') || codes.has('GPS_FAR')
      ? 'MISMATCH'
      : codes.has('PLATE_CONFIRMED') || codes.has('GPS_NEAR')
        ? 'OK'
        : 'NO_DATA';

  return { verdict, reasons, gpsDistanceM, gpsSeenAt, driverMatches };
}

/* ── Показ: карточка, «Требует действия», письмо ─────────────────── */

/** Строка vehicle_checks для карточки заказа. */
export type VehicleCheckView = {
  id: string;
  verdict: VehicleVerdict;
  reasons: VehicleReason[];
  shipperConfirmedAt: string | null;
  shipperReason: string | null;
  carrierConfirmedAt: string | null;
  carrierReason: string | null;
};

export type VehicleCheckTexts = {
  plateReported: string;
  trailerReported: string;
  gpsFar: string;
  driverOther: string;
};

/** Причины расхождения словами — для карточки и письма. */
export function reasonLines(reasons: readonly VehicleReason[], t: VehicleCheckTexts): string[] {
  const lines: string[] = [];
  for (const r of reasons) {
    if (r.code === 'PLATE_MISMATCH') lines.push(t.plateReported.replace('{expected}', r.expected).replace('{reported}', r.reported));
    else if (r.code === 'TRAILER_MISMATCH') lines.push(t.trailerReported.replace('{expected}', r.expected).replace('{reported}', r.reported));
    else if (r.code === 'GPS_FAR') lines.push(t.gpsFar.replace('{km}', String(Math.round(r.distanceM / 1000))));
    else if (r.code === 'DRIVER_OTHER') lines.push(t.driverOther);
  }
  return lines;
}
