/**
 * Документы экспедитора до работы (11.11.2026).
 *
 * Экспедитор, которого реестр не подтвердил автоматически (не финский
 * или не найден PRH), после одобрения входит и смотрит всё, но
 * публикует, назначает и принимает перевозки только когда оператор
 * принял выписку из реестра и полис экспедитора. Правило и запрет —
 * в базе (миграция forwarder_docs_gate: app.forwarder_docs_required,
 * app.forwarder_docs_ok, триггер orders_zz_forwarder_docs_guard); здесь
 * только то, чем интерфейс объясняет её ответ.
 *
 * Без импортов из приложения: модуль читают сервер, клиент и тесты.
 */

/** Свой код базы: «нужны документы экспедитора» (app.assert_forwarder_docs). */
export const DOCS_GATE_CODE = '55018';

/** Ответ API (по-английски, как остальные ответы /api/v1). */
export const DOCS_GATE_API_MESSAGE =
  "Publishing orders and giving transports become available once RAHTIS has checked the company documents (trade register extract and freight forwarder's liability insurance). Upload them in the RAHTIS cabinet, page Your details.";

export function isDocsGateError(error: { code?: string | null } | null | undefined): boolean {
  return error?.code === DOCS_GATE_CODE;
}

/** Состояние одного документа (app.forwarder_doc_state). */
export const DOC_STATES = ['OK', 'PENDING', 'REJECTED', 'EXPIRED', 'MISSING'] as const;
export type DocState = (typeof DOC_STATES)[number];

/** Итог для оператора: kunnossa / tarkastettavana / puuttuvat. */
export const GATE_OVERALLS = ['OK', 'REVIEW', 'MISSING'] as const;
export type GateOverall = (typeof GATE_OVERALLS)[number];

export const GATE_DOC_KINDS = ['REGISTER_EXTRACT', 'FORWARDER_INSURANCE'] as const;
export type GateDocKind = (typeof GATE_DOC_KINDS)[number];

export type DocsGate = {
  /** Документы нужны этой компании. */
  required: boolean;
  /** Публикация и назначение открыты (не нужны или приняты). */
  ok: boolean;
  registerExtract: DocState;
  insurance: DocState;
  overall: GateOverall;
};

/** Открыто: так же, как без правила вовсе. */
export const GATE_OPEN: DocsGate = {
  required: false,
  ok: true,
  registerExtract: 'OK',
  insurance: 'OK',
  overall: 'OK',
};

const asState = (value: unknown): DocState =>
  (DOC_STATES as readonly unknown[]).includes(value) ? (value as DocState) : 'MISSING';

const asOverall = (value: unknown): GateOverall =>
  (GATE_OVERALLS as readonly unknown[]).includes(value) ? (value as GateOverall) : 'MISSING';

/**
 * Строка public.forwarder_docs_status → состояние. Нет строки (до
 * миграции, нет компании) — открыто: запрет всё равно в базе, а пустой
 * ответ не должен гасить кнопки всем.
 */
export function gateFromRow(
  row: { required?: boolean | null; ok?: boolean | null; register_extract?: string | null; insurance?: string | null; overall?: string | null } | null | undefined,
): DocsGate {
  if (!row) return GATE_OPEN;
  const required = row.required === true;
  return {
    required,
    ok: !required || row.ok === true,
    registerExtract: asState(row.register_extract),
    insurance: asState(row.insurance),
    overall: required ? asOverall(row.overall) : 'OK',
  };
}

/** Закрыта ли новая работа. */
export function gateBlocked(gate: DocsGate): boolean {
  return gate.required && !gate.ok;
}

/** Какие документы ещё не приняты — для плашки «чего не хватает». */
export function pendingKinds(gate: DocsGate): { kind: GateDocKind; state: DocState }[] {
  if (!gate.required) return [];
  return [
    { kind: 'REGISTER_EXTRACT' as const, state: gate.registerExtract },
    { kind: 'FORWARDER_INSURANCE' as const, state: gate.insurance },
  ].filter((d) => d.state !== 'OK');
}
