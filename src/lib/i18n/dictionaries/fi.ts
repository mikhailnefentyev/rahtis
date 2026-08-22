import type { Dictionary } from './index';

/**
 * Suomenkielinen sanasto.
 *
 * Rakenne tulee venäjänkielisestä sanastosta: se on esikuva, ja jokainen
 * puuttuva avain kaatuu käännösvaiheessa. Termit ovat alan omia — se on
 * tärkeämpää kuin kirjaimellinen käännös: kuljettaja tunnistaa sanat
 * rahtikirja, irtoperä ja tyhjäajo, ei niiden selityksiä.
 *
 * Monikko: suomessa on kaksi muotoa, one ja other. Venäjän neljää muotoa
 * ei kopioida — Intl.PluralRules hoitaa säännöt, tässä ovat vain muodot.
 */
export const fi = {
  meta: {
    label: 'Suomi',
    intl: 'fi-FI',
    htmlLang: 'fi',
  },

  brand: {
    name: 'RAHTIS',
    tagline: 'Freight Desk · Suomi',
    operator: 'Aivomaa Oy',
    description: 'Digitaalinen kuljetusalusta. Operaattori Aivomaa Oy, Suomi.',
  },

  role: {
    CARRIER: 'Kuljetusliike',
    SHIPPER: 'Rahdinantaja',
    ADMIN: 'Ylläpito · Aivomaa',
  },

  nav: {
    desk: 'Tilauspöytä',
    fleet: 'Kalusto',
    orders: 'Omat tilaukset',
    report: 'Viikkoraportti',
    moderation: 'Tarkastus',
    dispatch: 'Ajojärjestely · WhatsApp',
    invoices: 'Laskut rahdinantajille',
    payouts: 'Tilitykset kuljetusliikkeille',
    signOut: 'Kirjaudu ulos',
  },

  action: {
    save: 'Tallenna',
    cancel: 'Peruuta',
    close: 'Sulje',
    confirm: 'Vahvista',
    decline: 'Kieltäydy',
    details: 'Lisätiedot',
    collapse: 'Pienennä',
    publish: 'Julkaise',
    take: 'Otan',
    choose: 'Valitse',
    approve: 'Hyväksy',
    reject: 'Hylkää',
    add: 'Lisää',
    remove: 'Poista',
    upload: 'Lataa',
    export: 'Vie',
    retry: 'Yritä uudelleen',
    closeTrip: 'Päätä keikka',
    submitApplication: 'Lähetä hakemus',
    addVehicle: 'Lisää auto',
  },

  a11y: {
    close: 'Sulje',
    openMenu: 'Avaa valikko',
  },

  auth: {
    signInTitle: 'Kirjaudu sisään',
    signInSubtitle:
      'Avointa rekisteröitymistä ei ole. Aivomaa avaa pääsyn yrityksen tarkastuksen jälkeen.',
    email: 'Sähköposti',
    password: 'Salasana',
    submit: 'Kirjaudu',
    submitting: 'Kirjaudutaan…',
    signOut: 'Kirjaudu ulos',
    fillBoth: 'Anna sähköposti ja salasana',
    invalidCredentials: 'Väärä sähköposti tai salasana',
    noApplicationYet: 'Etkö ole vielä hakenut?',
    applyLink: 'Lähetä hakemus',

    noAccessTitle: 'Työtila ei ole käytettävissä',
    noProfileText:
      'Tunnus on olemassa, mutta sitä ei ole liitetty yhteenkään yritykseen. Näin käy, jos käyttäjä on luotu käsin. Ota yhteyttä Aivomaahan — pääsy avataan sinulle.',
    rejectedText:
      'Yrityksesi hakemus on hylätty. Ota yhteyttä Aivomaahan syyn selvittämiseksi ja hae uudelleen.',
  },

  cabinet: {
    company: 'Yritys',
    status: 'Tila',
    businessId: 'Y-tunnus',
    yourRole: 'Roolisi',
    stageNotice:
      'Osio avautuu seuraavissa vaiheissa. Nyt toimivat kirjautuminen, roolit ja käyttöoikeudet.',
    approvedCarrierHint:
      'Yritys on hyväksytty. Tilauspöytä avautuu, kun lataat asiakirjat ja lisäät autot — Aivomaa hyväksyy jokaisen auton erikseen.',
    approvedShipperHint:
      'Yritys on hyväksytty. Täydennä yritystiedot, niin voit julkaista tilauksia.',
  },

  orderStatus: {
    DRAFT: 'Luonnos',
    OPEN: 'Pöydällä',
    REQUESTED: 'Tarjouksia saapunut',
    AWAIT_DRIVER: 'Odottaa kuljettajaa',
    IN_PROGRESS: 'Ajossa',
    DONE: 'Valmis',
    CANCELLED: 'Peruttu',
  },

  tripStage: {
    accepted: 'Vastaanotti tilauksen',
    trailerPicked: 'Nouti perävaunun',
    loaded: 'Lastasi',
    unloaded: 'Purki',
    enRoute: 'Matkalla',
    handedOver: 'Luovutti',
  },

  trip: {
    progress: 'Keikan eteneminen',
    markDone: 'Merkitse tehdyksi',
    marking: 'Merkitään…',
    undo: 'Poista merkintä',
    damageQuestion: 'Vauriot tällä pisteellä',
    damagePlaceholder: 'Kolhu perävaunun vasemmassa laidassa, kapelli revennyt…',
    noDamage: 'Ei vaurioita',
    damageFound: 'Vaurio',
    passed: 'Tehty',
    nextStop: 'Seuraava piste',
    allDone: 'Kaikki pisteet tehty',
    failed: 'Pisteen merkitseminen ei onnistunut. Päivitä sivu ja yritä uudelleen.',
    outOfOrder: 'Pisteet merkitään järjestyksessä — tee ensin edelliset.',
    notYours: 'Vain nimetty kuljetusliike voi merkitä pisteitä.',

    closing: 'Keikan päättäminen',
    closingHint: 'Liitä rahtikirja ja kuvat — ne menevät rahdinantajalle valmis-merkinnän kanssa',
    close: 'Päätä keikka',
    closing_: 'Päätetään…',
    closed: 'Keikka on valmis',
    documents: 'Keikan asiakirjat',
    noDocuments: 'Asiakirjoja ei vielä ole',
    cmrRequired: 'Ilman rahtikirjaa keikkaa ei voi päättää',
    addFile: 'Lisää tiedosto',
    uploading: 'Ladataan…',
  },

  amend: {
    title: 'Reitin muutos',
    hint: 'Muuta tekemättömiä pisteitä — kuljetusliike näkee muutoksen heti',
    edit: 'Muuta',
    insertBefore: 'Lisää piste tämän eteen',
    insertLoad: 'Lastaus',
    insertUnload: 'Purku',
    remove: 'Poista piste',
    removing: 'Poistetaan…',
    save: 'Tallenna muutos',
    saving: 'Tallennetaan…',
    add: 'Lisää piste',
    adding: 'Lisätään…',
    passed: 'Tehty — ei muuteta',
    ends: 'Noutoa ja jättöä ei poisteta reitiltä',
    rateUnchanged: 'Muutos ei koske matkaa eikä hintaa — niistä sovitaan erikseen',
    none: 'Reittiä ei ole muutettu aloituksen jälkeen',
    empty: 'ei annettu',
    acknowledge: 'Kuittaan nähdyksi',
    acknowledged: 'Kuitattu',
    failed: 'Reitin muuttaminen ei onnistunut. Päivitä sivu ja yritä uudelleen.',
    notYours: 'Vain tämän keikan rahdinantaja voi muuttaa reittiä.',
  },

  landing: {
    eyebrow: 'Logistiikka-alusta · Suomi',
    titleA: 'Auto ei seiso.',
    titleB: 'Rahti ei odota.',
    lede:
      'Kukaan ei soittele kenellekään. Tilaus lähtee itse alueen autoille, tarjoukset tulevat minuuteissa, keikka etenee pisteittäin ja päättyy asiakirjoihin. Osapuolten välissä on Aivomaa Oy, joka vastaa lopputuloksesta.',
    asShipper: 'Olen rahdinantaja',
    asCarrier: 'Olen kuljetusliike',
    signIn: 'Kirjaudu',
    apply: 'Lähetä hakemus',
    moderationNote:
      'Avointa rekisteröitymistä ei ole: jokainen yritys tarkastetaan käsin PRH:n ja YTJ:n rekisteristä.',
    fleetLabel: 'hyväksyttyä autoa',
    fleetLive: 'päivittyy jokaisen hyväksynnän myötä',
    clients: 'Kenen kanssa toimimme',

    factDeadline: 'aikaa jokaiseen päätökseen, sitten tilaus siirtyy seuraaville',
    factOffers: 'sinä valitset, et tyydy ainoaan',
    factDocs: 'keikan päättyessä, ei viikon kuluttua',

    cabinet: 'Työtila',

    helpEyebrow: 'Mitä teemme',
    helpTitle: 'Autamme rahtia liikkumaan ja autoja pysymään ajossa',
    helpLede:
      'Aivomaa ei korvaa huolitsijaasi eikä kuljettajaasi. Poistamme sen, mikä estää heitä tekemästä työtään: etsimisen, sopimisen, saman selittämisen uudelleen ja kadonneet paperit.',
    helpCargo: 'Rahdille',
    helpCargoTitle: 'Lähtee samana päivänä',
    helpCargoText:
      'Tilaus lähtee alueen autoille heti julkaisun jälkeen. Sillä aikaa kun teet muuta, tarjoukset ovat jo tulleet.',
    helpTruck: 'Autolle',
    helpTruckTitle: 'Ei palaa tyhjänä',
    helpTruckText:
      'Alueesi tilauspöytä on auki jatkuvasti. Paluukeikka löytyy samasta paikasta, jossa merkitsit purun.',
    helpDriver: 'Kuljettajalle',
    helpDriverTitle: 'Ei soita ajojärjestelijälle',
    helpDriverText:
      'Osoite, portin yhteyshenkilö, varaus ja pisteen ohjeet ovat keikassa itsessään. Loput kertoo avustaja WhatsAppissa.',

    timeEyebrow: 'Seisonta maksaa yhtä paljon molemmille',
    timeTitle: 'Logistiikan kallein asia on aika',
    timeLede:
      'Kun rahdinantaja soittelee kuljetusliikkeitä, rahti seisoo. Kun kuljetusliike soittelee huolitsijoita, auto seisoo. Kuluu sama asia — tunnit, joiden aikana kukaan ei päässyt mihinkään.',
    timeOld: 'Näin se yleensä menee',
    timeOld1: 'Rahdinantaja soittelee tuttuja ja selittää rahdin joka kerta uudelleen',
    timeOld2: 'Kuljetusliike soittelee huolitsijoita, ettei auto ajaisi tyhjänä',
    timeOld3: 'Sovittiin suullisesti — päivän päästä ei tiedetä, kuka lupasi mitä',
    timeOld4: 'Kuljettaja soittaa ajojärjestelijälle osoitetta, numeroa ja portin aikoja',
    timeOld5: 'Asiakirjat tulevat viikon päästä, rahat peritään soittamalla',
    timeNew: 'Näin RAHTIS toimii',
    timeNew1: 'Tilaus julkaistaan kerran ja lähtee oikean alueen autoille',
    timeNew2: 'Pöytä on auki kaikille hyväksytyille autoille — kenenkään ei tarvitse etsiä',
    timeNew3: 'Ehdot on kirjattu: hinta, pisteet, ajat, vaatimukset autolle',
    timeNew4: 'Kuljettajalla on keikassa osoite, yhteystieto, varaus ja pisteen ohjeet',
    timeNew5: 'Asiakirjat liitetään päätettäessä, tilitys viikkoraportin mukaan',

    rolesEyebrow: 'Kenelle tämä on',
    rolesTitle: 'Kaksi osapuolta, kaksi eri tehtävää',
    shipperTitle: 'Kuljetusliikettä ei tarvitse etsiä — se löytyy itse',
    shipper1: 'Julkaisit kerran — tilaus lähti kaikille noutoalueen autoille',
    shipper2: 'Enintään kolme tarjousta, valitset kuljetusliikkeen arvion perusteella',
    shipper3: 'Reittiä voi muuttaa kesken keikan — kuljettaja saa tiedon itse',
    shipper4: 'Asiakirjat tulevat keikan päättyessä, ei viikon kuluttua',
    shipper5: 'Viikkoraportti: keikat, summat, asiakirjat, arviot',
    carrierTitle: 'Auto ei seiso keikkojen välissä',
    carrier1: 'Alueesi tilauspöytä on auki jatkuvasti — ei tarvitse soitella kenellekään',
    carrier2: 'Paluukeikka löytyy samasta paikasta: tyhjäajo on sinun rahaasi',
    carrier3: 'Hyväksyntä annetaan jokaiselle autolle erikseen',
    carrier4: 'Hinta, provisio ja tilityssumma näkyvät ennen kuin otat keikan',
    carrier5: 'Viikkoraportti: mitä on ansaittu ja milloin se tulee',

    stepsEyebrow: 'Keikan polku',
    stepsTitle: 'Hakemuksesta tilitykseen — neljä askelta',
    step1: 'Yrityksen tarkastus',
    step1Text: 'Y-tunnus tarkistetaan rekisteristä, kuljetusliikkeeltä myös lupa ja vakuutus.',
    step2: 'Autojen hyväksyntä',
    step2Text: 'Operaattori hyväksyy jokaisen auton erikseen. Pöytä avautuu vain hyväksytyille.',
    step3: 'Keikka pisteittäin',
    step3Text: 'Nouto, lastaukset ja purut merkitään järjestyksessä. Tila on sama kaikille kolmelle.',
    step4: 'Asiakirjat',
    step4Text:
      'Ilman rahtikirjaa keikkaa ei päätetä. Rahtikirja ja kuvat menevät rahdinantajalle valmis-merkinnän kanssa.',

    faultsEyebrow: 'Katkeamattomuus',
    faultsTitle: 'Logistiikka hajoaa pikkuasioista. Ne on otettu huomioon',
    faultsLede:
      'Katkeamattomuus ei ole lupaus siitä, ettei mitään satu, vaan kuvattu toiminta silloin kun sattuu. Näin käy ilman yhtäkään puhelua ajojärjestelijälle.',
    fault1: 'Kuljettaja ei vahvistanut 15 minuutissa',
    fault1Text:
      'Tilaus palaa itse pöydälle ja lähtee seuraaville autoille. Määräaika on tieto kannassa, ei ajastimen tehtävä.',
    fault2: 'Satama siirsi aikaikkunan, varasto meni kiinni',
    fault2Text:
      'Rahdinantaja muuttaa pisteen kesken keikan. Muutos kirjautuu lokiin, ja kuljetusliike näkee merkinnän «muutoksia rahdinantajalta».',
    fault3: 'Perävaunu naarmuuntui noudossa',
    fault3Text:
      'Vaurio kirjataan juuri sille pisteelle kuvan ja kellonajan kanssa — näkyy, kenen osuudella se tapahtui.',
    fault4: 'Joku perui ennen aloitusta',
    fault4Text:
      'Peruutus palauttaa tilauksen pöydälle ja ilmoitukset lähtevät kaikille. Keikka ei jää roikkumaan osapuolten väliin.',

    aiEyebrow: 'Kuljettajan avustaja',
    aiSoon: 'Tulossa',
    aiTitle: 'Kuljettajalla on aina joku kysyttävänä',
    aiLede:
      'WhatsAppissa on auki keskustelu, joka tietää tästä keikasta kaiken. Ei nappibotti eikä automaattivastaaja: se vastaa sillä kielellä, joka kuljettajalle sopii.',
    aiOnline: 'WhatsApp · paikalla',
    aiQ1: 'Milloin Kotkan portti on auki?',
    aiA1: 'Hietanen: ma–pe 06:00–22:00, la 08:00–16:00. Sinulla on purku klo 07:00 — portti on auki.',
    aiQ2: 'Mistä saan lisää liinoja ja kulmasuojia?',
    aiA2: 'Lähin liike reitilläsi: Kotka, 4 km ennen terminaalia. Auki klo 18 asti.',
    aiQ3: 'Ehdinkö ajaa vielä Turkuun tänään?',
    aiA3: 'Ajoaikaa on jäljellä 3 h 20 min, matkaa 2 h 40 min. Ehdit, mutta tauko pitää pitää ennen lähtöä.',
    ai1: 'Tietää keikan ulkoa',
    ai1Text: 'Osoite, portin yhteyshenkilö, varaus, perävaunun numero — viestejä ei tarvitse selata.',
    ai2: 'Löytää senkin, mitä tilauksessa ei ole',
    ai2Text: 'Terminaalin aukioloajat, varaston numero, mistä saa liinoja ja kulmasuojia, missä voi pitää tauon.',
    ai3: 'Laskee ajoajan',
    ai3Text: 'Kertoo, ehditkö vuoron loppuun mennessä ja milloin on tauon aika.',
    ai4: 'Merkitsee pisteet kuljettajan puolesta',
    ai4Text: 'Kirjoitti «purettu» — tilan näkivät sekä rahdinantaja että kuljetusliike. Ilman puhelua.',
    ai5: 'Kutsuu ihmisen, kun ei ole varma',
    ai5Text: 'Epäselvä tapaus siirtyy Aivomaan ajojärjestelijälle eikä jää vastaamatta.',
    ai6: 'Puhuu hänen kieltään',

    servicesEyebrow: 'Suunnat',
    servicesTitle: 'Aloitimme irtoperistä, etenemme rahtiin',
    serviceLive: 'Toiminnassa',
    serviceSoon: 'Avaamme',
    service1: 'Puoliperävaunujen vaihto',
    service1Text:
      'Veturi noutaa perävaunusi satamasta tai terminaalista, hoitaa lastaukset ja purut ja jättää sen kentälle. Suomi, sitten Skandinavia.',
    service2: 'Rahti omalla perävaunulla',
    service2Text:
      'Kuljetusliike tulee omalla kalustollaan: kapelli, kylmäkone, kippi irtotavaralle, lavetti erikoiskuljetuksiin. Kerrot painon ja mitat — me löydämme auton.',

    finalEyebrow: 'Näin pääset alkuun',
    finalTitle: 'Kerro yrityksestäsi — muun hoidamme me',
    finalLede:
      'Tarvitsemme nimen, Y-tunnuksen ja sähköpostin. Tarkastamme yrityksen rekisteristä ja lähetämme tunnukset. Kuljetusliikkeeltä tarvitaan lisäksi lupa ja vakuutus.',
    applyShipper: 'Rahdinantajan hakemus',
    applyCarrier: 'Kuljetusliikkeen hakemus',
    footerCountry: 'Suomi',
  },

  done: {
    titleCarrier: 'Tehdyt keikat',
    titleShipper: 'Valmiit tilaukset',
    titleAdmin: 'Laskut ja tilitykset',
    subtitleCarrier: 'Päätetyt keikat viikoittain ja tilityssummat.',
    subtitleShipper: 'Valmiit tilaukset viikoittain ja maksettavat summat.',
    subtitleAdmin: 'Kenelle lasku ja kenelle tilitys.',
    open: 'Avaa',
    collapse: 'Pienennä',
    none: 'Tehtyjä keikkoja ei vielä ole',
    noneHint: 'Päätetty keikka päätyy tänne asiakirjojen ja summan kanssa.',
    rate: 'Hinta',
    commission: 'Provisio',
    payout: 'Tilitys',
    margin: 'Kate',
    clients: 'Rahdinantajille — laskut',
    carriers: 'Kuljetusliikkeille — tilitykset',
    company: 'Yritys',
    trips: 'Keikkoja',
    distance: 'Matka',
    noPartners: 'Tällä jaksolla ei päätetty keikkoja',
    allTime: 'Koko ajalta',
  },

  amendKind: {
    STOP_ADDED: 'Piste lisätty',
    STOP_CHANGED: 'Piste muutettu',
    STOP_REMOVED: 'Piste poistettu',
  },

  tripDocument: {
    CMR: 'CMR / rahtikirja',
    LOADING_PHOTO: 'Kuva lastauksesta',
    UNLOADING_PHOTO: 'Kuva purusta',
    DAMAGE_PHOTO: 'Kuva vauriosta',
  },

  companyStatus: {
    PENDING: 'Tarkastuksessa',
    APPROVED: 'Hyväksytty',
    ACTIVE: 'Aktiivinen',
    REJECTED: 'Hylätty',
  },

  vehicleAccess: {
    DRAFT: 'Luonnos',
    PENDING: 'Tarkastuksessa',
    APPROVED: 'Hyväksytty',
    REJECTED: 'Ei hyväksytty',
  },

  orderType: {
    TRAILER_SWAP: 'Puoliperävaunun vaihto',
    ROUND_TRIP: 'Rengasajo',
    ONE_WAY: 'Rahti yhteen suuntaan',
  },

  placeKind: {
    PORT: 'Satama',
    TERMINAL: 'Terminaali',
    PARKING: 'Parkki',
    ADDRESS: 'Osoite',
  },

  stopKind: {
    PICKUP: 'Perävaunun nouto',
    EXTRA_LOAD: 'Lastaus',
    EXTRA_UNLOAD: 'Purku',
    TRAILER_RETURN: 'Perävaunun jättö',
    DELIVERY: 'Purku',
    CONTINUATION: 'Keikan jatko',
  },

  order: {
    ref: 'Tilausnumero',
    trailer: 'Perävaunu',
    distance: 'Matka',
    rate: 'Hinta',
    ratePerKm: 'Hinta kilometriltä',
    comment: 'Tilauksen kommentti',
    commentPlaceholder: 'Satamalupa, sinetti, lämpötila…',
    changelog: 'Muutokset aloituksen jälkeen',
    changelogFromShipper: 'Muutoksia rahdinantajalta',
    offers: 'Tarjoukset',
    noDamage: 'Ei vaurioita',
    damage: 'Vauriot',
    damagePlaceholder: 'Kolhu perävaunun vasemmassa laidassa',
    documents: 'Asiakirjat',
    trips: 'Keikkoja',
    cargoAndPayment: 'Rahti ja maksu',
    closeTitle: 'Keikan päättäminen',

    consignee: 'Vastaanottaja',
    sealRequired: 'Sinetti',
  },

  orderForm: {
    title: 'Uusi tilaus',
    subtitle: 'Täytä koko reitti ja julkaise — tilaus ilmestyy kuljetusliikkeiden pöydälle.',
    type: 'Keikan tyyppi',
    shipperRef: 'Oma tilausnumerosi',
    shipperRefHint: 'Vapaaehtoinen. Alustan numero annetaan automaattisesti',

    trailerPickupSection: 'Mistä perävaunu noudetaan',
    dropSection: 'Mihin perävaunu jätetään',
    cargoSection: 'Rahti ja maksu',

    placeName: 'Paikan nimi',
    address: 'Osoite',
    addressHint: 'Katu, numero, postinumero, kaupunki. Valitse ehdotuksesta — kaupunki ja matka täyttyvät itse',
    city: 'Kaupunki',
    date: 'Päivä',
    time: 'Kello',
    company: 'Yritys',
    contact: 'Yhteyshenkilö',
    phone: 'Puhelin',

    remove: 'Poista',

    trailerState: 'Perävaunu',
    trailerLoaded: 'Kuormattu',
    trailerEmpty: 'Tyhjä',
    addUnload: '+ Purku',
    addLoad: '+ Lastaus',
    actionsSection: 'Mitä keikalla tehdään',
    actionsHint: 'Purkuja ja lastauksia voi olla kuinka monta tahansa, missä järjestyksessä tahansa',
    noActions: 'Lisää vähintään yksi tapahtuma — purku tai lastaus',

    bookingRef: 'Varausnumero REF',
    cargoWeight: 'Rahdin paino, t',
    cargoWeightHint: 'Enintään 76 tonnia — HCT-yhdistelmien raja',
    consignee: 'Rahdin vastaanottaja',
    consigneeHint: 'Kenelle rahti menee tältä pisteeltä',
    loadingRef: 'Lastauksen tilausnumero',
    loadingRefHint: 'Lähettäjän oma numero, jos sellainen on',
    seal: 'Sinetti',
    sealUnknown: 'Ei tiedossa',
    sealYes: 'Tarvitaan',
    sealNo: 'Ei tarvita',
    stopNote: 'Pisteen ohjeet',
    stopNotePlaceholder: 'Varausnumero, portin lupa, soita tuntia ennen…',

    trailer: 'Perävaunun tyyppi',
    trailerPlaceholder: 'Kapelli 13,6, 3 akselia',
    trailerPlate: 'Perävaunun numero',
    trailerPlateHint: 'Sillä kuljettaja löytää perävaunun kentältä — pakollinen',
    distance: 'Matka, km',
    rate: 'Hinta, €',

    publish: 'Julkaise · lähetys alueen autoille',
    publishing: 'Julkaistaan…',
    published: 'Tilaus julkaistu',
    needActive: 'Täydennä yritystiedot — ilman niitä tilausta ei voi julkaista.',
    failed: 'Tilauksen julkaisu ei onnistunut. Tarkista kentät ja yritä uudelleen.',
  },

  orders: {
    title: 'Omat tilaukset',
    subtitle: 'Julkaistut tilaukset ja niiden tila.',
    newOrder: 'Uusi tilaus',
    none: 'Tilauksia ei vielä ole',
    noneHint: 'Julkaise ensimmäinen tilaus — se ilmestyy kuljetusliikkeiden pöydälle.',
    route: 'Reitti',
    shipperRefShort: 'Oma numero',
  },

  routing: {
    searching: 'haetaan…',
    approximate: 'suunnilleen',
    weakMatch: 'Osoite löytyi epätarkasti — tarkista se ja kilometrit.',
    unavailable: 'Reitin laskenta ei ole nyt käytettävissä, anna matka käsin.',
    suggestFailed: 'Ehdotusta ei saatu. Kirjoita osoite kokonaan.',
    routeFailed: 'Reitin laskenta ei onnistunut. Anna matka käsin.',
    needTwoPoints: 'Tarvitaan koordinaatit vähintään kahdelle pisteelle.',
    calculate: 'Laske teitä pitkin',
    calculating: 'Lasketaan reittiä…',
    auto: 'laskettu kuorma-autolle',
    manual: 'annettu käsin',
    recalculate: 'Laske uudelleen',
    noCoordinates: 'Valitse osoitteet ehdotuksesta — silloin matka laskee itsensä.',
    mapLabel: 'Reittikartta',
  },

  matching: {
    take: 'Otan',
    taking: 'Lähetetään…',
    taken: 'Tarjouksesi on vastaanotettu',
    noSlots: 'Paikat täynnä',
    slots: 'Paikkoja varattu',
    chooseVehicle: 'Millä autolla otat',
    waitingChoice: 'Odotetaan rahdinantajan valintaa',
    offers: 'Tarjoukset',
    chooseCarrier: 'Valitse vaihtoehto',
    choose: 'Valitse',
    awaitDriver: 'Odotetaan kuljettajan vahvistusta',
    confirm: 'Vahvista keikka',
    decline: 'Kieltäydy',
    cancel: 'Peruuta',
    assignments: 'Omat keikat',
    noAssignments: 'Kiinnitettyjä keikkoja ei ole',
    noAssignmentsHint: 'Ota tilaus pöydältä — se ilmestyy tänne.',
    chosenYou: 'Rahdinantaja valitsi teidät',
    chosenYouHint: 'Vahvista keikka 15 minuutin kuluessa, muuten tilaus palaa pöydälle.',
    inProgress: 'Keikka ajossa',
    assignedCarrier: 'Keikan tekijä',
    contactsNow: 'Vastaanottajan yhteystiedot ovat auki — tilaus on kiinnitetty teille.',
    failed: 'Toiminto ei onnistunut. Päivitä sivu ja yritä uudelleen.',
    tooLate: 'Määräaika umpeutui, tilaus palasi pöydälle.',
    noSlotsLeft: 'Paikkoja ei enää ole — tilaukseen tarjosi kolme autoa.',
    alreadyTaken: 'Olette jo tarjonneet tähän tilaukseen.',
  },

  desk: {
    title: 'Tilauspöytä',
    subtitle: 'Avoimet tilaukset alueilta, joilla autonne ovat.',
    allRegions: 'Kaikki alueet',
    empty: 'Tällä alueella ei ole tilauksia',
    emptyHint: 'Vaihda aluetta suodattimesta tai odota uusia julkaisuja.',
    closedTitle: 'Pöytä on suljettu',
    closedNoVehicle:
      'Pöydän näkeminen ja tarjoaminen vaatii vähintään yhden hyväksytyn auton. Lisää auto — Aivomaa tarkastaa sen ja antaa hyväksynnän.',
    closedExpired:
      'Yrityksen asiakirjat ovat vanhentuneet — autojen hyväksyntä ei ole voimassa. Lataa uusittu lupa tai vakuutus.',
    openFleet: 'Kalusto',
    contactsHidden: 'Vastaanottajan yhteystiedot avautuvat, kun tilaus kiinnitetään teille.',
    details: 'Reitti ja tiedot',
  },

  moderation: {
    queue: 'Tarkastusjono',
    applications: 'Rekisteröitymishakemukset',
    vehicles: 'Autot hyväksyntään',
    approveAndInvite: 'Hyväksy · lähetä kutsu',
    rejectWithReason: 'Hylkää',
    reasonLabel: 'Hylkäyksen syy',
    reasonPlaceholder: 'Y-tunnusta ei löydy PRH:n rekisteristä',
    vehicleReasonPlaceholder: 'Vakuutus ei kata kansainvälisiä kuljetuksia',
    reasonRequired: 'Kerro syy — yritys näkee sen',
    inviteSent: 'Kutsu lähetetty',
    inviteFailed: 'Yritys hyväksyttiin, mutta viesti ei lähtenyt',
    resendInvite: 'Lähetä kutsu uudelleen',
    accessGranted: 'Pääsy avattu',
    noUsersYet: 'Kutsua ei ole lähetetty',
    recent: 'Käsitellyt hakemukset',
    decidedAt: 'Päätös',
  },

  apply: {
    title: 'Rekisteröitymishakemus',
    subtitle:
      'Avointa rekisteröitymistä ei ole. Aivomaa tarkastaa jokaisen yrityksen rekisteristä ja lähettää tunnukset annettuun sähköpostiin.',
    iAmCarrier: 'Olen kuljetusliike',
    iAmShipper: 'Olen rahdinantaja',
    submit: 'Lähetä hakemus Aivomaalle',
    submitting: 'Lähetetään…',
    carrierNote:
      'Hyväksynnän jälkeen: kirjautuminen → lupa ja vakuutus → autojen tiedot. Hyväksyntä annetaan jokaiselle autolle erikseen.',
    shipperNote: 'Hyväksynnän jälkeen: kirjautuminen → yritystiedot → tilausten julkaisu.',
    sentTitle: 'Hakemus lähetetty',
    duplicate: 'Tällä Y-tunnuksella on jo hakemus vireillä tai hyväksytty.',
    failed: 'Hakemuksen lähetys ei onnistunut. Yritä uudelleen.',
  },

  requisites: {
    title: 'Yritystiedot',
    subtitleShipper:
      'Tarvitaan laskutusta varten. Tallennuksen jälkeen yritys muuttuu aktiiviseksi.',
    subtitleCarrier:
      'Tarvitaan tilityksiä varten. Tallennuksen jälkeen yritys muuttuu aktiiviseksi.',

    legalSection: 'Viralliset tiedot',
    legalName: 'Virallinen nimi',
    legalNameHint: 'Kuten rekisterissä — jos poikkeaa alustalla käytetystä nimestä',
    street: 'Katu ja numero',
    postalCode: 'Postinumero',
    city: 'Kaupunki',
    country: 'Maa',
    vat: 'ALV-numero',
    vatHint: 'Johdettu Y-tunnuksesta — korjaa, jos yrityksellä on ryhmän numero',
    vatInvalid: 'Muoto: maatunnus ja kahdesta kahteentoista merkkiä, esimerkiksi FI12345678',

    billingSection: 'Laskutus',
    billingSameAsLegal: 'Laskutusosoite on sama kuin virallinen',
    billingEmail: 'Kirjanpidon sähköposti',
    billingEmailHint: 'Tänne tulevat laskut',
    billingReference: 'Laskujen viite',
    billingReferenceHint: 'Tilausnumero tai kustannuspaikka, joka painetaan laskuun',

    einvoiceSection: 'Verkkolaskut',
    einvoiceOptional: 'Vapaaehtoinen. Täytä, jos vastaanotat laskuja operaattorin kautta.',
    ovt: 'OVT-tunnus / EDI-koodi',
    ovtHint: 'Yleensä 0037 ja Y-tunnus ilman väliviivaa',
    ovtInvalid: '8–17 kirjainta ja numeroa',
    operator: 'Välittäjä',
    operatorHint: 'Välittäjän tunnus: Maventa, Basware, Apix ja muut',
    operatorInvalid: '4–20 merkkiä',

    payoutSection: 'Tilitykset',
    iban: 'IBAN',
    ibanHint: 'Tili, jolle keikkojen tilitykset maksetaan',
    ibanInvalid: 'IBAN ei läpäise tarkistussummaa — tarkista numerot',
    bic: 'BIC / SWIFT',
    bicHint: 'Suomalaisille tileille ei tarvita, ulkomaisille kyllä',
    bicInvalid: 'Muoto: 8 tai 11 merkkiä, esimerkiksi NDEAFIHH',

    save: 'Tallenna ja aktivoi',
    saving: 'Tallennetaan…',
    saved: 'Tiedot tallennettu, yritys on aktiivinen',
    incomplete: 'Kaikkia pakollisia kenttiä ei ole täytetty',
    failed: 'Tietojen tallennus ei onnistunut. Yritä uudelleen.',
    alreadyActive: 'Yritys on jo aktiivinen. Tietoja voi muuttaa milloin tahansa.',
    fillToActivate: 'Täydennä yritystiedot aktivoidaksesi yrityksen',
    openForm: 'Täydennä yritystiedot',
  },

  invite: {
    title: 'Aseta salasana',
    subtitle: 'Kutsu on hyväksytty. Keksi salasana kirjautumista varten.',
    password: 'Uusi salasana',
    repeat: 'Toista salasana',
    submit: 'Tallenna ja kirjaudu',
    tooShort: 'Salasanan pitää olla vähintään 8 merkkiä',
    mismatch: 'Salasanat eivät täsmää',
    linkExpired: 'Linkki ei kelpaa tai on vanhentunut. Pyydä uusi kutsu Aivomaalta.',
  },

  report: {
    weeklyPayouts: 'Viikoittaiset tilitykset kuljetusliikkeille',
    dailyInvoices: 'Päivittäinen yhteenveto rahdinantajittain',
    byMachine: 'Erittely autoittain',
  },

  vehicle: {
    plate: 'Rekisterinumero',
    driver: 'Kuljettaja',
    languages: 'Kielet',
    whatsapp: 'WhatsApp / puhelin',
    axles: 'Vetoauton akselit',
    make: 'Merkki / malli',
    euro: 'Päästöluokka',
    base: 'Kotipaikka',
    rating: 'Arvio',
  },

  fleet: {
    title: 'Kalusto',
    subtitle:
      'Tilauspöytä avautuu, kun yrityksellä on vähintään yksi hyväksytty auto ja voimassa olevat asiakirjat.',
    addVehicle: 'Lisää auto',
    newVehicle: 'Uusi auto',
    editVehicle: 'Auton tiedot',
    submitForApproval: 'Lähetä hyväksyntään',
    deleteDraft: 'Poista luonnos',
    noVehicles: 'Autoja ei vielä ole',
    noVehiclesHint: 'Lisää auto — Aivomaa tarkastaa sen ja antaa hyväksynnän.',
    onReview: 'Aivomaa tarkastaa asiakirjat ja auton tiedot',
    rejectedHint: 'Ei hyväksytty — korjaa huomautus ja lähetä uudelleen',
    canTakeOrders: 'Yritys voi ottaa tilauksia',
    cannotTakeOrders: 'Tilauspöytä on suljettu',
    whyClosedNoDocs: 'Lataa voimassa olevat yrityksen lupa ja vakuutus.',
    whyClosedNoVehicle: 'Tarvitaan vähintään yksi hyväksytty auto.',
    whyClosedExpired: 'Yrityksen asiakirjat ovat vanhentuneet — hyväksyntä ei ole voimassa.',
    languagesHint: 'Millä kielillä kuljettaja puhuu ajojärjestelijän kanssa',
  },

  documents: {
    title: 'Yrityksen asiakirjat',
    subtitle: 'Operaattori tarkastaa luvan ja vakuutuksen yhdessä autojen kanssa.',
    CARRIER_LICENSE: 'Liikennelupa',
    INSURANCE: 'Vakuutus (CMR / vastuu)',
    upload: 'Lataa',
    replace: 'Korvaa',
    uploading: 'Ladataan…',
    view: 'Avaa',
    file: 'Tiedosto',
    validUntil: 'Voimassa',
    validUntilRequired: 'Vakuutukselle voimassaolo on pakollinen',
    perpetual: 'toistaiseksi',
    expired: 'vanhentunut',
    notUploaded: 'ei ladattu',
    tooLarge: 'Tiedosto on yli 10 MB',
    wrongType: 'Sallitut muodot: PDF, JPG, PNG ja WEBP',
    uploadFailed: 'Tiedoston lataus ei onnistunut. Yritä uudelleen.',
    replacedNotice: 'Edellinen versio säilytetään annettujen hyväksyntöjen perusteena.',
    attention: 'Vaativat huomiota',
    attentionHint:
      'Näillä yrityksillä on hyväksyttyjä autoja, mutta asiakirjat ovat vanhentuneet tai vanhenevat pian.',
  },

  company: {
    name: 'Yrityksen nimi',
    businessId: 'Y-tunnus',
    email: 'Sähköposti',
    emailHint: 'Tänne tulevat tunnukset',
    license: 'Liikennelupa',
    insurance: 'Vakuutus (CMR / vastuu)',
  },

  doc: {
    uploaded: 'ladattu',
    missing: 'ei ladattu',
  },

  money: {
    addVat: '+ ALV 25,5 %',
    calcNote:
      'Laskelmat ilman veroa. Laskuihin ja tilityksiin lisätään ALV 25,5 %, suomalaisille yrityksille.',

    gross: 'Bruttohinta',
    commission: 'Provisio',
    payout: 'Tilitys',
    revenue: 'Liikevaihto · laskut',
    margin: 'Kate',
    total: 'Yhteensä',
  },

  unit: {
    km: 'km',
  },

  rating: {
    title: 'Arvio',
    none: 'ei arvioita',
    rate: 'Arvioi kuljetusliike',
    yours: 'Sinun arviosi',
    received: 'Rahdinantajan arvio',
    addComment: 'Lisää kommentti',
    editComment: 'Muuta kommenttia',
    commentPlaceholder: 'Myöhästyi purusta, asiakirjat kunnossa…',
    commentTitle: 'Rahdinantajan kommentti',
    save: 'Tallenna',
    saving: 'Tallennetaan…',
    starFirst: 'Anna ensin tähtiarvio',
    failed: 'Arvion antaminen ei onnistunut. Päivitä sivu ja yritä uudelleen.',
    company: 'Yrityksen arvio',
  },

  countdown: {
    expired: 'aika loppui',
    unknown: '—:—',
  },

  empty: {
    noOrders: 'Tällä alueella ei ole tilauksia.',
    noOrdersHint: 'Vaihda aluetta suodattimesta tai odota uusia julkaisuja.',
    noApplications: 'Uusia hakemuksia ei ole.',
    noVehicles: 'Tarkastuksessa ei ole autoja.',
    noTrips: 'Tällä viikolla ei ole keikkoja.',
    noMessages: 'Kuljettajalta ei ole vielä viestejä.',
    noAccessTitle: 'Ei pääsyä tilauksiin',
    noAccessText:
      'Pöydän näkeminen ja tarjoaminen vaatii vähintään yhden hyväksytyn auton.',
  },

  validation: {
    required: 'Täytä tämä kenttä',
    businessId: 'Muoto: 7 numeroa, väliviiva, tarkistusnumero',
    email: 'Anna kelvollinen sähköposti',
    positiveNumber: 'Anna nollaa suurempi luku',
  },

  error: {
    generic: 'Jokin meni pieleen. Yritä uudelleen.',
    notFound: 'Sivua ei löydy',
    forbidden: 'Ei pääsyä tähän osioon',
  },

  /**
   * ICU MessageFormat -viestit.
   *
   * Suomessa on kaksi monikkomuotoa: one ja other. Venäjän neljää muotoa
   * ei kopioida — ylimääräinen muoto on harmiton, puuttuva antaa väärän
   * tekstin.
   */
  msg: {
    'order.offersCounter':
      '{count, plural, one {# tarjous} other {# tarjousta}} / {max} — valitse auto',
    'order.offersFull': 'Paikat täynnä {count} / {max}',
    'order.distance': '{km, number} km',
    'order.ratePerKm': '{rate}/km',
    'order.tripsCount': '{count, plural, one {# keikka} other {# keikkaa}}',

    'vehicle.axlesCount': '{count, plural, one {# akseli} other {# akselia}}',
    'vehicle.accessGranted': 'Auto {plate} on hyväksytty tilauksiin.',

    'moderation.queued': '{count, plural, one {# hakemus} other {# hakemusta}} jonossa',

    'rating.summary': 'Arvio {value} / 5',
    'rating.summaryWithCount':
      'Arvio {value} / 5, {count, plural, one {# arvio} other {# arviota}}',
    'rating.setValue': 'Anna arvio {stars} / 5',

    'countdown.left': '{time} palautukseen',

    'money.withVat': 'ALV:n kanssa {amount}',
    'money.commissionRate': 'Provisio {rate, number, ::percent}',
    'money.marginRate': 'Kate · {rate, number, ::percent}',

    'report.weekTotal': 'Viikko yhteensä: {amount}',

    'signup.submitted':
      'Aivomaa tarkastaa yrityksen {company} (Y-tunnus {businessId}) rekisteristä ja lähettää tunnukset osoitteeseen {email}.',
    'moderation.pendingCount':
      '{count, plural, =0 {Uusia hakemuksia ei ole} one {# hakemus odottaa päätöstä} other {# hakemusta odottaa päätöstä}}',
    'moderation.invitedTo': 'Kutsu lähetetty osoitteeseen {email}',
    'moderation.decidedBy': 'Päätös tehty {date}',

    'fleet.vehiclesCount':
      '{count, plural, =0 {Autoja ei ole} one {# auto} other {# autoa}}',
    'fleet.approvedCount':
      '{count, plural, =0 {ei hyväksyttyjä} one {# hyväksytty} other {# hyväksyttyä}}',
    'fleet.pendingCount':
      '{count, plural, =0 {Tarkastuksessa ei ole autoja} one {# auto tarkastuksessa} other {# autoa tarkastuksessa}}',

    'documents.expiresIn':
      'Vanhenee {count, plural, one {# päivän} other {# päivän}} kuluttua',
    'documents.expiredAgo':
      'Vanhentui {count, plural, one {# päivä} other {# päivää}} sitten',
    'documents.validUntilDate': 'Voimassa {date} asti',

    'desk.ordersCount':
      '{count, plural, =0 {Tilauksia ei ole} one {# tilaus} other {# tilausta}}',
    'desk.regionCount': '{city} · {count}',

    'routing.result': '{km, number} km · noin {hours} h {minutes} min',
    'routing.legDistance': 'osuus {km, number} km',

    'stop.weight': '{tonnes, number, ::.0#} t',
    'stop.consignee': '{label}: {name}',

    'order.stopsCount':
      '{count, plural, one {# piste} other {# pistettä}} reitillä',
    'order.publishedAt': 'Julkaistu {date}',
    'matching.slotsTaken': '{count} / {max}',
    'matching.variant': 'Vaihtoehto {no}',
    'matching.basedIn': 'Kotipaikka {city}',
    'matching.offersCount':
      '{count, plural, =0 {Tarjouksia ei ole} one {# tarjous} other {# tarjousta}} / {max}',

    'trip.stageAt': '{stage} · {place}',
    'trip.progressCount': 'Tehty {done} / {total}',
    'trip.enRouteTo': 'Matkalla · {place}',
    'trip.completedAt': 'Tehty {time}',
    'trip.damageAt': 'Vaurio · {place}',

    'trip.stepReported': 'Tilaus {ref}: kuljettaja merkitsi «{step}».',
    'trip.amended': 'Reitin muutos tilauksessa {ref}: {change}',

    'amend.stopAt': '{kind} · {place}',
    'amend.fieldChange': '{label}: {from} → {to}',
    'amend.fieldValue': '{label}: {value}',
    'amend.pendingCount': '{count, plural, one {# muutos} other {# muutosta}}',
    'amend.madeAt': 'Muutettu {date}',

    'landing.regions': '{count, plural, one {# alue} other {# aluetta}}',

    'done.weekOf': 'Viikko alkaen {date}',
    'done.closedAt': 'Päätetty {date}',
    'done.bps': '{rate, number, ::percent}',
  },
} as const satisfies Dictionary;
