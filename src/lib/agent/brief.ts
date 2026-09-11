import type { Database } from '@/types/database';

type Audience = Database['public']['Enums']['chat_audience'];

/**
 * Наставление агенту и список его инструментов.
 *
 * Раньше и то и другое жило в узле n8n, на JavaScript внутри поля JSON.
 * Это выяснилось дорогой ценой: аудиторию ADMIN добавили в базу и в
 * файл воркфлоу, а в работающем n8n осталась прежняя ветка — и помощник
 * ответил оператору «платформа открывает мне только данные вашей
 * компании». Правда была в двух местах, и одно из них обновляется руками.
 *
 * Теперь правда одна и едет вместе с кодом. Воркфлоу берёт готовые
 * system и tools из тела запроса и ничего про роли не знает: его дело —
 * подпись, вызов модели и цикл инструментов.
 *
 * Пометки server-only здесь нет намеренно: в модуле нет ни ключей, ни
 * обращений к базе — только статический текст. Зато его можно прочитать
 * глазами скриптом scripts/print-agent-brief.mts, а наставление, которое
 * нельзя прочитать, тем и опасно: именно так оператору и досталось «ты
 * видишь только свою компанию».
 *
 * Тексты по-русски намеренно. Это наставление модели, а не интерфейс:
 * язык ответа задаётся отдельной строкой и берётся от собеседника, а
 * переводить инструкцию на два языка значит завести два её экземпляра,
 * которые разойдутся.
 */

export type ToolSpec = {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
};

const ref = { type: 'string', description: 'Номер заказа, например RS-2026-0043' };

export function agentTools(audience: Audience): ToolSpec[] {
  const carrier = audience === 'CARRIER' || audience === 'DRIVER';
  const driver = audience === 'DRIVER';
  const admin = audience === 'ADMIN';

  const tools: ToolSpec[] = [
    {
      name: 'order_by_ref',
      description: admin
        ? 'Карточка любого заказа платформы по номеру: статус, единица и её размер, пробег, ставка, даты, обе стороны сделки.'
        : 'Карточка заказа по его номеру: статус, единица и её размер, пробег, ставка, даты. Только заказы своей компании.',
      input_schema: { type: 'object', properties: { ref }, required: ['ref'] },
    },
    {
      name: 'trip_status',
      description: 'Где рейс сейчас: пройденные точки, текущий этап, следующая точка.',
      input_schema: { type: 'object', properties: { ref }, required: ['ref'] },
    },
    {
      name: 'trip_documents',
      description:
        'Документы, приложенные к рейсу: рахтикирья, фото загрузки и выгрузки, повреждения.',
      input_schema: { type: 'object', properties: { ref }, required: ['ref'] },
    },
    {
      name: 'legal_clause',
      description:
        'Точный текст пункта условий использования или политики приватности по его номеру.',
      input_schema: {
        type: 'object',
        properties: {
          number: { type: 'string', description: 'Номер пункта, например 6.2' },
          kind: { type: 'string', enum: ['TERMS', 'PRIVACY'], description: 'Какой документ' },
          locale: { type: 'string', enum: ['fi', 'en'] },
        },
        required: ['number'],
      },
    },
    {
      name: 'place_guide',
      description:
        'Площадка из справочника: адрес ворот и координаты. Часов работы и порядка въезда в справочнике НЕТ — не додумывай их, отправь к оператору.',
      input_schema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Название порта или терминала; понимает и русское написание',
          },
          locale: { type: 'string', enum: ['fi', 'en'], description: 'Язык подсказки, по умолчанию fi' },
        },
        required: ['query'],
      },
    },
  ];

  /*
   * Деньги водителю не показываются, и инструмента у него нет вовсе.
   * Показать инструмент, который откажет, значит пообещать ответ и
   * выдать отказ — модель всё равно попробует.
   */
  if (!driver) {
    tools.push(
      {
        name: 'company_money',
        description: admin
          ? 'Недельные суммы всей платформы: оборот, комиссия оператора и выплаты перевозчикам.'
          : carrier
            ? 'Недельные суммы своей компании: выплаты за рейсы.'
            : 'Недельные суммы своей компании: суммы к оплате за выполненные заказы.',
        input_schema: {
          type: 'object',
          properties: {
            weeks: { type: 'integer', description: 'За сколько последних недель, по умолчанию 4' },
          },
          required: [],
        },
      },
      {
        name: 'payout_schedule',
        description: admin
          ? 'Расчётные периоды всей платформы: суммы, срок счёта заказчику (invoice_due) и день выплаты перевозчику (payout_due).'
          : carrier
            ? 'Когда придут деньги: расчётные периоды по половине месяца, суммы и день выплаты (payout_due) — конец периода плюс 30 дней.'
            : 'Когда платить: расчётные периоды по половине месяца, суммы и срок оплаты (invoice_due) — конец периода плюс 15 дней. День выплаты перевозчику тебе не показывается.',
        input_schema: {
          type: 'object',
          properties: {
            periods: { type: 'integer', description: 'За сколько последних периодов, по умолчанию 6' },
          },
          required: [],
        },
      },
    );
  }

  if (admin) {
    tools.push({
      name: 'sql',
      description:
        'Свободный запрос SELECT по базе платформы, когда остальных инструментов не хватает. '
        + 'Таблицы: companies, profiles, orders, order_stops, order_offers, order_documents, '
        + 'order_amendments, vehicles, company_documents, ratings, notifications, email_outbox, '
        + 'weekly_reports, support_messages, incidents, conversations, messages, legal_documents, '
        + 'legal_clauses, place_guides. Только чтение, одна инструкция, до 1000 строк. '
        + 'Суммы везде в центах. Пиши обычный SQL: from orders, а не from public.orders.',
      input_schema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Запрос, начинающийся с select или with' },
          limit: { type: 'integer', description: 'Сколько строк вернуть, по умолчанию 200' },
        },
        required: ['query'],
      },
    });
  }

  return tools;
}

