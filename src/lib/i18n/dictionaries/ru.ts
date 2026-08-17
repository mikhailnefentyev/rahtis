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

  /* Ключи совпадают со значениями enum party_role в Postgres. */
  role: {
    CARRIER: 'Перевозчик',
    SHIPPER: 'Заказчик',
    ADMIN: 'Админ · Aivomaa',
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

  auth: {
    signInTitle: 'Вход в кабинет',
    signInSubtitle:
      'Открытой регистрации нет. Доступ выдаёт Aivomaa после проверки компании.',
    email: 'Email',
    password: 'Пароль',
    submit: 'Войти',
    submitting: 'Входим…',
    signOut: 'Выйти',
    fillBoth: 'Введите почту и пароль',
    invalidCredentials: 'Неверная почта или пароль',
    noApplicationYet: 'Ещё не подавали заявку?',
    applyLink: 'Подать заявку на регистрацию',

    noAccessTitle: 'Кабинет недоступен',
    noProfileText:
      'Учётная запись есть, но она не привязана ни к одной компании. Так бывает, если пользователя завели вручную. Обратитесь в Aivomaa — вам выдадут доступ.',
    rejectedText:
      'Заявка вашей компании отклонена. Свяжитесь с Aivomaa, чтобы узнать причину и подать её заново.',
  },

  cabinet: {
    company: 'Компания',
    status: 'Статус',
    businessId: 'Y-tunnus',
    yourRole: 'Ваша роль',
    stageNotice:
      'Раздел появится на следующих этапах. Сейчас работают вход, роли и разграничение доступа.',
    approvedCarrierHint:
      'Компания одобрена. Чтобы видеть стол заказов, загрузите документы и добавьте карточки авто — Aivomaa выдаст допуск по каждой машине.',
    approvedShipperHint:
      'Компания одобрена. Заполните реквизиты, чтобы публиковать заказы.',
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
    approveAndInvite: 'Одобрить · выслать приглашение',
    rejectWithReason: 'Отклонить',
    reasonLabel: 'Причина отказа',
    reasonPlaceholder: 'Y-tunnus не найден в реестре PRH',
    vehicleReasonPlaceholder: 'Страховка не покрывает международные перевозки',
    reasonRequired: 'Укажите причину — компания её увидит',
    inviteSent: 'Приглашение отправлено',
    inviteFailed: 'Компания одобрена, но письмо не ушло',
    resendInvite: 'Отправить приглашение повторно',
    accessGranted: 'Доступ выдан',
    noUsersYet: 'Приглашение не отправлено',
    recent: 'Рассмотренные заявки',
    decidedAt: 'Решение',
  },

  apply: {
    title: 'Заявка на регистрацию',
    subtitle:
      'Открытой регистрации нет. Aivomaa проверяет каждую компанию по реестру и высылает доступ на указанную почту.',
    iAmCarrier: 'Я перевозчик',
    iAmShipper: 'Я заказчик',
    submit: 'Отправить заявку в Aivomaa',
    submitting: 'Отправляем…',
    carrierNote:
      'После одобрения: вход в кабинет → лицензия и страховка → карточки авто. Допуск выдаётся по каждой машине отдельно.',
    shipperNote: 'После одобрения: вход в кабинет → реквизиты → публикация заказов.',
    sentTitle: 'Заявка отправлена',
    duplicate: 'Заявка от компании с таким Y-tunnus уже подана или одобрена.',
    failed: 'Не удалось отправить заявку. Попробуйте ещё раз.',
  },

  requisites: {
    title: 'Реквизиты компании',
    subtitleShipper:
      'Нужны, чтобы выставлять вам счета. После сохранения компания станет активной.',
    subtitleCarrier:
      'Нужны, чтобы платить вам за рейсы. После сохранения компания станет активной.',

    legalSection: 'Юридические данные',
    legalName: 'Юридическое название',
    legalNameHint: 'Как в реестре — если отличается от названия на площадке',
    street: 'Улица и дом',
    postalCode: 'Индекс',
    city: 'Город',
    country: 'Страна',
    vat: 'ALV-номер (НДС)',
    vatHint: 'Выведен из Y-tunnus — исправьте, если у компании номер группы',
    vatInvalid: 'Формат: код страны и от двух до двенадцати знаков, например FI12345678',

    billingSection: 'Счета',
    billingSameAsLegal: 'Адрес для счетов совпадает с юридическим',
    billingEmail: 'Email бухгалтерии',
    billingEmailHint: 'Сюда будут приходить счета',
    billingReference: 'Референс для счетов',
    billingReferenceHint: 'Номер заказа или центр затрат, который печатать на счёте',

    einvoiceSection: 'Электронные счета',
    einvoiceOptional: 'Необязательно. Заполните, если принимаете счета через оператора.',
    ovt: 'OVT-tunnus / EDI-код',
    ovtHint: 'Обычно 0037 и Y-tunnus без дефиса',
    ovtInvalid: 'От 8 до 17 букв и цифр',
    operator: 'Оператор (välittäjä)',
    operatorHint: 'Код посредника: Maventa, Basware, Apix и другие',
    operatorInvalid: 'От 4 до 20 знаков',

    payoutSection: 'Выплаты',
    iban: 'IBAN',
    ibanHint: 'Счёт, на который приходят выплаты за рейсы',
    ibanInvalid: 'IBAN не проходит проверку контрольной суммы — проверьте цифры',
    bic: 'BIC / SWIFT',
    bicHint: 'Для финских счетов не нужен, для иностранных пригодится',
    bicInvalid: 'Формат: 8 или 11 знаков, например NDEAFIHH',

    save: 'Сохранить и активировать',
    saving: 'Сохраняем…',
    saved: 'Реквизиты сохранены, компания активна',
    incomplete: 'Заполнены не все обязательные поля',
    failed: 'Не удалось сохранить реквизиты. Попробуйте ещё раз.',
    alreadyActive: 'Компания уже активна. Реквизиты можно изменить в любой момент.',
    fillToActivate: 'Заполните реквизиты, чтобы активировать компанию',
    openForm: 'Заполнить реквизиты',
  },

  invite: {
    title: 'Задайте пароль',
    subtitle: 'Приглашение принято. Придумайте пароль для входа в кабинет.',
    password: 'Новый пароль',
    repeat: 'Повторите пароль',
    submit: 'Сохранить и войти',
    tooShort: 'Пароль должен быть не короче 8 символов',
    mismatch: 'Пароли не совпадают',
    linkExpired: 'Ссылка недействительна или устарела. Запросите новое приглашение у Aivomaa.',
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

  fleet: {
    title: 'Мой автопарк',
    subtitle:
      'Стол заказов открывается, когда у компании есть хотя бы одна допущенная машина и действующие документы.',
    addVehicle: 'Добавить машину',
    newVehicle: 'Новая карточка',
    editVehicle: 'Карточка машины',
    submitForApproval: 'Отправить на допуск',
    deleteDraft: 'Удалить черновик',
    noVehicles: 'Машин пока нет',
    noVehiclesHint: 'Добавьте карточку авто — Aivomaa проверит её и выдаст допуск.',
    onReview: 'Aivomaa проверяет документы и карточку',
    rejectedHint: 'Не допущена — исправьте замечание и отправьте снова',
    canTakeOrders: 'Компания может брать заказы',
    cannotTakeOrders: 'Стол заказов закрыт',
    whyClosedNoDocs: 'Загрузите действующие лицензию и страховку компании.',
    whyClosedNoVehicle: 'Нужна хотя бы одна допущенная машина.',
    whyClosedExpired: 'Документы компании просрочены — допуск машин не действует.',
    languagesHint: 'На каких языках водитель говорит с диспетчером',
  },

  documents: {
    title: 'Документы компании',
    subtitle: 'Лицензия и страховка проверяются оператором вместе с карточками авто.',
    CARRIER_LICENSE: 'Лицензия перевозчика',
    INSURANCE: 'Страховка (CMR/ответственность)',
    upload: 'Загрузить',
    replace: 'Заменить',
    uploading: 'Загружаем…',
    view: 'Открыть',
    file: 'Файл',
    validUntil: 'Действует до',
    validUntilRequired: 'Для страховки срок обязателен',
    perpetual: 'бессрочно',
    expired: 'просрочен',
    notUploaded: 'не загружен',
    tooLarge: 'Файл больше 10 МБ',
    wrongType: 'Допустимы PDF, JPG, PNG и WEBP',
    uploadFailed: 'Не удалось загрузить файл. Попробуйте ещё раз.',
    replacedNotice: 'Прежняя версия сохраняется как основание выданных допусков.',
    attention: 'Требуют внимания',
    attentionHint:
      'У этих компаний есть допущенные машины, а документы просрочены или скоро истекут.',
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
      'Aivomaa проверит {company} (Y-tunnus {businessId}) по реестру и вышлет доступ на {email}.',
    'moderation.pendingCount':
      '{count, plural, =0 {Новых заявок нет} one {# заявка ждёт решения} few {# заявки ждут решения} many {# заявок ждут решения} other {# заявки ждут решения}}',
    'moderation.invitedTo': 'Приглашение отправлено на {email}',
    'moderation.decidedBy': 'Решение принято {date}',

    'fleet.vehiclesCount':
      '{count, plural, =0 {Машин нет} one {# машина} few {# машины} many {# машин} other {# машины}}',
    'fleet.approvedCount':
      '{count, plural, =0 {нет допущенных} one {# допущена} few {# допущены} many {# допущено} other {# допущено}}',
    'fleet.pendingCount':
      '{count, plural, =0 {Машин на проверке нет} one {# машина на проверке} few {# машины на проверке} many {# машин на проверке} other {# машины на проверке}}',

    'documents.expiresIn':
      'Истекает через {count, plural, one {# день} few {# дня} many {# дней} other {# дня}}',
    'documents.expiredAgo':
      'Просрочен {count, plural, one {# день} few {# дня} many {# дней} other {# дня}} назад',
    'documents.validUntilDate': 'Действует до {date}',

    'trip.stepReported': 'Заказ {ref}: водитель отметил «{step}».',
    'trip.amended': 'Изменение маршрута по заказу {ref}: {change}',
  },
} as const;
