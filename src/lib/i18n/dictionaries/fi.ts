/**
 * Suomenkielinen sanasto.
 *
 * Rakenne tulee venäjänkielisestä sanastosta, mutta kieli ei: venäjän
 * lauserakenne käännettynä sanasta sanaan kuulostaa käännökseltä, ja sen
 * huomaa ensimmäisestä rivistä. Siksi lauseet on kirjoitettu uudelleen,
 * ei käännetty — suomalainen yritysteksti on lyhyempää ja suorempaa.
 *
 * Termit ovat alan omia: kuormatarjonta, rahtikirja, irtoperä, tyhjäajo,
 * tilitys, hyväksyntä. Kuljettaja tunnistaa nämä sanat, ei niiden
 * selityksiä.
 *
 * Monikko: suomessa on kaksi muotoa, one ja other.
 */
export const fi = {
  meta: {
    label: 'Suomi',
    intl: 'fi-FI',
    htmlLang: 'fi',
  },

  brand: {
    name: 'RAHTIS',
    tagline: 'Irtoperät ja kontit · Skandinavia',
    operator: 'RAHTIS',
    /* Юрлицо. Только там, где его требует закон: договоры, счета, отчёты. */
    legalEntity: 'Aivomaa Oy',
    description: 'Irtoperien ja konttien kuljetusalusta Skandinavian satamissa.',
  },


  /*
   * Тексты для поисковика и для превью ссылки.
   *
   * Отдельным разделом, а не в brand: brand.description — одна фраза о
   * компании, и она стояла описанием сразу пяти страниц. Поисковик
   * считает такое дублем, а человек в выдаче не понимает, чем страницы
   * различаются.
   *
   * Заголовок главной раньше был просто «RAHTIS»: самое дорогое поле на
   * сайте занимало слово, которое никто не ищет.
   */
  seo: {
    homeTitle: 'Kuljetusalusta ja tarjouspöytä: irtoperät, kontit ja pikakuljetukset',
    homeDescription:
      'RAHTIS välittää irtoperien vaihdot, konttikuljetukset ja pikakuljetukset hyväksytyille kuljetusliikkeille Suomessa ja Skandinaviassa — ja toimii alustana kuljetusliikkeelle, joka ajaa omia asiakkaitaan: kuljettajan sovellus, työaika, rahtikirjat ja raportit. Tilaus tavoittaa sopivat autot heti, kuljetus näkyy vaihe vaiheelta ja asiakirjat syntyvät samaan paikkaan.',
    termsDescription:
      'RAHTIS-palvelun käyttöehdot: osapuolten vastuut, kuljetuksen kulku, maksut ja tilitykset sekä sopimuksen voimassaolo.',
    privacyDescription:
      'Miten RAHTIS käsittelee henkilötietoja: mitä tietoja kerätään, mihin niitä käytetään, kuinka kauan niitä säilytetään ja mitkä ovat rekisteröidyn oikeudet.',
    signinDescription: 'Kirjaudu RAHTIS-palveluun tilaajana tai kuljetusliikkeenä.',
    applyDescription:
      'Hae RAHTIS-palveluun. Tarkistamme Y-tunnuksen ja yrityksen tiedot rekistereistä, kuljetusliikkeiltä lisäksi liikenneluvan ja vakuutuksen.',
    forgotDescription: 'Palauta unohtunut salasana RAHTIS-palveluun.',
  },

  notFound: {
    title: 'Sivua ei löytynyt',
    lede: 'Osoite on voinut muuttua, tai sivua ei ole koskaan ollut. Etusivulta löytyvät palvelu, referenssit ja yhteydenotto.',
    home: 'Etusivulle',
    signIn: 'Kirjaudu palveluun',
  },

  role: {
    CARRIER: 'Kuljetusliike',
    SHIPPER: 'Tilaaja',
    ADMIN: 'Ylläpito · RAHTIS',
  },

  nav: {
    overview: 'Yleiskuva',
    desk: 'Avoimet kuljetukset',
    fleet: 'Kalusto',
    orders: 'Omat kuljetukset',
    report: 'Viikkoraportti',
    moderation: 'Tarkastus',
    dispatch: 'Ajojärjestely',
    invoices: 'Laskutus',
    payouts: 'Tilitykset',
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
    take: 'Otan kuljetuksen',
    choose: 'Valitse',
    approve: 'Hyväksy',
    reject: 'Hylkää',
    add: 'Lisää',
    remove: 'Poista',
    upload: 'Lataa',
    export: 'Vie',
    retry: 'Yritä uudelleen',
    closeTrip: 'Päätä kuljetus',
    submitApplication: 'Lähetä hakemus',
    addVehicle: 'Lisää ajoneuvo',
  },

  a11y: {
    close: 'Sulje',
    openMenu: 'Avaa valikko',
  },

  auth: {
    signInTitle: 'Kirjaudu sisään',
    signInSubtitle: 'Avointa rekisteröitymistä ei ole. RAHTIS avaa tunnukset tarkastuksen jälkeen.',
    email: 'Sähköposti',
    password: 'Salasana',
    submit: 'Kirjaudu',
    submitting: 'Kirjaudutaan…',
    signOut: 'Kirjaudu ulos',
    fillBoth: 'Anna sähköposti ja salasana',
    serviceDown: 'Palvelu ei juuri nyt vastaa. Yritä hetken kuluttua uudelleen — salasanasi on kunnossa.',
    invalidCredentials: 'Sähköposti tai salasana ei täsmää',
    noApplicationYet: 'Etkö ole vielä hakenut mukaan?',
    applyLink: 'Lähetä hakemus',

    noAccessTitle: 'Omat sivut eivät ole käytettävissä',
    noProfileText:
      'Tunnus on olemassa, mutta sitä ei ole liitetty yritykseen. Ota yhteyttä RAHTIS-tukeen, niin avaamme pääsyn.',
    frozenTitle: 'Tunnukset on jäädytetty',
    frozenText:
      'Yrityksen tunnukset on jäädytetty. Tiedot ja kuljetushistoria säilyvät. Ota yhteyttä RAHTIS-tukeen, niin selvitämme asian.',
    rejectedText:
      'Yrityksesi hakemus on hylätty. Ota yhteyttä RAHTIS-tukeen, niin kerromme syyn ja voit hakea uudelleen.',
  },

  cabinet: {
    company: 'Yritys',
    status: 'Tila',
    businessId: 'Y-tunnus',
    yourRole: 'Roolisi',
    approvedCarrierHint:
      'Yritys on hyväksytty. Lataa liikennelupa ja vakuutus sekä lisää ajoneuvot, niin avoimet kuljetukset tulevat näkyviin. Hyväksymme jokaisen ajoneuvon erikseen.',
    approvedShipperHint:
      'Yritys on hyväksytty. Täydennä yritystiedot, niin voit julkaista kuljetuksia.',
    partnership: 'Tapa käyttää palvelua',
    partnershipSub: 'Alusta kuukausimaksulla',
    partnershipCon: 'Alihankinta',
    partnershipSubText:
      '29,90 € (ilman alv:tä) kuukaudessa jokaisesta autosta, joka ajoi kuukauden aikana. Omat asiakkaasi ja heidän suorat tilauksensa laskutat itse; tarjouspöydältä otetusta keikasta 3 %.',
    partnershipConText:
      '3 % jokaisen keikan hinnasta, vähennetään tilityksestä. Laskut asiakkaille, rahtikirjat ja reklamaatiot hoidamme me; kuukausimaksua ei peritä.',
    partnershipChange: 'Tavan vaihto sovitaan meidän kanssamme.',
    freeUntil: 'Maksuton {date} asti',
    feeOpen: 'Maksamaton kuukausimaksu {amount}',
  },

  orderStatus: {
    DRAFT: 'Luonnos',
    OPEN: 'Avoin',
    REQUESTED: 'Tarjouksia',
    AWAIT_DRIVER: 'Odottaa kuljettajaa',
    IN_PROGRESS: 'Ajossa',
    DONE: 'Valmis',
    CANCELLED: 'Peruttu',
  },

  tripStage: {
    accepted: 'Otti kuljetuksen',
    trailerPicked: 'Nouti perävaunun',
    loaded: 'Lastasi',
    unloaded: 'Purki',
    enRoute: 'Matkalla',
    handedOver: 'Palautti perävaunun',
  },

  trip: {
    photos: 'Kuvat ja asiakirjat',
    signature: 'Allekirjoitus',
    fromApp: 'Kuljettajan sovelluksesta',
    signatureNoCmr: 'Kuljettaja otti allekirjoituksen, mutta rahtikirjaa ei kuvattu. Lataa CMR, niin keikan voi sulkea.',
    progress: 'Kuljetuksen eteneminen',
    markDone: 'Merkitse tehdyksi',
    marking: 'Merkitään…',
    locating: 'Haetaan sijaintia…',
    /*
     * Sijainti ei ole pakollinen, joten sen puuttuminen kerrotaan, ei
     * estetä: kuljettaja kellarilastauslaiturilla saa pisteen tehdyksi,
     * mutta kaikki kolme osapuolta näkevät, ettei merkintää syntynyt.
     */
    noPosition: 'Ilman sijaintia',
    positionAway: 'Merkitty etäältä',
    undo: 'Peru merkintä',
    damageQuestion: 'Vauriot tällä pisteellä',
    damagePlaceholder: 'Kolhu perävaunun vasemmassa laidassa, kapelli revennyt…',
    noDamage: 'Ei vaurioita',
    damageFound: 'Vaurio',
    passed: 'Tehty',
    nextStop: 'Seuraava piste',
    allDone: 'Kaikki pisteet tehty',
    failed: 'Merkintä ei onnistunut. Päivitä sivu ja yritä uudelleen.',
    outOfOrder: 'Pisteet merkitään järjestyksessä. Merkitse ensin edelliset pisteet.',
    notYours: 'Vain kuljetusta ajava kuljetusliike voi merkitä pisteitä.',

    closing: 'Kuljetuksen päättäminen',
    closingHint: 'Liitä rahtikirja ja kuvat. Ne välittyvät tilaajalle heti.',
    close: 'Päätä kuljetus',
    closing_: 'Päätetään…',
    closed: 'Kuljetus on valmis',
    documents: 'Kuljetuksen asiakirjat',
    noDocuments: 'Ei vielä asiakirjoja',
    cmrRequired: 'Ilman rahtikirjaa kuljetusta ei voi päättää',
    addFile: 'Lisää tiedosto',
    uploading: 'Ladataan…',
  },

  amend: {
    title: 'Reitin muutos',
    hint: 'Muuta pisteitä, joilla ei ole vielä käyty. Kuljetusliike näkee muutoksen heti.',
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
    passed: 'Piste on jo käyty, sitä ei voi muuttaa',
    ends: 'Noutoa ja palautusta ei voi poistaa',
    rateUnchanged: 'Muutos ei koske matkaa eikä hintaa. Niistä sovitaan erikseen.',
    none: 'Reittiä ei ole muutettu',
    empty: 'ei annettu',
    acknowledge: 'Kuittaa nähdyksi',
    acknowledged: 'Kuitattu',
    failed: 'Muutos ei onnistunut. Päivitä sivu ja yritä uudelleen.',
    notYours: 'Vain kuljetuksen tilaaja voi muuttaa reittiä.',
  },

  landing: {
    menuService: 'Palvelu',
    menuRoles: 'Kenelle',
    menuSteps: 'Näin se toimii',
    menuAssistant: 'Avustaja',
    menuSignIn: 'Kirjaudu',
    /*
     * Kärki nimeää sen, mitä oikeasti liikutetaan.
     *
     * 'Logistiikka-alusta Suomessa' lupasi kaiken rahdin koko maassa.
     * Kapea lupaus, joka pitää, tuo enemmän kuin laaja, jonka takana ei
     * ole mitään — mutta lupauksen on katettava se, mitä alusta tekee.
     * Pikakuljetusten myötä niitä on kolme, ja kaksi ensimmäistä riviä
     * eivät enää mahtuneet luettelemaan yksiköitä yksi per rivi.
     *
     * Siksi ensimmäinen rivi luettelee, toinen lupaa ja kolmas kertoo
     * hyödyn. Rytmi on entinen ja jokainen rivi mahtuu: pisin on yhä
     * kolmas, jolle otsikon koko aikoinaan mitattiin.
     *
     * 'Kuorma' eikä 'paketti': pikakuljetus ei ole postipaketti vaan
     * enintään 26 tonnia auton kyydissä. Sama sana on kabinetissakin.
     */
    eyebrow: 'Irtoperät, kontit ja pikakuljetukset · Skandinavia',
    /* Irtoperä, ei perävaunu: sama sana kuin kärjessä ja palvelussa. */
    titleA: 'Irtoperä, kontti, kuorma.',
    titleB: 'Jokainen lähtee ajallaan.',
    titleC: 'Turhat puhelut jäävät pois.',
    lede: 'Julkaise tilaus, ja sopivat kuljetusliikkeet saavat sen heti. Kuljetus näkyy vaihe vaiheelta, kuvat ja asiakirjat samassa paikassa.',
    /* Kolme asiaa, joiden takia palveluun tullaan. */
    highlight1: 'Muutos ei pysäytä kuljetusta',
    highlight2: 'Emme kilpailuta hintaa alaspäin',
    highlight3: 'Asiakirjat ja tilitykset sähköisesti',
    asShipper: 'Huolitsijalle tai operaattorille',
    asCarrier: 'Kuljetusliikkeelle',
    signIn: 'Kirjaudu palveluun',
    apply: 'Lähetä hakemus',
    fleetLabel: 'hyväksyttyä autoa',
    regionsLabel: 'toiminta-aluetta',
    regions: 'Toiminta-alueet',

    /*
     * Kaksi haaraa — sama jako, jolla kuljetustarjonta on kabinetissa
     * jaettu kahtia. Sivu kertoo tuotteen rakenteen sellaisena kuin se
     * on, eikä keksi sille omaa jäsennystä: vetoautolla ajava näkee
     * irtoperät ja kontit, paketti- tai kuorma-autolla ajava pikakuljetukset.
     *
     * Lohko on heti kärjen alla, koska se vastaa kysymykseen «ajatteko
     * te minun rahtiani» kahdessa sekunnissa — ennen kuin kukaan lukee
     * riviäkään muuta.
     */
    branchesEyebrow: 'Kaksi tapaa liikuttaa rahtia',
    /*
     * Otsikko erottaa haarat verbillä, ei substantiivilla.
     *
     * 'Yksikkö vai kuorma' kysyy lukijalta jotain, mitä hän ei vielä
     * tiedä. 'Vedetään' ja 'ajetaan' kertovat eron itse, yhdellä
     * silmäyksellä ja ilman kysymysmerkkiä — ja tekevät kahdesta
     * puolikkaasta symmetriset.
     */
    branchesTitle: 'Yksikkö vedetään, kuorma ajetaan',
    branchesLede:
      'Kumpikin kulkee alustalla samalla tavalla: julkaisu, tarjoukset, kuljetus vaihe vaiheelta, asiakirjat ja tilitys. Ero on siinä, mitä autolle annetaan ja mitä tilaaja kertoo.',
    /*
     * Kortin yläotsikko nimeää kaluston, ei haaraa: haaran sanoo jo
     * osion otsikko, ja sen toistaminen kortissa luki änkytyksenä.
     */
    unitBranch: 'Vetoauto',
    unitBranchTitle: 'Yksikkö haetaan ja jätetään',
    unitBranchText:
      'Vetoauto hakee irtoperän tai kontin sovitusta paikasta, hoitaa matkan pisteet ja jättää sen perille. Kuljettaja löytää oikean yksikön numerosta, alusta oikean auton yksikön mitoista.',
    /*
     * Kolme riviä avain–arvo, molemmissa korteissa samat avaimet.
     *
     * Keskimmäinen rivi on tärkein: se vastaa kysymykseen «mitä minun
     * pitää tietää ennen kuin julkaisen». Leipäteksti vastaa siihen
     * myös, mutta sen pitää lukea; taulukon lukee silmä.
     */
    branchFleet: 'Kalusto',
    branchTells: 'Tilaaja kertoo',
    branchExtra: 'Lisäksi',
    unitFleet: 'Vetoauto, 2–3 akselia',
    unitTells: 'Yksikön numero ja noutopaikka',
    unitExtra: 'Kontit 20–45 ft · ADR',
    expressBranch: 'Pakettiauto tai kuorma-auto',
    expressBranchTitle: 'Kuorma kulkee auton kyydissä',
    expressBranchText:
      'Tilaaja kertoo nouto- ja toimitusosoitteen, lavametrit ja painon; mitat ja pakkaustapa lisätietoihin. Nouto ja toimitus kuitataan kartalle, ja rahtikirja sekä mahdolliset vauriokuvat tulevat mukana.',
    expressFleet: 'Enintään 3,5 t tai 26 t',
    expressTells: 'Lavametrit, paino, kaksi osoitetta',
    expressExtra: 'Perälautanostin · Sivulastaus · Kylmäkone',
    /* Maat nimillä, ei tunnuksilla: nauha luetaan, ei tulkita. */
    country: { FI: 'Suomi', SE: 'Ruotsi', NO: 'Norja', DK: 'Tanska' },

    /*
     * Neljä vaihetta, jotka kuljetus oikeasti käy läpi. Tekstit ovat samat
     * kuin palvelussa, jotta kortti vastaa sitä, mitä käyttäjä myöhemmin
     * näkee omilla sivuillaan.
     */
    cycle1: 'Tarjolla',
    cycle1Note: 'Julkaistu ja välitetty alueen kuljetusliikkeille',
    cycle2: 'Tarjouksia 2 / 3',
    cycle2Note: 'Tilaaja valitsee hinnan ja arvostelujen perusteella',
    cycle3: 'Ajossa · yksikkö noudettu',
    cycle3Note: 'Kuljettaja merkitsee pisteet järjestyksessä',
    cycle4: 'Valmis · rahtikirja liitetty',
    cycle4Note: 'Asiakirjat tilaajalla, tilitys viikkoraportissa',
    cabinet: 'Omat sivut',

    helpEyebrow: 'Mitä RAHTIS tekee',
    helpTitle: 'Pidämme rahdin liikkeessä ja autot ajossa',
    helpLede:
      'RAHTIS on kaksi asiaa samassa: tarjouspöytä, jolta kuljetusliike saa työtä ja tilaaja tekijän, sekä alusta, jolla kuljetusliike ajaa omat asiakkaansa. Emme korvaa huolitsijaa, ajojärjestelyä tai kuljetusliikettä — poistamme etsimisen, soittelun, saman asian selvittämisen moneen kertaan ja hajallaan olevat asiakirjat.',
    helpCargo: 'Huolitsijalle ja operaattorille',
    helpCargoTitle: 'Tilaus liikkeelle nopeasti',
    helpCargoText:
      'Julkaise kuljetus kerran. Tieto välittyy heti alueen hyväksytyille kuljetusliikkeille, ja tarjoukset tulevat samaan näkymään.',
    helpTruck: 'Kuljetusliikkeelle',
    helpTruckTitle: 'Vähemmän tyhjäajoa',
    helpTruckText:
      'Näet alueesi avoimet keikat yhdessä paikassa. Kun edellinen kuljetus päättyy, voit etsiä seuraavan keikan suoraan samalta alueelta.',
    helpDriver: 'Kuljettajalle',
    helpDriverTitle: 'Kaikki keikan tiedot yhdessä paikassa',
    helpDriverText: 'Osoitteet, yhteyshenkilöt, varaukset ja toimintaohjeet kulkevat kuljettajan sovelluksessa koko keikan ajan. Kuittaukset ja kuvat hoituvat samasta paikasta.',

    timeEyebrow: 'Seisonta maksaa kaikille',
    timeTitle: 'Logistiikassa aika maksaa',
    timeLede:
      'Kun kuljetuksen tilaaja etsii vapaata autoa puhelimitse, rahti odottaa. Kun kuljetusliike etsii seuraavaa kuormaa, auto seisoo. Ja kun auto ajaa omia asiakkaita, aika kuluu rahtikirjoihin, laskuihin ja työaikakirjanpitoon. RAHTIS ei neuvottele hintaa alas — se poistaa vaiheet, joissa aika kuluu.',
    /*
     * Rivit ovat pareja: vasen ja oikea sanovat saman asian, ennen ja
     * jälkeen. Aiemmin tässä oli kaksi erillistä kuuden virkkeen listaa,
     * ja lukijan piti itse arvata mikä kuului mihinkin. Nyt pari on
     * yhdellä rivillä, joten vertailun tekee taitto eikä lukija — ja
     * silloin virke saa lyhentyä ilmaukseksi.
     */
    timeOld: 'Näin se usein toimii nyt',
    timeNew: 'Näin RAHTIS toimii',
    timeOld1: 'Soitot yhdelle kerrallaan',
    timeNew1: 'Yksi julkaisu, koko alue',
    timeOld2: 'Auto etsii kuormaa puhelimitse',
    timeNew2: 'Avoimet keikat yhdessä näkymässä',
    timeOld3: 'Sovittu jää puheluiden varaan',
    timeNew3: 'Hinta, aikataulu ja reitti kirjattuna',
    timeOld4: 'Kuljettaja kyselee osoitteita',
    timeNew4: 'Osoitteet ja ohjeet keikan mukana',
    timeOld5: 'Rahtikirja tulee päivien päästä',
    timeNew5: 'Asiakirjat heti valmistuttua',
    timeOld6: 'Laskutus selviää jälkikäteen',
    timeNew6: 'Keikat ja tilitykset viikkoraportissa',
    timeOld7: 'Kuriirin sijainti selviää soittamalla',
    timeNew7: 'Nouto ja toimitus kuitataan kartalle',

    rolesEyebrow: 'Kenelle RAHTIS on tarkoitettu',
    rolesTitle: 'Yksi alusta, kolme tapaa tulla mukaan',
    shipperEyebrow: 'Huolitsijalle ja operaattorille',
    shipperTitle: 'Kuljetusliikettä ei tarvitse etsiä yksi kerrallaan.',
    /*
     * Neljä kohtaa kuuden sijaan. Julkaisu kerran, asiakirjat heti ja
     * viikkoraportti sanottiin jo edellisessä osiossa; toistettuina ne
     * eivät vahvista lupausta vaan pidentävät listan. Jäljellä on se,
     * mitä vain tästä näkökulmasta voi sanoa.
     */
    shipper2: 'Saat enintään kolme tarjousta samaan näkymään.',
    shipper3: 'Valitset sopivan kuljetusliikkeen hinnan, kaluston ja arvostelujen perusteella.',
    shipper4:
      'Jos reitti, aikataulu tai muu tieto muuttuu kesken keikan, päivitys menee suoraan kuljetusliikkeelle ja kuljettajalle.',
    shipper6: 'Viikkoraportista näet keikat, summat, asiakirjat ja palautteet.',
    shipper7: 'Integraatio omaan järjestelmään (ERP/TMS) rajapinnan kautta on mahdollinen – sovitaan erikseen.',
    shipper5:
      'Jos auto peruu tai ei vahvista, keikka palaa tarjolle itsestään ja välittyy seuraaville sopiville autoille saman tien.',
    carrier2:
      'Vähemmän tyhjäajoa tarkoittaa enemmän ajettuja kilometrejä samalla autolla ja samalla kuljettajalla.',
    carrierEyebrow: 'Kuljetusliikkeelle · alihankinta',
    carrierTitle: 'Pidä auto ajossa myös keikkojen välillä.',
    carrier3: 'Voit löytää paluukeikan alueelta, jossa edellinen kuljetus päättyy.',
    carrier4: 'Jokainen auto hyväksytään palveluun erikseen.',
    carrier5:
      'Laskun asiakkaalle, rahtikirjat ja reklamaatiot hoidamme me. Maksat 3 % keikan hinnasta, kuukausimaksua ei ole.',
    carrier6: 'Viikkoraportista näet ajetut keikat, ansiot ja tulevat tilitykset.',
    carrier7:
      'Kuljettajan sovellus kuuluu mukaan: keikat, työaika, kuormakuvat, rahtikirja, paikkakartta ja kuljettajan oma kieli.',

    /*
     * Kolmas kortti: kuljetusliike, jolla on jo asiakkaat. Hän ei osta
     * meiltä työtä vaan työkalut, ja hinta on siksi toinen.
     */
    ownEyebrow: 'Kuljetusliikkeelle · omat asiakkaat',
    ownTitle: 'Aja omat asiakkaasi meidän työkaluillamme.',
    own1: 'Kuljettajan sovellus: keikat, työaika, kuormakuvat, rahtikirja ja allekirjoitus puhelimessa.',
    own2: 'Työaika ja suuntaa-antava palkka omilla hinnoillasi tai työehtosopimuksen taulukoilla.',
    own3: 'Kartta tauko-, pesu- ja huoltopaikoista Suomessa, Ruotsissa, Norjassa ja Tanskassa.',
    own4: 'Asiakkaasi lähettää tilauksen suoraan autollesi. Laskutat sen itse ja pidät koko hinnan.',
    own5: 'Maksat 29,90 € kuukaudessa autosta, joka ajoi. Seisova auto on maksuton.',
    own6: 'Tarjouspöytä on silti käytössäsi, kun auto jää vapaaksi.',

    stepsEyebrow: 'Näin keikka etenee',
    stepsTitle: 'Hakemuksesta valmiiseen kuljetukseen neljässä vaiheessa',
    step1: 'Yrityksen tarkastus',
    step1Text:
      'Tarkistamme Y-tunnuksen ja yrityksen tiedot rekistereistä. Kuljetusliikkeiltä tarkistamme lisäksi liikenneluvan ja vakuutuksen.',
    step2: 'Autojen hyväksyntä',
    step2Text:
      'Jokainen auto hyväksytään palveluun erikseen. Avoimet keikat näkyvät vain hyväksytylle kalustolle.',
    step3: 'Kuljetus vaihe vaiheelta',
    step3Text:
      'Nouto-, lastaus- ja purkupisteet näkyvät oikeassa järjestyksessä. Keikan tila päivittyy samanaikaisesti tilaajalle, kuljetusliikkeelle ja kuljettajalle.',
    step4: 'Asiakirjat',
    step4Text:
      'Keikkaa ei merkitä valmiiksi ennen kuin tarvittavat asiakirjat on lisätty. Rahtikirja ja kuvat toimitetaan tilaajalle samalla, kun kuljetus valmistuu.',

    faultsEyebrow: 'Kun suunnitelma muuttuu',
    faultsTitle: 'Poikkeustilanteet kuuluvat logistiikkaan. Siksi myös niille on oma toimintamalli.',
    faultsLede:
      'Jos aikataulu muuttuu, kuljettaja peruu tai noudossa havaitaan vaurio, tieto ei jää puheluiden tai yksittäisten viestien varaan. Tapahtuma kirjataan suoraan keikalle ja näkyy kaikille osapuolille.',
    fault1: 'Kuljettaja ei vahvista keikkaa 15 minuutissa',
    fault1Text:
      'Keikka vapautuu automaattisesti takaisin tarjolle ja välitetään seuraaville sopiville autoille. Se ei jää odottamaan vahvistusta määräämättömäksi ajaksi.',
    fault2: 'Satama muutti aikaikkunaa tai varasto sulkeutui',
    fault2Text:
      'Tilaaja päivittää tiedon suoraan keikalle. Muutos tallentuu tapahtumahistoriaan ja näkyy heti kuljetusliikkeelle ja kuljettajalle.',
    fault3: 'Noudossa havaittiin vaurio yksikössä tai kuormassa',
    fault3Text:
      'Vaurio kirjataan kyseiselle noutopisteelle kuvan ja kellonajan kanssa. Näin tapahtumasta jää selkeä dokumentointi.',
    fault4: 'Kuljetus perutaan ennen aloitusta',
    fault4Text:
      'Peruutettu keikka palautuu automaattisesti tarjolle ja siitä lähtee tieto sopiville kuljetusliikkeille.',

    aiEyebrow: 'Kuljettajan sovellus',
    aiTitle: 'Keikka kulkee kuljettajan puhelimessa',
    aiLede:
      'RAHTIS-kuljettajasovellus näyttää keikan pisteet, osoitteet, aikaikkunat ja yhteyshenkilöt. Saapuminen, kuvat, allekirjoitus ja kuittaus hoituvat napilla, ilman viestittelyä.',
    aiLede2:
      'Sovellus asennetaan puhelimen kotinäytölle kuljetusliikkeen lähettämällä linkillä tai koodilla. Se toimii myös satamassa ilman verkkoa.',
    appBack: 'Tehtävät',
    appStopOf: 'Pysähdys 2/3',
    appBanner: 'Purku · Kotka',
    appPickupRole: 'Nouto',
    appPickupDone: 'Tehty 06.42',
    appUnloadRole: 'Purku',
    appArrived: 'Saapui 07.05',
    appSign: 'Vastaanottajan allekirjoitus',
    appDone: 'Merkitse tehdyksi',
    appReturnRole: 'Perävaunun palautus',
    appNavTasks: 'Tehtävät',
    appNavInbox: 'Viestit',
    appNavProfile: 'Profiili',
    ai1: 'Keikka yhdessä näkymässä',
    ai1Text:
      'Pisteet järjestyksessä, osoitteet, aikaikkunat, yhteyshenkilöt ja yksikön numero. Navigointi ja soitto yhdellä napilla.',
    ai2: 'Saapuminen ja kuittaus napilla',
    ai2Text:
      'Kellonaika ja paikka tallentuvat kuittaushetkeltä. Seisonta näkyy saapumisesta, ja tila päivittyy tilaajalle ja kuljetusliikkeelle.',
    ai3: 'Kuvat ja vauriot',
    ai3Text:
      'Perävaunun jokainen puoli, sinetti ja uusi vaurio kuvataan sovelluksessa. Toimituksessa noudon kuva on vieressä vertailua varten.',
    ai4: 'Allekirjoitus ja rahtikirja',
    ai4Text:
      'Lastauksessa ja purussa sovellus ottaa allekirjoituksen ja rahtikirjan kuvan. Kuljetusliike sulkee keikan ilman erillistä latausta.',
    ai5: 'Toimii ilman verkkoa',
    ai5Text:
      'Merkinnät ja kuvat odottavat puhelimessa ja lähtevät, kun yhteys palaa. Aikana säilyy kuittaushetki, ei lähetyshetki.',
    ai6: 'Ilmoitukset puhelimeen',
    ai6Text:
      'Uusi keikka, suora tilaus tai peruutus tulee ilmoituksena, vaikka sovellus olisi kiinni.',

    /*
     * Kolme myöhemmin valmistunutta osaa, joita osio ei tuntenut:
     * paikkakartta, ansiot ja kuljettajan oma kieli. Kaksi ensimmäistä
     * ovat syitä, joiden vuoksi kuljettaja avaa sovelluksen silloinkin,
     * kun auto seisoo; kolmas on syy, jonka vuoksi hän ymmärtää sen.
     */
    ai7: 'Kartta tauko- ja huoltopaikoista',
    ai7Text:
      'Yli 500 paikkaa Suomessa, Ruotsissa, Norjassa ja Tanskassa: tankkaus, pysäköinti, suihku ja korjaamo. Sovellus näyttää lähimmät myös silloin, kun auto seisoo tauolla — maksuttomat ja vartioidut erikseen merkittynä.',
    ai8: 'Kuljettaja näkee ansionsa',
    ai8Text:
      'Keikan jälkeen sovellus näyttää, paljonko siitä kertyi ja mihin kuukauden summa on noussut. Laskenta tulee kuljetusliikkeen valitsemasta mallista tai työehtosopimuksen taulukoista.',
    ai9: 'Kuljettajan oma kieli',
    ai9Text:
      'Sovellus puhuu puhelimen kieltä: suomi, englanti, viro, venäjä, ruotsi, latvia, liettua, puola, norja ja tanska. Kielen voi myös valita itse profiilista.',

    servicesEyebrow: 'Palvelu laajenee vaiheittain',
    /*
     * Otsikko kertoi lupauksen, joka on jo pidetty.
     *
     * 'Aloitamme irtoperäliikenteestä ja laajennamme' oli totta silloin,
     * kun muuta ei ollut. Nyt kontit ja pikakuljetukset ovat
     * toiminnassa, ja saman lauseen toistaminen kertoisi lukijalle, että
     * mitään ei ole tapahtunut. Mennyt aikamuoto todistaa sen, mitä osio
     * lupaa: laajeneminen on tapahtunut kerran, joten se tapahtuu taas.
     */
    servicesTitle: 'Aloitimme irtoperistä — nyt mukana kontit ja pikakuljetukset',
    serviceLive: 'Toiminnassa',
    service1: 'Irtoperävaunujen kuljetukset',
    service1Text:
      'Veturi noutaa perävaunun satamasta tai terminaalista, hoitaa sovitut lastaukset ja purut ja toimittaa perävaunun seuraavaan sovittuun paikkaan.',
    service1Text2: 'Toimimme Skandinavian satamissa: Suomi, Ruotsi, Norja ja Tanska.',
    /*
     * Toinen palvelu on kontit, ei yleinen rahti.
     *
     * Tässä luki aiemmin 'kuljetukset kuljetusliikkeen omalla
     * kalustolla' — kapelli, kylmä, kippi, lavetti. Sitä ei luvata nyt:
     * alusta tekee irtoperiä ja kontteja, ja lupaus, jonka takana ei
     * ole toimintaa, maksaa enemmän kuin puuttuva rivi.
     */
    service2: 'Konttikuljetukset',
    service2Text:
      'Veturi noutaa kontin satamasta tai terminaalista — tyhjänä tai kuormattuna — ja toimittaa sen sovittuun paikkaan. Paluumatkalla kontti palautetaan satamaan.',
    service2Text2:
      'Koko ilmoitetaan jaloissa: 20, 30, 40 tai 45. Keikan näkevät vain ne ajoneuvot, joiden alusta ottaa juuri sen kokoisen kontin.',

    /*
     * Pikakuljetukset seisovat samalla rivillä kahden muun kanssa, eivät
     * katkoviivalla: ne toimivat. Katkoviiva jää sille, mitä ei vielä
     * ole — kuljettajan sovellukselle.
     */
    service4: 'Pikakuljetukset',
    service4Text:
      'Pakettiauto tai kuorma-auto noutaa kuorman sovitusta osoitteesta ja vie sen perille. Kuorma kulkee auton kyydissä, eikä matkalla vaihdeta yksikköä.',
    service4Text2:
      'Tilaaja kertoo lavametrit ja painon; nouto ja toimitus kuitataan kartalle. Keikan näkevät ne autot, joiden kuormatila riittää.',

    serviceSoon: 'Kehitteillä',
    service3: 'Kuljettajan sovellus',
    service3Text: 'Keikat, pisteet, kuvat ja allekirjoitukset kuljettajan omassa sovelluksessa. Asennetaan puhelimen kotinäytölle, toimii myös ilman verkkoa.',
    service3Text2: 'Kuljetusliike kutsuu kuljettajan linkillä tai koodilla ja näkee kuittaukset ja työajan suoraan palvelussa.',

    finalEyebrow: 'Näin pääset alkuun',
    finalTitle: 'Kerro yrityksestäsi – me hoidamme loput',
    finalLede: 'Tarvitsemme yrityksen nimen, Y-tunnuksen ja sähköpostin, kuljetusliikkeiltä myös liikenneluvan ja vakuutuksen.',
    /*
     * Sama asia seisoi aiemmin kahdesti: tässä ja ensimmäisen ruudun
     * alahuomautuksena. Huomautus kertoi lisäksi kaksi asiaa, joita tämä
     * rivi ei kertonut — ettei palveluun voi rekisteröityä suoraan ja
     * mitkä rekisterit tarkistetaan. Ne ovat nyt tässä, ja huomautus on
     * poissa.
     */
    finalLede2: 'Tarkistamme tiedot PRH:n ja YTJ:n rekistereistä ja avaamme tunnukset hyväksynnän jälkeen.',
    applyShipper: 'Huolitsijan hakemus',
    applyCarrier: 'Kuljetusliikkeen hakemus',
    footerCountry: 'Suomi',
  },

  done: {
    titleCarrier: 'Ajetut kuljetukset',
    titleShipper: 'Valmiit kuljetukset',
    titleAdmin: 'Laskutus ja tilitykset',
    subtitleCarrier: 'Viikon aikana ajetut kuljetukset ja niistä tilitettävät summat.',
    subtitleShipper: 'Viikon aikana valmistuneet kuljetukset ja niiden laskutettavat summat.',
    subtitleAdmin: 'Tilaajien laskut ja kuljetusliikkeiden tilitykset.',
    /*
     * Примечание про НДС различается по роли: заказчику выставляют счёт,
     * перевозчику платят. Одна общая фраза заставляла бы каждого читать
     * половину про чужие деньги.
     */
    /*
     * Kaksi verolausetta, ei yhtä.
     *
     * Kanta riippuu vastapuolen maasta: suomalaiselle yritykselle
     * tavallinen kotimaan myynti 25,5 %, ulkomaiselle käännetty
     * verovelvollisuus 0 %. Aiemmin tässä oli ensin yksi lause kaikille
     * ('lisätään 25,5 %'), sitten toinen yksi kaikille ('alv 0 %') —
     * kumpikin oli väärin puolelle asiakkaista.
     *
     * Nolla ei tarkoita, ettei veroa ole: käännetyssä
     * verovelvollisuudessa veron tilittää ostaja, ja asiakirjan on
     * sanottava se sanoin eikä tyhjällä rivillä.
     */
    vatNoteDomestic: 'Summat ilman arvonlisäveroa. Alv 25,5 % lisätään laskulle.',
    vatNoteReverse:
      'Summat alv 0 %: käännetty verovelvollisuus, ostaja tilittää veron omassa maassaan.',
    open: 'Avaa',
    collapse: 'Pienennä',
    none: 'Ei vielä ajettuja kuljetuksia',
    noneHint: 'Päättynyt kuljetus siirtyy tänne asiakirjoineen ja summineen.',
    rate: 'Hinta',
    commission: 'Palvelumaksu',
    payout: 'Tilitys',
    margin: 'Kate',
    clients: 'Tilaajat · laskutus',
    carriers: 'Kuljetusliikkeet · tilitykset',
    company: 'Yritys',
    trips: 'Kuljetuksia',
    distance: 'Matka',
    noPartners: 'Tällä jaksolla ei valmistunut kuljetuksia',
    allTime: 'Koko ajalta',
  },

  /*
   * Sanat, jotka vaihtuvat vedettävän mukaan.
   *
   * Vain viisi kohtaa koko käyttöliittymästä puhuu perävaunusta
   * nimeltä: noutopisteen ja palautuspisteen otsikot lomakkeella ja
   * reittilistassa sekä tieto siitä, onko yksikkö kuormattu.
   * Kontilla ne ovat toiset — 'perävaunun palautus' konttikeikalla
   * lupaa kuljettajalle perävaunun, jota reitillä ei ole.
   *
   * Rinnakkaiset sanastot yhden haulKindin alla eivätkä erilliset
   * avaimet siellä täällä: kun kolmas yksikkötyyppi tulee, sille
   * lisätään yksi lohko eikä viittä avainta viiteen paikkaan.
   */
  haul: {
    TRAILER: {
      stopPickup: 'Perävaunun nouto',
      stopReturn: 'Perävaunun palautus',
      pickupSection: 'Mistä perävaunu noudetaan',
      dropSection: 'Mihin perävaunu jätetään',
      unitState: 'Perävaunu',
    },
    CONTAINER: {
      stopPickup: 'Kontin nouto',
      stopReturn: 'Kontin palautus',
      pickupSection: 'Mistä kontti noudetaan',
      dropSection: 'Mihin kontti jätetään',
      unitState: 'Kontti',
    },
    /*
     * Pikakuljetuksessa ei ole yksikköä, joka noudetaan ja palautetaan:
     * kuorma matkustaa autossa. Siksi sanasto puhuu kuormasta eikä
     * perävaunusta, ja se on pakettiautolla ja kuorma-autolla sama —
     * ero on auton koossa, ei siinä mitä pisteellä tehdään.
     */
    VAN: {
      stopPickup: 'Kuorman nouto',
      stopReturn: 'Toimitus',
      pickupSection: 'Mistä kuorma noudetaan',
      dropSection: 'Mihin kuorma toimitetaan',
      unitState: 'Kuorma',
    },
    TRUCK: {
      stopPickup: 'Kuorman nouto',
      stopReturn: 'Toimitus',
      pickupSection: 'Mistä kuorma noudetaan',
      dropSection: 'Mihin kuorma toimitetaan',
      unitState: 'Kuorma',
    },
  },

  /*
   * Kartta kalustosta tilaajan työpöydällä. Ei kerro, onko auto vapaana:
   * vapaus vanhenee tunneissa ja vaatii ylläpitoa, kalusto ei.
   */
  presence: {
    title: 'Missä kalustoa on',
    hint: 'Hyväksytyt ajoneuvot kotipaikkansa mukaan. Ei kerro vapaana olosta eikä siitä, kenen autoja ne ovat.',
    mapLabel: 'Kartta kaupungeista, joissa on kalustoa',
  },

  haulKind: {
    TRAILER: 'Perävaunu',
    CONTAINER: 'Kontti',
    VAN: 'Pakettiauto',
    TRUCK: 'Kuorma-auto',
  },

  /*
   * Ajoneuvoluokan nimessä on kokoraja mukana, kuten akselimäärässäkin
   * on kantavuus: kuljetusliike ei valitse sanaa vaan sitä, minkä
   * kokoisia kuljetuksia auto voi ottaa.
   */
  vehicleClass: {
    TRACTOR: 'Vetoauto',
    VAN: 'Pakettiauto · enintään 3,5 t',
    TRUCK: 'Kuorma-auto · enintään 26 t',
  },

  amendKind: {
    STOP_ADDED: 'Piste lisätty',
    STOP_CHANGED: 'Piste muuttui',
    STOP_REMOVED: 'Piste poistettu',
    ORDER_REPRICED: 'Matka ja hinta päivitetty',
    ORDER_CANCELLED: 'Kuljetus peruutettu',
    ORDER_RELEASED: 'Kuljetusliike luopui',
  },

  /*
   * Häiriötilanteet: peruutus, luopuminen, uudelleenhinnoittelu, poisto.
   * Omana ryhmänään eikä matchingin alla, koska nämä eivät liity
   * tarjouksiin vaan siihen, mitä kuljetukselle tapahtuu sen jälkeen.
   */
  lifecycle: {
    withdraw: 'Peruuta kuljetus',
    withdrawing: 'Peruutetaan…',
    withdrawHint: 'Kuljetus poistuu työlistoilta lopullisesti. Tiedot ja historia jäävät.',
    /*
     * Ensimmäisessä persoonassa, kuten 'Otan kuljetuksen', jonka
     * vastapari tämä on. 'Luovu kuljetuksesta' kuulosti luovuttamiselta
     * ja syytti kuljettajaa; kyse on siitä, ettei auto kulje.
     */
    abandon: 'En pysty ajamaan',
    abandoning: 'Ilmoitetaan…',
    abandonHint:
      'Jos yhtäkään pistettä ei ole vielä käyty, kuljetus palaa tarjolle muille. Jos matka on jo alkanut, se peruuntuu ja ajojärjestely ottaa yhteyttä.',
    reprice: 'Päivitä matka ja hinta',
    repricing: 'Tallennetaan…',
    repriceHint:
      'Hinta seuraa kilometrejä samalla €/km-hinnalla, josta sovittiin. Voit myös kirjoittaa summan itse.',
    repriceOpen: 'Korjaa matka ja hinta',
    remove: 'Poista kuljetus',
    removing: 'Poistetaan…',
    removeHint:
      'Poistaa kuljetuksen tietokannasta lopullisesti. Vain koe- ja virhekuljetuksille: laskutettua tai dokumentoitua ei voi poistaa.',
    reason: 'Syy',
    reasonPlaceholder: 'Auto rikki, kuorma peruuntui…',
    confirm: 'Vahvista',
    cancelled: 'Kuljetus on peruutettu',
    notAllowed: 'Sinulla ei ole oikeutta tähän toimenpiteeseen.',
    notFound: 'Kuljetusta ei löytynyt.',
    failed: 'Toimenpide ei mennyt läpi. Päivitä sivu ja yritä uudelleen.',
    fieldStatus: 'Tila',
    fieldBy: 'Tekijä',
    fieldReason: 'Syy',
    cleanupTitle: 'Kuljetusten siivous',
    cleanupHint:
      'Luonnokset, tarjolla olevat ja peruutetut kuljetukset, joita ei ole laskutettu. Poisto on lopullinen: laskutettua tai dokumentoitua ei voi poistaa.',
    cleanupEmpty: 'Ei poistettavia kuljetuksia',
  },

  tripDocument: {
    CMR: 'Rahtikirja / CMR',
    LOADING_PHOTO: 'Kuva lastauksesta',
    UNLOADING_PHOTO: 'Kuva purusta',
    DAMAGE_PHOTO: 'Kuva vauriosta',
  },

  companyStatus: {
    PENDING: 'Tarkastuksessa',
    APPROVED: 'Hyväksytty',
    ACTIVE: 'Käytössä',
    REJECTED: 'Hylätty',
  },

  vehicleAccess: {
    DRAFT: 'Luonnos',
    PENDING: 'Tarkastuksessa',
    APPROVED: 'Hyväksytty',
    REJECTED: 'Ei hyväksytty',
  },

  /*
   * Otsikko ei enää nimeä vedettävää.
   *
   * 'Puoliperävaunun kuljetus' oli oikein niin kauan kuin muuta ei
   * ollutkaan. Konttitilauksen otsikkona se valehteli: perävaunua ei
   * ole. Mitä vedetään, kertoo nyt vieressä oleva haulKind-merkki, ja
   * otsikon tehtäväksi jää sanoa, minkä muotoinen keikka on.
   */
  orderType: {
    TRAILER_SWAP: 'Kuljetustilaus',
    ROUND_TRIP: 'Rengasajo',
    ONE_WAY: 'Yhdensuuntainen kuljetus',
  },

  placeKind: {
    PORT: 'Satama',
    TERMINAL: 'Terminaali',
    PARKING: 'Parkkialue',
    ADDRESS: 'Osoite',
  },

  stopKind: {
    PICKUP: 'Perävaunun nouto',
    EXTRA_LOAD: 'Lastaus',
    EXTRA_UNLOAD: 'Purku',
    TRAILER_RETURN: 'Perävaunun palautus',
    DELIVERY: 'Purku',
    CONTINUATION: 'Jatkokuljetus',
  },

  order: {
    ref: 'Kuljetusnumero',
    trailer: 'Perävaunu',
    distance: 'Matka',
    rate: 'Hinta',
    ratePerKm: 'Kilometrihinta',
    comment: 'Lisätiedot kuljetukseen',
    commentPlaceholder: 'Satamalupa, sinetti, lämpötila…',
    changelog: 'Muutokset lähdön jälkeen',
    changelogFromShipper: 'Muutos tilaajalta',
    offers: 'Kuljetustarjoukset',
    noDamage: 'Ei vaurioita',
    damage: 'Vauriot',
    damagePlaceholder: 'Kolhu perävaunun vasemmassa laidassa',
    documents: 'Asiakirjat',
    trips: 'Kuljetuksia',
    cargoAndPayment: 'Kuorma ja hinta',
    closeTitle: 'Kuljetuksen päättäminen',

    consignee: 'Vastaanottaja',
    sealRequired: 'Sinetti',
  },

  orderForm: {
    feeHint: 'Yhteiseltä pöydältä tilatusta kuljetuksesta laskutetaan lisäksi 3 % palvelumaksu; suora tilaus vakioautolle on maksuton.',
    title: 'Uusi kuljetus',
    subtitle: 'Täytä reitti kokonaan ja julkaise. Kuljetus näkyy kuljetusliikkeille heti.',
    type: 'Kuljetuksen tyyppi',
    shipperRef: 'Oma viitteesi',
    shipperRefHint: 'Vapaaehtoinen. RAHTIS antaa kuljetukselle oman numeron automaattisesti',

    cargoSection: 'Kuorma ja hinta',

    placeName: 'Paikan nimi',
    address: 'Osoite',
    addressHint:
      'Katu, numero, postinumero ja kaupunki. Valitse osoite ehdotuksista, niin kilometrit lasketaan automaattisesti',
    city: 'Kaupunki',
    date: 'Päivä',
    time: 'Kello',
    company: 'Yritys',
    contact: 'Yhteyshenkilö',
    phone: 'Puhelin',

    repeat: 'Toista tämä kuljetus',
    remove: 'Poista',

    trailerState: 'Perävaunu',
    trailerLoaded: 'Kuormattu',
    trailerEmpty: 'Tyhjä',
    addUnload: '+ Purku',
    addLoad: '+ Lastaus',
    actionsSection: 'Mitä matkalla tehdään',
    actionsHint: 'Purkuja ja lastauksia voi lisätä haluamasi määrän ja haluamassasi järjestyksessä',
    noActions: 'Lisää vähintään yksi purku tai lastaus',

    bookingRef: 'Varausnumero',
    ldm: 'Lavametrit',
    ldmHint: 'Paljonko lattiapituutta kuorma vie. Mitat ja pakkaustapa lisätietoihin.',
    expressCargoSection: 'Mitä kuljetetaan',
    expressCommentPlaceholder: 'Mitat, pakkaus, nostotapa, lämpötila…',
    cargoWeight: 'Paino, t',
    cargoWeightHint: 'Enintään 76 tonnia eli HCT-yhdistelmän suurin sallittu massa',
    consignee: 'Kuorman vastaanottaja',
    consigneeHint: 'Kenelle kuorma menee tältä pisteeltä',
    loadingRef: 'Lastauksen viite',
    loadingRefHint: 'Lähettäjän oma numero, jos sellainen on',
    seal: 'Sinetti',
    sealUnknown: 'Ei tiedossa',
    sealYes: 'Tarvitaan',
    sealNo: 'Ei tarvita',
    stopNote: 'Ohjeet pisteelle',
    stopNotePlaceholder: 'Varausnumero, porttilupa, soita tuntia ennen…',

    haulKind: 'Mitä vedetään',
    trailer: 'Perävaunun tyyppi',
    trailerPlaceholder: 'Kapelli 13,6, 3 akselia',
    trailerPlate: 'Perävaunun rekisterinumero',
    trailerPlateHint: 'Kuljettaja löytää sen avulla oikean vaunun kentältä. Pakollinen tieto.',
    /*
     * Kontilla on oma sanasto: rekisterinumeron tilalla ISO 6346
     * -tunnus, tyypin tilalla pituus jalkoina. Samat kentät, eri
     * otsikot — kuljettaja etsii kentältä eri esinettä.
     */
    containerNumber: 'Kontin numero',
    containerNumberHint: 'ISO 6346, esimerkiksi MSCU1234567. Kuljettaja löytää kontin sillä terminaalista.',
    containerFeet: 'Kontin pituus',
    containerFeetHint: 'Jaloissa. Määrää, mikä alusta kontin ottaa.',
    containerType: 'Kontin tyyppi',
    containerTypePlaceholder: 'Kuivakontti, high cube, reefer…',
    distance: 'Matka, km',
    rate: 'Hinta, €',

    publish: 'Julkaise · näkyy alueen kuljetusliikkeille',
    publishing: 'Julkaistaan…',
    published: 'Kuljetus julkaistu',
    needActive: 'Täydennä yritystiedot. Ilman niitä kuljetusta ei voi julkaista.',
    failed: 'Julkaisu ei onnistunut. Tarkista kentät ja yritä uudelleen.',
  },

  orders: {
    title: 'Omat kuljetukset',
    subtitle: 'Julkaistut kuljetukset ja niiden tilanne.',
    /*
     * Kolme kaistaa sen mukaan, kuka ketäkin odottaa. Nimet kertovat
     * toiminnan, eivät tilaa: 'Odottaa päätöstäsi' sanoo mitä tehdä,
     * 'REQUESTED' ei sano mitään.
     */
    bandDecide: 'Odottaa päätöstäsi',
    bandRunning: 'Ajossa',
    bandWaiting: 'Odottaa tarjouksia',
    bandDraft: 'Luonnokset',
    bandCancelled: 'Peruutetut',
    searchPlaceholder: 'Etsi: numero, perävaunu, kaupunki',
    when: { all: 'Kaikki', today: 'Tänään', tomorrow: 'Huomenna', week: 'Viikko' },
    nothingFound: 'Ei osumia',
    nothingFoundHint: 'Muuta hakua tai valitse toinen aikaväli.',
    newOrder: 'Uusi kuljetus',
    none: 'Ei vielä kuljetuksia',
    noneHint: 'Julkaise ensimmäinen kuljetus, niin se näkyy kuljetusliikkeille.',
    route: 'Reitti',
    shipperRefShort: 'Oma viite',
  },

  routing: {
    searching: 'haetaan…',
    approximate: 'arvio',
    weakMatch: 'Osoite tunnistettiin epätarkasti. Tarkista osoite ja kilometrit.',
    unavailable: 'Reittilaskenta ei ole nyt käytettävissä. Anna matka käsin.',
    suggestFailed: 'Ehdotuksia ei saatu. Kirjoita osoite kokonaan.',
    routeFailed: 'Reittiä ei saatu laskettua. Anna matka käsin.',
    needTwoPoints: 'Tarvitaan vähintään kaksi pistettä koordinaatteineen.',
    calculate: 'Laske reitti',
    calculating: 'Lasketaan…',
    auto: 'laskettu kuorma-autoreittinä',
    manual: 'annettu käsin',
    recalculate: 'Laske uudelleen',
    noCoordinates: 'Valitse osoitteet ehdotuksista, niin kilometrit lasketaan automaattisesti.',
    /*
     * Sama sääntö kahdella tapaa sanottuna: lomake kertoo, mitkä pisteet
     * puuttuvat, palvelin vain torjuu. Palvelimen teksti ei voi luetella
     * pisteitä, koska sinne asti ei pitäisi koskaan päästä.
     */
    addressRequired:
      'Jokainen osoite on valittava ehdotuksista. Kilometrit ja hinta lasketaan koordinaateista, eikä niitä voi enää korjata julkaisun jälkeen.',
    mapLabel: 'Reittikartta',
  },

  matching: {
    take: 'Otan kuljetuksen',
    taking: 'Lähetetään…',
    taken: 'Tarjous vastaanotettu',
    noSlots: 'Paikat täynnä',
    slots: 'Paikkoja varattu',
    chooseVehicle: 'Millä autolla ajat',
    waitingChoice: 'Odotetaan tilaajan valintaa',
    offers: 'Kuljetustarjoukset',
    chooseCarrier: 'Valitse',
    choose: 'Valitse',
    awaitDriver: 'Odotetaan kuljettajan vahvistusta',
    confirm: 'Vahvista',
    decline: 'Kieltäydy',
    /*
     * Ei 'Peruuta': tämä painike palauttaa kuljetuksen tarjolle, ei
     * poista sitä. Vieressä on lifecycle.withdraw, joka nimenomaan
     * peruu — kahta samannäköistä nappia ei voi erottaa toisistaan.
     */
    cancel: 'Palauta tarjolle',
    assignments: 'Omat kuljetukset',
    noAssignments: 'Ei kuljetuksia',
    noAssignmentsHint: 'Ota kuljetus, niin se siirtyy tänne.',
    chosenYou: 'Tilaaja valitsi sinut',
    chosenYouHint: 'Vahvista 15 minuutin kuluessa, muuten kuljetus vapautuu takaisin avoimeksi.',
    inProgress: 'Kuljetus ajossa',
    assignedCarrier: 'Kuljetuksen ajaa',
    contactsNow: 'Vastaanottajan yhteystiedot ovat nyt näkyvissä.',
    failed: 'Toiminto ei onnistunut. Päivitä sivu ja yritä uudelleen.',
    tooLate: 'Aika loppui, kuljetus vapautui takaisin avoimeksi.',
    cancelledTrips: 'Peruutetut kuljetukset',
    noChassis: 'Tällä ajoneuvolla ei ole alustaa tämän kokoiselle kontille.',
    wrongClass: 'Tähän kuljetukseen tarvitaan toisen luokan auto tai isompi kuormatila.',
    noSlotsLeft: 'Paikat ovat täynnä: kuljetukseen on jo kolme tarjousta.',
    alreadyTaken: 'Olet jo tehnyt tarjouksen tähän kuljetukseen.',
  },

  desk: {
    title: 'Avoimet kuljetukset',
    subtitle: 'Avoimet kuljetukset alueilta, joilla ajoneuvosi ovat.',
    allRegions: 'Kaikki alueet',
    empty: 'Tällä alueella ei ole avoimia kuljetuksia',
    emptyHint: 'Vaihda aluetta tai odota uusia kuljetuksia.',
    closedTitle: 'Avoimet kuljetukset eivät ole näkyvissä',
    closedNoVehicle:
      'Avoimet kuljetukset näkyvät, kun yritykselläsi on vähintään yksi hyväksytty ajoneuvo ja vaaditut asiakirjat ovat voimassa. Lisää ajoneuvo, niin tarkastamme sen.',
    closedExpired:
      'Avoimet kuljetukset näkyvät, kun yritykselläsi on vähintään yksi hyväksytty ajoneuvo ja vaaditut asiakirjat ovat voimassa. Lataa uusittu liikennelupa tai vakuutus.',
    openFleet: 'Kalusto',
    contactsHidden: 'Vastaanottajan yhteystiedot näkyvät, kun otat kuljetuksen.',
    details: 'Kuljetuksen tiedot',
  },

  billingDesk: {
    title: 'Laskutus ja tilitykset',
    subtitle:
      'Kausi on puoli kuukautta: 1.–15. ja 16. päivästä kuun loppuun. Laskut lähtevät asiakkaille automaattisesti kauden päätyttyä. Sinä kirjaat saapuneet maksut ja tilitykset kuljetusliikkeille.',
    statAwaiting: 'Odottaa asiakkaiden maksua',
    statOverdue: 'Myöhässä',
    statToPay: 'Maksettavaa kuljetusliikkeille',
    statMargin: 'Kate',
    current: 'Käynnissä',
    invoices: 'Laskut asiakkaille',
    payouts: 'Tilitykset kuljetusliikkeille',
    colCustomer: 'Asiakas',
    colCarrier: 'Kuljetusliike',
    colInvoice: 'Lasku',
    colTrips: 'Keikat',
    colGross: 'Summa sis. ALV',
    colStatus: 'Tila',
    stSent: 'Lähetetty',
    stPaid: 'Maksettu',
    stOverdue: 'Myöhässä',
    stNotSent: 'Ei lähetetty',
    stWaiting: 'Odottaa asiakkaan maksua',
    stReady: 'Maksettava nyt',
    stSettled: 'Tilitetty',
    markPaid: 'Maksu saapunut',
    markSettled: 'Merkitse tilitetyksi',
    notSent: 'Kauden laskut eivät ole lähteneet. Lähetä ne nyt — sama toiminto, jonka ajastus tekee.',
    sendNow: 'Lähetä kauden laskut',
    account: 'Tili',
    noIban: 'Tilinumero puuttuu',
    trendTitle: 'Kehitys',
    trendTurnover: 'Kuljetusten arvo',
    trendRevenue: 'Meidän osuutemme',
    trendHint: 'Viikot maanantaista sunnuntaihin, summat ilman alv:tä. Osuus on kuljetusliikkeen 3 % alihankinnasta ja tilaajan 3 % pöydältä otetusta keikasta; kuukausimaksut eivät ole mukana.',
    subsTitle: 'Kuukausimaksut',
    subsLede: 'Kuukausimaksu peritään kuukausimaksullisilta kuljetusliikkeiltä ajaneista autoista. Ensin se vähennetään tilityksestä; kattamaton osa laskutetaan.',
    subsColMonth: 'Kuukausi',
    subsColVehicles: 'Autoja',
    subsColTotal: 'Sis. ALV',
    subsColDeducted: 'Vähennetty',
    subsColOpen: 'Avoinna',
    subsPaid: 'Maksettu',
    subsMarkPaid: 'Maksu saapunut',
    subsUndo: 'Peru maksumerkintä',
    subsNone: 'Kuukausimaksuja ei ole vielä veloitettu.',
    subsNoInvoice: 'Vähennetty kokonaan',
    feeDeducted: 'Kuukausimaksu',
    closed: 'Loppuun käsitellyt kaudet',
    nothing: 'Ei vielä valmiita keikkoja.',
    colDate: 'Päivä',
    colRef: 'Keikka',
    colRoute: 'Reitti',
    colAmount: 'Veroton',
    summary: 'Yhteenveto kumppaneittain ja keikoittain',
  },

  billing: {
    title: 'Laskutuksen tila',
    PENDING: 'Laskuttamatta',
    INVOICED: 'Laskutettu',
    PAID: 'Maksettu',
    SETTLED: 'Tilitetty',
    toInvoiced: 'Merkitse laskutetuksi',
    toPaid: 'Merkitse maksetuksi',
    toSettled: 'Merkitse tilitetyksi',
    invoiceRef: 'Laskun numero',
    invoiceRefPlaceholder: '2026-0142',
    onlyForward: 'Laskutuksen tila etenee vain eteenpäin.',
    notDone: 'Kuljetus on vielä kesken.',
    done: 'Tila päivitetty',
  },

  support: {
    title: 'Kysy ylläpidolta',
    hint: 'Vastaamme arkisin. Kysymys näkyy myös omilla sivuillasi.',
    subject: 'Aihe',
    subjectPlaceholder: 'Kysymys kuljetuksesta RS-2026-0041',
    body: 'Viesti',
    bodyPlaceholder: 'Kerro lyhyesti, mistä on kyse.',
    submit: 'Lähetä',
    sending: 'Lähetetään…',
    sent: 'Viesti lähetetty. Vastaamme antamaasi osoitteeseen.',
    failed: 'Viesti ei lähtenyt. Yritä uudelleen.',
    queue: 'Kysymykset ylläpidolle',
    queueEmpty: 'Ei avoimia kysymyksiä',
    markHandled: 'Merkitse käsitellyksi',
    handled: 'Käsitelty',
    from: 'Lähettäjä',
  },

  adminMessage: {
    title: 'Lähetä ilmoitus yritykselle',
    hint: 'Ilmoitus näkyy yrityksen omilla sivuilla. Sähköposti lähetetään lisäksi.',
    company: 'Yritys',
    subject: 'Otsikko',
    body: 'Viesti',
    submit: 'Lähetä ilmoitus',
    sending: 'Lähetetään…',
    sent: 'Ilmoitus lähetetty',
    failed: 'Ilmoitus ei lähtenyt. Yritä uudelleen.',
  },

  notify: {
    title: 'Ilmoitukset',
    empty: 'Ei ilmoituksia',
    emptyHint: 'Tänne tulevat tiedot kuljetuksista, laskutuksesta ja ylläpidosta.',
    markAllRead: 'Merkitse kaikki luetuiksi',
    unread: 'Lukematta',
    open: 'Avaa',
  },

  outbox: {
    title: 'Lähtevät viestit',
    subtitle: 'Kaikki palvelun sähköpostit. Lokiin kirjataan myös lähettämättä jääneet.',
    empty: 'Ei viestejä',
    to: 'Vastaanottaja',
    subject: 'Aihe',
    template: 'Malli',
    provider: 'Lähettäjä',
    status: 'Tila',
    created: 'Luotu',
    body: 'Viestin sisältö',
    stubNotice: 'Lähetys ei ole käytössä. Viestit kirjataan lokiin, mutta niitä ei lähetetä.',
    PENDING: 'Jonossa',
    SENT: 'Lähetetty',
    FAILED: 'Ei lähtenyt',
    SKIPPED: 'Ei lähetetty',
  },

  chat: {
    title: 'Kysy avustajalta',
    hint: 'Avustaja tuntee kuljetuksesi, asiakirjat ja sopimusehdot.',
    placeholder: 'Kirjoita kysymys…',
    send: 'Lähetä',
    sending: 'Lähetetään…',
    thinking: 'Avustaja etsii vastausta…',
    empty: 'Ei viestejä vielä',
    emptyHint: 'Kysy esimerkiksi kuljetuksen tilaa tai sopimuksen kohtaa.',
    clear: 'Tyhjennä keskustelu',
    clearConfirm: 'Koko keskustelu poistetaan.',
    clearYes: 'Poista',
    failed: 'Viesti ei lähtenyt. Yritä uudelleen.',
    you: 'Sinä',
    agent: 'Avustaja',
    operator: 'Ylläpito',
    offline: 'Avustaja ei ole vielä käytössä. Viesti jää ylläpidolle.',
  },

  legal: {
    TERMS: 'Käyttöehdot',
    PRIVACY: 'Tietosuojaseloste',
    CARRIER_AGREEMENT: 'Kuljetusliikkeen sopimus',
    SHIPPER_AGREEMENT: 'Tilaajan sopimus',

    missing: 'Asiakirjaa ei ole vielä julkaistu.',
    clauseLink: 'Kopioi linkki kohtaan',

    accept: 'Hyväksyn seuraavat asiakirjat:',
    ownDocuments: 'Omat asiakirjat',
    acceptRequired: 'Ehdot on hyväksyttävä ennen käyttöönottoa.',

    /* Ylläpito */
    manage: 'Asiakirjat ja versiot',
    newVersion: 'Uusi versio',
    activate: 'Ota käyttöön',
    DRAFT: 'Luonnos',
    ACTIVE: 'Voimassa',
    ARCHIVED: 'Arkistoitu',
    clauses: 'Kohtia',
    noClauses: 'Versiossa ei ole yhtään kohtaa, sitä ei voi ottaa käyttöön.',
    acceptances: 'Hyväksynnät',
    acceptedBy: 'Hyväksyjä',
    noAcceptances: 'Ei hyväksyntöjä',
  },

  admin: {
    people: 'Käyttäjät',
  },

  moderation: {
    test: 'Testiyritys',
    markTest: 'Merkitse testiyritykseksi',
    unmarkTest: 'Poista testimerkintä',
    partnership: 'Kuljetusliikkeen tapa',
    partnershipSub: 'Kuukausimaksu',
    partnershipCon: 'Alihankinta',
    partnershipSubHint: '29,90 € kuukaudessa ajanutta autoa kohden. Omat asiakkaat ja suorat tilaukset laskuttaa kuljetusliike itse; pöydältä otetusta keikasta 3 %.',
    partnershipConHint: '3 % jokaisesta keikasta. Laskut asiakkaille, rahtikirjat ja reklamaatiot hoidamme me; kuukausimaksua ei peritä.',
    partnershipSwitch: 'Vaihda tavaksi {mode}',
    testHint: 'Testiyrityksen keikat eivät mene laskuihin eivätkä tilityksiin.',
    queue: 'Tarkastusjono',
    applications: 'Hakemukset',
    vehicles: 'Ajoneuvot hyväksyntään',
    approveAndInvite: 'Hyväksy ja lähetä kutsu',
    rejectWithReason: 'Hylkää',
    reasonLabel: 'Hylkäyksen syy',
    reasonPlaceholder: 'Y-tunnusta ei löydy PRH:n rekisteristä',
    vehicleReasonPlaceholder: 'Vakuutus ei kata kansainvälisiä kuljetuksia',
    reasonRequired: 'Kirjoita syy. Yritys näkee sen sellaisenaan',
    inviteSent: 'Kutsu lähetetty',
    inviteFailed: 'Yritys hyväksyttiin, mutta viesti ei lähtenyt',
    resendInvite: 'Lähetä kutsu uudelleen',
    accessGranted: 'Tunnukset annettu',
    noUsersYet: 'Kutsua ei ole lähetetty',
    recent: 'Käsitellyt hakemukset',
    decidedAt: 'Päätös',
    freeze: 'Jäädytä',
    unfreeze: 'Palauta käyttöön',
    frozen: 'Jäädytetty',
    freezeReason: 'Jäädytyksen syy',
    freezeReasonPlaceholder: 'Sopimus päättynyt',
    freezeBlocked: 'Yrityksellä on keskeneräisiä kuljetuksia. Päätä tai peru ne ensin.',
    freezeHint: 'Jäädytetty yritys ei kirjaudu eikä ota kuljetuksia. Tiedot ja historia säilyvät.',
    remove: 'Poista yritys',
    removeConfirm: 'Poistetaanko yritys pysyvästi? Tätä ei voi perua.',
    removeBlocked: 'Yritystä ei voi poistaa: sillä on kuljetuksia. Kuljetushistoriaa ei poisteta.',
    removed: 'Yritys poistettu',
    inviteNotSent: 'Kutsua ei saatu lähetettyä. Tarkista sähköpostiasetukset ja lähetä uudelleen.',
  },

  apply: {
    title: 'Hakemus',
    subtitle:
      'Avointa rekisteröitymistä ei ole. Tarkistamme jokaisen yrityksen tiedot rekisteristä ja lähetämme tunnukset antamaasi osoitteeseen.',
    howTitle: 'Miten haluat käyttää palvelua?',
    howSub: 'Alusta kuukausimaksulla',
    howSubText:
      'Ajat omia asiakkaitasi ja käytät sovellusta, työaikaa, karttaa ja tarjouspöytää. 29,90 € kuukaudessa jokaisesta autosta, joka ajoi kuukauden aikana. Laskutat asiakkaasi itse.',
    howCon: 'Alihankinta',
    howConText:
      'Me hankimme työn, laskutamme asiakkaan, hoidamme rahtikirjat ja reklamaatiot. 3 % keikan hinnasta, ei kuukausimaksua.',
    howNote: 'Voit vaihtaa tapaa myöhemmin. Tarjouspöydältä otettu keikka ajetaan aina alihankintana.',
    iAmCarrier: 'Kuljetusliike',
    iAmShipper: 'Tilaaja',
    submit: 'Lähetä hakemus',
    submitting: 'Lähetetään…',
    carrierNote:
      'Hyväksynnän jälkeen: kirjautuminen, liikennelupa ja vakuutus, ajoneuvojen tiedot. Hyväksymme jokaisen ajoneuvon erikseen.',
    shipperNote: 'Hyväksynnän jälkeen: kirjautuminen, yritystiedot, kuljetusten julkaisu.',
    sentTitle: 'Hakemus lähetetty',
    duplicate: 'Tällä Y-tunnuksella on jo hakemus vireillä tai hyväksytty.',
    failed: 'Lähetys ei onnistunut. Yritä uudelleen.',
  },

  requisites: {
    title: 'Yritystiedot',
    subtitleShipper: 'Tarvitsemme nämä laskutusta varten. Tallennuksen jälkeen yritys on käytössä.',
    subtitleCarrier: 'Tarvitsemme nämä tilityksiä varten. Tallennuksen jälkeen yritys on käytössä.',

    legalSection: 'Viralliset tiedot',
    legalName: 'Virallinen nimi',
    legalNameHint: 'Kuten rekisterissä, jos se poikkeaa käyttämästäsi nimestä',
    street: 'Katuosoite',
    postalCode: 'Postinumero',
    city: 'Kaupunki',
    country: 'Maa',
    vat: 'ALV-numero',
    language: 'Viestinnän kieli',
    languageHint:
      'Millä kielellä lähetämme kutsut, laskut ja raportit. Käyttöliittymän kielen jokainen valitsee itse yläpalkista.',
    vatHint: 'Muodostettu Y-tunnuksesta. Korjaa, jos käytät ALV-ryhmän tunnusta',
    vatInvalid: 'Muoto: maatunnus ja 2–12 merkkiä, esimerkiksi FI12345678',

    billingSection: 'Laskutus',
    billingSameAsLegal: 'Laskutusosoite on sama kuin virallinen',
    billingEmail: 'Laskutuksen sähköposti',
    billingEmailHint: 'Tänne lähetämme laskut',
    billingReference: 'Viite laskulle',
    billingReferenceHint: 'Viitteesi tai kustannuspaikka, jonka haluat laskulle',

    einvoiceSection: 'Verkkolasku',
    einvoiceOptional: 'Vapaaehtoinen. Täytä, jos vastaanotat verkkolaskuja.',
    ovt: 'OVT-tunnus',
    ovtHint: 'Yleensä 0037 ja Y-tunnus ilman väliviivaa',
    ovtInvalid: '8–17 kirjainta tai numeroa',
    operator: 'Verkkolaskuoperaattori',
    operatorHint: 'Esimerkiksi Maventa, Basware tai Apix',
    operatorInvalid: '4–20 merkkiä',

    payoutSection: 'Tilitykset',
    bankSection: 'Pankkiyhteys',
    iban: 'IBAN',
    ibanHint: 'Tili, jolle maksamme kuljetukset',
    ibanHintShipper: 'Tili, jolle mahdolliset hyvitykset maksetaan',
    ibanInvalid: 'IBAN ei mene tarkistuksesta läpi. Tarkista numerot.',
    bic: 'BIC / SWIFT',
    bicHint: 'Suomalaisille tileille ei tarvita',
    bicInvalid: 'Muoto: 8 tai 11 merkkiä, esimerkiksi NDEAFIHH',

    save: 'Tallenna ja ota käyttöön',
    saving: 'Tallennetaan…',
    saved: 'Tiedot tallennettu, yritys on käytössä',
    incomplete: 'Kaikkia pakollisia tietoja ei ole täytetty',
    failed: 'Tallennus ei onnistunut. Yritä uudelleen.',
    alreadyActive: 'Yritys on jo käytössä. Tietoja voi muuttaa milloin tahansa.',
    fillToActivate: 'Täydennä yritystiedot, niin yritys otetaan käyttöön',
    openForm: 'Täydennä tiedot',
    open: 'Yritystiedot',
  },

  recovery: {
    link: 'Unohditko salasanan?',
    title: 'Salasanan palautus',
    subtitle:
      'Anna sähköpostiosoitteesi. Lähetämme linkin, jolla asetat uuden salasanan.',
    submit: 'Lähetä linkki',
    sending: 'Lähetetään…',
    sent:
      'Jos osoite on rekisteröity, linkki on matkalla. Tarkista myös roskapostikansio — linkki on voimassa tunnin.',
    badEmail: 'Tarkista sähköpostiosoite',
    backToSignIn: 'Takaisin kirjautumiseen',
  },

  account: {
    title: 'Omat tiedot',
    passwordTitle: 'Salasanan vaihto',
    passwordHint: 'Uusi salasana tulee voimaan heti. Muista se — emme näe emmekä voi palauttaa sitä.',
    current: 'Nykyinen salasana',
    newPassword: 'Uusi salasana',
    repeat: 'Toista uusi salasana',
    submit: 'Vaihda salasana',
    saving: 'Vaihdetaan…',
    saved: 'Salasana vaihdettu',
    wrongCurrent: 'Nykyinen salasana ei täsmää',
    sameAsOld: 'Uusi salasana on sama kuin nykyinen',
  },

  invite: {
    title: 'Aseta salasana',
    subtitle: 'Kutsu on hyväksytty. Valitse salasana kirjautumista varten.',
    password: 'Uusi salasana',
    repeat: 'Toista salasana',
    submit: 'Tallenna ja kirjaudu',
    tooShort: 'Salasanassa pitää olla vähintään 8 merkkiä',
    mismatch: 'Salasanat eivät täsmää',
    linkExpired: 'Linkki ei kelpaa tai on vanhentunut. Pyydä uusi kutsu RAHTIS-tuesta.',
  },

  report: {
    weeklyPayouts: 'Viikkotilitykset kuljetusliikkeille',
    dailyInvoices: 'Päivittäinen yhteenveto tilaajittain',
    byMachine: 'Erittely ajoneuvoittain',
  },

  report_: {
    carrierTitle: 'Viikkoraportti · ajetut kuljetukset',
    shipperTitle: 'Viikkoraportti · valmiit kuljetukset',
    adminTitle: 'Viikkoraportti · laskutus ja tilitykset',
    period: 'Viikko {week} · {from}–{to}',
    /*
     * Kauden asiakirjat. Erillinen otsikko, koska ne kertovat eri asian
     * kuin viikkoraportti: viikko näyttää tehdyn työn, kausi rahan.
     *
     * Tilaajalle lasku: numero juoksevasta sarjasta, yksi tilaajaa ja
     * kautta kohden, ja se lähtee automaattisesti kauden päätyttyä.
     */
    settlementShipperTitle: 'Lasku {number}',
    invoiceDate: 'Laskun päivä {date}',
    invoiceEmailSubject: 'RAHTIS · lasku {number} · kausi {from}–{to}',
    feeLine: 'Kuukausimaksu {month}: {count} aktiivista autoa × {unit} + ALV {vat}',
    directLine: 'Omat asiakkaat: laskutat itse suoraan',
    subTitle: 'Kuukausimaksu',
    subColRef: 'Lasku',
    subColMonth: 'Kuukausi',
    subColDescription: 'Selite',
    subColVehicles: 'Autoja',
    subColUnit: 'À-hinta',
    subDeducted: 'Vähennetty tilityksestä',
    subEmailSubject: 'Lasku {number} · kuukausimaksu {month}',
    subEmailLine: 'Laskutamme kuukausimaksun niistä autoista, jotka ajoivat kuukauden aikana.',
    payable: 'Maksetaan kuljetusliikkeelle',
    settlementCarrierTitle: 'Kauden koontiraportti · ajetut kuljetukset',
    periodRange: 'Kausi {from}–{to}',
    dueShipper: 'Maksettava {date} mennessä',
    dueCarrier: 'Tilitys maksetaan {date}',
    settlementEmailSubject: 'RAHTIS · kauden erittely {from}–{to}',
    colRef: 'Numero',
    colDate: 'Valmistui',
    colRoute: 'Reitti',
    colVehicle: 'Ajoneuvo',
    colDistance: 'km',
    colGross: 'Hinta',
    colCommission: 'Palvelumaksu',
    colNetCarrier: 'Tilitys',
    colNetShipper: 'Laskutetaan',
    colDocuments: 'Asiakirjat',
    total: 'Yhteensä',
    /*
     * Verokannat asiakirjoissa. Kanta riippuu vastapuolen maasta:
     * suomalaiselle yritykselle 25,5 %, ulkomaiselle käännetty
     * verovelvollisuus.
     */
    vatLine: 'ALV {rate}',
    totalWithVat: 'Yhteensä sis. ALV',
    empty: 'Tällä viikolla ei valmistunut kuljetuksia.',
    closingNote:
      'Kuljetus kuuluu sille viikolle, jona se päättyi. Perjantaina aloitettu ja maanantaina purettu kuljetus näkyy seuraavan viikon raportissa.',
    periodClosingNote:
      'Kuljetus kuuluu sille kaudelle, jona se päättyi. Kausi on 1.–15. tai 16. päivästä kuun loppuun; kauden lopussa aloitettu ja sen jälkeen purettu kuljetus näkyy seuraavan kauden asiakirjoissa.',
    page: 'Sivu',
    kindWeek: 'Viikkoraportti',
    kindPeriod: 'Kauden asiakirja',
    kindSubscription: 'Kuukausimaksulasku',
    archive: 'Viikkoraportit',
    archiveEmpty: 'Ei vielä raportteja',
    download: 'Lataa PDF',
    generate: 'Muodosta viikkoraportit',
    generating: 'Muodostetaan…',
    generated: 'Raportit muodostettu',
    generateFailed: 'Raportteja ei saatu muodostettua.',
    emailSubject: 'RAHTIS · viikkoraportti {week}',
    emailTrips: 'Kuljetuksia',
    emailWhere: 'Raportti on saatavilla omilla sivuillasi.',
    seller: 'Laskuttaja',
    customer: 'Asiakas',
    payer: 'Maksaja',
    payee: 'Saaja',
    vatNumber: 'ALV-tunniste',
    reference: 'Viite',
  },

  /*
   * Reklamaatiot. Sana on alalla vakiintunut: kuljetusliike ja tilaaja
   * puhuvat reklamaatiosta, eivät "vaateesta". Englanniksi claim.
   */
  operator: {
    title: 'Ylläpitäjän yritystiedot',
    tab: 'Yritystiedot',
    subtitle:
      'Aivomaa Oy:n tiedot, jotka tulostuvat laskuihin, kauden erittelyihin, raportteihin ja laskutussähköposteihin. Muutos koskee seuraavia asiakirjoja; jo muodostetut säilyvät ennallaan.',
    company: 'Yritys',
    legalName: 'Virallinen nimi',
    businessId: 'Y-tunnus',
    vatNumber: 'ALV-tunniste',
    email: 'Sähköposti',
    phone: 'Puhelin',
    website: 'Verkkosivu',
    address: 'Osoite',
    street: 'Katuosoite',
    postalCode: 'Postinumero',
    city: 'Kaupunki',
    country: 'Maa (ISO)',
    bank: 'Maksutiedot',
    bankName: 'Pankki',
    einvoiceOvt: 'Verkkolaskuosoite (OVT)',
    einvoiceOperator: 'Verkkolaskuoperaattori',
    save: 'Tallenna',
    saving: 'Tallennetaan…',
    saved: 'Tallennettu',
    failed: 'Tietoja ei tallennettu. Tarkista kentät.',
    ibanInvalid: 'IBAN ei ole kelvollinen.',
    businessIdShape: 'Y-tunnus muodossa 1234567-8.',
    updated: 'Päivitetty',
  },

  claims: {
    title: 'Reklamaatiot',
    subtitle:
      'Vauriot, vajaukset, odotusajat ja poikkeamat kuljetuksittain. RAHTIS käsittelee jokaisen reklamaation ja välittää osapuolten välillä.',
    subtitleAdmin: 'Kaikki reklamaatiot. Avoimet ja käsittelyssä olevat ensin.',
    none: 'Ei reklamaatioita',
    noneHint: 'Reklamaation voi tehdä valmiin tai käynnissä olevan kuljetuksen kortista.',
    all: 'Kaikki',
    back: 'Reklamaatiot',
    file: 'Tee reklamaatio',
    fileTitle: 'Uusi reklamaatio',
    kind: 'Tyyppi',
    stop: 'Missä tapahtui',
    stopWhole: 'Koko kuljetus',
    description: 'Mitä tapahtui',
    descriptionHint: 'Vähintään 10 merkkiä. Kerro mitä, missä ja milloin — se nopeuttaa käsittelyä.',
    amount: 'Vaadittu summa, € (veroton)',
    amountHint: 'Vapaaehtoinen. Jos summaa ei vielä tiedetä, jätä tyhjäksi.',
    submit: 'Lähetä reklamaatio',
    submitting: 'Lähetetään…',
    cancel: 'Peruuta',
    amountClaimed: 'Vaadittu summa',
    filedBy: 'Tekijä',
    mine: 'Te',
    against: 'Vastapuoli',
    trip: 'Kuljetus',
    evidence: 'Todisteet kuljetuksesta',
    evidenceHint:
      'Kuvat tulevat kuljetukselta, eivät reklamaatiolta: kuljettajan sovelluksen nouto- ja toimituskuvat näkyvät tässä automaattisesti, myös reklamaation jättämisen jälkeen lähetetyt.',
    before: 'Noudettaessa · ennen',
    after: 'Toimitettaessa · jälkeen',
    otherDocuments: 'Rahtikirja ja muut asiakirjat',
    noPhotos: 'Ei kuvia vielä.',
    fromApp: 'sovellus',
    atClaimStop: 'tapahtumapaikka',
    attachments: 'Liitteet',
    attach: 'Liitä tiedosto',
    attachHint: 'PDF, JPG, PNG tai WEBP, enintään 10 Mt.',
    timeline: 'Tapahtumat ja viestit',
    comment: 'Viesti',
    commentPlaceholder: 'Kirjoita viesti vastapuolelle ja RAHTIS-operaattorille…',
    send: 'Lähetä',
    sending: 'Lähetetään…',
    open: 'Avaa',
    closed: 'Reklamaatio on suljettu. Jos asia jatkuu, tee uusi reklamaatio.',
    resolution: 'Ratkaisu',
    moderate: 'Käsittely',
    resolutionHint: 'Pakollinen ratkaistessa ja hylätessä: osapuolten on tiedettävä, mihin päätös perustuu.',
    toReview: 'Ota käsittelyyn',
    resolve: 'Ratkaise',
    reject: 'Hylkää',
    reopen: 'Palauta käsittelyyn',
    settle: 'Merkitse sovituksi',
    settleHint: 'Jos sovitte asiasta vastapuolen kanssa, voitte sulkea oman reklamaationne.',
    failed: 'Toiminto ei onnistunut. Yritä uudelleen.',
    notAllowed: 'Tätä toimintoa ei voi tehdä tässä tilassa.',
    tooShort: 'Kuvaus on liian lyhyt.',
    byEmail: 'Käsittely sähköpostitse',
    notForwarded: 'Reklamaatiota ei ole välitetty vastapuolelle: yhteystietoa ei löytynyt tai lähetys epäonnistui. Välitä se käsin.',
    adminChannel: 'Viestisi näkee vain reklamaation tekijä. Vastapuolen kanssa asia hoidetaan sähköpostitse.',
    writeByEmail: 'Kirjoita vastapuolelle',
    author: {
      SHIPPER: 'Tilaaja',
      CARRIER: 'Kuljetusliike',
      ADMIN: 'RAHTIS',
    },
    event: {
      CREATED: 'teki reklamaation',
      COMMENT: 'kirjoitti',
      STATUS: 'muutti tilaa',
      ATTACHMENT: 'liitti tiedoston',
    },
  },

  claimKind: {
    CARGO_DAMAGE: 'Lastin tai perävaunun vaurio',
    SHORTAGE: 'Vajaus',
    DOWNTIME: 'Odotusaika',
    DEVIATION: 'Poikkeama reitistä tai ajasta',
    OTHER: 'Muu',
  },

  claimStatus: {
    OPEN: 'Avoin',
    IN_REVIEW: 'Käsittelyssä',
    RESOLVED: 'Ratkaistu',
    REJECTED: 'Hylätty',
  },

  /*
   * Raportti vapaavalintaiselta ajanjaksolta. Kirjanpito kysyy eri
   * kysymyksen kuin viikkoraportti: "mitä tapahtui 1.7.–30.9.".
   */
  periodReport: {
    title: 'Raportit',
    subtitle:
      'Valitse ajanjakso ja lataa raportti: PDF katseluun, Excel tai CSV kirjanpitoon.',
    from: 'Alkaen',
    to: 'Päättyen',
    show: 'Näytä',
    company: 'Yritys',
    allCompanies: 'Kaikki yritykset',
    thisWeek: 'Tämä viikko',
    lastWeek: 'Edellinen viikko',
    thisMonth: 'Tämä kuukausi',
    lastMonth: 'Edellinen kuukausi',
    thisQuarter: 'Tämä neljännes',
    lastQuarter: 'Edellinen neljännes',
    download: 'Lataa',
    pdf: 'PDF',
    xlsx: 'Excel',
    csv: 'CSV',
    invalid: 'Tarkista päivämäärät: alku ennen loppua, enintään vuosi.',
    empty: 'Ajanjaksolla ei valmistunut kuljetuksia.',
    noClaims: 'Ajanjaksolla ei tehty reklamaatioita.',
    trips: 'Kuljetukset',
    claims: 'Reklamaatiot',
    summary: 'Yhteenveto',
    titleShipper: 'Kuljetusraportti',
    titleCarrier: 'Ajoraportti',
    titleAdmin: 'Laskutus- ja tilitysraportti',
    /*
      * Perusrivi ei väitä verokantaa: se riippuu vastapuolen maasta, ja
      * «vero lisätään laskulle» oli väärin ulkomaiselle yritykselle,
      * jolla on käännetty verovelvollisuus. Kanta sanotaan erikseen
      * seuraavalla rivillä, jossa vastapuoli tiedetään.
      */
    basis:
      'Kuljetus kuuluu ajanjaksolle päättymispäivänsä mukaan (Suomen aika).',
    colDate: 'Päättyi',
    colRef: 'Numero',
    colShipperRef: 'Tilaajan viite',
    colRoute: 'Reitti',
    colVehicle: 'Ajoneuvo',
    colTrailer: 'Perävaunu',
    colKm: 'km',
    colRate: 'Hinta',
    colCommission: 'Palvelumaksu',
    colShipperFee: 'Tilaajan palvelumaksu',
    colCommissionRate: 'Palvelumaksu %',
    colPayout: 'Tilitys',
    colNet: 'Veroton',
    colVatRate: 'ALV %',
    colVat: 'ALV',
    colGross: 'Verollinen',
    colDocuments: 'Asiakirjat',
    colClaims: 'Reklamaatiot',
    colShipper: 'Tilaaja',
    colCarrier: 'Kuljetusliike',
    colKind: 'Tyyppi',
    colStatus: 'Tila',
    colAmount: 'Summa',
    colFiled: 'Tehty',
    colFiledBy: 'Tekijä',
    colOrder: 'Kuljetus',
    colResolution: 'Ratkaisu',
    rowTrips: 'Kuljetuksia',
    rowDistance: 'Kilometrejä',
    rowRate: 'Kuljetusten hinta',
    rowCommission: 'Palvelumaksut',
    rowPayout: 'Tilitettävä',
    rowMargin: 'Kate',
    rowVat: 'ALV',
    rowGross: 'Yhteensä sis. ALV',
    rowClaims: 'Reklamaatioita',
    rowClaimed: 'Vaadittu yhteensä',
    reverseCharge: 'käännetty verovelvollisuus',
    sheetTrips: 'Kuljetukset',
    sheetClaims: 'Reklamaatiot',
    sheetSummary: 'Yhteenveto',
  },

  vehicle: {
    plate: 'Rekisterinumero',
    driver: 'Kuljettaja',
    languages: 'Kielet',
    whatsapp: 'Kuljettajan puhelin',
    axles: 'Vetoauton akselit',
    make: 'Merkki ja malli',
    euro: 'Päästöluokka',
    base: 'Kotipaikka',
    baseHint: 'Valitse kaupunki ehdotuksista, niin tilaajat näkevät kartalla, että alueella on kalustoa',
    rating: 'Arvio',
    adr: 'ADR',
    adrHas: 'ADR-lupa',
    adrHint: 'Onko ajoneuvolla ja kuljettajalla lupa vaarallisiin aineisiin',
    adrNo: 'Ei ADR-lupaa',
    capacity: 'Kantavuus',
    capacityHint: 'Kaksiakselinen vetoauto ottaa 25 t, kolmiakselinen 32 t.',
    containerFeet: 'Konttialusta',
    containerFeetHint:
      'Mitkä konttipituudet tämä yhdistelmä ottaa. Tyhjä tarkoittaa, ettei ajoneuvo vedä kontteja.',
    containerNone: 'Ei konttialustaa',
    class: 'Ajoneuvoluokka',
    classHint: 'Vetoauto vetää perävaunuja ja kontteja, pakettiauto ja kuorma-auto ajavat pikakuljetuksia.',
    payload: 'Kantavuus, kg',
    payloadHint: 'Paljonko kuormatilaan voi lastata',
    ldm: 'Lavametrit',
    ldmHint: 'Kuormatilan lattiapituus metreinä',
    equipment: 'Varustus',
    tailLift: 'Perälautanostin',
    sideLoading: 'Sivulastaus',
    reefer: 'Kylmäkone',
    reeferUntil: 'Kylmäkoneen tarkastus voimassa',
    reeferUntilHint: 'Päivä, johon asti kylmälaitteen tarkastus on voimassa',
    reeferExpired: 'Kylmäkoneen tarkastus on vanhentunut',
    noEquipment: 'Ei erikoisvarustusta',
  },

  fleet: {
    feeTitle: 'Kuukausimaksu',
    title: 'Kalusto',
    subtitle:
      'Avoimet kuljetukset näkyvät, kun yritykselläsi on vähintään yksi hyväksytty ajoneuvo ja vaaditut asiakirjat ovat voimassa.',
    addVehicle: 'Lisää ajoneuvo',
    newVehicle: 'Uusi ajoneuvo',
    editVehicle: 'Ajoneuvon tiedot',
    submitForApproval: 'Lähetä hyväksyttäväksi',
    deleteDraft: 'Poista luonnos',
    noVehicles: 'Ei vielä ajoneuvoja',
    noVehiclesHint: 'Lisää ajoneuvo, niin tarkastamme sen ja annamme hyväksynnän.',
    onReview: 'Tarkastamme asiakirjat ja ajoneuvon tiedot',
    rejectedHint: 'Ei hyväksytty. Korjaa huomautus ja lähetä uudelleen.',
    canTakeOrders: 'Voit ottaa kuljetuksia',
    cannotTakeOrders: 'Avoimet kuljetukset eivät ole näkyvissä',
    whyClosedNoDocs: 'Lataa voimassa olevat liikennelupa ja vakuutus.',
    whyClosedNoVehicle: 'Tarvitaan vähintään yksi hyväksytty ajoneuvo.',
    whyClosedExpired: 'Asiakirjat ovat vanhentuneet, hyväksyntä ei ole voimassa.',
    languagesHint: 'Millä kielillä kuljettaja pystyy asioimaan',
    tooHeavy: 'Kuljetus on liian raskas tälle ajoneuvolle. Valitse auto, jonka kantavuus riittää.',
  },

  documents: {
    title: 'Yrityksen asiakirjat',
    subtitle: 'Tarkastamme liikenneluvan ja vakuutuksen yhdessä ajoneuvojen kanssa.',
    CARRIER_LICENSE: 'Liikennelupa',
    INSURANCE: 'Vakuutus (CMR / vastuu)',
    upload: 'Lataa',
    replace: 'Korvaa',
    uploading: 'Ladataan…',
    view: 'Avaa',
    file: 'Tiedosto',
    chooseFile: 'Valitse tiedosto',
    dropFile: 'tai vedä se tähän · PDF, JPG, PNG tai WEBP, enintään 10 Mt',
    validUntil: 'Voimassa',
    validUntilRequired: 'Vakuutukselle voimassaolo on pakollinen',
    perpetual: 'toistaiseksi',
    expired: 'vanhentunut',
    notUploaded: 'ei ladattu',
    tooLarge: 'Tiedosto on yli 10 Mt',
    wrongType: 'Sallitut muodot: PDF, JPG, PNG ja WEBP',
    uploadFailed: 'Lataus ei onnistunut. Yritä uudelleen.',
    replacedNotice: 'Vanha versio säilyy, koska aiemmat hyväksynnät perustuvat siihen.',
    attention: 'Huomiota vaativat',
    attentionHint:
      'Näillä yrityksillä on hyväksyttyjä ajoneuvoja, mutta asiakirjat ovat vanhentumassa tai jo vanhentuneet.',
  },

  company: {
    name: 'Yrityksen nimi',
    businessId: 'Y-tunnus',
    email: 'Sähköposti',
    emailHint: 'Tänne lähetämme tunnukset',
    license: 'Liikennelupa',
    insurance: 'Vakuutus (CMR / vastuu)',
  },

  doc: {
    uploaded: 'ladattu',
    missing: 'ei ladattu',
  },

  drivers: {
    title: 'Kuljettajat',
    subtitle:
      'Kuljettajat, heidän autonsa ja työaika. Puhelinnumero on kuljettajan tunnus: samalla numerolla voi olla vain yksi kuljettaja koko palvelussa.',
    add: 'Lisää kuljettaja',
    new: 'Uusi kuljettaja',
    edit: 'Muokkaa',
    name: 'Nimi',
    phone: 'Puhelin',
    email: 'Sähköposti',
    emailHint: 'Vapaaehtoinen. Näkyy tilaajalle, jolle olet sallinut suorat tilaukset.',
    phoneHint: 'Kansainvälisessä muodossa, esim. +358401112233.',
    phoneTaken: 'Tällä numerolla on jo toinen kuljettaja.',
    phoneInvalid: 'Tarkista numero: kansainvälinen muoto, alussa +.',
    languages: 'Kielet',
    languagesHint: 'Millä kielillä kuljettaja pystyy asioimaan',
    vehicle: 'Auto',
    noVehicle: 'Ei autoa',
    assign: 'Vaihda auto',
    archive: 'Arkistoi',
    restore: 'Palauta',
    archived: 'Arkistoidut',
    archivedHint: 'Arkistoitu kuljettaja ei vie puhelinnumeroa. Hänen vuoronsa ja keikkansa säilyvät raporteissa.',
    needsReview: 'Tarkista tiedot: sama numero oli usealla autolla tai eri nimillä.',
    none: 'Ei vielä kuljettajia',
    noneHint: 'Lisää kuljettaja ja valitse hänelle auto.',
    open: 'Työaika ja palkka',
    back: 'Kaikki kuljettajat',
    report: 'Raportti',
    tes: 'TES-säännöt',
    driverHint: 'Kuljettajan voi vaihtaa milloin tahansa — auton hyväksyntä säilyy.',
    vehicleNoDriver: 'Autolla ei ole kuljettajaa, joten se ei voi ottaa kuljetuksia.',
    addDriverFirst: 'Lisää ensin kuljettaja Kuljettajat-sivulla.',
    manage: 'Kuljettajat',
    invite: 'Kutsu sovellukseen',
    inviteAgain: 'Uusi kutsulinkki',
    inviteLink: 'Kutsu on voimassa vuorokauden ja toimii kerran: kuljettaja avaa linkin tai syöttää koodin sovellukseen. Uusi kutsu kirjaa vanhan puhelimen ulos.',
    inviteCode: 'Koodi',
    copy: 'Kopioi',
    copied: 'Kopioitu',
    sms: 'Lähetä tekstiviestinä',
    appLinked: 'Sovellus käytössä',
    appNotLinked: 'Ei sovellusta',
    detach: 'Kirjaa ulos puhelimesta',
  },

  places: {
    kind: {
      FUEL: 'Tankkaus',
      PARKING: 'Pysäköinti',
      SHOWER: 'Suihku',
      SERVICE: 'Huolto',
    },
    free: 'Ilmainen',
    secured: 'Vartioitu',
    sauna: 'Sauna',
    warning: 'Huomio',
    approx: 'Sijainti on likimääräinen – navigointi hakee paikan nimellä.',
    hours: 'Aukioloajat',
    navigate: 'Navigoi',
    call: 'Soita',
    close: 'Sulje',
    nearest: 'Lähimmät',
    locate: 'Näytä lähimmät',
    locating: 'Haetaan sijaintia…',
    locateHint: 'Salli sijainti, niin näet lähimmät paikat etäisyyksineen.',
    noMap: 'Kartta ei ole käytettävissä. Lähimmät paikat näet sijainnin avulla.',
    source:
      'Tiedot on koottu 22.9.2026 ketjujen sivuilta, viranomaisilta ja kuljettajien arvioista. Hinnat ja käytännöt voivat muuttua – varmista tärkeät asiat puhelimella.',
    detail: {
      price: 'Hinta',
      security: 'Turvallisuus',
      facilities: 'Palvelut',
      capacity: 'Paikkoja',
    },
  },

  driverApp: {
    map: 'Kartta',
    title: 'RAHTIS Kuljettaja',
    tasks: 'Tehtävät',
    inbox: 'Viestit',
    profile: 'Profiili',
    earnings: 'Ansiot',
    earningsMonth: 'Ansiot yhteensä',
    earningsNoPay: 'Työnantaja ei ole vielä kirjannut palkkaustasi. Tunnit ja keikat näkyvät silti.',
    earningsEmpty: 'Tässä kuussa ei vielä valmiita keikkoja.',
    earningsRunning: 'Kuussa yhteensä',
    tabActive: 'Aktiiviset',
    tabDone: 'Valmiit',
    noTasks: 'Sinulla ei ole tehtäviä.',
    startDay: 'Aloita päivä',
    pause: 'Tauko',
    resume: 'Jatka',
    endDay: 'Lopeta päivä',
    onBreak: 'Tauolla',
    shiftOff: 'Päivä ei ole käynnissä',
    working: 'Työaika',
    accept: 'Hyväksy tehtävä',
    decline: 'Kieltäydy',
    awaitHint: 'Vahvista tehtävä, kun voit ajaa sen.',
    directHint: 'Tilaaja lähetti tämän suoraan autollesi. Määräaikaa ei ole.',
    open: 'Avaa',
    back: 'Tehtävät',
    navigate: 'Navigoi',
    call: 'Soita',
    next: 'Seuraavaksi',
    window: 'Aika',
    contact: 'Yhteyshenkilö',
    unit: 'Yksikkö',
    weight: 'Paino',
    seal: 'Sinetti vaaditaan',
    loaded: 'Lastattu',
    emptyUnit: 'Tyhjä',
    ref: 'Viite',
    note: 'Huomio',
    markDone: 'Merkitse tehdyksi',
    stopDone: 'Tehty',
    damage: 'Huomautus kalustosta tai kuormasta',
    damagePlaceholder: 'Valinnainen: vauriot, puutteet',
    allDone: 'Kaikki pisteet on tehty. Kuljetusliike sulkee keikan asiakirjoineen.',
    locating: 'Haetaan sijaintia…',
    problem: 'Ilmoita ongelmasta',
    problemPlaceholder: 'Mitä tapahtui?',
    send: 'Lähetä',
    sent: 'Viesti lähetetty kuljetusliikkeelle.',
    notLinked: 'Sovellusta ei ole vielä liitetty',
    notLinkedHint: 'Avaa kuljetusliikkeen lähettämä linkki tai kirjaudu alla puhelinnumerolla ja koodilla. Kutsu on voimassa vuorokauden.',
    inviteCompany: 'Kuljetusliike',
    inviteButton: 'Aloita',
    inviteInvalid: 'Linkki on vanhentunut tai jo käytetty. Pyydä uusi linkki kuljetusliikkeeltäsi.',
    inviteFailed: 'Kirjautuminen epäonnistui. Yritä uudelleen tai pyydä uusi linkki.',
    install: 'Asenna sovellus kotinäytölle',
    installIos: 'iPhonessa: Jaa → Lisää Koti-valikkoon.',
    installAndroid: 'Androidissa: selaimen valikko → Asenna sovellus.',
    signOut: 'Kirjaudu ulos',
    company: 'Kuljetusliike',
    vehicle: 'Auto',
    noVehicle: 'Ei autoa',
    phone: 'Puhelin',
    language: 'Kieli',
    languageAuto: 'Puhelimen mukaan',
    privacy: 'Tietosuoja',
    inboxEmpty: 'Ei viestejä.',
    markRead: 'Merkitse luetuksi',
    failed: 'Toiminto epäonnistui. Yritä uudelleen.',
    arrive: 'Saapui',
    inspection: 'Tarkastus ja kuvat',
    inspectionHint: 'Kuvaa jokainen puoli. Jos näet uuden vaurion, merkitse se ennen kuvaamista.',
    angle: {
      FRONT: 'Etupuoli',
      BACK: 'Takapuoli',
      LEFT: 'Vasen puoli ja renkaat',
      RIGHT: 'Oikea puoli ja renkaat',
    },
    sealPhoto: 'Sinetti',
    cargoPhoto: 'Kuorma',
    extraPhoto: 'Lisäkuva',
    takePhoto: 'Ota kuva',
    retake: 'Ota uusi kuva',
    damageToggle: 'Uusi vaurio',
    atPickup: 'Noudossa',
    uploading: 'Lähetetään…',
    confirmation: 'Toimitusvahvistus',
    signHere: 'Vastaanottajan allekirjoitus',
    signerName: 'Vastaanottajan nimi',
    clear: 'Tyhjennä',
    saveSignature: 'Tallenna allekirjoitus',
    signed: 'Allekirjoitettu',
    scanCmr: 'Kuvaa rahtikirja',
    cmrDone: 'Rahtikirja kuvattu',
    codeTitle: 'Kirjaudu koodilla',
    codePhone: 'Puhelinnumerosi',
    codeLabel: 'Koodi kuljetusliikkeeltä',
    codeSubmit: 'Kirjaudu',
    codeInvalid: 'Numero ja koodi eivät täsmää, tai koodi on vanhentunut.',
    codeThrottled: 'Liian monta yritystä. Yritä uudelleen 15 minuutin kuluttua.',
    confirmationPickup: 'Noutovahvistus',
    signHerePickup: 'Luovuttajan allekirjoitus',
    signerNamePickup: 'Luovuttajan nimi',
    offlineShort: 'Ei yhteyttä',
    offlineStale: 'Näytetään viimeksi ladattu tila.',
    sending: 'Lähetetään merkintöjä…',
    queuedBadge: 'jonossa',
    pushTitle: 'Ilmoitukset',
    pushHint: 'Saat ilmoituksen uudesta tehtävästä, suorasta tilauksesta ja peruutuksesta, vaikka sovellus olisi kiinni.',
    pushEnable: 'Ota ilmoitukset käyttöön',
    pushDisable: 'Poista ilmoitukset käytöstä',
    pushOn: 'Ilmoitukset ovat käytössä tässä puhelimessa.',
    pushDenied: 'Ilmoitukset on estetty. Salli ne puhelimen asetuksista tälle sovellukselle.',
    pushUnsupported: 'Tämä selain ei tue ilmoituksia. iPhonessa asenna sovellus ensin kotinäytölle ja avaa se sieltä.',
    offline: 'Ei yhteyttä. Tarkista verkko ja yritä uudelleen.',
  },

  shifts: {
    title: 'Työvuorot',
    add: 'Lisää työvuoro',
    edit: 'Muokkaa työvuoroa',
    start: 'Alkoi',
    end: 'Päättyi',
    endHint: 'Tyhjä, jos vuoro on vielä käynnissä.',
    breakStart: 'Tauko alkoi',
    breakEnd: 'Tauko päättyi',
    breakHint: 'Yksi tauko käsin syötettynä. Sovellus kirjaa tauot itse.',
    vehicle: 'Auto',
    odoStart: 'Mittarilukema alussa, km',
    odoEnd: 'Mittarilukema lopussa, km',
    note: 'Huomio',
    running: 'Käynnissä',
    delete: 'Poista',
    none: 'Ei työvuoroja tällä jaksolla',
    overlap: 'Työvuoro menee päällekkäin toisen vuoron kanssa.',
    tooLong: 'Työvuoro voi kestää enintään 24 tuntia.',
    invalid: 'Tarkista ajat: loppu ennen alkua tai tauko vuoron ulkopuolella.',
    appRow: 'Kuljettaja kirjasi tämän sovelluksessa — sitä ei muokata käsin.',
    period: 'Jakso',
    history: 'Muutoshistoria',
  },

  shiftSource: {
    APP: 'Sovellus',
    MANUAL: 'Käsin',
  },

  pay: {
    title: 'Palkkalaskuri',
    disclaimer:
      'Laskuri on suuntaa-antava. Lopullinen palkka määräytyy työnantajan ja työsopimuksen/TES:n mukaan.',
    model: 'Palkkamalli',
    validFrom: 'Voimassa alkaen',
    perKm: '€ / km',
    hourly: '€ / h',
    tripPercent: '% tilityksestä',
    tesSet: 'TES-sääntösarja',
    tesGrade: 'Kuljettajaryhmä',
    tesExperience: 'Ajokokemus alkaen',
    tesExperienceHint:
      'Kokemusluokka (alle 4 v, 4–8 v, 8–12 v, yli 12 v) lasketaan tästä päivästä, ja palkka nousee itsestään luokan vaihtuessa.',
    save: 'Tallenna malli',
    current: 'Nykyinen malli',
    history: 'Aiemmat mallit',
    none: 'Palkkamallia ei ole asetettu',
    noTes: 'Luo ensin TES-sääntösarja.',
    missingRate: 'Osalle päivistä ei ole palkkamallia — summa on vajaa.',
    saved: 'Malli tallennettu.',
    sameDay: 'Tälle päivälle on jo malli. Valitse toinen alkupäivä tai poista vanha.',
    delete: 'Poista',
  },

  payModel: {
    PER_KM: 'Kilometripalkka',
    TRIP_PERCENT: 'Prosentti keikasta',
    FLAT_HOURLY: 'Läpituntipalkka',
    TES: 'TES',
  },

  payModelHint: {
    PER_KM: 'Euroa kilometriltä. Kilometrit mittarilukemista, niiden puuttuessa keikkojen matkasta.',
    TRIP_PERCENT: 'Osuus kuljetusliikkeen tilityksestä keikasta.',
    FLAT_HOURLY: 'Sama tuntipalkka kaikille tunneille, ilman lisiä.',
    TES: 'Peruspalkka ja lisät valitun TES-sääntösarjan mukaan.',
  },

  tes: {
    title: 'TES-säännöt',
    subtitle:
      'Syötä luvut voimassa olevasta työehtosopimuksesta. Kun sopimus uudistuu, luo uusi sääntösarja uudella alkupäivällä — vanhat jaksot lasketaan vanhoilla säännöillä.',
    add: 'Uusi sääntösarja',
    name: 'Nimi',
    validFrom: 'Voimassa alkaen',
    regular: 'Säännöllinen työaika, h / vuorokausi',
    ot1Hours: 'Ensimmäiset ylityötunnit, h',
    ot1: 'Ylityökorotus, ensimmäiset tunnit, %',
    ot2: 'Ylityökorotus, seuraavat tunnit, %',
    evening: 'Iltalisä',
    night: 'Yölisä',
    from: 'klo alkaen',
    to: 'klo asti',
    perHour: '€ / h',
    saturday: 'Lauantailisä, %',
    sunday: 'Sunnuntailisä, %',
    note: 'Huomio',
    templates: 'Operaattorin pohjat',
    copy: 'Kopioi omaksi',
    own: 'Omat sääntösarjat',
    none: 'Ei vielä sääntösarjoja',
    later:
      'Operaattorin pohja Kuorma-autoalan TES 2025–2028 sisältää palkkataulukot ja lisät valmiina. Voit käyttää sitä suoraan kuljettajan palkkamallissa tai kopioida omaksi ja muokata.',
    base: 'Peruspalkka, € / h',
    basePlaceholderHint: 'Käytetään, jos kuljettajalle ei ole valittu palkkaryhmää.',
    overtimeBasis: 'Ylityön laskenta',
    basisDay: 'Vuorokausittain',
    basisPeriod: '2 viikon jaksossa (jaksotyö)',
    periodHours: 'Säännöllinen työaika jaksossa, h',
    periodAnchor: 'Jakso alkaa (maanantai)',
    pctOfBase: '% taulukkopalkasta',
    holidays: 'Arkipyhät ja TES 11 § 4:n vapaapäivät kuten sunnuntai',
    minPaid: 'Vähimmäistyö päivässä, h',
    rates: 'Palkkataulukko',
    grade: 'Palkkaryhmä',
    since: 'alkaen',
    save: 'Tallenna',
    inUse: 'Sääntösarja on käytössä palkkamallissa, sitä ei voi poistaa.',
    delete: 'Poista',
  },

  workReport: {
    title: 'Kuljettajaraportti',
    subtitle: 'Tunnit, kilometrit, keikat ja palkka jaksolta — sisäisiin maksuihin.',
    from: 'Alkaen',
    to: 'Päättyen',
    show: 'Näytä',
    driver: 'Kuljettaja',
    allDrivers: 'Kaikki kuljettajat',
    colDate: 'Päivä',
    colHours: 'Työ, h',
    colBreaks: 'Tauot, h',
    colEvening: 'Ilta, h',
    colNight: 'Yö, h',
    colSaturday: 'La, h',
    colSunday: 'Su, h',
    colOvertime: 'Ylityö, h',
    colKm: 'Km',
    colStops: 'Pisteet',
    colTrips: 'Keikat',
    colModel: 'Malli',
    colAmount: 'Suuntaa-antava, €',
    total: 'Yhteensä',
    pdf: 'PDF',
    xlsx: 'Excel',
    csv: 'CSV',
    empty: 'Ei työvuoroja eikä keikkoja tällä jaksolla',
    noRate: 'ei mallia',
    fileName: 'kuljettajaraportti',
    company: 'Kuljetusliike',
    generated: 'Laadittu',
  },

  partners: {
    title: 'Asiakkaat',
    subtitle:
      'Tilaajat, joiden kuljetuksia olet ajanut. Voit sallia heidän lähettää kuljetuksia suoraan autoillesi — ohi yhteisen pöydän.',
    trips: 'Keikat',
    lastTrip: 'Viimeksi',
    allow: 'Salli suorat tilaukset',
    revoke: 'Peru lupa',
    none: 'Ei vielä ajettuja kuljetuksia',
    anonymity:
      'Asiakkaat näkyvät koodilla, ei nimellä. Tilaaja näkee autosi rekisterinumeron, arvosanan sekä kuljettajan nimen, puhelinnumeron ja sähköpostin yhteydenpitoa varten, mutta ei yrityksesi nimeä. Molempien sopimuskumppani on Aivomaa Oy.',
  },

  linkStatus: {
    OFFERED: 'Odottaa päätöstäsi',
    ACTIVE: 'Suorat tilaukset sallittu',
    REVOKED: 'Ei sallittu',
  },

  known: {
    directBilling: 'Laskuttaa sinua suoraan',
    directBillingHint: 'Tämän auton kuljetusliike laskuttaa sinua itse ja vastaa kuljetuksesta. Maksa sen tilille laskun mukaan.',
    carrierAccount: 'Tilinumero',
    title: 'Omat autot',
    subtitle:
      'Autot, jotka ovat ajaneet kuljetuksianne ja joiden kuljetusliike on sallinut suorat tilaukset. Suora tilaus menee autolle ohi yhteisen pöydän.',
    pool: 'Vakioautot',
    others: 'Muut tutut autot',
    addPool: 'Lisää vakioautoihin',
    removePool: 'Poista vakioautoista',
    trips: 'Keikat',
    lastTrip: 'Viimeksi',
    busy: 'Ajossa',
    available: 'Vapaa',
    unavailable: 'Ei nyt käytettävissä',
    none: 'Ei vielä tuttuja autoja',
    noneHint:
      'Auto tulee tänne, kun se on ajanut kuljetuksenne ja sen kuljetusliike sallii suorat tilaukset.',
  },

  direct: {
    dispatch: 'Lähetys',
    desk: 'Yhteiselle pöydälle',
    deskHint: 'Tarjoukset jopa kolmelta kuljetusliikkeeltä, valinta 15 minuutissa.',
    direct: 'Suoraan omalle autolle',
    directHint:
      'Ei määräaikaa: kuljetus odottaa, kunnes auto vahvistaa sen. Jos se perutaan, kuljetus siirtyy yhteiselle pöydälle.',
    chooseVehicle: 'Valitse auto',
    busyWarn:
      'Auto on nyt ajossa — vahvistus voi tulla vasta ajon jälkeen. Kiireelliseen kuljetukseen valitse yhteinen pöytä.',
    noKnown: 'Tuttuja autoja ei vielä ole — kuljetus menee yhteiselle pöydälle.',
    toDesk: 'Siirrä yhteiselle pöydälle',
    sendDirect: 'Lähetä omalle autolle',
    badge: 'Suora tilaus',
    carrierHint:
      'Tilaaja lähetti kuljetuksen suoraan autollenne. Määräaikaa ei ole — vahvista tai kieltäydy. Kieltäytyminen siirtää kuljetuksen yhteiselle pöydälle.',
    shipperHint:
      'Kuljetus odottaa auton vahvistusta ilman määräaikaa. Voit siirtää sen yhteiselle pöydälle milloin tahansa.',
    notKnown: 'Auto ei ole enää tuttujen joukossa.',
    unavailable: 'Auto ei juuri nyt ota kuljetuksia.',
    notFit: 'Auto ei sovi tähän kuljetukseen: tarkista yksikkö ja paino.',
    hasOffers: 'Kuljetukseen on jo tullut tarjouksia — valitse niistä.',
  },

  money: {
    /*
     * Nolla ei ole tilapäinen: asiakkaat ovat ulkomaisia yrityksiä, ja
     * kuljetuspalvelu EU-maiden alv-velvollisten välillä menee
     * käännetyllä verovelvollisuudella. Myyjä laskuttaa 0 %, ostaja
     * tilittää veron omassa maassaan. Ks. VAT_BPS lib/config.ts.
     */
    /*
     * Summat ovat verottomia; kanta riippuu vastapuolen maasta (25,5 %
     * suomalaiselle, käännetty verovelvollisuus ulkomaiselle). Merkintä
     * sanoo siksi 'ilman alv:tä', ei 'alv 0 %', joka väitti nollakantaa
     * myös suomalaiselle asiakkaalle.
     */
    addVat: 'ilman alv:tä',
    vatByCountry: 'Summat ilman alv:ta. Kanta määräytyy vastapuolen maan mukaan.',
    calcNote:
      'Summat ilman alv:tä. Suomalaiselle yritykselle lisätään 25,5 %, muun maan yritykselle sovelletaan käännettyä verovelvollisuutta.',

    gross: 'Bruttohinta',
    commission: 'Palvelumaksu',
    payout: 'Tilitys',
    revenue: 'Laskutus',
    margin: 'Kate',
    total: 'Yhteensä',
  },

  pulse: {
    now: 'Juuri nyt',
    nowEmpty: 'Ei käynnissä olevia kuljetuksia',

    /*
     * Omat nimet laskurille, vaikka orderStatus sanoo saman.
     *
     * Tilamerkintä kertoo yhdestä kuljetuksesta, laskuri monesta, ja
     * suomessa se on eri sana: yksi kuljetus on «Avoin», mutta kolme on
     * «Avoimia 3». Luku tulee sanan jälkeen samasta syystä — «3 Odottaa
     * kuljettajaa» ei ole suomea.
     */
    countOpen: 'Avoimia',
    countOffers: 'Tarjouksia',
    countAwaitDriver: 'Odottaa kuljettajaa',
    countInProgress: 'Ajossa',
    earnings: 'Ansiot viikoittain',
    spend: 'Kustannukset viikoittain',
    vatFree: 'ilman alv:tä',
    empty: 'Kaavio piirtyy, kun ensimmäinen kuljetus on valmis.',
  },

  unit: {
    km: 'km',
  },

  rating: {
    title: 'Arvosana',
    none: 'ei arvioita',
    rate: 'Arvioi kuljetusliike',
    yours: 'Antamasi arvio',
    received: 'Tilaajan arvio',
    addComment: 'Lisää kommentti',
    editComment: 'Muuta kommenttia',
    commentPlaceholder: 'Myöhästyi purusta, paperit kunnossa…',
    commentTitle: 'Tilaajan kommentti',
    save: 'Tallenna',
    saving: 'Tallennetaan…',
    starFirst: 'Anna ensin tähdet',
    failed: 'Arvion tallennus ei onnistunut. Päivitä sivu ja yritä uudelleen.',
    company: 'Yrityksen arvosana',
  },

  countdown: {
    expired: 'aika loppui',
    unknown: '—:—',
  },

  empty: {
    noOrders: 'Tällä alueella ei ole avoimia kuljetuksia.',
    noOrdersHint: 'Vaihda aluetta tai odota uusia kuljetuksia.',
    noApplications: 'Ei uusia hakemuksia.',
    noVehicles: 'Ei ajoneuvoja tarkastuksessa.',
    noTrips: 'Tällä viikolla ei ole kuljetuksia.',
    noMessages: 'Kuljettajalta ei ole viestejä.',
    noAccessTitle: 'Ei pääsyä kuljetuksiin',
    noAccessText: 'Tarvitset vähintään yhden hyväksytyn ajoneuvon.',
  },

  validation: {
    required: 'Täytä tämä kenttä',
    businessId: 'Muoto: 7 numeroa, väliviiva ja tarkistusnumero',
    email: 'Tarkista sähköpostiosoite',
    positiveNumber: 'Anna nollaa suurempi luku',
  },

  error: {
    generic: 'Jokin meni pieleen. Yritä uudelleen.',
    notFound: 'Sivua ei löydy',
    forbidden: 'Ei pääsyä tähän osioon',
    title: 'Sivu ei latautunut',
    body: 'Sivun lataus keskeytyi. Tiedot ovat tallessa — mitään ei kadonnut kesken toiminnon.',
    retry: 'Yritä uudelleen',
    home: 'Etusivulle',
    reference: 'Virheen tunnus',
    referenceHint: 'Kerro tämä tunnus, jos otat yhteyttä ylläpitoon.',
  },

  /**
   * ICU MessageFormat -viestit. Suomessa kaksi monikkomuotoa: one ja other.
   *
   * Sanajärjestys on suomen, ei venäjän: «Viikko 34» eikä «Viikko alkaen»,
   * «3 / 5» eikä «3 viidestä».
   */
  msg: {
    'order.offersCounter':
      '{count, plural, one {# tarjous} other {# tarjousta}} / {max} — valitse kuljetusliike',
    'order.offersFull': 'Paikat täynnä {count} / {max}',
    'order.containerSize': '{feet, number} jalkaa',
    'order.distance': '{km, number} km',
    'order.ratePerKm': '{rate}/km',
    'order.tripsCount': '{count, plural, one {# kuljetus} other {# kuljetusta}}',

    'vehicle.axlesCount': '{count, plural, one {# akseli} other {# akselia}}',
    'vehicle.accessGranted': 'Ajoneuvo {plate} on hyväksytty.',

    'moderation.queued': 'Jonossa {count, plural, one {# hakemus} other {# hakemusta}}',

    'rating.summary': 'Arvosana {value}',
    'rating.summaryWithCount':
      'Arvosana {value} · {count, plural, one {# arvio} other {# arviota}}',
    'rating.ratingsCount': '{count, plural, one {# arvio} other {# arviota}}',
    'rating.setValue': 'Anna arvio {stars} / 5',

    'countdown.left': 'Aikaa jäljellä {time}',

    'money.withVat': 'Sis. ALV {amount}',
    'money.commissionRate': 'Palvelumaksu {rate, number, ::percent}',
    'money.marginRate': 'Kate · {rate, number, ::percent}',

    'report.weekTotal': 'Viikko yhteensä {amount}',
    'report.notice': '{count, plural, one {# kuljetus} other {# kuljetusta}} · {amount}',

    'signup.submitted':
      'Tarkistamme yrityksen {company} (Y-tunnus {businessId}) tiedot rekisteristä ja lähetämme tunnukset osoitteeseen {email}.',
    'moderation.pendingCount':
      '{count, plural, =0 {Ei uusia hakemuksia} one {# hakemus odottaa} other {# hakemusta odottaa}}',
    'moderation.invitedTo': 'Kutsu lähetetty osoitteeseen {email}',
    'moderation.decidedBy': 'Päätetty {date}',

    'fleet.vehiclesCount': '{count, plural, =0 {Ei ajoneuvoja} one {# ajoneuvo} other {# ajoneuvoa}}',
    'fleet.approvedCount':
      '{count, plural, =0 {ei hyväksyttyjä} one {# hyväksytty} other {# hyväksyttyä}}',
    'fleet.pendingCount':
      '{count, plural, =0 {Ei ajoneuvoja tarkastuksessa} one {# ajoneuvo tarkastuksessa} other {# ajoneuvoa tarkastuksessa}}',

    'documents.expiresIn': 'Vanhenee {count, plural, one {# päivän} other {# päivän}} kuluttua',
    'documents.expiredAgo': 'Vanhentui {count, plural, one {# päivä} other {# päivää}} sitten',
    'documents.validUntilDate': 'Voimassa {date} asti',

    'desk.ordersCount': '{count, plural, =0 {Ei kuljetuksia} one {# kuljetus} other {# kuljetusta}}',
    'desk.regionCount': '{city} · {count}',

    'routing.result': '{km, number} km · noin {hours} h {minutes} min',
    'routing.pickFromList': 'Valitse osoite ehdotuksista: {stops}',
    'order.routeRecomputed': 'Reitti muuttui — laskettu {km, number} km',
    'lifecycle.wasNow': 'Ennen {before}, nyt {after}',
    'lifecycle.kmAndMoney': '{km, number} km · {amount}',
    'routing.legDistance': 'osuus {km, number} km',

    'stop.weight': '{tonnes, number, ::.0#} t',
    'stop.consignee': '{label}: {name}',

    'order.stopsCount': 'Reitillä {count, plural, one {# piste} other {# pistettä}}',
    'order.publishedAt': 'Julkaistu {date}',
    'matching.slotsTaken': '{count} / {max}',
    'matching.variant': 'Vaihtoehto {no}',
    'matching.basedIn': 'Kotipaikka {city}',
    'matching.offersCount':
      '{count, plural, =0 {Ei tarjouksia} one {# tarjous} other {# tarjousta}} / {max}',

    'trip.stageAt': '{stage} · {place}',
    'trip.progressCount': 'Tehty {done} / {total}',
    'trip.enRouteTo': 'Matkalla · {place}',
    /*
      * Kalustolaji kokonaisena sanana. Aiemmat lyhenteet «vetoa» ja
      * «pika» eivät kertoneet, tuleeko pakettiauto vai kuorma-auto.
      */
    'presence.tractorCount': '{count, plural, one {# vetoauto} other {# vetoautoa}}',
    'presence.truckCount': '{count, plural, one {# kuorma-auto} other {# kuorma-autoa}}',
    'presence.vanCount': '{count, plural, one {# pakettiauto} other {# pakettiautoa}}',
    'trip.arrivedAt': 'Saapui klo {time}',
    'trip.completedAt': 'Tehty klo {time}',
    /*
     * Poikkeama, ei koordinaatit. Numeropari ei kerro riitatilanteessa
     * mitään; etäisyys osoitteesta kertoo kaiken.
     */
    'trip.markedNear': 'Merkitty {meters, number} m päässä osoitteesta',
    'trip.markedFar': 'Merkitty {km, number, ::.0#} km päässä osoitteesta',
    'trip.markedHere': 'Merkitty paikan päällä',
    'trip.damageAt': 'Vaurio · {place}',

    'trip.stepReported': 'Kuljetus {ref}: kuljettaja merkitsi ”{step}”.',
    'trip.amended': 'Reitti muuttui kuljetuksessa {ref}: {change}',

    'amend.stopAt': '{kind} · {place}',
    'amend.fieldChange': '{label}: {from} → {to}',
    'amend.fieldValue': '{label}: {value}',
    'amend.pendingCount': '{count, plural, one {# muutos} other {# muutosta}}',
    'amend.madeAt': 'Muutettu {date}',


    'landing.cycleStage': 'Vaihe {no} / {total}',

    /*
      * Pylvään alla pelkkä viikon numero: otsikko kertoo jo, että kyse on
      * viikoista, ja lyhenne «vko» jäi lukijalle arvattavaksi. Koko sana
      * on siellä, missä tilaa on — vihjeessä ja yhteissummassa.
      */
    'pulse.week': '{no}',
    'pulse.weekAmount': 'Viikko {no} · {amount}',
    'pulse.totalOne': 'Viikko {no} yhteensä {amount}',
    'pulse.totalRange': 'Viikot {from}–{to} yhteensä {amount}',

    'event.order.published': 'Uusi kuljetus {ref} · {from} → {to}',
    'event.offer.received': 'Uusi tarjous kuljetukseen {ref}',
    'event.offer.chosen': 'Sinut valittiin kuljetukseen {ref} — vahvista {minutes} minuutissa',
    'event.order.released': 'Kuljetus {ref} vapautui takaisin avoimeksi',
    'event.order.cancelled': 'Kuljetus {ref} on peruutettu — katso muutosloki',
    'event.order.amended': 'Kuljetuksen {ref} reitti muuttui',
    'event.trip.stop.done': 'Kuljetus {ref}: {place} merkitty tehdyksi ({done}/{total})',
    'event.order.closed': 'Kuljetus {ref} on valmis, asiakirjat ovat saatavilla',
    'event.vehicle.approved': 'Ajoneuvo {plate} on hyväksytty',
    'event.vehicle.rejected': 'Ajoneuvoa {plate} ei hyväksytty',

    'event.rating.received': 'Tilaaja arvioi kuljetuksen {ref}: {score} / 5',
    'event.claim.opened': 'Uusi reklamaatio {ref} kuljetuksesta {order}',
    'event.claim.comment': 'Uusi viesti reklamaatiossa {ref}',
    'event.claim.attachment': 'Uusi liite reklamaatiossa {ref}',
    'event.claim.status': 'Reklamaatio {ref}: {status, select, OPEN {avoin} IN_REVIEW {käsittelyssä} RESOLVED {ratkaistu} REJECTED {hylätty} other {tila muuttui}}',
    'claims.statusChange': '{from} → {to}',
    'claims.channelEmail': 'Tätä reklamaatiota käsitellään RAHTIS-operaattorin kanssa sähköpostitse. Vastaa saamaasi viestiin tai kirjoita osoitteeseen {email} ja mainitse numero {ref}. Tilan ja ratkaisun näet tästä.',
    'claims.forwarded': 'Välitetty vastapuolelle {date}. Viestisi näkee RAHTIS-operaattori, joka hoitaa asian vastapuolen kanssa.',
    'claims.forwardedTo': 'Välitetty vastapuolelle {date} · {email}',
    'claims.openCount': '{count, plural, =0 {Ei avoimia reklamaatioita} one {# avoin reklamaatio} other {# avointa reklamaatiota}}',
    'claims.onTrip': '{count, plural, one {# reklamaatio} other {# reklamaatiota}}',
    'periodReport.range': 'Ajanjakso {from}–{to}',
    'periodReport.tripsCount': '{count, plural, one {# kuljetus} other {# kuljetusta}}',

    'legal.version': 'Versio {n}',
    'legal.effective': 'Voimassa {date} alkaen',
    'legal.accepted': 'Hyväksytty {date} · versio {n}',

    'orderForm.repeatedFrom': 'Toistetaan kuljetuksesta {ref}. Päivämäärät ja perävaunun numero on jätetty tyhjiksi: ne ovat uudella keikalla omat.',
    'orderForm.repeatSkipped': '{count, plural, one {Yhtä pistettä} other {# pistettä}} ei voitu toistaa: jatkokeikalle ei ole lomakkeella kenttää.',
    'admin.companyOrders': '{count, plural, =0 {Ei kuljetuksia} one {# kuljetus} other {# kuljetusta}}',
    'orders.shownOf': 'Näytetään {shown}/{total}',
    'done.windowNote': 'Listalla näkyvät viimeiset {weeks} viikkoa. Vanhemmat kuljetukset löytyvät numerolla kauden asiakirjoista tai kysymällä avustajalta.',
    'done.weekOf': 'Viikko {date}',
    'done.closedAt': 'Päättyi {date}',
    'done.bps': '{rate, number, ::percent}',
    'direct.waiting': 'Odottaa auton {plate} vahvistusta',
    'event.order.direct': 'Suora tilaus {ref} autolle {plate} — {shipper}',
    'event.direct.accepted': 'Auto {plate} vahvisti kuljetuksen {ref}',
    'event.direct.released': 'Auto {plate} ei ottanut kuljetusta {ref} — se on nyt yhteisellä pöydällä',
    'event.link.offer': 'Ajoit ensimmäisen kuljetuksen tilaajalle {shipper}. Sallitaanko suorat tilaukset?',
    'drivers.count': '{count, plural, =0 {Ei kuljettajia} one {# kuljettaja} other {# kuljettajaa}}',
    'drivers.onVehicle': 'Autolla {plate}',
    'known.tripsCount': '{count, plural, one {# keikka} other {# keikkaa}} kanssanne',
    'partners.tripsCount': '{count, plural, one {# keikka} other {# keikkaa}}',
    'pay.modelSince': '{model} {date} alkaen',
    'driverApp.earnTrips': '{count, plural, one {# keikka} other {# keikkaa}}',
    'driverApp.earnHours': '{hours} h',
    'billingDesk.week': 'vko {no}',
    'billingDesk.weekTrips': '{count, plural, one {vko {no}: # keikka} other {vko {no}: # keikkaa}}',
    'billingDesk.weekAmount': 'vko {no}: {amount}',
    'billingDesk.trips': '{count, plural, one {# keikka} other {# keikkaa}}',
    'billingDesk.period': 'Kausi {from}–{to}',
    'billingDesk.autoInvoice': 'Laskut lähtevät automaattisesti {date}',
    'billingDesk.customerDue': 'Asiakkaat maksavat {date} mennessä',
    'billingDesk.payoutDue': 'Tilitys kuljetusliikkeille {date}',
    'pay.experienceSince': 'ajokokemus {date} alkaen',
    'fleet.feeRule': '{unit} (ilman alv:tä) kuukaudessa jokaisesta autosta, joka ajaa kuukauden aikana vähintään yhden keikan. Ajamaton auto on maksuton. Maksu vähennetään tilityksestä.',
    'fleet.feeFree': 'Ensimmäinen kuukausi on maksuton: maksuton {date} asti.',
    'places.count': '{count, plural, one {# paikka} other {# paikkaa}}',
    'driverApp.welcome': 'Tervetuloa, {name}',
    'driverApp.breakTotal': 'Tauot {minutes} min',
    'driverApp.stopOf': 'Pysähdys {n}/{total}',
    'driverApp.arrivedAt': 'Saavuit klo {time}',
    'driverApp.queued': '{count, plural, one {# merkintä odottaa lähetystä} other {# merkintää odottaa lähetystä}}',
    'driverApp.rejected': '{count, plural, one {Yhtä merkintää ei hyväksytty} other {# merkintää ei hyväksytty}} — tarkista tehtävä. Sulje napauttamalla.',
    'driverApp.pendingSignOut': '{count, plural, one {# merkintä ei ole vielä lähtenyt} other {# merkintää ei ole vielä lähtenyt}}. Jos kirjaudut ulos nyt, ne katoavat.',
    'driverEvent.order.direct': 'Uusi suora keikka {ref} autolle {plate}',
    'driverEvent.offer.chosen': 'Keikka {ref} autolle {plate} — vahvista {minutes} minuutissa',
    'driverEvent.order.released': 'Keikka {ref} ei ole enää sinun',
    'driverEvent.order.cancelled': 'Keikka {ref} on peruttu',
    'event.driver.problem': 'Kuljettaja {driver}, keikka {ref}: {text}',
    'drivers.smsBody': 'RAHTIS-kuljettajasovellus: {link} — tai kirjaudu sovelluksessa koodilla {code}',
  },
/*
 * Без `satisfies Dictionary`: тип Dictionary выводится отсюда же, и
 * проверка эталона собственным типом была бы кольцом. Форму этого
 * словаря проверяют остальные словари, а не он сам.
 */
} as const;
