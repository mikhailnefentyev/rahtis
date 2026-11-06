/**
 * Автоответ на «Где машина?» в переписке рейса.
 *
 * Без ИИ: ответ собирается из данных рейса по шаблонам словаря — дёшево,
 * сразу и без выдумок. Модуль чистый: факты собирает сервер
 * (askChatAction), время форматирует вызывающий (ctx), а здесь только
 * решается, какие фразы и в каком порядке.
 *
 * Позиции машины в ответе нет: страница отслеживания (/track/[token])
 * превращает GPS только во время прибытия, и автоответ не показывает
 * больше неё (PRIVACY, GPS 29.10).
 */

export const ASK_KINDS = ['WHERE', 'WHEN', 'LOADED'] as const;
export type AskKind = (typeof ASK_KINDS)[number];

/** Языки шаблонов — языки кабинета. */
export const AUTO_LANGS = ['fi', 'en', 'sv', 'et', 'lv', 'lt', 'pl', 'de', 'ru'] as const;
export type AutoLang = (typeof AUTO_LANGS)[number];

/** Язык ответа: язык спросившего, «ru-RU» → «ru», чужой — английский. */
export function autoAnswerLang(lang: string | null | undefined): AutoLang {
  const code = (lang ?? '').toLowerCase().slice(0, 2);
  return (AUTO_LANGS as readonly string[]).includes(code) ? (code as AutoLang) : 'en';
}

export type AutoStop = {
  role: string;
  city: string;
  country: string | null;
  /** Плановые дата и время — местные, как записаны у точки. */
  date: string | null;
  time: string | null;
  arrivedAt: string | null;
  completedAt: string | null;
};

/** Факты рейса на момент ответа — хранятся в order_messages.auto. */
export type AutoFacts = {
  kind: AskKind;
  asker: 'SHIPPER' | 'CARRIER';
  status: string;
  haulKind: string | null;
  /** Машина или водитель назначены. */
  assigned: boolean;
  delivered: boolean;
  /** Первая погрузка. */
  pickup: AutoStop | null;
  lastDone: AutoStop | null;
  next: AutoStop | null;
  /** Оценка прибытия к следующей точке — та же, что на странице отслеживания. */
  eta: { at: string; late: boolean } | null;
};

export type AutoLabels = {
  delivered: string;
  loaded: string;
  notLoaded: string;
  lastDone: string;
  onSite: string;
  next: string;
  planned: string;
  eta: string;
  late: string;
  notStarted: string;
  started: string;
  assigned: string;
  notAssigned: string;
  pickupPlanned: string;
  notified: string;
  askDriver: string;
};

export type AutoContext = {
  /** Название точки: погрузка, выгрузка… */
  stop: (role: string) => string;
  /** Время события точки (ISO) в её поясе. */
  at: (iso: string, country: string | null) => string;
  /** Плановое время точки: местные дата и время. */
  planned: (date: string, time: string | null, country: string | null) => string;
};

/** Есть ли что сказать, кроме плана: рейс идёт, пройдено, оценка. */
export function hasLiveData(facts: AutoFacts): boolean {
  return Boolean(facts.delivered || facts.lastDone || facts.next?.arrivedAt || facts.eta);
}

const fill = (template: string, values: Record<string, string>) =>
  template.replace(/\{(\w+)\}/g, (all, key: string) => values[key] ?? all);

/** Текст автоответа. Строки — по одной на факт. */
export function composeAutoAnswer(facts: AutoFacts, L: AutoLabels, ctx: AutoContext): string {
  const lines: string[] = [];
  const place = (s: AutoStop) => `${ctx.stop(s.role)}, ${s.city}`;
  const plannedOf = (s: AutoStop) => (s.date ? ctx.planned(s.date, s.time, s.country) : null);

  /* «Погружено?» — первым делом ответ на сам вопрос. */
  if (facts.kind === 'LOADED' && !facts.delivered) {
    const loaded = facts.pickup?.completedAt ? facts.pickup : null;
    lines.push(
      loaded
        ? fill(L.loaded, { at: ctx.at(loaded.completedAt as string, loaded.country), city: loaded.city })
        : L.notLoaded,
    );
  }

  if (facts.delivered) {
    const done = facts.lastDone;
    if (done?.completedAt) lines.push(fill(L.delivered, { at: ctx.at(done.completedAt, done.country), city: done.city }));
    return lines.join('\n');
  }

  if (!hasLiveData(facts)) {
    lines.push(L.notStarted);
    lines.push(facts.assigned ? L.assigned : L.notAssigned);
    const pickup = facts.pickup;
    const plan = pickup ? plannedOf(pickup) : null;
    if (pickup && plan) lines.push(fill(L.pickupPlanned, { at: plan, city: pickup.city }));
    lines.push(facts.asker === 'SHIPPER' ? L.notified : L.askDriver);
    return lines.join('\n');
  }

  const last = facts.lastDone;
  if (last?.completedAt) {
    /* На «Погружено?» погрузку уже назвали — не повторять. */
    const said = facts.kind === 'LOADED' && last.completedAt === facts.pickup?.completedAt;
    if (!said) lines.push(fill(L.lastDone, { stop: place(last), at: ctx.at(last.completedAt, last.country) }));
  } else if (facts.kind !== 'LOADED') {
    lines.push(L.started);
  }

  const next = facts.next;
  if (next?.arrivedAt) {
    lines.push(fill(L.onSite, { stop: place(next), at: ctx.at(next.arrivedAt, next.country) }));
  } else if (next) {
    lines.push(fill(L.next, { stop: place(next) }));
    const plan = plannedOf(next);
    if (plan) lines.push(fill(L.planned, { at: plan }));
    if (facts.eta) {
      lines.push(fill(L.eta, { at: ctx.at(facts.eta.at, next.country) }));
      if (facts.eta.late) lines.push(L.late);
    }
  }

  return lines.join('\n');
}

/** Местные дата и время момента в поясе: { date: '2026-11-06', time: '14:05' }. */
export function localParts(iso: string, timeZone: string): { date: string; time: string } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(new Date(iso))
      .map((p) => [p.type, p.value]),
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}

/** Допуск к плановому времени: позже — «опаздывает». */
export const LATE_GRACE_MIN = 30;

const minutesOf = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

/**
 * Оценка позже плана? Сравнение в местном времени точки: план записан
 * местным. Без планового часа — опоздание, только если оценка на
 * следующий день или позже.
 */
export function isLate(
  eta: { date: string; time: string },
  scheduled: { date: string | null; time: string | null },
  graceMin: number = LATE_GRACE_MIN,
): boolean {
  if (!scheduled.date) return false;
  if (eta.date !== scheduled.date) return eta.date > scheduled.date;
  if (!scheduled.time) return false;
  return minutesOf(eta.time) > minutesOf(scheduled.time) + graceMin;
}

/*
 * Свободный текст, похожий на «где машина?» — по словам на языках
 * кабинета. Финские слова — с окончаниями (missäs, saapuuko).
 */
const WHERE_RE = /(?<!\p{L})(missä\p{L}*|where|var|где|gdzie|wo|kus|kur)(?!\p{L})/iu;
const WHEN_RE = /(?<!\p{L})(milloin\p{L}*|saapu\p{L}*|when|eta|när|когда|kiedy|wann|millal|kad|kada)(?!\p{L})/iu;

/** Похоже ли сообщение на вопрос о машине: WHERE, WHEN или null. */
export function detectAsk(text: string): AskKind | null {
  if (WHERE_RE.test(text)) return 'WHERE';
  if (WHEN_RE.test(text)) return 'WHEN';
  return null;
}
