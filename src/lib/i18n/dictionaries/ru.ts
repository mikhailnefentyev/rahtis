/**
 * Русский словарь — эталон структуры.
 *
 * Тип `Dictionary` выводится именно отсюда, поэтому этот файл задаёт набор
 * ключей для всех остальных языков. Добавили ключ здесь — TypeScript
 * потребует его во всех прочих словарях.
 *
 * Ключи статусов совпадают со значениями enum'ов в Postgres: в БД статусы
 * английские, человеческие подписи живут только тут.
 */
export const ru = {
  meta: {
    /** Название языка на нём самом — для переключателя языков. */
    label: 'Русский',
    /** Тег для Intl: форматирование дат, чисел и валюты. */
    intl: 'ru-RU',
    /** Значение атрибута lang у <html>. */
    htmlLang: 'ru',
  },

  brand: {
    name: 'RAHTIS',
    tagline: 'Freight Desk · Suomi',
    operator: 'Aivomaa Oy',
  },

  role: {
    carrier: 'Перевозчик',
    shipper: 'Заказчик',
    admin: 'Админ · Aivomaa',
  },

  nav: {
    desk: 'Стол заказов',
    fleet: 'Мой автопарк',
    orders: 'Мои заказы',
    report: 'Отчёт за неделю',
    moderation: 'Модерация',
    dispatch: 'Диспетчер · WhatsApp',
    invoices: 'Счета заказчикам',
    payouts: 'Выплаты перевозчикам',
    signOut: 'Выйти',
  },

  action: {
    save: 'Сохранить',
    cancel: 'Отмена',
    close: 'Закрыть',
    confirm: 'Подтвердить',
    decline: 'Отказаться',
    publish: 'Опубликовать',
    take: 'Беру',
    choose: 'Выбрать',
    approve: 'Одобрить',
    reject: 'Отклонить',
    add: 'Добавить',
    remove: 'Удалить',
    upload: 'Загрузить',
    export: 'Выгрузить',
    retry: 'Повторить',
  },

  /** Статусы заказа (ТЗ §6). Значения совпадают с enum order_status. */
  orderStatus: {
    OPEN: 'На столе',
    REQUESTED: 'Есть отклики',
    AWAIT_DRIVER: 'Ждём водителя',
    IN_PROGRESS: 'В работе',
    DONE: 'Выполнен',
    CANCELLED: 'Отменён',
  },

  /** Этапы прохождения рейса (ТЗ §7). Приходят от водителя через WhatsApp. */
  tripStep: {
    ACCEPTED: 'Принял',
    TRAILER_PICKED: 'Забрал прицеп',
    LOADED: 'Загрузился',
    EN_ROUTE: 'В пути',
    UNLOADED: 'Выгрузился',
    HANDED_OVER: 'Сдал',
  },

  /** Статус компании в онбординге (ТЗ §3). */
  companyStatus: {
    PENDING: 'На проверке',
    APPROVED: 'Одобрена',
    ACTIVE: 'Активна',
    REJECTED: 'Отклонена',
  },

  /** Допуск машины к заказам (ТЗ §3). */
  vehicleAccess: {
    DRAFT: 'Черновик',
    PENDING: 'На проверке',
    APPROVED: 'Допущена',
    REJECTED: 'Не допущена',
  },

  /** Тип заказа. Этап 1 продукта — тягачи и перецеп полуприцепов (ТЗ §13). */
  orderType: {
    TRAILER_SWAP: 'Перецеп полуприцепа',
    ROUND_TRIP: 'Кругорейс',
    ONE_WAY: 'Груз в один конец',
  },

  /** Тип места забора (ТЗ §5). */
  placeKind: {
    PORT: 'Порт',
    TERMINAL: 'Терминал',
    PARKING: 'Парковка',
    ADDRESS: 'Адрес',
  },

  /** Точки маршрута — единый список стопов вместо разрозненных полей. */
  stopKind: {
    PICKUP: 'Забор',
    DELIVERY: 'Выгрузка',
    EXTRA_LOAD: 'Доп. загрузка',
    EXTRA_UNLOAD: 'Доп. выгрузка',
    CONTINUATION: 'Продолжение рейса',
    TRAILER_RETURN: 'Возврат прицепа',
  },

  order: {
    ref: 'Номер заказа',
    trailer: 'Прицеп',
    distance: 'Пробег',
    rate: 'Ставка',
    ratePerKm: 'Ставка за километр',
    comment: 'Комментарий к заказу',
    changelog: 'Изменения после старта',
    changelogFromShipper: 'Изменения от заказчика',
    offers: 'Отклики',
    offersFull: 'Мест нет',
    timeLeft: 'до отката',
    noDamage: 'Без повреждений',
    damage: 'Повреждения',
    documents: 'Документы',
  },

  vehicle: {
    plate: 'Госномер',
    driver: 'Водитель',
    languages: 'Языки',
    whatsapp: 'WhatsApp / телефон',
    axles: 'Осей тягача',
    make: 'Марка / модель',
    euro: 'Эко-класс',
    base: 'База (город)',
    rating: 'Рейтинг',
  },

  company: {
    name: 'Название компании',
    businessId: 'Y-tunnus (бизнес-ID)',
    email: 'Email',
    license: 'Лицензия перевозчика',
    insurance: 'Страховка (CMR/ответственность)',
  },

  money: {
    gross: 'Валовая ставка',
    commission: 'Комиссия',
    payout: 'К выплате',
    revenue: 'Выручка · счета',
    margin: 'Маржа',
    total: 'Итого',
  },

  unit: {
    km: 'км',
    perKm: '/км',
    axles: 'оси',
    trips: 'рейсов',
  },

  rating: {
    none: 'нет оценок',
    rate: 'Оценить перевозчика',
  },

  empty: {
    noOrders: 'Нет заказов в этом регионе.',
    noApplications: 'Новых заявок нет.',
    noVehicles: 'Машин на проверке нет.',
    noTrips: 'За эту неделю рейсов нет.',
    noMessages: 'Пока нет сообщений от водителя.',
  },

  validation: {
    required: 'Заполните это поле',
    businessId: 'Формат: 7 цифр, дефис, контрольная цифра',
    email: 'Введите корректный email',
    positiveNumber: 'Введите число больше нуля',
  },

  error: {
    generic: 'Что-то пошло не так. Попробуйте ещё раз.',
    notFound: 'Страница не найдена',
    forbidden: 'Нет доступа к этому разделу',
  },
} as const;
