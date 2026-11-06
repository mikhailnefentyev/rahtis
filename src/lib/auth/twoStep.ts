import { createHash } from 'node:crypto';

/*
 * Двухэтапный вход и новые устройства (этап 3, 6.11.2026): чистые
 * помощники без базы и путей @/ — их гоняет node --test.
 */

export type Aal = 'aal1' | 'aal2';

/** Полезная нагрузка JWT без проверки подписи: токен уже проверил getUser. */
function jwtPayload(jwt: string | null | undefined): Record<string, unknown> | null {
  const part = jwt?.split('.')[1];
  if (!part) return null;
  try {
    const base64 = part.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const parsed: unknown = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(padded), (c) => c.charCodeAt(0))));
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Уровень сессии из токена: aal1 — только пароль или ссылка, aal2 — с кодом. */
export function aalOf(jwt: string | null | undefined): Aal | null {
  const aal = jwtPayload(jwt)?.aal;
  return aal === 'aal1' || aal === 'aal2' ? aal : null;
}

/** Когда в этой сессии последний раз вводили код (секунды эпохи) — из amr. */
export function lastCodeAt(jwt: string | null | undefined): number | null {
  const amr = jwtPayload(jwt)?.amr;
  if (!Array.isArray(amr)) return null;
  let last: number | null = null;
  for (const entry of amr) {
    if (!entry || typeof entry !== 'object') continue;
    const { method, timestamp } = entry as { method?: unknown; timestamp?: unknown };
    if (method === 'totp' && typeof timestamp === 'number' && (last === null || timestamp > last)) last = timestamp;
  }
  return last;
}

/** Окно, в котором недавний код подтверждает важное действие без нового. */
export const STEP_UP_WINDOW_SECONDS = 15 * 60;

/**
 * Нужно ли спросить код перед важным действием: у кого двухэтапный вход
 * включён — да, если сессия не aal2 или код вводили дольше окна назад.
 */
export function stepUpNeeded(input: {
  enabled: boolean;
  aal: Aal | null;
  codeAt: number | null;
  now?: number;
  windowSeconds?: number;
}): boolean {
  if (!input.enabled) return false;
  if (input.aal !== 'aal2' || input.codeAt === null) return true;
  const now = Math.floor((input.now ?? Date.now()) / 1000);
  return now - input.codeAt > (input.windowSeconds ?? STEP_UP_WINDOW_SECONDS);
}

/**
 * Состояние вошедшего: code — есть подтверждённый фактор, а код ещё не
 * введён; enrol — оператор без фактора (для оператора обязателен);
 * null — пускать.
 */
export function pendingStep(input: { enabled: boolean; aal: Aal | null; admin: boolean }): 'code' | 'enrol' | null {
  if (input.enabled) return input.aal === 'aal2' ? null : 'code';
  return input.admin ? 'enrol' : null;
}

/*
 * Отпечаток устройства. Номера версий вырезаются: обновление браузера —
 * не новое устройство, и письмо после каждого обновления Chrome
 * приучило бы людей такие письма не читать.
 */
export function normaliseUserAgent(ua: string | null | undefined): string {
  return (ua ?? '').replace(/\d[\d._]*/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function normaliseLanguages(header: string | null | undefined): string {
  return (header ?? '')
    .split(',')
    .map((part) => part.split(';')[0]?.trim().toLowerCase())
    .filter(Boolean)
    .join(',');
}

/** sha256 от браузера без версий и языков браузера; 64 шестнадцатеричных знака. */
export function deviceFingerprint(ua: string | null | undefined, languages: string | null | undefined): string {
  return createHash('sha256').update(`${normaliseUserAgent(ua)}|${normaliseLanguages(languages)}`).digest('hex');
}

/** «Chrome · Windows» — для письма и списка; неизвестное — null. */
export function describeDevice(ua: string | null | undefined): string | null {
  const s = ua ?? '';
  const browser = /Edg\//.test(s)
    ? 'Edge'
    : /OPR\/|Opera/.test(s)
      ? 'Opera'
      : /SamsungBrowser\//.test(s)
        ? 'Samsung Internet'
        : /Firefox\/|FxiOS\//.test(s)
          ? 'Firefox'
          : /Chrome\/|CriOS\//.test(s)
            ? 'Chrome'
            : /Safari\//.test(s)
              ? 'Safari'
              : null;
  const os = /iPhone|iPad|iPod/.test(s)
    ? 'iOS'
    : /Android/.test(s)
      ? 'Android'
      : /Windows/.test(s)
        ? 'Windows'
        : /Mac OS X|Macintosh/.test(s)
          ? 'macOS'
          : /CrOS/.test(s)
            ? 'ChromeOS'
            : /Linux/.test(s)
              ? 'Linux'
              : null;
  if (!browser && !os) return null;
  return [browser, os].filter(Boolean).join(' · ');
}

/**
 * Префикс адреса вместо адреса (GDPR — минимум данных): IPv4 до /24,
 * IPv6 до /48. Непонятное — null.
 */
export function ipPrefix(ip: string | null | undefined): string | null {
  const raw = (ip ?? '').trim();
  const v4 = /^(?:::ffff:)?(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/i.exec(raw);
  if (v4) {
    const octets = v4.slice(1, 5).map(Number);
    if (octets.some((n) => n > 255)) return null;
    return `${octets[0]}.${octets[1]}.${octets[2]}.0/24`;
  }
  if (!raw.includes(':') || !/^[0-9a-f:]+$/i.test(raw)) return null;
  const [head, tail] = raw.split('::');
  if (raw.split('::').length > 2) return null;
  const left = head ? head.split(':') : [];
  const right = tail !== undefined && tail !== '' ? tail.split(':') : [];
  const missing = 8 - left.length - right.length;
  if (missing < 0 || (tail === undefined && missing !== 0)) return null;
  const groups = [...left, ...Array<string>(missing).fill('0'), ...right];
  if (groups.some((g) => g.length === 0 || g.length > 4)) return null;
  return `${groups
    .slice(0, 3)
    .map((g) => parseInt(g, 16).toString(16))
    .join(':')}::/48`;
}

/** Страна из заголовка Vercel: две буквы или null. */
export function countryCode(header: string | null | undefined): string | null {
  const code = (header ?? '').trim().toUpperCase();
  return /^[A-Z]{2}$/.test(code) && code !== 'XX' ? code : null;
}

/** Город из заголовка Vercel (приходит в URL-кодировке). */
export function cityName(header: string | null | undefined): string | null {
  if (!header) return null;
  try {
    const city = decodeURIComponent(header).trim();
    return city && city.length <= 80 ? city : null;
  } catch {
    return null;
  }
}

/**
 * Письмо о входе — только с нового устройства и не при самом первом
 * входе: у нового аккаунта (и у всех в первый день после выкладки)
 * знакомых устройств ещё нет, и письмо ничего бы не значило.
 */
export function shouldAlert(known: readonly string[], fingerprint: string): boolean {
  return known.length > 0 && !known.includes(fingerprint);
}

/** QR из Supabase (SVG-разметка, иногда уже с префиксом) — в адрес для <img>. */
export function qrDataUrl(qr: string): string {
  const svg = qr.replace(/^data:image\/svg\+xml;[^,]*,/, '');
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/** Код из приложения: шесть цифр, пробелы и дефисы, которые люди ставят сами, — убираем. */
export function cleanCode(raw: string | null | undefined): string | null {
  const code = (raw ?? '').replace(/[\s-]/g, '');
  return /^\d{6}$/.test(code) ? code : null;
}