export function agentSystemPrompt(input: {
  audience: Audience;
  companyName: string | null;
}): string {
  const { audience, companyName } = input;
  const carrier = audience === 'CARRIER' || audience === 'DRIVER';
  const driver = audience === 'DRIVER';
  const admin = audience === 'ADMIN';

  const lines: string[] = [];

  lines.push(
    admin
      ? 'Ты — помощник оператора платформы RAHTIS (Aivomaa Oy). Собеседник ведёт платформу, а не возит и не заказывает.'
      : driver
        ? 'Ты — помощник платформы RAHTIS для водителя грузовика.'
        : carrier
          ? 'Ты — помощник платформы RAHTIS для транспортной компании (перевозчика).'
          : 'Ты — помощник платформы RAHTIS для заказчика: экспедитора или логистического оператора.',
  );

  lines.push(
    admin
      ? 'Компании у него нет: оператор посредник, а не сторона сделки.'
      : `Компания пользователя: ${companyName || 'не указана'}.`,
    '',
  );

  if (admin) {
    lines.push(
      'Тебе доступна вся платформа: любой заказ, обе стороны сделки, деньги в целом. Это его работа.',
      'Комиссия оператора — его выручка. Оборот, комиссия и выплаты перевозчикам это три разных числа, не путай их.',
      'Не хватило готового инструмента — бери sql и спрашивай базу напрямую. Сначала посмотри, что в таблице есть, потом считай.',
      'Суммы в базе в центах: дели на 100, прежде чем называть евро.',
    );
  } else {
    lines.push(
      'Ты видишь ТОЛЬКО данные этой компании. Инструменты сами ограничивают выдачу её тредом —',
      'чужие заказы и чужие компании тебе недоступны, и упоминать их нельзя.',
    );
    if (driver) {
      lines.push(
        'Деньги — дело компании, а не водителя: ставок, выплат и сроков оплаты ты не показываешь.',
      );
    }
  }

  lines.push(
    '',
    'Не выдумывай суммы, даты, статусы и номера. Нужен факт — возьми его инструментом.',
    'Инструмента не хватило или данных нет — так и скажи и предложи написать оператору.',
    '',
    'Отвечай коротко и по делу. Язык ответа — тот же, на котором написал собеседник.',
  );

  return lines.join('\n');
}
