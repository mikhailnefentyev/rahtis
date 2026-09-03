import type { Dictionary } from './index';

/**
 * English dictionary.
 *
 * The shape comes from the Finnish one; the wording does not. Finnish
 * compounds — kuormatarjonta, tyhjäajo, tilitys — have no single English
 * word, and translating them literally produces phrases nobody in the
 * trade uses. They are rendered as what a British or Baltic dispatcher
 * would actually say: load board, empty running, payout.
 *
 * Two terms stay Finnish because they are legal identifiers, not words:
 * Y-tunnus (the business ID as printed in the register) and ALV (the tax
 * as it appears on a Finnish invoice). Rahtikirja is glossed once and
 * then called a CMR note, which is what the paper is called abroad.
 *
 * Plurals: English has two forms, one and other — the same as Finnish.
 */
export const en = {
  meta: {
    label: 'English',
    intl: 'en-GB',
    htmlLang: 'en',
  },

  brand: {
    name: 'RAHTIS',
    tagline: 'Freight platform · Finland',
    operator: 'RAHTIS',
    /* Юрлицо. Только там, где его требует закон: договоры, счета, отчёты. */
    legalEntity: 'Aivomaa Oy',
    description: 'Digital freight platform in Finland.',
  },

  role: {
    CARRIER: 'Carrier',
    SHIPPER: 'Shipper',
    ADMIN: 'Admin · RAHTIS',
  },

  nav: {
    overview: 'Overview',
    desk: 'Load board',
    fleet: 'Fleet',
    orders: 'My orders',
    report: 'Weekly report',
    moderation: 'Review',
    dispatch: 'Dispatch · WhatsApp',
    invoices: 'Invoicing',
    payouts: 'Payouts',
    signOut: 'Sign out',
  },

  action: {
    save: 'Save',
    cancel: 'Cancel',
    close: 'Close',
    confirm: 'Confirm',
    decline: 'Decline',
    details: 'Details',
    collapse: 'Collapse',
    publish: 'Publish',
    take: 'Take this job',
    choose: 'Select',
    approve: 'Approve',
    reject: 'Reject',
    add: 'Add',
    remove: 'Remove',
    upload: 'Upload',
    export: 'Export',
    retry: 'Try again',
    closeTrip: 'Complete job',
    submitApplication: 'Send application',
    addVehicle: 'Add vehicle',
  },

  a11y: {
    close: 'Close',
    openMenu: 'Open menu',
  },

  auth: {
    signInTitle: 'Sign in',
    signInSubtitle: 'There is no open sign-up. RAHTIS issues credentials after a check.',
    email: 'Email',
    password: 'Password',
    submit: 'Sign in',
    submitting: 'Signing in…',
    signOut: 'Sign out',
    fillBoth: 'Enter your email and password',
    serviceDown: 'The service is not responding right now. Try again shortly — your password is fine.',
    invalidCredentials: 'That email and password do not match',
    noApplicationYet: 'Not applied yet?',
    applyLink: 'Send an application',

    noAccessTitle: 'Your account is not available',
    noProfileText:
      'The account exists but is not linked to a company. Contact RAHTIS support and we will open access.',
    frozenTitle: 'Access is frozen',
    frozenText:
      'This company’s access has been frozen. Its data and transport history are kept. Contact RAHTIS support and we will sort it out.',
    rejectedText:
      'Your company’s application was rejected. Contact RAHTIS support — we will tell you why, and you can apply again.',
  },

  cabinet: {
    company: 'Company',
    status: 'Status',
    businessId: 'Y-tunnus',
    yourRole: 'Your role',
    approvedCarrierHint:
      'Your company is approved. Upload your operating licence and insurance and add your vehicles, and the load board opens. Every vehicle is approved separately.',
    approvedShipperHint:
      'Your company is approved. Complete the company details and you can publish orders.',
  },

  orderStatus: {
    DRAFT: 'Draft',
    OPEN: 'Available',
    REQUESTED: 'Offers in',
    AWAIT_DRIVER: 'Awaiting driver',
    IN_PROGRESS: 'On the road',
    DONE: 'Completed',
    CANCELLED: 'Cancelled',
  },

  tripStage: {
    accepted: 'Took the job',
    trailerPicked: 'Picked up the trailer',
    loaded: 'Loaded',
    unloaded: 'Unloaded',
    enRoute: 'En route',
    handedOver: 'Returned the trailer',
  },

  trip: {
    progress: 'Job progress',
    markDone: 'Mark as done',
    marking: 'Marking…',
    undo: 'Undo',
    damageQuestion: 'Damage at this stop',
    damagePlaceholder: 'Dent on the left side of the trailer, curtain torn…',
    noDamage: 'No damage',
    damageFound: 'Damage',
    passed: 'Done',
    nextStop: 'Next stop',
    allDone: 'All stops done',
    failed: 'That did not go through. Refresh the page and try again.',
    outOfOrder: 'Stops are marked in order. Mark the earlier ones first.',
    notYours: 'Only the carrier running the job can mark stops.',

    closing: 'Completing the job',
    closingHint: 'Attach the CMR note and photos. The shipper gets them straight away.',
    close: 'Complete job',
    closing_: 'Completing…',
    closed: 'Job completed',
    documents: 'Job documents',
    noDocuments: 'No documents yet',
    cmrRequired: 'A job cannot be completed without the CMR note',
    addFile: 'Add file',
    uploading: 'Uploading…',
  },

  amend: {
    title: 'Route change',
    hint: 'Change stops that have not been reached yet. The carrier sees it immediately.',
    edit: 'Change',
    insertBefore: 'Add a stop before this one',
    insertLoad: 'Loading',
    insertUnload: 'Unloading',
    remove: 'Remove stop',
    removing: 'Removing…',
    save: 'Save change',
    saving: 'Saving…',
    add: 'Add stop',
    adding: 'Adding…',
    passed: 'This stop has been reached and cannot be changed',
    ends: 'The pickup and the return cannot be removed',
    rateUnchanged: 'This change does not affect distance or price. Those are agreed separately.',
    none: 'The route has not been changed',
    empty: 'not given',
    acknowledge: 'Acknowledge',
    acknowledged: 'Acknowledged',
    failed: 'The change did not go through. Refresh the page and try again.',
    notYours: 'Only the shipper who placed the order can change the route.',
  },

  landing: {
    menuService: 'Service',
    menuRoles: 'Who it is for',
    menuSteps: 'How it works',
    menuAssistant: 'Assistant',
    menuSignIn: 'Sign in',
    eyebrow: 'Freight platform in Finland',
    titleA: 'Trucks keep rolling.',
    titleB: 'Freight leaves on time.',
    titleC: 'The phone stops ringing.',
    lede:
      'Once an order is published, it goes automatically to approved carriers in the area. Offers can arrive within minutes. The job’s progress is visible step by step, and at the end every document sits in one place.',
    lede2: 'RAHTIS makes sure the process runs from start to finish.',
    asShipper: 'I need freight moved',
    asCarrier: 'I run a fleet',
    signIn: 'Sign in',
    apply: 'Send an application',
    moderationNote:
      'You cannot sign up directly. We check every company against the PRH and YTJ registers before approval.',
    fleetLabel: 'approved vehicles',
    regionsLabel: 'operating areas',
    fleetLive: 'The figures update as new approvals come through.',
    regions: 'Operating areas',
    cabinet: 'My account',

    cycle1: 'Available',
    cycle1Note: 'Published and sent to carriers in the area',
    cycle2: 'Offers 2 / 3',
    cycle2Note: 'The shipper chooses on price and ratings',
    cycle3: 'On the road · trailer picked up',
    cycle3Note: 'The driver marks the stops in order',
    cycle4: 'Completed · CMR note attached',
    cycle4Note: 'Documents with the shipper, payout in the weekly report',

    helpEyebrow: 'What RAHTIS does',
    helpTitle: 'We keep freight moving and trucks working',
    helpLede:
      'RAHTIS does not replace your forwarder, your dispatcher or your carrier. It takes out the searching, the phone calls, explaining the same job over and over, and documents scattered across inboxes.',
    helpCargo: 'For the shipper',
    helpCargoTitle: 'Orders move quickly',
    helpCargoText:
      'Publish the job once. It goes straight to approved carriers in the area, and the offers come back to the same screen.',
    helpTruck: 'For the carrier',
    helpTruckTitle: 'Less empty running',
    helpTruckText:
      'The open jobs in your area are in one place. When one job ends, you can look for the next one in the same area.',
    helpDriver: 'For the driver',
    helpDriverTitle: 'Everything about the job in one place',
    helpDriverText:
      'Addresses, contacts, bookings and site instructions travel with the job. If the driver needs help, it is there on WhatsApp.',

    timeEyebrow: 'Standing still costs both sides',
    timeTitle: 'In logistics, time is what you pay for',
    timeLede:
      'While a shipper rings round for a free truck, the freight waits. While a carrier rings round for the next load, the truck stands. Both are losing the same thing: time.',
    timeOld: 'How it usually works now',
    timeOld1: 'The shipper calls several carriers and explains the same job to each one.',
    timeOld2: 'The carrier calls round for the next job so the truck does not run empty.',
    timeOld3: 'What was agreed lives in phone calls and messages.',
    timeOld4: 'The driver has to ask separately for addresses, contacts and terminal rules.',
    timeOld5: 'CMR notes and other paperwork arrive days after the job.',
    timeOld6: 'Invoicing and payouts get sorted out afterwards across different channels.',
    timeNew: 'How RAHTIS works',
    timeNew1: 'The order is published once and goes automatically to carriers in the right area.',
    timeNew2: 'Approved carriers see the open jobs in the same view.',
    timeNew3: 'Price, schedule, route and equipment are known before the job is accepted.',
    timeNew4: 'The driver gets addresses, contacts, bookings and site instructions with the job.',
    timeNew5: 'Documents are attached to the job the moment it is completed.',
    timeNew6: 'Completed jobs and payouts appear in the weekly report.',

    rolesEyebrow: 'Who RAHTIS is for',
    rolesTitle: 'One platform for both sides of a job',
    shipperEyebrow: 'For the shipper',
    shipperTitle: 'You do not have to find a carrier one call at a time.',
    shipper1: 'Publish the order once and it goes to approved carriers in the area.',
    shipper2: 'You get up to three offers in the same view.',
    shipper3: 'You pick the carrier on price, equipment and ratings.',
    shipper4:
      'If the route, the schedule or anything else changes mid-job, the update goes straight to the carrier and the driver.',
    shipper5: 'Documents are available the moment the job is completed.',
    shipper6: 'The weekly report shows jobs, amounts, documents and feedback.',
    carrierEyebrow: 'For the carrier',
    carrierTitle: 'Keep the truck working between jobs too.',
    carrier1: 'The open jobs in your area are all in one place.',
    carrier2: 'You do not have to ring round for the next job.',
    carrier3: 'You can find a return load in the area where the last job ends.',
    carrier4: 'Every vehicle is approved onto the platform separately.',
    carrier5: 'Price, service fee and your share are visible before you accept.',
    carrier6: 'The weekly report shows jobs driven, earnings and payouts due.',

    stepsEyebrow: 'How a job runs',
    stepsTitle: 'From application to completed job in four steps',
    step1: 'Company check',
    step1Text:
      'We check the Y-tunnus and the company details against the registers. For carriers we also check the operating licence and insurance.',
    step2: 'Vehicle approval',
    step2Text:
      'Every vehicle is approved separately. Open jobs are only visible to approved equipment.',
    step3: 'The job, step by step',
    step3Text:
      'Pickup, loading and unloading points appear in the right order. The status updates at the same moment for the shipper, the carrier and the driver.',
    step4: 'Documents',
    step4Text:
      'A job is not marked complete until the required documents are attached. The CMR note and photos reach the shipper as the job closes.',

    faultsEyebrow: 'When the plan changes',
    faultsTitle: 'Things go wrong in logistics. That is why they have a procedure too.',
    faultsLede:
      'If the schedule moves, a driver drops out or damage turns up at pickup, the news does not depend on a phone call or a single message. The event is recorded on the job and everyone involved sees it.',
    fault1: 'The driver does not confirm within 15 minutes',
    fault1Text:
      'The job goes back on the board automatically and out to the next suitable trucks. It does not sit waiting for a confirmation that never comes.',
    fault2: 'The port moved the slot or the warehouse closed',
    fault2Text:
      'The shipper updates the stop on the job itself. The change is recorded in the history and reaches the carrier and the driver immediately.',
    fault3: 'Damage found on the trailer at pickup',
    fault3Text:
      'The damage is recorded against that stop with a photo and a timestamp, so there is a clear record of what happened and when.',
    fault4: 'The job is cancelled before it starts',
    fault4Text:
      'A cancelled job returns to the board automatically and suitable carriers are notified.',

    aiEyebrow: 'Driver’s assistant',
    aiTitle: 'The driver always has someone to ask',
    aiLede:
      'The RAHTIS assistant works in WhatsApp, knows the details of that particular job, and answers the driver in the driver’s own language.',
    aiLede2:
      'It is not a menu bot or an autoresponder. The assistant uses the job’s own data and helps with the practical things that come up on the road.',
    aiOnline: 'WhatsApp · online',
    aiToday: 'Today',
    aiPlaceholder: 'Message',
    aiDriver: 'Driver',
    aiBot: 'RAHTIS',
    aiQ1: 'When is the Kotka gate open?',
    aiA1:
      'The Hietanen gate is open Mon–Fri 06:00–22:00 and Sat 08:00–16:00. Your unloading slot is at 07:00, so the gate will be open.',
    aiQ2: 'Where can I get more straps and corner protectors?',
    aiA2:
      'The nearest place on your route is in Kotka, about 4 km before the terminal. It is open until 18:00.',
    aiQ3: 'Can I still make Turku today?',
    aiA3:
      'By the hours you have logged, you have 3 h 20 min of driving time left and the leg takes about 2 h 40 min. On those figures you make it inside your driving time.',
    ai1: 'Knows the job',
    ai1Text:
      'Addresses, contacts, booking numbers, trailer details and everything else on the job are available to the assistant.',
    ai2: 'Looks things up when needed',
    ai2Text:
      'It can help with terminal opening hours, contact details, where to buy equipment and where to take a break.',
    ai3: 'Helps with driving time',
    ai3Text:
      'When the driving-time figures are available, it can work out whether the driver makes the next stop within the hours left.',
    ai4: 'Updates the job from a message',
    ai4Text:
      'The driver can simply write “unloaded” in WhatsApp, and the job status updates for the shipper and the carrier.',
    ai5: 'Hands over to a person when it should',
    ai5Text:
      'If the assistant cannot be sure of an answer, the question goes to RAHTIS dispatch.',
    ai6: 'Speaks the driver’s language',

    servicesEyebrow: 'The service grows in stages',
    servicesTitle: 'We start with trailer swaps and expand to other transport',
    serviceLive: 'Live',
    serviceSoon: 'Next',
    service1: 'Semi-trailer swaps',
    service1Text:
      'A tractor unit collects the trailer from a port or terminal, handles the agreed loading and unloading, and delivers the trailer to the next agreed place.',
    service1Text2: 'We start in Finland and expand into Scandinavia later.',
    service2: 'Transport on the carrier’s own equipment',
    service2Text:
      'The carrier runs the job with its own equipment: curtainsider, reefer, tipper or low-loader.',
    service2Text2:
      'The shipper states the cargo, weight, dimensions and any other requirements. RAHTIS finds a carrier that fits.',

    finalEyebrow: 'Getting started',
    finalTitle: 'Tell us about your company — we handle the rest',
    finalLede: 'We need the company name, the Y-tunnus and an email address.',
    finalLede2:
      'We check the company against the registers and issue credentials once it is approved.',
    finalLede3: 'From carriers we also need the operating licence and insurance details.',
    applyShipper: 'Shipper application',
    applyCarrier: 'Carrier application',
    footerCountry: 'Finland',
  },

  done: {
    titleCarrier: 'Jobs driven',
    titleShipper: 'Completed orders',
    titleAdmin: 'Invoicing and payouts',
    subtitleCarrier: 'Jobs driven during the week and the payouts due on them.',
    subtitleShipper: 'Jobs completed during the week and the amounts to be invoiced.',
    subtitleAdmin: 'Invoices to shippers, payouts to carriers.',
    vatNoteShipper: 'Amounts exclude VAT. Invoices add VAT at 25.5%.',
    vatNoteCarrier: 'Amounts exclude VAT. Payouts add VAT at 25.5%.',
    open: 'Open',
    collapse: 'Collapse',
    none: 'No jobs driven yet',
    noneHint: 'A completed job moves here with its documents and amounts.',
    rate: 'Price',
    commission: 'Service fee',
    payout: 'Payout',
    margin: 'Margin',
    clients: 'Shippers · invoicing',
    carriers: 'Carriers · payouts',
    company: 'Company',
    trips: 'Jobs',
    distance: 'Distance',
    noPartners: 'No jobs were completed in this period',
    allTime: 'All time',
  },

  amendKind: {
    STOP_ADDED: 'Stop added',
    STOP_CHANGED: 'Stop changed',
    STOP_REMOVED: 'Stop removed',
  },

  tripDocument: {
    CMR: 'CMR note / rahtikirja',
    LOADING_PHOTO: 'Loading photo',
    UNLOADING_PHOTO: 'Unloading photo',
    DAMAGE_PHOTO: 'Damage photo',
  },

  companyStatus: {
    PENDING: 'Under review',
    APPROVED: 'Approved',
    ACTIVE: 'Active',
    REJECTED: 'Rejected',
  },

  vehicleAccess: {
    DRAFT: 'Draft',
    PENDING: 'Under review',
    APPROVED: 'Approved',
    REJECTED: 'Not approved',
  },

  orderType: {
    TRAILER_SWAP: 'Semi-trailer transport',
    ROUND_TRIP: 'Round trip',
    ONE_WAY: 'One-way transport',
  },

  placeKind: {
    PORT: 'Port',
    TERMINAL: 'Terminal',
    PARKING: 'Parking area',
    ADDRESS: 'Address',
  },

  stopKind: {
    PICKUP: 'Trailer pickup',
    EXTRA_LOAD: 'Loading',
    EXTRA_UNLOAD: 'Unloading',
    TRAILER_RETURN: 'Trailer return',
    DELIVERY: 'Unloading',
    CONTINUATION: 'Onward transport',
  },

  order: {
    ref: 'Order number',
    trailer: 'Trailer',
    distance: 'Distance',
    rate: 'Price',
    ratePerKm: 'Price per km',
    comment: 'Notes for the order',
    commentPlaceholder: 'Port pass, seal, temperature…',
    changelog: 'Changes after departure',
    changelogFromShipper: 'Change from the shipper',
    offers: 'Offers',
    noDamage: 'No damage',
    damage: 'Damage',
    damagePlaceholder: 'Dent on the left side of the trailer',
    documents: 'Documents',
    trips: 'Jobs',
    cargoAndPayment: 'Cargo and price',
    closeTitle: 'Completing the job',

    consignee: 'Consignee',
    sealRequired: 'Seal',
  },

  orderForm: {
    title: 'New order',
    subtitle: 'Fill in the whole route and publish. Carriers see it immediately.',
    type: 'Type of transport',
    shipperRef: 'Your own order number',
    shipperRefHint: 'Optional. The platform assigns its own number automatically',

    trailerPickupSection: 'Where the trailer is collected',
    dropSection: 'Where the trailer is left',
    cargoSection: 'Cargo and price',

    placeName: 'Place name',
    address: 'Address',
    addressHint:
      'Street, number, postcode and town. Pick the address from the suggestions and the kilometres are calculated automatically',
    city: 'Town',
    date: 'Date',
    time: 'Time',
    company: 'Company',
    contact: 'Contact person',
    phone: 'Phone',

    remove: 'Remove',

    trailerState: 'Trailer',
    trailerLoaded: 'Loaded',
    trailerEmpty: 'Empty',
    addUnload: '+ Unloading',
    addLoad: '+ Loading',
    actionsSection: 'What happens on the way',
    actionsHint: 'Add as many loadings and unloadings as you need, in any order',
    noActions: 'Add at least one loading or unloading',

    bookingRef: 'Booking number',
    cargoWeight: 'Weight, t',
    cargoWeightHint: 'Up to 76 tonnes, the maximum for an HCT combination',
    consignee: 'Consignee',
    consigneeHint: 'Who receives the cargo from this stop',
    loadingRef: 'Loading reference',
    loadingRefHint: 'The shipper’s own number, if there is one',
    seal: 'Seal',
    sealUnknown: 'Not known',
    sealYes: 'Required',
    sealNo: 'Not required',
    stopNote: 'Instructions for this stop',
    stopNotePlaceholder: 'Booking number, gate pass, call an hour ahead…',

    trailer: 'Trailer type',
    trailerPlaceholder: 'Curtainsider 13.6, 3 axles',
    trailerPlate: 'Trailer registration',
    trailerPlateHint: 'This is how the driver finds the right trailer on the yard. Required.',
    distance: 'Distance, km',
    rate: 'Price, €',

    publish: 'Publish · goes to trucks in the area',
    publishing: 'Publishing…',
    published: 'Order published',
    needActive: 'Complete your company details first. Without them an order cannot be published.',
    failed: 'Publishing failed. Check the fields and try again.',
  },

  orders: {
    title: 'My orders',
    subtitle: 'Published orders and where they stand.',
    newOrder: 'New order',
    none: 'No orders yet',
    noneHint: 'Publish your first order and carriers will see it.',
    route: 'Route',
    shipperRefShort: 'Your number',
  },

  routing: {
    searching: 'searching…',
    approximate: 'estimate',
    weakMatch: 'The address matched loosely. Check the address and the kilometres.',
    unavailable: 'Route calculation is unavailable right now. Enter the distance by hand.',
    suggestFailed: 'No suggestions came back. Type the address in full.',
    routeFailed: 'The route could not be calculated. Enter the distance by hand.',
    needTwoPoints: 'At least two stops with coordinates are needed.',
    calculate: 'Calculate route',
    calculating: 'Calculating…',
    auto: 'calculated as a truck route',
    manual: 'entered by hand',
    recalculate: 'Recalculate',
    noCoordinates:
      'Pick the addresses from the suggestions and the kilometres are calculated automatically.',
    /*
     * The same rule stated twice: the form names the stops that are
     * missing, the server only refuses. The server text cannot list the
     * stops, because it should never be reached in the first place.
     */
    addressRequired:
      'Every address must be picked from the suggestions. Kilometres and price are calculated from the coordinates, and neither can be corrected once the order is published.',
    mapLabel: 'Route map',
  },

  matching: {
    take: 'Take this job',
    taking: 'Sending…',
    taken: 'Offer received',
    noSlots: 'Slots full',
    slots: 'Slots taken',
    chooseVehicle: 'Which vehicle will run it',
    waitingChoice: 'Waiting for the shipper to choose',
    offers: 'Offers',
    chooseCarrier: 'Select',
    choose: 'Select',
    awaitDriver: 'Waiting for the driver to confirm',
    confirm: 'Confirm',
    decline: 'Decline',
    cancel: 'Cancel',
    assignments: 'My jobs',
    noAssignments: 'No jobs',
    noAssignmentsHint: 'Take an order from the load board and it moves here.',
    chosenYou: 'The shipper picked you',
    chosenYouHint: 'Confirm within 15 minutes or the order goes back on the board.',
    inProgress: 'Job on the road',
    assignedCarrier: 'Run by',
    contactsNow: 'The consignee’s contact details are now visible.',
    failed: 'That did not go through. Refresh the page and try again.',
    tooLate: 'Time ran out and the order went back on the board.',
    noSlotsLeft: 'Slots are full — three trucks have already offered on this order.',
    alreadyTaken: 'You have already made an offer on this order.',
  },

  desk: {
    title: 'Load board',
    subtitle: 'Open orders in the areas where your trucks are.',
    allRegions: 'All areas',
    empty: 'No orders in this area',
    emptyHint: 'Change the area or wait for new orders.',
    closedTitle: 'The load board is not visible',
    closedNoVehicle:
      'Open jobs appear once your company has at least one approved vehicle and valid documents. Add a vehicle and we will check it.',
    closedExpired:
      'Open jobs appear once your company has at least one approved vehicle and valid documents. Upload a renewed operating licence or insurance.',
    openFleet: 'Fleet',
    contactsHidden: 'The consignee’s contact details appear once you take the order.',
    details: 'Job details',
  },

  billing: {
    title: 'Billing status',
    PENDING: 'Not invoiced',
    INVOICED: 'Invoiced',
    PAID: 'Paid',
    SETTLED: 'Settled',
    toInvoiced: 'Mark as invoiced',
    toPaid: 'Mark as paid',
    toSettled: 'Mark as settled',
    invoiceRef: 'Invoice number',
    invoiceRefPlaceholder: '2026-0142',
    onlyForward: 'Billing status only moves forward.',
    notDone: 'The transport is not finished yet.',
    done: 'Status updated',
  },

  support: {
    title: 'Ask the operator',
    hint: 'We answer on weekdays. Your message also appears on your own pages.',
    subject: 'Subject',
    subjectPlaceholder: 'Question about transport RS-2026-0041',
    body: 'Message',
    bodyPlaceholder: 'Tell us briefly what this is about.',
    submit: 'Send',
    sending: 'Sending…',
    sent: 'Message sent. We will reply to the address you gave.',
    failed: 'The message did not go through. Try again.',
    queue: 'Questions to the operator',
    queueEmpty: 'No open questions',
    markHandled: 'Mark as handled',
    handled: 'Handled',
    from: 'Sender',
  },

  adminMessage: {
    title: 'Send a notice to a company',
    hint: 'The notice appears on the company’s own pages. An email is sent as well.',
    company: 'Company',
    subject: 'Title',
    body: 'Message',
    submit: 'Send notice',
    sending: 'Sending…',
    sent: 'Notice sent',
    failed: 'The notice did not go through. Try again.',
  },

  notify: {
    title: 'Notifications',
    empty: 'No notifications',
    emptyHint: 'Updates on transports, invoicing and admin arrive here.',
    markAllRead: 'Mark all as read',
    unread: 'Unread',
    open: 'Open',
  },

  outbox: {
    title: 'Outgoing messages',
    subtitle: 'Every email the platform produces. Messages that never went out are logged too.',
    empty: 'No messages',
    to: 'Recipient',
    subject: 'Subject',
    template: 'Template',
    provider: 'Sender',
    status: 'Status',
    created: 'Created',
    body: 'Message body',
    stubNotice: 'Sending is off. Messages are logged but not delivered.',
    PENDING: 'Queued',
    SENT: 'Sent',
    FAILED: 'Failed',
    SKIPPED: 'Not sent',
  },

  chat: {
    title: 'Ask the assistant',
    hint: 'The assistant knows your transports, documents and contract terms.',
    placeholder: 'Type a question…',
    send: 'Send',
    sending: 'Sending…',
    thinking: 'The assistant is looking it up…',
    empty: 'No messages yet',
    emptyHint: 'Ask about a transport status or a clause of the contract.',
    failed: 'The message did not go through. Try again.',
    you: 'You',
    agent: 'Assistant',
    operator: 'Admin',
    offline: 'The assistant is not connected yet. Your message goes to the operator.',
  },

  legal: {
    TERMS: 'Terms of service',
    PRIVACY: 'Privacy notice',
    CARRIER_AGREEMENT: 'Carrier agreement',
    SHIPPER_AGREEMENT: 'Shipper agreement',

    missing: 'This document has not been published yet.',
    clauseLink: 'Copy a link to this clause',

    accept: 'I accept the terms of service and the privacy notice',
    acceptRequired: 'The terms must be accepted before going live.',

    manage: 'Documents and versions',
    newVersion: 'New version',
    activate: 'Publish',
    DRAFT: 'Draft',
    ACTIVE: 'In force',
    ARCHIVED: 'Archived',
    clauses: 'Clauses',
    noClauses: 'This version has no clauses and cannot be published.',
    acceptances: 'Acceptances',
    acceptedBy: 'Accepted by',
    noAcceptances: 'No acceptances',
  },

  moderation: {
    queue: 'Review queue',
    applications: 'Applications',
    vehicles: 'Vehicles for approval',
    approveAndInvite: 'Approve and send invite',
    rejectWithReason: 'Reject',
    reasonLabel: 'Reason for rejection',
    reasonPlaceholder: 'The Y-tunnus is not in the PRH register',
    vehicleReasonPlaceholder: 'The insurance does not cover international transport',
    reasonRequired: 'Write a reason. The company sees it as written',
    inviteSent: 'Invite sent',
    inviteFailed: 'The company was approved, but the message did not go out',
    resendInvite: 'Send the invite again',
    accessGranted: 'Credentials issued',
    noUsersYet: 'No invite sent',
    recent: 'Processed applications',
    decidedAt: 'Decision',
    freeze: 'Freeze',
    unfreeze: 'Restore access',
    frozen: 'Frozen',
    freezeReason: 'Reason for freezing',
    freezeReasonPlaceholder: 'Contract ended',
    freezeBlocked: 'This company has unfinished transports. Complete or cancel them first.',
    freezeHint: 'A frozen company cannot sign in or take work. Its data and history are kept.',
    remove: 'Delete company',
    removeConfirm: 'Delete this company permanently? This cannot be undone.',
    removeBlocked: 'This company cannot be deleted: it has transports. Transport history is never deleted.',
    removed: 'Company deleted',
    inviteNotSent: 'The invite could not be sent. Check the email settings and send it again.',
  },

  apply: {
    title: 'Application',
    subtitle:
      'There is no open sign-up. We check every company against the register and send the credentials to the address you give.',
    iAmCarrier: 'Carrier',
    iAmShipper: 'Shipper',
    submit: 'Send application',
    submitting: 'Sending…',
    carrierNote:
      'After approval: sign-in, licence and insurance, vehicle details. Every vehicle is approved separately.',
    shipperNote: 'After approval: sign-in, company details, publishing orders.',
    sentTitle: 'Application sent',
    duplicate: 'There is already an application for this Y-tunnus, pending or approved.',
    failed: 'Sending failed. Try again.',
  },

  requisites: {
    title: 'Company details',
    subtitleShipper: 'We need these for invoicing. Once saved, the company goes live.',
    subtitleCarrier: 'We need these for payouts. Once saved, the company goes live.',

    legalSection: 'Registered details',
    legalName: 'Registered name',
    legalNameHint: 'As in the register, if it differs from the name you trade under',
    street: 'Street address',
    postalCode: 'Postcode',
    city: 'Town',
    country: 'Country',
    vat: 'VAT number',
    vatHint: 'Derived from the Y-tunnus. Correct it if you use a VAT group number',
    vatInvalid: 'Format: country code plus 2–12 characters, for example FI12345678',

    billingSection: 'Invoicing',
    billingSameAsLegal: 'The invoicing address is the same as the registered one',
    billingEmail: 'Invoicing email',
    billingEmailHint: 'This is where we send invoices',
    billingReference: 'Invoice reference',
    billingReferenceHint: 'Order number or cost centre you want on the invoice',

    einvoiceSection: 'E-invoicing',
    einvoiceOptional: 'Optional. Fill this in if you receive e-invoices.',
    ovt: 'OVT identifier',
    ovtHint: 'Usually 0037 followed by the Y-tunnus without the hyphen',
    ovtInvalid: '8–17 letters or digits',
    operator: 'E-invoicing operator',
    operatorHint: 'For example Maventa, Basware or Apix',
    operatorInvalid: '4–20 characters',

    payoutSection: 'Payouts',
    bankSection: 'Bank details',
    iban: 'IBAN',
    ibanHint: 'The account we pay the jobs into',
    ibanHintShipper: 'The account we pay any refunds into',
    ibanInvalid: 'That IBAN does not pass the check. Check the digits.',
    bic: 'BIC / SWIFT',
    bicHint: 'Not needed for Finnish accounts',
    bicInvalid: 'Format: 8 or 11 characters, for example NDEAFIHH',

    save: 'Save and go live',
    saving: 'Saving…',
    saved: 'Details saved, the company is live',
    incomplete: 'Some required details are missing',
    failed: 'Saving failed. Try again.',
    alreadyActive: 'The company is already live. You can change these details at any time.',
    fillToActivate: 'Complete the company details and the company goes live',
    openForm: 'Complete the details',
    open: 'Company details',
  },

  recovery: {
    link: 'Forgot your password?',
    title: 'Password reset',
    subtitle: 'Enter your email address. We will send a link for setting a new password.',
    submit: 'Send link',
    sending: 'Sending…',
    sent:
      'If the address is registered, the link is on its way. Check your spam folder too — the link is valid for an hour.',
    badEmail: 'Check the email address',
    backToSignIn: 'Back to sign in',
  },

  account: {
    title: 'Your details',
    passwordTitle: 'Change password',
    passwordHint: 'The new password takes effect immediately. Remember it — we cannot see it or recover it.',
    current: 'Current password',
    newPassword: 'New password',
    repeat: 'Repeat the new password',
    submit: 'Change password',
    saving: 'Changing…',
    saved: 'Password changed',
    wrongCurrent: 'The current password does not match',
    sameAsOld: 'The new password is the same as the current one',
  },

  invite: {
    title: 'Set a password',
    subtitle: 'Your invite is accepted. Choose a password for signing in.',
    password: 'New password',
    repeat: 'Repeat the password',
    submit: 'Save and sign in',
    tooShort: 'The password needs at least 8 characters',
    mismatch: 'The passwords do not match',
    linkExpired: 'This link is invalid or has expired. Ask RAHTIS support for a new invite.',
  },

  report: {
    weeklyPayouts: 'Weekly payouts to carriers',
    dailyInvoices: 'Daily summary by shipper',
    byMachine: 'Breakdown by vehicle',
  },

  report_: {
    carrierTitle: 'Weekly report · jobs driven',
    shipperTitle: 'Weekly report · completed transports',
    adminTitle: 'Weekly report · invoicing and payouts',
    period: 'Week {week} · {from}–{to}',
    colRef: 'Number',
    colDate: 'Completed',
    colRoute: 'Route',
    colVehicle: 'Vehicle',
    colDistance: 'km',
    colGross: 'Price',
    colCommission: 'Service fee',
    colNetCarrier: 'Payout',
    colNetShipper: 'To invoice',
    colDocuments: 'Documents',
    total: 'Total',
    empty: 'No transports were completed this week.',
    closingNote:
      'A transport belongs to the week it finished in. One started on Friday and unloaded on Monday appears in the following week’s report.',
    page: 'Page',
    archive: 'Weekly reports',
    archiveEmpty: 'No reports yet',
    download: 'Download PDF',
    generate: 'Generate weekly reports',
    generating: 'Generating…',
    generated: 'Reports generated',
    generateFailed: 'The reports could not be generated.',
    emailSubject: 'RAHTIS · weekly report {week}',
  },

  vehicle: {
    plate: 'Registration',
    driver: 'Driver',
    languages: 'Languages',
    whatsapp: 'WhatsApp / phone',
    axles: 'Tractor axles',
    make: 'Make and model',
    euro: 'Emission class',
    base: 'Home base',
    rating: 'Rating',
    adr: 'ADR',
    adrHas: 'ADR permit',
    adrHint: 'Whether the vehicle and driver are cleared for dangerous goods',
    adrNo: 'No ADR permit',
    capacity: 'Payload',
    capacityHint: 'A two-axle tractor takes 25 t, a three-axle one 32 t.',
  },

  fleet: {
    title: 'Fleet',
    subtitle:
      'Open jobs appear once your company has at least one approved vehicle and valid documents.',
    addVehicle: 'Add vehicle',
    newVehicle: 'New vehicle',
    editVehicle: 'Vehicle details',
    submitForApproval: 'Send for approval',
    deleteDraft: 'Delete draft',
    noVehicles: 'No vehicles yet',
    noVehiclesHint: 'Add a vehicle and we will check it and grant approval.',
    onReview: 'We are checking the documents and the vehicle details',
    rejectedHint: 'Not approved. Fix what is noted and send it again.',
    canTakeOrders: 'You can take jobs',
    cannotTakeOrders: 'The load board is not visible',
    whyClosedNoDocs: 'Upload a valid licence and insurance.',
    whyClosedNoVehicle: 'At least one approved vehicle is needed.',
    whyClosedExpired: 'The documents have expired, so the approval is not valid.',
    languagesHint: 'Which languages the driver can work in',
    tooHeavy: 'This job is too heavy for the vehicle. Pick a three-axle tractor.',
  },

  documents: {
    title: 'Company documents',
    subtitle: 'We check the licence and the insurance together with the vehicles.',
    CARRIER_LICENSE: 'Operating licence',
    INSURANCE: 'Insurance (CMR / liability)',
    upload: 'Upload',
    replace: 'Replace',
    uploading: 'Uploading…',
    view: 'Open',
    file: 'File',
    validUntil: 'Valid',
    validUntilRequired: 'An expiry date is required for insurance',
    perpetual: 'indefinitely',
    expired: 'expired',
    notUploaded: 'not uploaded',
    tooLarge: 'The file is over 10 MB',
    wrongType: 'Allowed formats: PDF, JPG, PNG and WEBP',
    uploadFailed: 'The upload failed. Try again.',
    replacedNotice: 'The old version is kept, because earlier approvals rest on it.',
    attention: 'Needs attention',
    attentionHint:
      'These companies have approved vehicles, but their documents are expiring or have expired.',
  },

  company: {
    name: 'Company name',
    businessId: 'Y-tunnus',
    email: 'Email',
    emailHint: 'This is where we send the credentials',
    license: 'Operating licence',
    insurance: 'Insurance (CMR / liability)',
  },

  doc: {
    uploaded: 'uploaded',
    missing: 'not uploaded',
  },

  money: {
    addVat: '+ VAT 25.5%',
    calcNote: 'Amounts exclude VAT. Invoices and payouts add VAT at 25.5%.',

    gross: 'Gross price',
    commission: 'Service fee',
    payout: 'Payout',
    revenue: 'Invoiced',
    margin: 'Margin',
    total: 'Total',
  },

  pulse: {
    now: 'Right now',
    nowEmpty: 'No transports in progress',

    countOpen: 'Available',
    countOffers: 'Offers in',
    countAwaitDriver: 'Awaiting driver',
    countInProgress: 'On the road',
    earnings: 'Earnings by week',
    spend: 'Costs by week',
    vatFree: 'VAT 0%',
    empty: 'The chart appears once the first job is completed.',
  },

  unit: {
    km: 'km',
  },

  rating: {
    title: 'Rating',
    none: 'no ratings',
    rate: 'Rate the carrier',
    yours: 'Your rating',
    received: 'The shipper’s rating',
    addComment: 'Add a comment',
    editComment: 'Edit the comment',
    commentPlaceholder: 'Late for unloading, paperwork in order…',
    commentTitle: 'The shipper’s comment',
    save: 'Save',
    saving: 'Saving…',
    starFirst: 'Give the stars first',
    failed: 'The rating could not be saved. Refresh the page and try again.',
    company: 'Company rating',
  },

  countdown: {
    expired: 'time is up',
    unknown: '—:—',
  },

  empty: {
    noOrders: 'No orders in this area.',
    noOrdersHint: 'Change the area or wait for new orders.',
    noApplications: 'No new applications.',
    noVehicles: 'No vehicles under review.',
    noTrips: 'No jobs this week.',
    noMessages: 'No messages from the driver.',
    noAccessTitle: 'No access to orders',
    noAccessText: 'You need at least one approved vehicle.',
  },

  validation: {
    required: 'Fill in this field',
    businessId: 'Format: 7 digits, a hyphen and a check digit',
    email: 'Check the email address',
    positiveNumber: 'Enter a number greater than zero',
  },

  error: {
    generic: 'Something went wrong. Try again.',
    notFound: 'Page not found',
    forbidden: 'No access to this section',
    title: 'The page did not load',
    body: 'The page failed to load. Your data is safe — nothing was lost mid-action.',
    retry: 'Try again',
    home: 'Go to front page',
    reference: 'Error reference',
    referenceHint: 'Quote this reference if you contact support.',
  },

  /**
   * ICU MessageFormat messages. English has two plural forms, one and
   * other — the same two as Finnish, so the Finnish shapes carry over
   * directly.
   */
  msg: {
    'order.offersCounter': '{count, plural, one {# offer} other {# offers}} / {max} — pick a carrier',
    'order.offersFull': 'Slots full {count} / {max}',
    'order.distance': '{km, number} km',
    'order.ratePerKm': '{rate}/km',
    'order.tripsCount': '{count, plural, one {# job} other {# jobs}}',

    'vehicle.axlesCount': '{count, plural, one {# axle} other {# axles}}',
    'vehicle.accessGranted': 'Vehicle {plate} is approved.',

    'moderation.queued': '{count, plural, one {# application} other {# applications}} queued',

    'rating.summary': 'Rating {value}',
    'rating.summaryWithCount':
      'Rating {value} · {count, plural, one {# rating} other {# ratings}}',
    'rating.ratingsCount': '{count, plural, one {# rating} other {# ratings}}',
    'rating.setValue': 'Give {stars} out of 5',

    'countdown.left': '{time} left',

    'money.withVat': 'Incl. VAT {amount}',
    'money.commissionRate': 'Service fee {rate, number, ::percent}',
    'money.marginRate': 'Margin · {rate, number, ::percent}',

    'report.weekTotal': 'Week total {amount}',

    'signup.submitted':
      'We will check {company} (Y-tunnus {businessId}) against the register and send the credentials to {email}.',
    'moderation.pendingCount':
      '{count, plural, =0 {No new applications} one {# application waiting} other {# applications waiting}}',
    'moderation.invitedTo': 'Invite sent to {email}',
    'moderation.decidedBy': 'Decided {date}',

    'fleet.vehiclesCount': '{count, plural, =0 {No vehicles} one {# vehicle} other {# vehicles}}',
    'fleet.approvedCount':
      '{count, plural, =0 {none approved} one {# approved} other {# approved}}',
    'fleet.pendingCount':
      '{count, plural, =0 {No vehicles under review} one {# vehicle under review} other {# vehicles under review}}',

    'documents.expiresIn': 'Expires in {count, plural, one {# day} other {# days}}',
    'documents.expiredAgo': 'Expired {count, plural, one {# day} other {# days}} ago',
    'documents.validUntilDate': 'Valid until {date}',

    'desk.ordersCount': '{count, plural, =0 {No orders} one {# order} other {# orders}}',
    'desk.regionCount': '{city} · {count}',

    'routing.result': '{km, number} km · about {hours} h {minutes} min',
    'routing.pickFromList': 'Pick the address from the suggestions: {stops}',
    'order.routeRecomputed': 'Route changed — {km, number} km calculated',
    'routing.legDistance': 'leg {km, number} km',

    'stop.weight': '{tonnes, number, ::.0#} t',
    'stop.consignee': '{label}: {name}',

    'order.stopsCount': '{count, plural, one {# stop} other {# stops}} on the route',
    'order.publishedAt': 'Published {date}',
    'matching.slotsTaken': '{count} / {max}',
    'matching.variant': 'Option {no}',
    'matching.basedIn': 'Based in {city}',
    'matching.offersCount':
      '{count, plural, =0 {No offers} one {# offer} other {# offers}} / {max}',

    'trip.stageAt': '{stage} · {place}',
    'trip.progressCount': 'Done {done} / {total}',
    'trip.enRouteTo': 'En route · {place}',
    'trip.completedAt': 'Done at {time}',
    'trip.damageAt': 'Damage · {place}',

    'trip.stepReported': 'Order {ref}: the driver marked “{step}”.',
    'trip.amended': 'The route changed on order {ref}: {change}',

    'amend.stopAt': '{kind} · {place}',
    'amend.fieldChange': '{label}: {from} → {to}',
    'amend.fieldValue': '{label}: {value}',
    'amend.pendingCount': '{count, plural, one {# change} other {# changes}}',
    'amend.madeAt': 'Changed {date}',

    'landing.cycleStage': 'Stage {no} / {total}',

    'pulse.week': 'wk {no}',
    'pulse.weekAmount': 'Week {no} · {amount}',
    'pulse.totalOne': 'wk {no} total {amount}',
    'pulse.totalRange': 'wks {from}–{to} total {amount}',

    'event.offer.received': 'New offer on transport {ref}',
    'event.offer.chosen': 'You were picked for transport {ref} — confirm within {minutes} minutes',
    'event.order.released': 'Transport {ref} is back on the board',
    'event.order.amended': 'The route on transport {ref} changed',
    'event.trip.stop.done': 'Transport {ref}: {place} marked done ({done}/{total})',
    'event.order.closed': 'Transport {ref} is complete, the documents are available',
    'event.vehicle.approved': 'Vehicle {plate} is approved',
    'event.vehicle.rejected': 'Vehicle {plate} was not approved',

    'legal.version': 'Version {n}',
    'legal.effective': 'In force from {date}',
    'legal.accepted': 'Accepted {date} · version {n}',

    'done.weekOf': 'Week of {date}',
    'done.closedAt': 'Completed {date}',
    'done.bps': '{rate, number, ::percent}',
  },
} as const satisfies Dictionary;
