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
    tagline: 'Trailers and containers · Scandinavia',
    operator: 'RAHTIS',
    /* Юрлицо. Только там, где его требует закон: договоры, счета, отчёты. */
    legalEntity: 'Aivomaa Oy',
    description: 'Trailer swap and container haulage platform across Scandinavian ports.',
  },


  seo: {
    homeTitle: 'Haulage platform: trailer swaps, containers, express',
    homeDescription:
      'RAHTIS routes trailer swaps and container haulage to approved carriers across the ports of Finland, Sweden, Norway and Denmark. An order reaches the trucks in the area at once, the job is visible stop by stop, and the documents end up in one place.',
    termsDescription:
      'Terms of service for RAHTIS: responsibilities of the parties, how a job runs, payments and settlements, and the term of the agreement.',
    privacyDescription:
      'How RAHTIS handles personal data: what is collected, what it is used for, how long it is kept and what rights the data subject has.',
    signinDescription: 'Sign in to RAHTIS as a shipper or as a carrier.',
    applyDescription:
      'Apply to RAHTIS. We check the business ID and company details against the registers, and for carriers the transport licence and insurance as well.',
    forgotDescription: 'Reset a forgotten RAHTIS password.',
  },

  notFound: {
    title: 'Page not found',
    lede: 'The address may have changed, or the page may never have existed. The front page has the service, the references and the way to reach us.',
    home: 'To the front page',
    signIn: 'Sign in',
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
    dispatch: 'Dispatch',
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
    photos: 'Photos and documents',
    signature: 'Signature',
    fromApp: 'From the driver app',
    signatureNoCmr: 'The driver collected a signature, but the consignment note was not photographed. Upload the CMR to close the job.',
    progress: 'Job progress',
    markDone: 'Mark as done',
    marking: 'Marking…',
    locating: 'Getting location…',
    noPosition: 'No location',
    positionAway: 'Marked from a distance',
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
    /*
     * The strapline names what actually moves.
     *
     * 'Freight platform in Finland' promised all cargo across one
     * country. The platform does two things — trailer swaps and
     * containers — and does them across Scandinavian ports. A narrow
     * promise that holds beats a wide one with nothing behind it.
     */
    eyebrow: 'Trailer swaps, containers and express · Scandinavia',
    /*
     * First line lists, second promises, third gives the benefit.
     *
     * With express there are three things to name and no room to give
     * each a line of its own. The rhythm survives, and every line still
     * fits: the longest is the third, the one the headline size was
     * measured against.
     *
     * 'Load', not 'parcel': express here is up to 26 tonnes in the
     * vehicle, not post. The cabinet uses the same word.
     */
    titleA: 'Trailer, container, load.',
    titleB: 'Each one leaves on time.',
    titleC: 'The phone stops ringing.',
    lede: 'Publish an order and suitable carriers get it at once. The job shows step by step, with photos and documents in one place.',
    /* The three things people come here for. */
    highlight1: 'A change does not stop the load',
    highlight2: 'We do not auction the price down',
    highlight3: 'Documents and settlements electronically',
    asShipper: 'For forwarders and operators',
    asCarrier: 'For carriers',
    signIn: 'Sign in',
    apply: 'Send an application',
    fleetLabel: 'approved vehicles',
        regionsLabel: 'operating areas',
    regions: 'Operating areas',

    branchesEyebrow: 'Two ways to move freight',
    branchesTitle: 'The unit is towed, the load is driven',
    branchesLede:
      'Both run through the platform the same way: publish, offers, the job step by step, documents and settlement. The difference is what the vehicle is given and what the shipper states.',
    unitBranch: 'Tractor unit',
    unitBranchTitle: 'The unit is collected and left',
    unitBranchText:
      'A tractor unit collects the trailer or container from an agreed place, works the stops along the way and leaves it at the end. The driver finds the right unit by its number, the platform the right vehicle by the unit’s size.',
    branchFleet: 'Vehicle',
    /*
     * Ключ держится в одну строку: в колонке 7rem «The shipper states»
     * переносился, ряд становился выше соседних и таблица переставала
     * читаться поперёк — ради чего она и сделана.
     */
    branchTells: 'Shipper states',
    branchExtra: 'Also',
    unitFleet: 'Tractor unit, 2–3 axles',
    unitTells: 'Unit number and collection point',
    unitExtra: 'Containers 20–45 ft · ADR',
    expressBranch: 'Van or truck',
    expressBranchTitle: 'The load travels in the vehicle',
    expressBranchText:
      'The shipper gives a pickup and a delivery address, loading metres and weight; dimensions and packaging go in the notes. Pickup and delivery are marked on the map, and the waybill and any damage photos come with them.',
    expressFleet: 'Up to 3.5 t or 26 t',
    expressTells: 'Loading metres, weight, two addresses',
    expressExtra: 'Tail lift · Side loading · Refrigeration',
    /* Countries by name, not by code: the strip is read, not decoded. */
    country: { FI: 'Finland', SE: 'Sweden', NO: 'Norway', DK: 'Denmark' },
    cabinet: 'My account',

    cycle1: 'Available',
    cycle1Note: 'Published and sent to carriers in the area',
    cycle2: 'Offers 2 / 3',
    cycle2Note: 'The shipper chooses on price and ratings',
    cycle3: 'On the road · unit collected',
    cycle3Note: 'The driver marks the stops in order',
    cycle4: 'Completed · CMR note attached',
    cycle4Note: 'Documents with the shipper, payout in the weekly report',

    helpEyebrow: 'What RAHTIS does',
    helpTitle: 'We keep freight moving and trucks working',
    helpLede:
      'RAHTIS does not replace your forwarder, your dispatcher or your carrier. It takes out the searching, the phone calls, explaining the same job over and over, and documents scattered across inboxes.',
    helpCargo: 'For forwarders and operators',
    helpCargoTitle: 'Orders move quickly',
    helpCargoText:
      'Publish the job once. It goes straight to approved carriers in the area, and the offers come back to the same screen.',
    helpTruck: 'For the carrier',
    helpTruckTitle: 'Less empty running',
    helpTruckText:
      'The open jobs in your area are in one place. When one job ends, you can look for the next one in the same area.',
    helpDriver: 'For the driver',
    helpDriverTitle: 'Everything about the job in one place',
    helpDriverText: 'Addresses, contacts, bookings and instructions travel in the driver app for the whole job. Confirmations and photos are done in the same place.',

    timeEyebrow: 'Standing still costs both sides',
    timeTitle: 'In logistics, time is what you pay for',
    timeLede:
      'While a shipper rings round for a free truck, the freight waits. While a carrier rings round for the next load, the truck stands. Both are losing the same thing: time. RAHTIS does not negotiate the price down — it removes the steps where the time goes.',
    /*
     * The rows are pairs: left and right say the same thing, before and
     * after. This used to be two separate lists of six sentences, and the
     * reader had to work out which line answered which. Now the pair sits
     * on one row, so the layout does the comparing — and once it does,
     * the sentence can shrink to a phrase.
     */
    timeOld: 'How it usually works now',
    timeNew: 'How RAHTIS works',
    timeOld1: 'Calls, one carrier at a time',
    timeNew1: 'Published once, to the whole area',
    timeOld2: 'Ringing round for the next load',
    timeNew2: 'Open jobs in one view',
    timeOld3: 'Agreements live in calls and texts',
    timeNew3: 'Price, schedule and route on record',
    timeOld4: 'The driver asks for addresses',
    timeNew4: 'Addresses and instructions with the job',
    timeOld5: 'CMR notes arrive days later',
    timeNew5: 'Documents attached on completion',
    timeOld6: 'Invoicing sorted out afterwards',
    timeNew6: 'Jobs and payouts in the weekly report',
    timeOld7: 'Where the courier is takes a phone call',
    timeNew7: 'Pickup and delivery marked on the map',

    rolesEyebrow: 'Who RAHTIS is for',
    rolesTitle: 'One platform for three kinds of haulage — and for both sides',
    shipperEyebrow: 'For forwarders and operators',
    shipperTitle: 'You do not have to find a carrier one call at a time.',
    /*
     * Four points, not six. Published once, documents on completion and
     * the weekly report were already said in the section above; repeated
     * here they do not strengthen the promise, only lengthen the list.
     * What is left is what only this side can say.
     */
    shipper2: 'You get up to three offers in the same view.',
    shipper3: 'You pick the carrier on price, equipment and ratings.',
    shipper4:
      'If the route, the schedule or anything else changes mid-job, the update goes straight to the carrier and the driver.',
    shipper6: 'The weekly report shows jobs, amounts, documents and feedback.',
    shipper5:
      'If a truck cancels or does not confirm, the job returns to the board on its own and reaches the next suitable trucks right away.',
    carrier2:
      'Less empty running means more paid kilometres with the same truck and the same driver.',
    carrierEyebrow: 'For the carrier',
    carrierTitle: 'Keep the truck working between jobs too.',
    carrier3: 'You can find a return load in the area where the last job ends.',
    carrier4: 'Every vehicle is approved onto the platform separately.',
    carrier5: 'Price, service fee and your share are visible before you accept.',
    carrier6: 'The weekly report shows jobs driven, earnings and payouts due.',

    feeEyebrow: 'Service fee',
    feeTitle: 'A small service fee, and it is visible before you take the job',
    feeLede:
      'We do not auction jobs down on price. The carrier prices its own work, and both the service fee and the remaining share are visible before the job is accepted. The fee covers the work that would otherwise be done by hand.',
    fee1: 'Electronic documents',
    fee1Text:
      'The consignment note, loading photos and damage notes travel with the job and reach the shipper without being sent separately.',
    fee2: 'Automated invoices and settlements',
    fee2Text:
      'The jobs of a period are assembled on their own into an invoice for the shipper and a settlement for the carrier. The payment date is known in advance.',
    fee3: 'Reports',
    fee3Text:
      'The weekly report shows the jobs driven, the sums and the coming payment dates without separate bookkeeping.',
    fee4: 'Finding the work and the hauler',
    fee4Text:
      'The shipper finds an available truck and the carrier finds the next job without a round of phone calls. That same work used to be done by telephone.',

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
    fault3: 'Damage found on the unit or the load at pickup',
    fault3Text:
      'The damage is recorded against that stop with a photo and a timestamp, so there is a clear record of what happened and when.',
    fault4: 'The job is cancelled before it starts',
    fault4Text:
      'A cancelled job returns to the board automatically and suitable carriers are notified.',

    aiEyebrow: 'Driver app',
    aiTitle: 'The job travels in the driver’s phone',
    aiLede:
      'The RAHTIS driver app shows the stops, addresses, time windows and contacts of the job. Arrival, photos, signature and confirmation are done with a tap, without messaging.',
    aiLede2:
      'The app is installed on the phone’s home screen with a link or code from the carrier. It also works in the port without a network.',
    appBack: 'Jobs',
    appStopOf: 'Stop 2/3',
    appBanner: 'Unloading · Kotka',
    appPickupRole: 'Pickup',
    appPickupDone: 'Done 06:42',
    appUnloadRole: 'Unloading',
    appArrived: 'Arrived 07:05',
    appSign: 'Recipient signature',
    appDone: 'Mark as done',
    appReturnRole: 'Trailer return',
    appNavTasks: 'Jobs',
    appNavInbox: 'Messages',
    appNavProfile: 'Profile',
    ai1: 'The job in one view',
    ai1Text:
      'Stops in order, addresses, time windows, contacts and the unit number. Navigation and calling with one tap.',
    ai2: 'Arrival and confirmation with a tap',
    ai2Text:
      'The time and place are recorded at the moment of the tap. Waiting time shows from arrival, and the status updates for the shipper and the carrier.',
    ai3: 'Photos and damage',
    ai3Text:
      'Every side of the trailer, the seal and any new damage are photographed in the app. At delivery the pickup photo is shown alongside for comparison.',
    ai4: 'Signature and consignment note',
    ai4Text:
      'At loading and unloading the app takes the signature and a photo of the consignment note. The carrier closes the job without a separate upload.',
    ai5: 'Works without a network',
    ai5Text:
      'Entries and photos wait on the phone and are sent when the connection returns. The time kept is the moment of the tap, not of sending.',
    ai6: 'Notifications to the phone',
    ai6Text:
      'A new job, a direct order or a cancellation arrives as a notification, even when the app is closed.',

    servicesEyebrow: 'The service grows in stages',
    servicesTitle: 'We started with trailer swaps — containers and express are live too',
    serviceLive: 'Live',
    service1: 'Semi-trailer swaps',
    service1Text:
      'A tractor unit collects the trailer from a port or terminal, handles the agreed loading and unloading, and delivers the trailer to the next agreed place.',
    service1Text2: 'We operate across Scandinavian ports: Finland, Sweden, Norway and Denmark.',
    /*
     * The second service is containers, not general cargo.
     *
     * This used to read 'transport on the carrier's own equipment' —
     * curtainsider, reefer, tipper, low-loader. That is not promised
     * now: the platform does trailer swaps and containers, and a
     * promise with no operation behind it costs more than a missing
     * line.
     */
    service2: 'Container haulage',
    service2Text:
      'The tractor collects the container from a port or terminal — empty or loaded — and delivers it where agreed. On the way back the container returns to the port.',
    service2Text2:
      'The size is stated in feet: 20, 30, 40 or 45. Only vehicles whose chassis takes that length see the job.',

    service4: 'Express deliveries',
    service4Text:
      'A van or a truck collects the load from an agreed address and takes it to the destination. The load travels in the vehicle; nothing is swapped along the way.',
    service4Text2:
      'The shipper states loading metres and weight; pickup and delivery are marked on the map. Only vehicles with enough space in the body see the job.',

    serviceSoon: 'In development',
    service3: 'Driver app',
    service3Text: 'Jobs, stops, photos and signatures in the driver’s own app. Installed on the phone’s home screen, and it also works without a network.',
    service3Text2: 'The carrier invites the driver with a link or code and sees confirmations and working time directly in the service.',

    finalEyebrow: 'Getting started',
    finalTitle: 'Tell us about your company — we handle the rest',
    finalLede: 'We need the company name, the Y-tunnus and an email address; from carriers also the operating licence and insurance.',
    /*
     * The same fact used to stand twice: here and as a footnote on the
     * first screen. The footnote also carried two things this line did
     * not — that you cannot sign up directly, and which registers we
     * check. They live here now, and the footnote is gone.
     */
    finalLede2: 'We check the company against the PRH and YTJ registers and issue credentials once it is approved.',
    applyShipper: 'Forwarder application',
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
    /*
     * Two tax lines, not one.
     *
     * The rate follows the counterparty's country: a normal domestic
     * sale at 25.5% for a Finnish company, reverse charge at 0% for a
     * foreign one. This first held one sentence for everyone ('25.5% is
     * added'), then another one for everyone ('VAT 0%') — each was wrong
     * for half the customers.
     *
     * Zero does not mean there is no tax: under the reverse charge the
     * buyer accounts for it, and the document must say so in words
     * rather than with a blank line.
     */
    vatNoteDomestic: 'Amounts exclude VAT. VAT at 25.5% is added on the invoice.',
    vatNoteReverse:
      'Amounts at VAT 0%: reverse charge, the buyer accounts for the tax in its own country.',
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

  /*
   * The words that change with what is being hauled.
   *
   * Only five places in the whole interface name the trailer: the
   * pickup and return headings on the form and in the route list,
   * and whether the unit is loaded. A container needs different
   * ones — 'trailer return' on a container job promises the driver
   * a trailer that is not in the route.
   *
   * Parallel vocabularies under one haulKind rather than scattered
   * keys: when a third unit type arrives it gets one block, not
   * five keys in five places.
   */
  haul: {
    TRAILER: {
      stopPickup: 'Trailer pickup',
      stopReturn: 'Trailer return',
      pickupSection: 'Where the trailer is picked up',
      dropSection: 'Where the trailer is left',
      unitState: 'Trailer',
    },
    CONTAINER: {
      stopPickup: 'Container pickup',
      stopReturn: 'Container return',
      pickupSection: 'Where the container is picked up',
      dropSection: 'Where the container is left',
      unitState: 'Container',
    },
    VAN: {
      stopPickup: 'Cargo pickup',
      stopReturn: 'Delivery',
      pickupSection: 'Where the cargo is picked up',
      dropSection: 'Where the cargo is delivered',
      unitState: 'Cargo',
    },
    TRUCK: {
      stopPickup: 'Cargo pickup',
      stopReturn: 'Delivery',
      pickupSection: 'Where the cargo is picked up',
      dropSection: 'Where the cargo is delivered',
      unitState: 'Cargo',
    },
  },

  presence: {
    title: 'Where the vehicles are',
    hint: 'Approved vehicles by home base. It does not show availability, nor whose vehicles these are.',
    mapLabel: 'Map of cities with vehicles',
  },

  haulKind: {
    TRAILER: 'Semi-trailer',
    CONTAINER: 'Container',
    VAN: 'Van',
    TRUCK: 'Truck',
  },

  vehicleClass: {
    TRACTOR: 'Tractor unit',
    VAN: 'Van · up to 3.5 t',
    TRUCK: 'Truck · up to 26 t',
  },

  amendKind: {
    STOP_ADDED: 'Stop added',
    STOP_CHANGED: 'Stop changed',
    STOP_REMOVED: 'Stop removed',
    ORDER_REPRICED: 'Distance and price updated',
    ORDER_CANCELLED: 'Order cancelled',
    ORDER_RELEASED: 'Carrier stepped back',
  },

  /*
   * When things go wrong: cancelling, stepping back, repricing, deleting.
   * A group of its own rather than part of matching, because none of it is
   * about offers — it is about what happens to an order afterwards.
   */
  lifecycle: {
    withdraw: 'Cancel order',
    withdrawing: 'Cancelling…',
    withdrawHint: 'The order leaves the working lists for good. Its data and history stay.',
    /*
     * First person, matching 'I take this job', which this undoes.
     * The old wording read as giving up; the point is that the truck
     * cannot run, not that the carrier lost heart.
     */
    abandon: 'I cannot run this job',
    abandoning: 'Reporting…',
    abandonHint:
      'If no stop has been reached yet, the order goes back on the board for someone else. If the run has started, it is cancelled and dispatch will be in touch.',
    reprice: 'Update distance and price',
    repricing: 'Saving…',
    repriceHint:
      'The price follows the kilometres at the €/km you agreed. You can also type the amount yourself.',
    repriceOpen: 'Correct distance and price',
    remove: 'Delete order',
    removing: 'Deleting…',
    removeHint:
      'Removes the order from the database for good. Test and mistaken orders only: anything invoiced or documented cannot be deleted.',
    reason: 'Reason',
    reasonPlaceholder: 'Truck broke down, load called off…',
    confirm: 'Confirm',
    cancelled: 'This order has been cancelled',
    notAllowed: 'You are not allowed to do this.',
    notFound: 'Order not found.',
    failed: 'That did not go through. Refresh the page and try again.',
    fieldStatus: 'Status',
    fieldBy: 'By',
    fieldReason: 'Reason',
    cleanupTitle: 'Order cleanup',
    cleanupHint:
      'Drafts, orders on the board and cancelled orders that were never invoiced. Deletion is final: anything invoiced or documented cannot be removed.',
    cleanupEmpty: 'Nothing to delete',
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

  /*
   * The heading no longer names what is being hauled.
   *
   * 'Semi-trailer transport' was right while there was nothing else.
   * On a container order it lied: there is no trailer. What is hauled
   * is now said by the haulKind badge beside it, and the heading is
   * left to say what shape the job is.
   */
  orderType: {
    TRAILER_SWAP: 'Transport order',
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

    repeat: 'Repeat this transport',
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
    ldm: 'Loading metres',
    ldmHint: 'How much floor length the cargo takes. Put dimensions and packaging in the notes.',
    expressCargoSection: 'What is being shipped',
    expressCommentPlaceholder: 'Dimensions, packaging, handling, temperature…',
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

    haulKind: 'What is being hauled',
    trailer: 'Trailer type',
    trailerPlaceholder: 'Curtainsider 13.6, 3 axles',
    trailerPlate: 'Trailer registration',
    trailerPlateHint: 'This is how the driver finds the right trailer on the yard. Required.',
    /*
     * A container has its own vocabulary: an ISO 6346 number instead of
     * a registration, a length in feet instead of a type. Same fields,
     * different labels — the driver is looking for a different object.
     */
    containerNumber: 'Container number',
    containerNumberHint: 'ISO 6346, for example MSCU1234567. This is how the driver finds it at the terminal.',
    containerFeet: 'Container length',
    containerFeetHint: 'In feet. It decides which chassis can take it.',
    containerType: 'Container type',
    containerTypePlaceholder: 'Dry van, high cube, reefer…',
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
    /*
     * Three bands by who is waiting for whom. The names say what to do,
     * not what state a row is in: 'Waiting for your decision' tells you
     * something, 'REQUESTED' does not.
     */
    bandDecide: 'Waiting for your decision',
    bandRunning: 'On the road',
    bandWaiting: 'Waiting for offers',
    bandDraft: 'Drafts',
    bandCancelled: 'Cancelled',
    searchPlaceholder: 'Search: number, trailer, city',
    when: { all: 'All', today: 'Today', tomorrow: 'Tomorrow', week: 'Week' },
    nothingFound: 'No matches',
    nothingFoundHint: 'Change the search or pick another date range.',
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
    /*
     * Not 'Cancel': this button puts the order back on the board, it
     * does not call it off. lifecycle.withdraw sits next to it and does
     * exactly that — two look-alike buttons cannot be told apart.
     */
    cancel: 'Put back on the board',
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
    cancelledTrips: 'Cancelled jobs',
    noChassis: 'This vehicle has no chassis for a container of that size.',
    wrongClass: 'This transport needs a different vehicle class or more loading metres.',
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

  billingDesk: {
    title: 'Invoicing and settlements',
    subtitle:
      'A period is half a month: the 1st to the 15th, and the 16th to the end of the month. Invoices go to customers automatically when the period ends. You record incoming payments and settlements to carriers.',
    statAwaiting: 'Awaiting customer payment',
    statOverdue: 'Overdue',
    statToPay: 'To pay to carriers',
    statMargin: 'Margin',
    current: 'In progress',
    invoices: 'Invoices to customers',
    payouts: 'Settlements to carriers',
    colCustomer: 'Customer',
    colCarrier: 'Carrier',
    colInvoice: 'Invoice',
    colTrips: 'Jobs',
    colGross: 'Amount incl. VAT',
    colStatus: 'Status',
    stSent: 'Sent',
    stPaid: 'Paid',
    stOverdue: 'Overdue',
    stNotSent: 'Not sent',
    stWaiting: 'Awaiting customer payment',
    stReady: 'Pay now',
    stSettled: 'Settled',
    markPaid: 'Payment received',
    markSettled: 'Mark settled',
    notSent: 'The invoices for this period have not gone out. Send them now — the same action the schedule runs.',
    sendNow: 'Send the period invoices',
    account: 'Account',
    noIban: 'Bank account missing',
    closed: 'Fully processed periods',
    nothing: 'No completed jobs yet.',
    colDate: 'Date',
    colRef: 'Job',
    colRoute: 'Route',
    colAmount: 'Net',
    summary: 'Summary by partner and by job',
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
    clear: 'Clear the chat',
    clearConfirm: 'The whole chat will be deleted.',
    clearYes: 'Delete',
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

    accept: 'I accept the following documents:',
    ownDocuments: 'Your documents',
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

  admin: {
    people: 'Users',
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
    language: 'Language of correspondence',
    languageHint:
      'The language we send invitations, invoices and reports in. Everyone picks the interface language for themselves in the top bar.',
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
    emailTrips: 'Transports',
    emailWhere: 'The report is available in your account.',
    seller: 'Seller',
    customer: 'Customer',
    payer: 'Payer',
    payee: 'Payee',
    vatNumber: 'VAT no.',
    reference: 'Reference',
    carrierTitle: 'Weekly report · jobs driven',
    shipperTitle: 'Weekly report · completed transports',
    adminTitle: 'Weekly report · invoicing and payouts',
    period: 'Week {week} · {from}–{to}',
    /*
     * Period documents. A separate title because they say something
     * different from the weekly report: the week shows work done, the
     * period shows money.
     *
     * 'Payment summary' for the shipper, not 'invoice': the invoice
     * number is issued in accounting, and calling a summary an invoice
     * would promise bookkeeping rigour where there is none.
     */
    settlementShipperTitle: 'Invoice {number}',
    invoiceDate: 'Invoice date {date}',
    invoiceEmailSubject: 'RAHTIS · invoice {number} · period {from}–{to}',
    settlementCarrierTitle: 'Period statement · transports driven',
    periodRange: 'Period {from}–{to}',
    dueShipper: 'Due by {date}',
    dueCarrier: 'Payout on {date}',
    settlementEmailSubject: 'RAHTIS · period summary {from}–{to}',
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
    /*
     * Tax lines in the documents. The rate follows the counterparty's
     * country: 25.5% for a Finnish company, reverse charge for a
     * foreign one.
     */
    vatLine: 'VAT {rate}',
    totalWithVat: 'Total incl. VAT',
    empty: 'No transports were completed this week.',
    closingNote:
      'A transport belongs to the week it finished in. One started on Friday and unloaded on Monday appears in the following week’s report.',
    periodClosingNote:
      'A transport belongs to the period in which it was completed. A period runs from the 1st to the 15th or from the 16th to the end of the month; one started at the end of a period and unloaded after it appears in the next period documents.',
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

  operator: {
    title: 'Operator company details',
    tab: 'Company details',
    subtitle:
      'Aivomaa Oy details printed on invoices, period statements, reports and billing emails. Changes apply to the next documents; ones already issued stay as they are.',
    company: 'Company',
    legalName: 'Legal name',
    businessId: 'Business ID (Y-tunnus)',
    vatNumber: 'VAT number',
    email: 'Email',
    phone: 'Phone',
    website: 'Website',
    address: 'Address',
    street: 'Street address',
    postalCode: 'Postal code',
    city: 'City',
    country: 'Country (ISO)',
    bank: 'Payment details',
    bankName: 'Bank',
    einvoiceOvt: 'E-invoice address (OVT)',
    einvoiceOperator: 'E-invoice operator',
    save: 'Save',
    saving: 'Saving…',
    saved: 'Saved',
    failed: 'Details not saved. Check the fields.',
    ibanInvalid: 'The IBAN is not valid.',
    businessIdShape: 'Business ID in the form 1234567-8.',
    updated: 'Updated',
  },

  claims: {
    title: 'Claims',
    subtitle:
      'Damage, shortages, downtime and deviations, trip by trip. RAHTIS reviews every claim and mediates between the parties.',
    subtitleAdmin: 'All claims. Open and in-review first.',
    none: 'No claims',
    noneHint: 'A claim can be filed from the card of a completed or running trip.',
    all: 'All',
    back: 'Claims',
    file: 'File a claim',
    fileTitle: 'New claim',
    kind: 'Type',
    stop: 'Where it happened',
    stopWhole: 'Whole trip',
    description: 'What happened',
    descriptionHint: 'At least 10 characters. Say what, where and when — it speeds up the review.',
    amount: 'Amount claimed, € (excl. VAT)',
    amountHint: 'Optional. Leave empty if the amount is not known yet.',
    submit: 'Submit claim',
    submitting: 'Submitting…',
    cancel: 'Cancel',
    amountClaimed: 'Amount claimed',
    filedBy: 'Filed by',
    mine: 'You',
    against: 'Counterparty',
    trip: 'Trip',
    evidence: 'Evidence from the trip',
    evidenceHint:
      'Photos come from the trip, not from the claim: pickup and delivery photos from the driver app appear here automatically, including ones sent after the claim was filed.',
    before: 'At pickup · before',
    after: 'At delivery · after',
    otherDocuments: 'CMR and other documents',
    noPhotos: 'No photos yet.',
    fromApp: 'app',
    atClaimStop: 'claim location',
    attachments: 'Attachments',
    attach: 'Attach file',
    attachHint: 'PDF, JPG, PNG or WEBP, up to 10 MB.',
    timeline: 'History and messages',
    comment: 'Message',
    commentPlaceholder: 'Write to the counterparty and the RAHTIS operator…',
    send: 'Send',
    sending: 'Sending…',
    open: 'Open',
    closed: 'This claim is closed. If the matter continues, file a new claim.',
    resolution: 'Resolution',
    moderate: 'Review',
    resolutionHint: 'Required when resolving or rejecting: the parties need to know what the decision rests on.',
    toReview: 'Take into review',
    resolve: 'Resolve',
    reject: 'Reject',
    reopen: 'Back to review',
    settle: 'Mark as settled',
    settleHint: 'If you have agreed with the counterparty, you can close your own claim.',
    failed: 'That did not work. Please try again.',
    notAllowed: 'This action is not available in the current state.',
    tooShort: 'The description is too short.',
    byEmail: 'Handled by email',
    notForwarded: 'The claim has not been forwarded to the counterparty: no contact address was found or sending failed. Forward it manually.',
    adminChannel: 'Only the party that filed the claim sees your messages. The counterparty is handled by email.',
    writeByEmail: 'Write to the counterparty',
    author: {
      SHIPPER: 'Shipper',
      CARRIER: 'Carrier',
      ADMIN: 'RAHTIS',
    },
    event: {
      CREATED: 'filed the claim',
      COMMENT: 'wrote',
      STATUS: 'changed the status',
      ATTACHMENT: 'attached a file',
    },
  },

  claimKind: {
    CARGO_DAMAGE: 'Cargo or trailer damage',
    SHORTAGE: 'Shortage',
    DOWNTIME: 'Downtime',
    DEVIATION: 'Route or time deviation',
    OTHER: 'Other',
  },

  claimStatus: {
    OPEN: 'Open',
    IN_REVIEW: 'In review',
    RESOLVED: 'Resolved',
    REJECTED: 'Rejected',
  },

  periodReport: {
    title: 'Reports',
    subtitle:
      'Pick a period and download the report: PDF to read, Excel or CSV for your accounting system.',
    from: 'From',
    to: 'To',
    show: 'Show',
    company: 'Company',
    allCompanies: 'All companies',
    thisWeek: 'This week',
    lastWeek: 'Last week',
    thisMonth: 'This month',
    lastMonth: 'Last month',
    thisQuarter: 'This quarter',
    lastQuarter: 'Last quarter',
    download: 'Download',
    pdf: 'PDF',
    xlsx: 'Excel',
    csv: 'CSV',
    invalid: 'Check the dates: start before end, one year at most.',
    empty: 'No trips were completed in this period.',
    noClaims: 'No claims were filed in this period.',
    trips: 'Trips',
    claims: 'Claims',
    summary: 'Summary',
    titleShipper: 'Transport report',
    titleCarrier: 'Haulage report',
    titleAdmin: 'Billing and payout report',
    basis:
      'A trip belongs to the period of the day it was closed (Finnish time).',
    colDate: 'Closed',
    colRef: 'No.',
    colShipperRef: 'Shipper ref.',
    colRoute: 'Route',
    colVehicle: 'Vehicle',
    colTrailer: 'Trailer',
    colKm: 'km',
    colRate: 'Rate',
    colCommission: 'Service fee',
    colCommissionRate: 'Service fee %',
    colPayout: 'Payout',
    colNet: 'Net',
    colVatRate: 'VAT %',
    colVat: 'VAT',
    colGross: 'Gross',
    colDocuments: 'Documents',
    colClaims: 'Claims',
    colShipper: 'Shipper',
    colCarrier: 'Carrier',
    colKind: 'Type',
    colStatus: 'Status',
    colAmount: 'Amount',
    colFiled: 'Filed',
    colFiledBy: 'Filed by',
    colOrder: 'Trip',
    colResolution: 'Resolution',
    rowTrips: 'Trips',
    rowDistance: 'Kilometres',
    rowRate: 'Trip rates',
    rowCommission: 'Service fees',
    rowPayout: 'Payouts',
    rowMargin: 'Margin',
    rowVat: 'VAT',
    rowGross: 'Total incl. VAT',
    rowClaims: 'Claims',
    rowClaimed: 'Total claimed',
    reverseCharge: 'reverse charge',
    sheetTrips: 'Trips',
    sheetClaims: 'Claims',
    sheetSummary: 'Summary',
  },

  vehicle: {
    plate: 'Registration',
    driver: 'Driver',
    languages: 'Languages',
    whatsapp: 'Driver phone',
    axles: 'Tractor axles',
    make: 'Make and model',
    euro: 'Emission class',
    base: 'Home base',
    baseHint: 'Pick the city from the suggestions so shippers can see on the map that there is capacity in the area',
    rating: 'Rating',
    adr: 'ADR',
    adrHas: 'ADR permit',
    adrHint: 'Whether the vehicle and driver are cleared for dangerous goods',
    adrNo: 'No ADR permit',
    capacity: 'Payload',
    capacityHint: 'A two-axle tractor takes 25 t, a three-axle one 32 t.',
    containerFeet: 'Container chassis',
    containerFeetHint:
      'Which container lengths this rig can take. Empty means it does not carry containers.',
    containerNone: 'No container chassis',
    class: 'Vehicle class',
    classHint: 'A tractor unit pulls trailers and containers; vans and trucks run express deliveries.',
    payload: 'Payload, kg',
    payloadHint: 'How much the cargo space can carry',
    ldm: 'Loading metres',
    ldmHint: 'Floor length of the cargo space, in metres',
    equipment: 'Equipment',
    tailLift: 'Tail lift',
    sideLoading: 'Side loading',
    reefer: 'Refrigeration unit',
    reeferUntil: 'Refrigeration inspection valid until',
    reeferUntilHint: 'The date the refrigeration unit inspection expires',
    reeferExpired: 'Refrigeration inspection has expired',
    noEquipment: 'No special equipment',
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
    tooHeavy: 'This job is too heavy for the vehicle. Pick one with enough payload.',
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

  drivers: {
    title: 'Drivers',
    subtitle:
      'Drivers, their vehicles and working time. The phone number identifies the driver: one number can belong to only one driver on the whole platform.',
    add: 'Add driver',
    new: 'New driver',
    edit: 'Edit',
    name: 'Name',
    phone: 'Phone',
    phoneHint: 'International format, e.g. +358401112233.',
    phoneTaken: 'Another driver already has this number.',
    phoneInvalid: 'Check the number: international format starting with +.',
    languages: 'Languages',
    languagesHint: 'Languages the driver can communicate in',
    vehicle: 'Vehicle',
    noVehicle: 'No vehicle',
    assign: 'Change vehicle',
    archive: 'Archive',
    restore: 'Restore',
    archived: 'Archived',
    archivedHint: 'An archived driver does not hold the phone number. Their shifts and trips stay in the reports.',
    needsReview: 'Please check: the same number was on several vehicles or under different names.',
    none: 'No drivers yet',
    noneHint: 'Add a driver and choose their vehicle.',
    open: 'Hours and pay',
    back: 'All drivers',
    report: 'Report',
    tes: 'CBA rules',
    driverHint: 'You can change the driver at any time — the vehicle stays approved.',
    vehicleNoDriver: 'This vehicle has no driver, so it cannot take transports.',
    addDriverFirst: 'Add a driver on the Drivers page first.',
    manage: 'Drivers',
    invite: 'Invite to the app',
    inviteAgain: 'New invite link',
    inviteLink: 'The invite is valid for 24 hours and works once: the driver opens the link or enters the code in the app. A new invite signs the old phone out.',
    inviteCode: 'Code',
    copy: 'Copy',
    copied: 'Copied',
    sms: 'Send as text message',
    appLinked: 'App in use',
    appNotLinked: 'No app',
    detach: 'Sign out from the phone',
  },

  driverApp: {
    title: 'RAHTIS Driver',
    tasks: 'Jobs',
    inbox: 'Messages',
    profile: 'Profile',
    earnings: 'Earnings',
    earningsMonth: 'Earned in total',
    earningsNoPay: 'Your employer has not set your pay yet. Hours and jobs are still shown.',
    earningsEmpty: 'No completed jobs this month yet.',
    earningsRunning: 'Month so far',
    tabActive: 'Active',
    tabDone: 'Done',
    noTasks: 'You have no jobs.',
    startDay: 'Start day',
    pause: 'Break',
    resume: 'Resume',
    endDay: 'End day',
    onBreak: 'On a break',
    shiftOff: 'Day not started',
    working: 'Working time',
    accept: 'Accept job',
    decline: 'Decline',
    awaitHint: 'Confirm the job when you can drive it.',
    directHint: 'The shipper sent this straight to your vehicle. There is no deadline.',
    open: 'Open',
    back: 'Jobs',
    navigate: 'Navigate',
    call: 'Call',
    next: 'Next',
    window: 'Time',
    contact: 'Contact',
    unit: 'Unit',
    weight: 'Weight',
    seal: 'Seal required',
    loaded: 'Loaded',
    emptyUnit: 'Empty',
    ref: 'Reference',
    note: 'Note',
    markDone: 'Mark as done',
    stopDone: 'Done',
    damage: 'Note on the equipment or load',
    damagePlaceholder: 'Optional: damage, shortages',
    allDone: 'All stops are done. The carrier closes the job with its documents.',
    locating: 'Getting location…',
    problem: 'Report a problem',
    problemPlaceholder: 'What happened?',
    send: 'Send',
    sent: 'Message sent to your carrier.',
    notLinked: 'The app is not linked yet',
    notLinkedHint: 'Open the link from your carrier, or sign in below with your phone number and code. The invite is valid for 24 hours.',
    inviteCompany: 'Carrier',
    inviteButton: 'Start',
    inviteInvalid: 'The link has expired or has already been used. Ask your carrier for a new one.',
    inviteFailed: 'Sign-in failed. Try again or ask for a new link.',
    install: 'Install the app on your home screen',
    installIos: 'On iPhone: Share → Add to Home Screen.',
    installAndroid: 'On Android: browser menu → Install app.',
    signOut: 'Sign out',
    company: 'Carrier',
    vehicle: 'Vehicle',
    noVehicle: 'No vehicle',
    phone: 'Phone',
    language: 'Language',
    privacy: 'Privacy',
    inboxEmpty: 'No messages.',
    markRead: 'Mark as read',
    failed: 'That did not work. Try again.',
    arrive: 'Arrived',
    inspection: 'Inspection and photos',
    inspectionHint: 'Photograph every side. If you see new damage, mark it before taking the photo.',
    angle: {
      FRONT: 'Front',
      BACK: 'Rear',
      LEFT: 'Left side and tyres',
      RIGHT: 'Right side and tyres',
    },
    sealPhoto: 'Seal',
    cargoPhoto: 'Load',
    extraPhoto: 'Extra photo',
    takePhoto: 'Take photo',
    retake: 'Take a new photo',
    damageToggle: 'New damage',
    atPickup: 'At pickup',
    uploading: 'Sending…',
    confirmation: 'Delivery confirmation',
    signHere: 'Recipient signature',
    signerName: 'Recipient name',
    clear: 'Clear',
    saveSignature: 'Save signature',
    signed: 'Signed',
    scanCmr: 'Photograph the consignment note',
    cmrDone: 'Consignment note photographed',
    codeTitle: 'Sign in with a code',
    codePhone: 'Your phone number',
    codeLabel: 'Code from your carrier',
    codeSubmit: 'Sign in',
    codeInvalid: 'The number and code do not match, or the code has expired.',
    codeThrottled: 'Too many attempts. Try again in 15 minutes.',
    confirmationPickup: 'Pickup confirmation',
    signHerePickup: 'Signature of the person handing over',
    signerNamePickup: 'Name of the person handing over',
    offlineShort: 'No connection',
    offlineStale: 'Showing the last loaded state.',
    sending: 'Sending entries…',
    queuedBadge: 'queued',
    pushTitle: 'Notifications',
    pushHint: 'Get notified about a new job, a direct order or a cancellation, even when the app is closed.',
    pushEnable: 'Turn on notifications',
    pushDisable: 'Turn off notifications',
    pushOn: 'Notifications are on for this phone.',
    pushDenied: 'Notifications are blocked. Allow them for this app in the phone settings.',
    pushUnsupported: 'This browser does not support notifications. On iPhone, install the app on the home screen first and open it from there.',
    offline: 'No connection. Check the network and try again.',
  },

  shifts: {
    title: 'Shifts',
    add: 'Add shift',
    edit: 'Edit shift',
    start: 'Started',
    end: 'Ended',
    endHint: 'Leave empty if the shift is still running.',
    breakStart: 'Break started',
    breakEnd: 'Break ended',
    breakHint: 'One break when entered by hand. The app records breaks itself.',
    vehicle: 'Vehicle',
    odoStart: 'Odometer at start, km',
    odoEnd: 'Odometer at end, km',
    note: 'Note',
    running: 'Running',
    delete: 'Delete',
    none: 'No shifts in this period',
    overlap: 'This shift overlaps another one.',
    tooLong: 'A shift can last at most 24 hours.',
    invalid: 'Check the times: end before start, or the break is outside the shift.',
    appRow: 'The driver recorded this in the app — it is not edited by hand.',
    period: 'Period',
    history: 'Change history',
  },

  shiftSource: {
    APP: 'App',
    MANUAL: 'Manual',
  },

  pay: {
    title: 'Pay calculator',
    disclaimer:
      'Laskuri on suuntaa-antava. Lopullinen palkka määräytyy työnantajan ja työsopimuksen/TES:n mukaan. (The calculator is indicative. The final pay is determined by the employer and the employment contract / collective agreement.)',
    model: 'Pay model',
    validFrom: 'Valid from',
    perKm: '€ / km',
    hourly: '€ / h',
    tripPercent: '% of settlement',
    tesSet: 'CBA rule set',
    save: 'Save model',
    current: 'Current model',
    history: 'Earlier models',
    none: 'No pay model set',
    noTes: 'Create a CBA rule set first.',
    missingRate: 'Some days have no pay model — the total is incomplete.',
    saved: 'Model saved.',
    sameDay: 'There is already a model for this date. Choose another start date or delete the old one.',
    delete: 'Delete',
  },

  payModel: {
    PER_KM: 'Per kilometre',
    TRIP_PERCENT: 'Percent of trip',
    FLAT_HOURLY: 'Flat hourly',
    TES: 'CBA (TES)',
  },

  payModelHint: {
    PER_KM: 'Euros per kilometre. Kilometres from the odometer, or from trip distances if there is none.',
    TRIP_PERCENT: 'Share of the carrier settlement for each trip.',
    FLAT_HOURLY: 'The same hourly rate for all hours, without supplements.',
    TES: 'Base pay and supplements under the chosen CBA rule set.',
  },

  tes: {
    title: 'CBA rules',
    subtitle:
      'Enter the figures from your current collective agreement. When the agreement is renewed, create a new rule set with a new start date — earlier periods keep the old rules.',
    add: 'New rule set',
    name: 'Name',
    validFrom: 'Valid from',
    base: 'Base pay, € / h',
    regular: 'Regular working time, h / day',
    ot1Hours: 'First overtime hours, h',
    ot1: 'Overtime increase, first hours, %',
    ot2: 'Overtime increase, further hours, %',
    evening: 'Evening supplement',
    night: 'Night supplement',
    from: 'from',
    to: 'until',
    perHour: '€ / h',
    saturday: 'Saturday supplement, %',
    sunday: 'Sunday supplement, %',
    note: 'Note',
    templates: 'Operator templates',
    copy: 'Copy as my own',
    own: 'My rule sets',
    none: 'No rule sets yet',
    later: 'Public holidays, weekly overtime and daily rest will be added later.',
    save: 'Save',
    inUse: 'This rule set is used by a pay model and cannot be deleted.',
    delete: 'Delete',
  },

  workReport: {
    title: 'Driver report',
    subtitle: 'Hours, kilometres, trips and pay for a period — for internal payments.',
    from: 'From',
    to: 'To',
    show: 'Show',
    driver: 'Driver',
    allDrivers: 'All drivers',
    colDate: 'Date',
    colHours: 'Work, h',
    colBreaks: 'Breaks, h',
    colEvening: 'Evening, h',
    colNight: 'Night, h',
    colSaturday: 'Sat, h',
    colSunday: 'Sun, h',
    colOvertime: 'Overtime, h',
    colKm: 'Km',
    colStops: 'Stops',
    colTrips: 'Trips',
    colModel: 'Model',
    colAmount: 'Indicative, €',
    total: 'Total',
    pdf: 'PDF',
    xlsx: 'Excel',
    csv: 'CSV',
    empty: 'No shifts or trips in this period',
    noRate: 'no model',
    fileName: 'driver-report',
    company: 'Carrier',
    generated: 'Generated',
  },

  partners: {
    title: 'Customers',
    subtitle:
      'Shippers whose transports you have driven. You can allow them to send transports straight to your vehicles — bypassing the load board.',
    trips: 'Trips',
    lastTrip: 'Last',
    allow: 'Allow direct orders',
    revoke: 'Withdraw',
    none: 'No transports driven yet',
    anonymity:
      'The shipper sees your vehicle plate, driver name and rating, but not your company name or the driver’s phone. The contracting party is still Aivomaa Oy.',
  },

  linkStatus: {
    OFFERED: 'Waiting for your decision',
    ACTIVE: 'Direct orders allowed',
    REVOKED: 'Not allowed',
  },

  known: {
    title: 'My vehicles',
    subtitle:
      'Vehicles that have driven your transports and whose carrier allows direct orders. A direct order goes to the vehicle without the load board.',
    pool: 'Regular vehicles',
    others: 'Other known vehicles',
    addPool: 'Add to regulars',
    removePool: 'Remove from regulars',
    trips: 'Trips',
    lastTrip: 'Last',
    busy: 'On a trip',
    available: 'Free',
    unavailable: 'Not available now',
    none: 'No known vehicles yet',
    noneHint:
      'A vehicle appears here once it has driven your transport and its carrier allows direct orders.',
  },

  direct: {
    dispatch: 'Dispatch',
    desk: 'To the load board',
    deskHint: 'Offers from up to three carriers, choice within 15 minutes.',
    direct: 'Straight to my vehicle',
    directHint:
      'No deadline: the transport waits until the vehicle confirms it. If it is cancelled, the transport goes to the load board.',
    chooseVehicle: 'Choose a vehicle',
    busyWarn:
      'The vehicle is on a trip now — confirmation may come only after it. For an urgent transport, use the load board.',
    noKnown: 'No known vehicles yet — the transport goes to the load board.',
    toDesk: 'Move to the load board',
    sendDirect: 'Send to my vehicle',
    badge: 'Direct order',
    carrierHint:
      'The shipper sent this transport straight to your vehicle. There is no deadline — confirm or decline. Declining moves it to the load board.',
    shipperHint:
      'The transport waits for the vehicle to confirm, with no deadline. You can move it to the load board at any time.',
    notKnown: 'The vehicle is no longer among your known vehicles.',
    unavailable: 'The vehicle is not taking transports right now.',
    notFit: 'The vehicle does not fit this transport: check the unit and weight.',
    hasOffers: 'Offers have already arrived for this transport — choose from them.',
  },

  money: {
    /*
     * Zero is not a placeholder: the customers are foreign companies,
     * and freight between VAT-registered businesses in different EU
     * states falls under reverse charge. The seller invoices at 0%
     * and the buyer accounts for the tax at home. See VAT_BPS in
     * lib/config.ts.
     */
    addVat: 'excl. VAT',
    vatByCountry: 'Amounts exclude VAT. The rate follows the counterparty country.',
    calcNote:
      'Amounts excl. VAT. For a Finnish company 25.5% is added; for a company in another country the reverse charge applies.',

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
    vatFree: 'excl. VAT',
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
    'order.containerSize': '{feet, number} ft',
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
    'report.notice': '{count, plural, one {# transport} other {# transports}} · {amount}',

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
    'lifecycle.wasNow': 'Was {before}, now {after}',
    'lifecycle.kmAndMoney': '{km, number} km · {amount}',
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
    'presence.tractorCount': '{count, plural, one {# tractor unit} other {# tractor units}}',
    'presence.truckCount': '{count, plural, one {# truck} other {# trucks}}',
    'presence.vanCount': '{count, plural, one {# van} other {# vans}}',
    'trip.arrivedAt': 'Arrived at {time}',
    'trip.completedAt': 'Done at {time}',
    'trip.markedNear': 'Marked {meters, number} m from the address',
    'trip.markedFar': 'Marked {km, number, ::.0#} km from the address',
    'trip.markedHere': 'Marked on site',
    'trip.damageAt': 'Damage · {place}',

    'trip.stepReported': 'Order {ref}: the driver marked “{step}”.',
    'trip.amended': 'The route changed on order {ref}: {change}',

    'amend.stopAt': '{kind} · {place}',
    'amend.fieldChange': '{label}: {from} → {to}',
    'amend.fieldValue': '{label}: {value}',
    'amend.pendingCount': '{count, plural, one {# change} other {# changes}}',
    'amend.madeAt': 'Changed {date}',

    'landing.cycleStage': 'Stage {no} / {total}',

    'pulse.week': '{no}',
    'pulse.weekAmount': 'Week {no} · {amount}',
    'pulse.totalOne': 'Week {no} total {amount}',
    'pulse.totalRange': 'Weeks {from}–{to} total {amount}',

    'event.order.published': 'New transport {ref} · {from} → {to}',
    'event.offer.received': 'New offer on transport {ref}',
    'event.offer.chosen': 'You were picked for transport {ref} — confirm within {minutes} minutes',
    'event.order.released': 'Transport {ref} is back on the board',
    'event.order.cancelled': 'Transport {ref} has been cancelled — see the change log',
    'event.order.amended': 'The route on transport {ref} changed',
    'event.trip.stop.done': 'Transport {ref}: {place} marked done ({done}/{total})',
    'event.order.closed': 'Transport {ref} is complete, the documents are available',
    'event.vehicle.approved': 'Vehicle {plate} is approved',
    'event.vehicle.rejected': 'Vehicle {plate} was not approved',

    'event.rating.received': 'The shipper rated trip {ref}: {score} / 5',
    'event.claim.opened': 'New claim {ref} on trip {order}',
    'event.claim.comment': 'New message in claim {ref}',
    'event.claim.attachment': 'New attachment in claim {ref}',
    'event.claim.status': 'Claim {ref}: {status, select, OPEN {open} IN_REVIEW {in review} RESOLVED {resolved} REJECTED {rejected} other {status changed}}',
    'claims.statusChange': '{from} → {to}',
    'claims.channelEmail': 'This claim is handled with the RAHTIS operator by email. Reply to the message you received or write to {email} quoting {ref}. You can follow the status and resolution here.',
    'claims.forwarded': 'Forwarded to the counterparty on {date}. Your messages are read by the RAHTIS operator, who handles the matter with the counterparty.',
    'claims.forwardedTo': 'Forwarded to the counterparty on {date} · {email}',
    'claims.openCount': '{count, plural, =0 {No open claims} one {# open claim} other {# open claims}}',
    'claims.onTrip': '{count, plural, one {# claim} other {# claims}}',
    'periodReport.range': 'Period {from}–{to}',
    'periodReport.tripsCount': '{count, plural, one {# trip} other {# trips}}',

    'legal.version': 'Version {n}',
    'legal.effective': 'In force from {date}',
    'legal.accepted': 'Accepted {date} · version {n}',

    'orderForm.repeatedFrom': 'Repeating transport {ref}. Dates and the trailer number are left empty: the new job has its own.',
    'orderForm.repeatSkipped': '{count, plural, one {One stop} other {# stops}} could not be repeated: the form has no field for a continuation.',
    'admin.companyOrders': '{count, plural, =0 {No transports} one {# transport} other {# transports}}',
    'orders.shownOf': 'Showing {shown} of {total}',
    'done.windowNote': 'The list shows the last {weeks} weeks. Older transports are found by number in the period documents or by asking the assistant.',
    'done.weekOf': 'Week of {date}',
    'done.closedAt': 'Completed {date}',
    'done.bps': '{rate, number, ::percent}',
    'direct.waiting': 'Waiting for {plate} to confirm',
    'event.order.direct': 'Direct order {ref} for {plate} — {shipper}',
    'event.direct.accepted': '{plate} confirmed transport {ref}',
    'event.direct.released': '{plate} did not take transport {ref} — it is now on the load board',
    'event.link.offer': 'You drove your first transport for {shipper}. Allow direct orders?',
    'drivers.count': '{count, plural, =0 {No drivers} one {# driver} other {# drivers}}',
    'drivers.onVehicle': 'On {plate}',
    'known.tripsCount': '{count, plural, one {# trip} other {# trips}} with you',
    'partners.tripsCount': '{count, plural, one {# trip} other {# trips}}',
    'pay.modelSince': '{model} from {date}',
    'driverApp.earnTrips': '{count, plural, one {# job} other {# jobs}}',
    'driverApp.earnHours': '{hours} h',
    'billingDesk.trips': '{count, plural, one {# job} other {# jobs}}',
    'billingDesk.period': 'Period {from}–{to}',
    'billingDesk.autoInvoice': 'Invoices go out automatically on {date}',
    'billingDesk.customerDue': 'Customers pay by {date}',
    'billingDesk.payoutDue': 'Carriers are paid on {date}',
    'driverApp.welcome': 'Welcome, {name}',
    'driverApp.breakTotal': 'Breaks {minutes} min',
    'driverApp.stopOf': 'Stop {n}/{total}',
    'driverApp.arrivedAt': 'Arrived at {time}',
    'driverApp.queued': '{count, plural, one {# entry waiting to be sent} other {# entries waiting to be sent}}',
    'driverApp.rejected': '{count, plural, one {One entry was not accepted} other {# entries were not accepted}} — check the job. Tap to close.',
    'driverApp.pendingSignOut': '{count, plural, one {# entry has not been sent yet} other {# entries have not been sent yet}}. If you sign out now, they will be lost.',
    'driverEvent.order.direct': 'New direct job {ref} for {plate}',
    'driverEvent.offer.chosen': 'Job {ref} for {plate} — confirm within {minutes} minutes',
    'driverEvent.order.released': 'Job {ref} is no longer yours',
    'driverEvent.order.cancelled': 'Job {ref} has been cancelled',
    'event.driver.problem': 'Driver {driver}, job {ref}: {text}',
    'drivers.smsBody': 'RAHTIS driver app: {link} — or sign in in the app with code {code}',
  },
} as const satisfies Dictionary;
