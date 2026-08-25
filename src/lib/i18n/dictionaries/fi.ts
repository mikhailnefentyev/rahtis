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
    tagline: 'Kuljetusalusta · Suomi',
    operator: 'Aivomaa Oy',
    description: 'Digitaalinen kuljetusalusta. Operaattorina Aivomaa Oy.',
  },

  role: {
    CARRIER: 'Kuljetusliike',
    SHIPPER: 'Tilaaja',
    ADMIN: 'Ylläpito · Aivomaa',
  },

  nav: {
    desk: 'Avoimet kuljetukset',
    fleet: 'Kalusto',
    orders: 'Omat kuljetukset',
    report: 'Viikkoraportti',
    moderation: 'Tarkastus',
    dispatch: 'Ajojärjestely · WhatsApp',
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
    signInSubtitle: 'Avointa rekisteröitymistä ei ole. Aivomaa avaa tunnukset tarkastuksen jälkeen.',
    email: 'Sähköposti',
    password: 'Salasana',
    submit: 'Kirjaudu',
    submitting: 'Kirjaudutaan…',
    signOut: 'Kirjaudu ulos',
    fillBoth: 'Anna sähköposti ja salasana',
    invalidCredentials: 'Sähköposti tai salasana ei täsmää',
    noApplicationYet: 'Etkö ole vielä hakenut mukaan?',
    applyLink: 'Lähetä hakemus',

    noAccessTitle: 'Omat sivut eivät ole käytettävissä',
    noProfileText:
      'Tunnus on olemassa, mutta sitä ei ole liitetty yritykseen. Ota yhteyttä Aivomaahan, niin avaamme pääsyn.',
    frozenTitle: 'Tunnukset on jäädytetty',
    frozenText:
      'Yrityksen tunnukset on jäädytetty. Tiedot ja kuljetushistoria säilyvät. Ota yhteyttä Aivomaahan, niin selvitämme asian.',
    rejectedText:
      'Yrityksesi hakemus on hylätty. Ota yhteyttä Aivomaahan, niin kerromme syyn ja voit hakea uudelleen.',
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
    progress: 'Kuljetuksen eteneminen',
    markDone: 'Merkitse tehdyksi',
    marking: 'Merkitään…',
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
    eyebrow: 'Logistiikka-alusta Suomessa',
    titleA: 'Auto pysyy liikkeessä.',
    titleB: 'Rahti lähtee ajallaan.',
    titleC: 'Turhat puhelut jäävät pois.',
    lede:
      'Kun tilaus julkaistaan, se välittyy automaattisesti alueen hyväksytyille kuljetusliikkeille. Tarjoukset voivat tulla jo minuuteissa. Keikan eteneminen näkyy vaihe vaiheelta, ja lopuksi kaikki asiakirjat löytyvät samasta paikasta.',
    lede2: 'Aivomaa Oy huolehtii siitä, että prosessi etenee alusta loppuun.',
    asShipper: 'Olen kuljetuksen tilaaja',
    asCarrier: 'Olen kuljetusliike',
    signIn: 'Kirjaudu palveluun',
    apply: 'Lähetä hakemus',
    moderationNote:
      'Palveluun ei voi rekisteröityä suoraan. Tarkistamme jokaisen yrityksen tiedot ennen hyväksyntää PRH:n ja YTJ:n rekistereistä.',
    fleetLabel: 'hyväksyttyä autoa',
    regionsLabel: 'toiminta-aluetta',
    fleetLive: 'Luvut päivittyvät uusien hyväksyntöjen myötä.',
    regions: 'Toiminta-alueet',

    /*
     * Neljä vaihetta, jotka kuljetus oikeasti käy läpi. Tekstit ovat samat
     * kuin palvelussa, jotta kortti vastaa sitä, mitä käyttäjä myöhemmin
     * näkee omilla sivuillaan.
     */
    cycle1: 'Tarjolla',
    cycle1Note: 'Julkaistu ja välitetty alueen kuljetusliikkeille',
    cycle2: 'Tarjouksia 2 / 3',
    cycle2Note: 'Tilaaja valitsee hinnan ja arvostelujen perusteella',
    cycle3: 'Ajossa · perävaunu noudettu',
    cycle3Note: 'Kuljettaja merkitsee pisteet järjestyksessä',
    cycle4: 'Valmis · rahtikirja liitetty',
    cycle4Note: 'Asiakirjat tilaajalla, tilitys viikkoraportissa',
    cabinet: 'Omat sivut',

    helpEyebrow: 'Mitä RAHTIS tekee',
    helpTitle: 'Pidämme rahdin liikkeessä ja autot ajossa',
    helpLede:
      'RAHTIS ei korvaa huolitsijaa, ajojärjestelyä tai kuljetusliikettä. Se poistaa työstä turhan etsimisen, soittelun, saman asian selvittämisen moneen kertaan ja hajallaan olevat asiakirjat.',
    helpCargo: 'Kuljetuksen tilaajalle',
    helpCargoTitle: 'Tilaus liikkeelle nopeasti',
    helpCargoText:
      'Julkaise kuljetus kerran. Tieto välittyy heti alueen hyväksytyille kuljetusliikkeille, ja tarjoukset tulevat samaan näkymään.',
    helpTruck: 'Kuljetusliikkeelle',
    helpTruckTitle: 'Vähemmän tyhjäajoa',
    helpTruckText:
      'Näet alueesi avoimet keikat yhdessä paikassa. Kun edellinen kuljetus päättyy, voit etsiä seuraavan keikan suoraan samalta alueelta.',
    helpDriver: 'Kuljettajalle',
    helpDriverTitle: 'Kaikki keikan tiedot yhdessä paikassa',
    helpDriverText:
      'Osoitteet, yhteyshenkilöt, varaukset ja toimintaohjeet kulkevat mukana koko keikan ajan. Tarvittaessa kuljettaja saa apua suoraan WhatsAppissa.',

    timeEyebrow: 'Seisonta maksaa kaikille',
    timeTitle: 'Logistiikassa aika maksaa',
    timeLede:
      'Kun kuljetuksen tilaaja etsii vapaata autoa puhelimitse, rahti odottaa. Kun kuljetusliike etsii seuraavaa kuormaa, auto seisoo. Molemmissa tapauksissa menetetään samaa asiaa: aikaa.',
    timeOld: 'Näin se usein toimii nyt',
    timeOld1:
      'Tilaaja soittaa useille kuljetusliikkeille ja kertoo saman kuljetuksen tiedot joka kerta uudelleen.',
    timeOld2: 'Kuljetusliike etsii seuraavaa keikkaa puhelimitse, jotta auto ei lähtisi tyhjänä.',
    timeOld3: 'Sovitut asiat jäävät puheluiden ja viestien varaan.',
    timeOld4:
      'Kuljettaja joutuu kysymään erikseen osoitteita, yhteystietoja ja terminaalien ohjeita.',
    timeOld5: 'Rahtikirjat ja muut asiakirjat saattavat tulla vasta päiviä kuljetuksen jälkeen.',
    timeOld6: 'Laskutusta ja tilityksiä selvitetään jälkikäteen eri kanavissa.',
    timeNew: 'Näin RAHTIS toimii',
    timeNew1:
      'Tilaus julkaistaan kerran ja välitetään automaattisesti oikean alueen kuljetusliikkeille.',
    timeNew2: 'Hyväksytyt kuljetusliikkeet näkevät avoimet keikat samassa näkymässä.',
    timeNew3: 'Hinta, aikataulu, reitti ja kalustovaatimukset ovat selvillä ennen keikan hyväksymistä.',
    timeNew4:
      'Kuljettaja saa osoitteet, yhteystiedot, varaukset ja kohdekohtaiset ohjeet suoraan keikalle.',
    timeNew5: 'Asiakirjat liitetään keikkaan heti sen valmistuttua.',
    timeNew6: 'Ajetut keikat ja tilitykset näkyvät viikkoraportissa.',

    rolesEyebrow: 'Kenelle RAHTIS on tarkoitettu',
    rolesTitle: 'Yksi alusta kuljetuksen molemmille osapuolille',
    shipperEyebrow: 'Kuljetuksen tilaajalle',
    shipperTitle: 'Kuljetusliikettä ei tarvitse etsiä yksi kerrallaan.',
    shipper1: 'Julkaiset tilauksen kerran, ja se välittyy alueen hyväksytyille kuljetusliikkeille.',
    shipper2: 'Saat enintään kolme tarjousta samaan näkymään.',
    shipper3: 'Valitset sopivan kuljetusliikkeen hinnan, kaluston ja arvostelujen perusteella.',
    shipper4:
      'Jos reitti, aikataulu tai muu tieto muuttuu kesken keikan, päivitys menee suoraan kuljetusliikkeelle ja kuljettajalle.',
    shipper5: 'Asiakirjat ovat saatavilla heti keikan valmistuttua.',
    shipper6: 'Viikkoraportista näet keikat, summat, asiakirjat ja palautteet.',
    carrierEyebrow: 'Kuljetusliikkeelle',
    carrierTitle: 'Pidä auto ajossa myös keikkojen välillä.',
    carrier1: 'Näet alueesi avoimet keikat yhdestä paikasta.',
    carrier2: 'Seuraavaa kuljetusta ei tarvitse etsiä soittamalla.',
    carrier3: 'Voit löytää paluukeikan alueelta, jossa edellinen kuljetus päättyy.',
    carrier4: 'Jokainen auto hyväksytään palveluun erikseen.',
    carrier5: 'Hinta, palvelumaksu ja sinulle jäävä osuus näkyvät ennen keikan hyväksymistä.',
    carrier6: 'Viikkoraportista näet ajetut keikat, ansiot ja tulevat tilitykset.',

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
    fault3: 'Perävaunussa havaittiin vaurio noudon yhteydessä',
    fault3Text:
      'Vaurio kirjataan kyseiselle noutopisteelle kuvan ja kellonajan kanssa. Näin tapahtumasta jää selkeä dokumentointi.',
    fault4: 'Kuljetus perutaan ennen aloitusta',
    fault4Text:
      'Peruutettu keikka palautuu automaattisesti tarjolle ja siitä lähtee tieto sopiville kuljetusliikkeille.',

    aiEyebrow: 'Kuljettajan avustaja',
    aiSoon: 'Tulossa',
    aiTitle: 'Kuljettajalla on apu mukana koko keikan ajan',
    aiLede:
      'WhatsAppissa toimiva RAHTIS-avustaja tuntee kyseisen keikan tiedot ja pystyy vastaamaan kuljettajan kysymyksiin hänen omalla kielellään.',
    aiLede2:
      'Kyse ei ole valikkobotista tai automaattivastaajasta. Avustaja käyttää keikan tietoja ja auttaa käytännön tilanteissa matkan aikana.',
    aiOnline: 'WhatsApp · paikalla',
    aiDriver: 'Kuljettaja',
    aiBot: 'RAHTIS',
    aiQ1: 'Milloin Kotkan portti on auki?',
    aiA1:
      'Hietasen portti on avoinna ma–pe klo 06.00–22.00 ja la klo 08.00–16.00. Sinun purkuaikasi on klo 07.00, joten portti on silloin auki.',
    aiQ2: 'Mistä saan lisää liinoja ja kulmasuojia?',
    aiA2:
      'Lähin sopiva liike on reittisi varrella Kotkassa, noin 4 km ennen terminaalia. Liike on avoinna klo 18 asti.',
    aiQ3: 'Ehdinkö vielä Turkuun tänään?',
    aiA3:
      'Ilmoitettujen tietojen mukaan ajoaikaa on jäljellä 3 h 20 min ja matka kestää noin 2 h 40 min. Nykyisillä tiedoilla ehdit perille ajoajan puitteissa.',
    ai1: 'Tuntee keikan tiedot',
    ai1Text:
      'Osoitteet, yhteyshenkilöt, varausnumerot, perävaunun tiedot ja muut keikan tiedot ovat avustajan käytettävissä.',
    ai2: 'Etsii tarvittaessa lisätietoa',
    ai2Text:
      'Avustaja voi auttaa esimerkiksi terminaalien aukioloajoissa, yhteystiedoissa, tarvikkeiden hankinnassa ja sopivan taukopaikan löytämisessä.',
    ai3: 'Auttaa ajoajan arvioinnissa',
    ai3Text:
      'Kun tarvittavat ajoaikatiedot ovat käytettävissä, avustaja voi arvioida, ehtiikö kuljettaja seuraavaan pisteeseen ajoajan puitteissa.',
    ai4: 'Päivittää keikan kuljettajan viestistä',
    ai4Text:
      'Kuljettaja voi esimerkiksi kirjoittaa WhatsAppiin ”purettu”, jolloin keikan tila päivittyy tilaajalle ja kuljetusliikkeelle.',
    ai5: 'Siirtää asian ihmiselle tarvittaessa',
    ai5Text:
      'Jos avustaja ei pysty varmistamaan vastausta, asia siirtyy Aivomaan ajojärjestelyyn.',
    ai6: 'Palvelee kuljettajan kielellä',

    servicesEyebrow: 'Palvelu laajenee vaiheittain',
    servicesTitle: 'Aloitamme irtoperäliikenteestä ja laajennamme muihin kuljetuksiin',
    serviceLive: 'Toiminnassa',
    serviceSoon: 'Seuraavaksi',
    service1: 'Irtoperävaunujen kuljetukset',
    service1Text:
      'Veturi noutaa perävaunun satamasta tai terminaalista, hoitaa sovitut lastaukset ja purut ja toimittaa perävaunun seuraavaan sovittuun paikkaan.',
    service1Text2: 'Aloitamme Suomessa ja laajennamme myöhemmin Skandinaviaan.',
    service2: 'Kuljetukset kuljetusliikkeen omalla kalustolla',
    service2Text:
      'Kuljetusliike hoitaa kuljetuksen omalla kalustollaan: esimerkiksi kapelliperävaunulla, kylmäkalustolla, kippikalustolla tai lavetilla.',
    service2Text2:
      'Tilaaja ilmoittaa kuorman tiedot, painon, mitat ja muut vaatimukset. RAHTIS etsii tehtävään sopivan kuljetusliikkeen.',

    finalEyebrow: 'Näin pääset alkuun',
    finalTitle: 'Kerro yrityksestäsi – me hoidamme loput',
    finalLede: 'Tarvitsemme yrityksen nimen, Y-tunnuksen ja sähköpostiosoitteen.',
    finalLede2:
      'Tarkistamme yrityksen tiedot rekistereistä ja avaamme hyväksynnän jälkeen tunnukset palveluun.',
    finalLede3: 'Kuljetusliikkeiltä tarvitsemme lisäksi tiedot liikenneluvasta ja vakuutuksesta.',
    applyShipper: 'Tilaajan hakemus',
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
    vatNoteShipper: 'Summat alv 0 %. Laskuihin lisätään alv 25,5 %.',
    vatNoteCarrier: 'Summat alv 0 %. Tilityksiin lisätään alv 25,5 %.',
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

  amendKind: {
    STOP_ADDED: 'Piste lisätty',
    STOP_CHANGED: 'Piste muuttui',
    STOP_REMOVED: 'Piste poistettu',
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

  orderType: {
    TRAILER_SWAP: 'Puoliperävaunun kuljetus',
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
    title: 'Uusi kuljetus',
    subtitle: 'Täytä reitti kokonaan ja julkaise. Kuljetus näkyy kuljetusliikkeille heti.',
    type: 'Kuljetuksen tyyppi',
    shipperRef: 'Oma viitteesi',
    shipperRefHint: 'Vapaaehtoinen. RAHTIS antaa kuljetukselle oman numeron automaattisesti',

    trailerPickupSection: 'Mistä perävaunu noudetaan',
    dropSection: 'Mihin perävaunu jätetään',
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

    trailer: 'Perävaunun tyyppi',
    trailerPlaceholder: 'Kapelli 13,6, 3 akselia',
    trailerPlate: 'Perävaunun rekisterinumero',
    trailerPlateHint: 'Kuljettaja löytää sen avulla oikean vaunun kentältä. Pakollinen tieto.',
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
    cancel: 'Peruuta',
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

    accept: 'Hyväksyn käyttöehdot ja tietosuojaselosteen',
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

  moderation: {
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
    iAmCarrier: 'Ajan kuljetuksia',
    iAmShipper: 'Tarvitsen kuljetuksia',
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

  account: {
    title: 'Oma tili',
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
    linkExpired: 'Linkki ei kelpaa tai on vanhentunut. Pyydä uusi kutsu Aivomaalta.',
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
    empty: 'Tällä viikolla ei valmistunut kuljetuksia.',
    closingNote:
      'Kuljetus kuuluu sille viikolle, jona se päättyi. Perjantaina aloitettu ja maanantaina purettu kuljetus näkyy seuraavan viikon raportissa.',
    page: 'Sivu',
    archive: 'Viikkoraportit',
    archiveEmpty: 'Ei vielä raportteja',
    download: 'Lataa PDF',
    generate: 'Muodosta viikkoraportit',
    generating: 'Muodostetaan…',
    generated: 'Raportit muodostettu',
    generateFailed: 'Raportteja ei saatu muodostettua.',
    emailSubject: 'RAHTIS · viikkoraportti {week}',
  },

  vehicle: {
    plate: 'Rekisterinumero',
    driver: 'Kuljettaja',
    languages: 'Kielet',
    whatsapp: 'WhatsApp / puhelin',
    axles: 'Vetoauton akselit',
    make: 'Merkki ja malli',
    euro: 'Päästöluokka',
    base: 'Kotipaikka',
    rating: 'Arvio',
    adr: 'ADR',
    adrHas: 'ADR-lupa',
    adrHint: 'Onko ajoneuvolla ja kuljettajalla lupa vaarallisiin aineisiin',
    adrNo: 'Ei ADR-lupaa',
    capacity: 'Kantavuus',
    capacityHint: 'Kaksiakselinen vetoauto ottaa 25 t, kolmiakselinen 32 t.',
  },

  fleet: {
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
    tooHeavy: 'Kuljetus on liian raskas tälle ajoneuvolle. Valitse kolmiakselinen vetoauto.',
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
    validUntil: 'Voimassa',
    validUntilRequired: 'Vakuutukselle voimassaolo on pakollinen',
    perpetual: 'toistaiseksi',
    expired: 'vanhentunut',
    notUploaded: 'ei ladattu',
    tooLarge: 'Tiedosto on yli 10 MB',
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

  money: {
    addVat: '+ alv 25,5 %',
    calcNote: 'Summat alv 0 %. Laskuihin ja tilityksiin lisätään alv 25,5 %.',

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
    vatFree: 'alv 0 %',
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
    'trip.completedAt': 'Tehty klo {time}',
    'trip.damageAt': 'Vaurio · {place}',

    'trip.stepReported': 'Kuljetus {ref}: kuljettaja merkitsi ”{step}”.',
    'trip.amended': 'Reitti muuttui kuljetuksessa {ref}: {change}',

    'amend.stopAt': '{kind} · {place}',
    'amend.fieldChange': '{label}: {from} → {to}',
    'amend.fieldValue': '{label}: {value}',
    'amend.pendingCount': '{count, plural, one {# muutos} other {# muutosta}}',
    'amend.madeAt': 'Muutettu {date}',


    'landing.cycleStage': 'Vaihe {no} / {total}',

    'pulse.week': 'vko {no}',
    'pulse.weekAmount': 'Viikko {no} · {amount}',
    'pulse.totalOne': 'vko {no} yhteensä {amount}',
    'pulse.totalRange': 'vko {from}–{to} yhteensä {amount}',

    'event.offer.received': 'Uusi tarjous kuljetukseen {ref}',
    'event.offer.chosen': 'Sinut valittiin kuljetukseen {ref} — vahvista {minutes} minuutissa',
    'event.order.released': 'Kuljetus {ref} vapautui takaisin avoimeksi',
    'event.order.amended': 'Kuljetuksen {ref} reitti muuttui',
    'event.order.closed': 'Kuljetus {ref} on valmis, asiakirjat ovat saatavilla',
    'event.vehicle.approved': 'Ajoneuvo {plate} on hyväksytty',
    'event.vehicle.rejected': 'Ajoneuvoa {plate} ei hyväksytty',

    'legal.version': 'Versio {n}',
    'legal.effective': 'Voimassa {date} alkaen',
    'legal.accepted': 'Hyväksytty {date} · versio {n}',

    'done.weekOf': 'Viikko {date}',
    'done.closedAt': 'Päättyi {date}',
    'done.bps': '{rate, number, ::percent}',
  },
/*
 * Без `satisfies Dictionary`: тип Dictionary выводится отсюда же, и
 * проверка эталона собственным типом была бы кольцом. Форму этого
 * словаря проверяют остальные словари, а не он сам.
 */
} as const;
