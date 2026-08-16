/**
 * Русский словарь — эталон структуры.
 *
 * Тип `Dictionary` выводится именно отсюда, поэтому этот файл задаёт набор
 * ключей для всех остальных языков. Добавили ключ здесь — TypeScript
 * потребует его во всех прочих словарях.
 *
 * Два раздела:
 *
 *   • всё, кроме `msg` — простые подписи без подстановок;
 *   • `msg` — сообщения в синтаксисе ICU MessageFormat: подстановки,
 *     множественное число, форматирование чисел по локали.
 *
 * Правила, обязательные для всех языков:
 *
 *   1. Никаких склеек в коде. «Осталось » + n + « мин» — это три разных
 *      предложения в трёх языках; собирать строку из кусков нельзя.
 *   2. Подстановки только именованные: {company}, {ref}. Позиционные
 *      не позволяют переводчику поменять порядок слов.
 *   3. Множественное число только через plural. У русского четыре формы
 *      (one/few/many/other), у финского две, у арабского шесть — окончания
 *      в коде не хардкодятся никогда.
 *   4. Даты, суммы и числа не пишутся в словарь готовыми строками. Либо
 *      Intl-форматтеры из lib/format.ts, либо ICU-скелеты вроде
 *      {value, number, ::percent} прямо в сообщении.
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
    description: 'Цифровая биржа грузоперевозок. Оператор — Aivomaa Oy, Финляндия.',
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
    details: 'Подробнее',
    collapse: 'Свернуть',
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
    closeTrip: 'Закрыть рейс',
    submitApplication: 'Отправить заявку',
    addVehicle: 'Добавить машину',
  },

  /** Подписи для программ чтения с экрана — их тоже переводят. */
  a11y: {
    close: 'Закрыть',
    openMenu: 'Открыть меню',
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
    commentPlaceholder: 'Пропуск в порт, пломба, температурный режим…',
    changelog: 'Изменения после старта',
    changelogFromShipper: 'Изменения от заказчика',
    offers: 'Отклики',
    noDamage: 'Без повреждений',
    damage: 'Повреждения',
    damagePlaceholder: 'Скол на левом борту прицепа',
    documents: 'Документы',
    trips: 'Рейсов',
    cargoAndPayment: 'Груз и оплата',
    closeTitle: 'Закрытие рейса',
  },

  moderation: {
    queue: 'Очередь модерации',
    applications: 'Заявки на регистрацию',
    vehicles: 'Машины на допуск',
  },

  report: {
    weeklyPayouts: 'Еженедельные выплаты перевозчикам',
    dailyInvoices: 'Ежедневная сводка по заказчикам',
    byMachine: 'Разрез по машинам',
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
    emailHint: 'Сюда придут коды доступа',
    license: 'Лицензия перевозчика',
    insurance: 'Страховка (CMR/ответственность)',
  },

  doc: {
    uploaded: 'загружено',
    missing: 'не загружено',
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
  },

  rating: {
    none: 'нет оценок',
    rate: 'Оценить перевозчика',
  },

  countdown: {
    expired: 'время вышло',
    /** Первый кадр до гидратации: время клиента ещё неизвестно. */
    unknown: '—:—',
  },

  empty: {
    noOrders: 'Нет заказов в этом регионе.',
    noOrdersHint: 'Смените регион в фильтре или подождите новых публикаций.',
    noApplications: 'Новых заявок нет.',
    noVehicles: 'Машин на проверке нет.',
    noTrips: 'За эту неделю рейсов нет.',
    noMessages: 'Пока нет сообщений от водителя.',
    noAccessTitle: 'Нет допуска к заказам',
    noAccessText:
      'Чтобы видеть стол и откликаться, нужна хотя бы одна допущенная машина.',
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

  /**
   * Сообщения ICU MessageFormat.
   *
   * У русского четыре формы множественного числа: one (1, 21, 31…),
   * few (2–4, 22–24…), many (0, 5–20, 25–30…) и other (дробные: 1,5 рейса).
   * У финского их две, у английского две, у польского четыре с другими
   * границами. Правила берёт на себя Intl.PluralRules — здесь только формы.
   *
   * Символ # внутри plural подставляет само число, отформатированное
   * по локали: 1 234 для русского, 1 234 для финского, 1,234 для английского.
   *
   * Ключи плоские с точками — так их понимают системы перевода
   * (Crowdin, Lokalise, POEditor) при импорте и экспорте.
   */
  msg: {
    'order.offersCounter':
      '{count, plural, one {# отклик} few {# отклика} many {# откликов} other {# отклика}} из {max} — выберите машину',
    'order.offersFull': 'Мест нет {count} из {max}',
    'order.distance': '{km, number} км',
    'order.ratePerKm': '{rate}/км',
    'order.tripsCount':
      '{count, plural, one {# рейс} few {# рейса} many {# рейсов} other {# рейса}}',

    'vehicle.axlesCount':
      '{count, plural, one {# ось} few {# оси} many {# осей} other {# оси}}',
    'vehicle.accessGranted': 'Машина {plate} допущена к заказам.',

    'moderation.queued':
      '{count, plural, one {# заявка} few {# заявки} many {# заявок} other {# заявки}} в очереди',

    'rating.summary': 'Рейтинг {value} из 5',
    'rating.summaryWithCount':
      'Рейтинг {value} из 5, {count, plural, one {# оценка} few {# оценки} many {# оценок} other {# оценки}}',
    'rating.setValue': 'Поставить оценку {stars} из 5',

    'countdown.left': '{time} до отката',

    'money.commissionRate': 'Комиссия {rate, number, ::percent}',
    'money.marginRate': 'Маржа · {rate, number, ::percent}',

    'report.weekTotal': 'Итого за неделю: {amount}',

    'signup.submitted':
      'Aivomaa проверит {company} (Y-tunnus {businessId}) по реестру и вышлет коды доступа на {email}.',

    'trip.stepReported': 'Заказ {ref}: водитель отметил «{step}».',
    'trip.amended': 'Изменение маршрута по заказу {ref}: {change}',
  },
} as const;
