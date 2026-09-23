import type { Database, Tables } from './database';

/**
 * Короткие имена для типов схемы.
 *
 * database.ts генерируется и перезаписывается целиком — руками его не
 * правят. Всё, что удобно писать коротко, живёт здесь.
 */

export type PartyRole = Database['public']['Enums']['party_role'];
export type CompanyStatus = Database['public']['Enums']['company_status'];
export type VehicleAccess = Database['public']['Enums']['vehicle_access'];
export type EuroClass = Database['public']['Enums']['euro_class'];
export type VehicleClass = Database['public']['Enums']['vehicle_class'];
export type DocumentKind = Database['public']['Enums']['document_kind'];

export type Company = Tables<'companies'>;
export type Profile = Tables<'profiles'>;
export type CompanyEvent = Tables<'company_events'>;
export type Vehicle = Tables<'vehicles'>;
export type CompanyDocument = Tables<'company_documents'>;

export type OrderType = Database['public']['Enums']['order_type'];
export type OrderStatus = Database['public']['Enums']['order_status'];
export type StopRole = Database['public']['Enums']['stop_role'];
export type PlaceKind = Database['public']['Enums']['place_kind'];

export type Order = Tables<'orders'>;

/** Документ рейса: CMR, фото загрузки, выгрузки, повреждения (ТЗ §9). */
export type TripDocument = Tables<'order_documents'>;
export type TripDocumentKind = Database['public']['Enums']['trip_document_kind'];

/**
 * Выполненный рейс глазами спрашивающего (ТЗ §11).
 *
 * Комиссия и выплата приходят пустыми заказчику, имя перевозчика — всем,
 * кроме оператора. Решает это функция completed_orders одним местом, а
 * тип лишь отражает, что колонка может не прийти.
 */
export type CompletedOrder =
  Database['public']['Functions']['completed_orders']['Returns'][number];

/** Итого за неделю: счёт заказчику, выплата перевозчику, маржа оператора. */
export type WeeklyTotal = Database['public']['Functions']['weekly_totals']['Returns'][number];

/** Оценка перевозчика за рейс, 1–5 (ТЗ §10). */
export type OrderRating = Tables<'order_ratings'>;

/** Средняя оценка компании и число оценок. */
export type CarrierRating = Database['public']['Functions']['carrier_rating']['Returns'][number];

/** Сводка оператора: кому выставлять счёт и кому платить. */
export type PartnerTotal = Database['public']['Functions']['partner_totals']['Returns'][number];

/** Правка маршрута в идущем рейсе (ТЗ §8). */
export type OrderAmendment = Tables<'order_amendments'>;
export type AmendmentKind = Database['public']['Enums']['amendment_kind'];

/**
 * Пара «было → стало» из журнала правок.
 *
 * Значения разнотипны — строка адреса, дата, вес в килограммах, признак
 * пломбы, — потому что это поля точки, а не однородный список. Разбирает
 * их тот, кто знает поле по имени: компонент журнала.
 */
export type AmendmentChange = { from: unknown; to: unknown };

/**
 * Заказ глазами заказчика.
 *
 * Колонки назначения (assigned_company_id, assigned_vehicle_id,
 * chosen_offer_id) сюда не входят: грант их заказчику не отдаёт, потому
 * что его контрагент — Aivomaa, а не перевозчик (ТЗ §1). Тип это
 * отражает, чтобы попытка прочитать исполнителя из заказа не собралась.
 *
 * commission_bps и closed_at не входят по той же причине: комиссия — это
 * доля оператора в расчётах с перевозчиком, и заказчику она не видна ни
 * грантом, ни типом. Отчёты Этапа 7 читают их функциями с security
 * definer, где состав колонок записан явно.
 *
 * Состояние расчётов тоже не входит. Заказчик узнаёт о выставленном
 * счёте уведомлением, а суммы смотрит в «Valmiit kuljetukset» — список
 * своих заказов для этого не место, там про рейсы, а не про деньги.
 */
export type ShipperOrder = Omit<
  Order,
  'assigned_company_id' | 'assigned_vehicle_id' | 'assigned_driver_id' | 'chosen_offer_id' | 'shipper_company_id' | 'shipper_company_kind' | 'updated_at' | 'created_by' | 'route_computed_at' | 'route_fingerprint' | 'commission_bps' | 'shipper_fee_bps' | 'contract_party' | 'closed_at' | 'billing' | 'invoice_ref' | 'invoiced_at' | 'paid_at' | 'settled_at' | 'terms_document_id'
>;
export type OrderStop = Tables<'order_stops'>;

/* ── Водители ───────────────────────────────────────────────────── */

export type Driver = Tables<'drivers'>;
export type DriverShift = Tables<'driver_shifts'>;
export type DriverBreak = Tables<'driver_breaks'>;
export type TesRuleSet = Tables<'tes_rule_sets'>;
export type DriverPayProfile = Tables<'driver_pay_profiles'>;
export type PayModel = Database['public']['Enums']['pay_model'];

/** Закрытый рейс водителя за период — public.driver_trips. */
export type DriverTrip = Database['public']['Functions']['driver_trips']['Returns'][number];

/* ── Знакомые машины и прямое назначение ────────────────────────── */

export type LinkStatus = Database['public']['Enums']['link_status'];

/** Заказчик, с которым перевозчик возил, и согласие на прямые заказы. */
export type CarrierPartner = Database['public']['Functions']['carrier_partners']['Returns'][number];

/** Знакомая машина заказчика: без названия перевозчика и телефона водителя. */
export type KnownVehicle =
  Database['public']['Functions']['known_vehicles_for_shipper']['Returns'][number];

/** Что возвращает public.company_readiness — гейт стола заказов. */
export type CompanyReadiness = Database['public']['Functions']['company_readiness']['Returns'][number];

/** Строка стола: заказ с маршрутом, но без контактов получателя. */
export type DeskOrder = Database['public']['Functions']['desk_orders']['Returns'][number];

/**
 * Отклик глазами заказчика: машина, компания и рейтинг, без телефона
 * водителя (ТЗ §14).
 *
 * Поле rating переопределено на nullable. Генератор типов выводит его из
 * сигнатуры функции как numeric и о null не знает, а оценок в системе
 * пока нет вовсе — они появятся на Этапе 7. Без переопределения код
 * считал бы, что рейтинг есть всегда.
 */
export type ShipperOffer = Omit<
  Database['public']['Functions']['offers_for_shipper']['Returns'][number],
  'rating' | 'plate' | 'driver_name'
> & {
  rating: number | null;
  /* Появляются только у назначенной машины — до выбора это опознавательный признак. */
  plate: string | null;
  driver_name: string | null;
};

/**
 * Точка маршрута в том виде, в каком её отдаёт стол.
 *
 * Это не OrderStop: contact_name и contact_phone функция desk_orders не
 * возвращает вовсе, и тип обязан это отражать — иначе компонент напишет
 * stop.contact_phone, получит undefined и никто не заметит.
 */
export type DeskStop = {
  id: string;
  sequence: number;
  role: StopRole;
  place_kind: PlaceKind | null;
  place_name: string | null;
  company_name: string | null;
  address: string;
  city: string;
  scheduled_date: string | null;
  scheduled_time: string | null;
  external_ref: string | null;
  trailer_loaded: boolean | null;
  note: string | null;
  /*
   * Бронь, вес и пломба нужны перевозчику до взятия заказа: по ним он
   * решает, пройдёт ли машина по массе и успеет ли к окну на терминале.
   * Получателя (consignee) здесь нет — третье лицо, как и контакты.
   */
  cargo_weight_kg: number | null;
  seal_required: boolean | null;
  /* Координаты нужны, чтобы поставить точку на карту. */
  lat: number | null;
  lon: number | null;
  leg_distance_m: number | null;
};

/** Языки водителя. Набор совпадает с ограничением vehicles_languages_known. */
export const DRIVER_LANGUAGES = [
  'FI',
  'SV',
  'EN',
  'RU',
  'ET',
  'NO',
  'DA',
  'DE',
  'PL',
  'LT',
  'LV',
] as const;

/** Роли, у которых есть компания. У ADMIN её нет. */
export type CompanyRole = Exclude<PartyRole, 'ADMIN'>;

/* ── Claims: претензии и отклонения по рейсу ───────────────────── */

export type ClaimKind = Database['public']['Enums']['claim_kind'];
export type ClaimStatus = Database['public']['Enums']['claim_status'];
export type ClaimEventKind = Database['public']['Enums']['claim_event_kind'];
export type TripPhase = Database['public']['Enums']['trip_phase'];

/** Строка списка claims: имена сторон уже обрезаны по роли в my_claims. */
export type ClaimListItem = Database['public']['Functions']['my_claims']['Returns'][number];

/**
 * Карточка claim из claim_detail.
 *
 * Функция отдаёт jsonb, и генератор типов видит в нём только Json.
 * Форма записана здесь рядом с функцией, которая её собирает; поля,
 * которые роли знать не положено, приходят null — как в completed_orders.
 */
export type ClaimDetail = {
  viewer: PartyRole;
  /** Где идёт разговор: CABINET у подавшего и оператора, EMAIL у второй стороны. */
  channel: 'CABINET' | 'EMAIL';
  claim: {
    id: string;
    ref: string;
    kind: ClaimKind;
    status: ClaimStatus;
    filed_by_role: PartyRole;
    mine: boolean;
    stop_id: string | null;
    description: string;
    amount_cents: number | null;
    resolution: string | null;
    resolved_at: string | null;
    created_at: string;
    updated_at: string;
    mirrored_at: string | null;
    /** Только оператору. */
    mirrored_to: string | null;
  };
  order: {
    id: string;
    ref: string;
    shipper_ref: string | null;
    status: OrderStatus;
    order_type: OrderType;
    haul_kind: Database['public']['Enums']['haul_kind'];
    container_feet: number | null;
    trailer: string | null;
    trailer_plate: string | null;
    distance_km: number | null;
    rate_cents: number | null;
    closed_at: string | null;
    vehicle_plate: string | null;
    shipper_name: string | null;
    carrier_name: string | null;
    route_geometry: string | null;
    route_bounds: number[] | null;
    stops: OrderStop[] | null;
  };
  documents: Array<
    Pick<
      TripDocument,
      | 'id'
      | 'kind'
      | 'file_name'
      | 'storage_path'
      | 'mime_type'
      | 'size_bytes'
      | 'stop_id'
      | 'source'
      | 'phase'
      | 'subject'
      | 'captured_at'
      | 'created_at'
    >
  >;
  attachments: Array<{
    id: string;
    file_name: string;
    storage_path: string;
    mime_type: string;
    size_bytes: number;
    author_role: PartyRole;
    created_at: string;
  }>;
  events: Array<{
    id: number;
    kind: ClaimEventKind;
    author_role: PartyRole;
    body: string | null;
    status_from: ClaimStatus | null;
    status_to: ClaimStatus | null;
    attachment_id: string | null;
    created_at: string;
  }>;
};

/* ── Отчёт за период ──────────────────────────────────────────── */

export type PeriodReportRow = Database['public']['Functions']['period_report']['Returns'][number];
export type PeriodClaim = Database['public']['Functions']['period_claims']['Returns'][number];
