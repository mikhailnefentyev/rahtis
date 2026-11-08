import type { Locale } from '@/lib/i18n/config';

/**
 * Витрина «Maansiirto ja kippiautot» — страница для поиска и ответчиков
 * на языковых моделях (26.10.2026).
 *
 * Тексты здесь, а не в общих словарях: это одна посадочная страница с
 * длинным рассказом, и держать её в словарях платформы значило бы
 * раздувать то, что грузится в каждый кабинет.
 *
 * Только то, что модуль объектов делает уже сейчас. Связь с системами
 * весовых (mScales и т. п.) и отправка в реестр SIIRTO ещё не готовы —
 * их здесь нет, пока они не заработают.
 */
export type EarthworksCopy = {
  /** Заголовок вкладки и поисковой выдачи (≤ 60 знаков, без «· RAHTIS»). */
  metaTitle: string;
  /** Описание для выдачи (≤ 160 знаков). */
  metaDescription: string;
  eyebrow: string;
  title: string;
  lede: string;
  ctaApply: string;
  ctaSignIn: string;
  dayTitle: string;
  day: { title: string; text: string }[];
  featuresTitle: string;
  features: { title: string; text: string }[];
  priceTitle: string;
  priceText: string;
  faqTitle: string;
  faq: { q: string; a: string }[];
  finalTitle: string;
  finalText: string;
  /** Ссылка с главной и из подвала. */
  teaserEyebrow: string;
  teaserTitle: string;
  teaserText: string;
  teaserCta: string;
  footerLink: string;
  /** Карточка в блоке «как растёт сервис» на главной. */
  serviceTitle: string;
  serviceText: string;
  serviceText2: string;
  /** Для разметки schema.org. */
  serviceType: string;
  features_ld: string[];
};

const fi: EarthworksCopy = {
  metaTitle: 'Maansiirto ja kippiautot: kuormat, tunnit ja laskut',
  metaDescription:
    'Kippiautojen työmaasovellus: kuormat punnituksineen, siirtoasiakirjat, tunnit (viimeinen purku + 30 min), työnjohtajan hyväksyntä ja laskut asiakkaalle.',
  eyebrow: 'Maansiirto ja kippiautot',
  title: 'Työmaan kuormat, tunnit ja laskut yhdessä paikassa',
  lede:
    'Kuski merkitsee puhelimella saapumisen, kuormat ja punnitukset. Työnjohtaja hyväksyy päivän linkistä. Lasku lähtee asiakkaalle yrityksesi nimissä – napista, viikoittain tai joka toinen viikko.',
  ctaApply: 'Hae mukaan',
  ctaSignIn: 'Kirjaudu',
  dayTitle: 'Näin päivä kulkee',
  day: [
    { title: 'Aamulla työmaalle', text: 'Kuski painaa sovelluksessa ”Saavuin kohteelle”. Aika ja paikka tallentuvat, auto ja perävaunu valitaan kerran päivälle.' },
    { title: 'Kuormat vaa’an kautta', text: 'Jokaisesta kuormasta materiaali, vastaanottopaikka, brutto, tara ja punnituslipun numero. Netto lasketaan itse, ylikuormasta tulee varoitus.' },
    { title: 'Illalla päivä kiinni', text: 'Päivä päättyy viimeiseen purkuun + 30 minuuttia, kuten kuskit itsekin kirjaavat. Varaaika on kohteen asetus.' },
    { title: 'Työnjohtaja hyväksyy', text: 'Työnjohtaja avaa linkin ilman tunnuksia, näkee päivät, kuormat ja tunnit ja hyväksyy. Hinnat eivät näy hänelle. Tarvittaessa kuljetusliike hyväksyy itse.' },
    { title: 'Lasku asiakkaalle', text: 'Hyväksytyt päivät laskutetaan kerran: PDF-lasku viitenumerolla ja ALV:llä lähtee asiakkaan sähköpostiin yrityksesi nimissä.' },
  ],
  featuresTitle: 'Mitä saat',
  features: [
    { title: 'Kuormat ja punnitukset', text: 'Brutto, tara, netto ja punnituslippu jokaisesta kuormasta. Vaa’at ja vastaanottopaikat valitaan listasta, uuden paikan voi lisätä työmaalta. Kuski voi myös kuvata punnituslipun, ja tiedot luetaan lomakkeelle.' },
    { title: 'Siirtoasiakirja', text: 'Jätelain 121 §:n mukainen siirtoasiakirja syntyy kuormasta silloin, kun sitä tarvitaan: rakennusjäte ja pilaantunut maa-aines (PIMA), jonka merkitset kohteelle. Pilaantumattomasta maa-aineksesta tulee kuormatosite – siirtoasiakirjaa ei tarvita.' },
    { title: 'Tunnit ilman lappuja', text: 'Saapuminen aamulla, viimeinen purku + 30 min illalla. Ei käsin kirjattuja tuntilappuja eikä jälkikäteen arvailua.' },
    { title: 'Akselimassat ja ylikuorma', text: 'Auto, perävaunu ja yhdistelmän suurin sallittu massa maittain (Suomi 76 t, Ruotsi, Norja, Tanska, Viro, Saksa…). Ylikuormasta varoitus jo vaa’alla.' },
    { title: 'Laskutus omissa nimissä', text: 'Laskut yrityksesi Y-tunnuksella, tilinumerolla ja omalla numerosarjalla. Tuntityö, kuormalta tai tonnilta. Lähtee napista, viikoittain tai joka toinen viikko.' },
    { title: 'Sovellus kuskin kielellä', text: 'Kuljettajan sovellus kymmenellä kielellä, myös viroksi, venäjäksi ja puolaksi. Toimii ilman verkkoa ja lähettää merkinnät, kun yhteys palaa.' },
  ],
  priceTitle: 'Hinta',
  priceText: 'Ensimmäinen auto maksutta, jokainen seuraava 14,90 € (alv 0 %) kuukaudessa – vain niistä autoista, jotka ajoivat kuussa. Omista asiakkaista ja työmaista ei prosenttia. Ensimmäinen kuukausi ilmaiseksi.',
  faqTitle: 'Kysyttyä',
  faq: [
    { q: 'Tarvitseeko työnjohtaja tunnukset?', a: 'Ei. Työnjohtaja saa kohteen linkin, näkee siitä päivät, kuormat ja tunnit ja hyväksyy päivän nimellään. Hintoja hän ei näe.' },
    { q: 'Miten tunnit lasketaan?', a: 'Päivä alkaa, kun kuski merkitsee saapumisen työmaalle, ja päättyy viimeiseen purkuun + varaaikaan (oletus 30 min). Jos kuski lopettaa päivän myöhemmin, lasketaan lopetus.' },
    { q: 'Kenen nimissä lasku lähtee?', a: 'Kuljetusliikkeen: Y-tunnus, tilinumero, laskunumero ja viitenumero ovat yrityksesi. RAHTIS laatii laskun hyväksytyistä päivistä ja lähettää sen asiakkaalle PDF:nä.' },
    { q: 'Saako siirtoasiakirjan?', a: 'Kyllä, kun sitä tarvitaan. Rakennusjätteestä ja pilaantuneesta maa-aineksesta (PIMA-merkintä kohteella) saa jätelain mukaisen siirtoasiakirjan jätekoodeineen, ja kuormat merkitään siirtoasiakirjarekisteriin ilmoitettaviksi. Pilaantumaton maa-aines ei tarvitse siirtoasiakirjaa – kuormasta tulee kuormatosite.' },
    { q: 'Toimiiko sovellus kuopassa ilman verkkoa?', a: 'Toimii. Merkinnät tallentuvat puhelimeen ja lähtevät, kun yhteys palaa. Aika on painalluksen hetki, ei lähetyksen.' },
    { q: 'Mitä se maksaa?', a: 'Ensimmäinen auto on maksuton. Jokaisesta seuraavasta 14,90 € (alv 0 %) kuukaudessa, vain ajaneista autoista. 100 autosta alkaen hinta tarjouksen mukaan. Vuoden etukäteen maksaen −10 %. Ensimmäinen kuukausi on ilmainen.' },
  ],
  finalTitle: 'Kokeile omalla työmaalla',
  finalText: 'Lisää kohde, kutsu kuski ja lähetä työnjohtajalle linkki. Ensimmäinen kuukausi on ilmainen.',
  teaserEyebrow: 'Uutta: maansiirto',
  teaserTitle: 'Kippiautot työmaalla: kuormat, tunnit ja laskut',
  teaserText: 'Kuormat punnituksineen, siirtoasiakirjat, tunnit viimeiseen purkuun + 30 min ja työnjohtajan hyväksyntä linkistä. Lasku asiakkaalle yrityksesi nimissä.',
  teaserCta: 'Lue lisää',
  footerLink: 'Maansiirto ja kippiautot',
  serviceTitle: 'Maansiirto ja kippiautot',
  serviceText: 'Kippiauto ajaa työmaalla koko päivän: kuski kirjaa saapumisen ja jokaisen kuorman punnituksineen ja purkupaikkoineen. Tunnit lasketaan viimeiseen purkuun + 30 minuuttia.',
  serviceText2: 'Työnjohtaja hyväksyy päivän linkistä ilman tunnuksia, ja lasku lähtee asiakkaalle kuljetusliikkeen omissa nimissä.',
  serviceType: 'Maansiirtokuljetusten työmaasovellus',
  features_ld: [
    'Kuormat ja punnitukset (brutto, tara, netto, punnituslippu)',
    'Jätelain mukainen siirtoasiakirja rakennusjätteelle ja pilaantuneelle maa-ainekselle (PIMA)',
    'Punnituslipun luku valokuvasta',
    'Tunnit: saapuminen – viimeinen purku + 30 min',
    'Työnjohtajan hyväksyntä linkistä',
    'Laskut asiakkaalle kuljetusliikkeen nimissä',
    'Akselimassat ja ylikuormavaroitus maittain',
  ],
};

const en: EarthworksCopy = {
  metaTitle: 'Earthworks and dump trucks: loads, hours, invoices',
  metaDescription:
    'Worksite app for dump trucks: weighed loads, Finnish waste transfer documents, hours (last unload + 30 min), foreman approval and invoices to your customer.',
  eyebrow: 'Earthworks and dump trucks',
  title: 'Worksite loads, hours and invoices in one place',
  lede:
    'Drivers log arrival, loads and weighings on their phone. The foreman approves the day from a link. The invoice goes to your customer in your company’s name – at the press of a button, weekly or every other week.',
  ctaApply: 'Join RAHTIS',
  ctaSignIn: 'Sign in',
  dayTitle: 'How a day works',
  day: [
    { title: 'Morning: on site', text: 'The driver taps “Arrived on site”. Time and place are saved, and the truck and trailer are chosen once for the day.' },
    { title: 'Loads over the weighbridge', text: 'For each load: material, receiving site, gross, tare and the weigh ticket number. Net is calculated for you, and you get an overload warning.' },
    { title: 'Evening: day closed', text: 'The day ends at the last unload + 30 minutes, the way drivers log it anyway. The buffer is a site setting.' },
    { title: 'Foreman approves', text: 'The foreman opens a link with no login, sees the days, loads and hours, and approves. Prices are not shown. If needed, your company approves the day itself.' },
    { title: 'Invoice to the customer', text: 'Approved days are invoiced once: a PDF invoice with reference number and VAT goes to the customer’s email in your company’s name.' },
  ],
  featuresTitle: 'What you get',
  features: [
    { title: 'Loads and weighings', text: 'Gross, tare, net and weigh ticket for every load. Weighbridges and receiving sites come from a list, and a driver can add a new one from the site. The driver can also photograph the weigh ticket, and the values are read into the form.' },
    { title: 'Finnish waste transfer document', text: 'For sites in Finland, the transfer document (siirtoasiakirja) required by the Finnish Waste Act (section 121) is made from the load when it is needed: construction waste and contaminated soil (PIMA), which you mark on the site. Clean soil gets a load record instead – no transfer document needed.' },
    { title: 'Hours without paper', text: 'Arrival in the morning, last unload + 30 min in the evening. No handwritten timesheets and no guessing afterwards.' },
    { title: 'Axle weights and overload', text: 'Truck, trailer and the maximum combination weight by country (Finland 76 t, Sweden, Norway, Denmark, Estonia, Germany…). Overload warning right at the weighbridge.' },
    { title: 'Invoicing in your own name', text: 'Invoices with your business ID, bank account and your own number series. By the hour, per load or per tonne. Sent at a button press, weekly or every other week.' },
    { title: 'App in the driver’s language', text: 'The driver app works in ten languages, including Estonian, Russian and Polish. It works offline and sends entries when the connection is back.' },
  ],
  priceTitle: 'Price',
  priceText: 'First truck free, each further truck €14.90 (excl. VAT) a month – only for trucks that drove that month. No percentage on your own customers and worksites. First month free.',
  faqTitle: 'FAQ',
  faq: [
    { q: 'Does the foreman need a login?', a: 'No. The foreman gets the site link, sees the days, loads and hours there and approves the day with their name. Prices are not shown.' },
    { q: 'How are hours counted?', a: 'The day starts when the driver marks arrival on site and ends at the last unload + buffer (30 min by default). If the driver ends the day later, the later time counts.' },
    { q: 'Whose name is on the invoice?', a: 'The carrier’s: business ID, bank account, invoice number and reference are your company’s. RAHTIS builds the invoice from approved days and emails it to the customer as a PDF.' },
    { q: 'Do I get a waste transfer document?', a: 'Yes, for sites in Finland, when one is needed: construction waste and contaminated soil (marked as PIMA on the site) get a siirtoasiakirja under the Finnish Waste Act, with waste codes, and are flagged for reporting to the transfer document register. Clean soil needs no transfer document – the load gets a load record instead. For sites outside Finland, national requirements and state e-systems are being added country by country — not available yet.' },
    { q: 'Does the app work in a pit with no signal?', a: 'Yes. Entries are saved on the phone and sent when the connection returns. The time is when the driver tapped, not when it was sent.' },
    { q: 'What does it cost?', a: 'One truck is free. Each further truck costs €14.90 (excl. VAT) a month, only if it drove that month. From 100 trucks the price is on request. 10 % off when you pay a year in advance. The first month is free.' },
  ],
  finalTitle: 'Try it on your own worksite',
  finalText: 'Add a site, invite a driver and send the foreman the link. The first month is free.',
  teaserEyebrow: 'New: earthworks',
  teaserTitle: 'Dump trucks on site: loads, hours and invoices',
  teaserText: 'Weighed loads, Finnish waste transfer documents, hours to the last unload + 30 min and foreman approval by link. Invoice to the customer in your company’s name.',
  teaserCta: 'Read more',
  footerLink: 'Earthworks and dump trucks',
  serviceTitle: 'Earthworks and dump trucks',
  serviceText: 'A dump truck works a full day on site: the driver logs arrival and every load with its weighing and unloading site. Hours run to the last unload + 30 minutes.',
  serviceText2: 'The foreman approves the day from a link without logging in, and the invoice goes to the customer in the carrier\'s own name.',
  serviceType: 'Worksite app for earthworks haulage',
  features_ld: [
    'Loads and weighings (gross, tare, net, weigh ticket)',
    'Finnish waste transfer document (siirtoasiakirja) for sites in Finland: construction waste and contaminated soil (PIMA)',
    'Weigh ticket read from a photo',
    'Hours: arrival to last unload + 30 min',
    'Foreman approval by link',
    'Invoices to the customer in the carrier’s name',
    'Axle weights and overload warning by country',
  ],
};

const sv: EarthworksCopy = {
  metaTitle: 'Masstransport och tippbilar: lass, timmar, fakturor',
  metaDescription:
    'Arbetsplatsapp för tippbilar: vägda lass, finska transportdokument för avfall, timmar (sista tömning + 30 min), arbetsledarens godkännande och fakturor.',
  eyebrow: 'Masstransporter och tippbilar',
  title: 'Arbetsplatsens lass, timmar och fakturor på ett ställe',
  lede:
    'Föraren registrerar ankomst, lass och vägningar i mobilen. Arbetsledaren godkänner dagen via en länk. Fakturan går till kunden i ditt företags namn – med en knapptryckning, varje vecka eller varannan vecka.',
  ctaApply: 'Ansök nu',
  ctaSignIn: 'Logga in',
  dayTitle: 'Så går en dag',
  day: [
    { title: 'På morgonen till arbetsplatsen', text: 'Föraren trycker ”Jag är på plats” i appen. Tid och plats sparas, och bil och släp väljs en gång per dag.' },
    { title: 'Lassen över vågen', text: 'För varje lass: material, mottagningsplats, brutto, tara och vägsedelns nummer. Netto räknas ut automatiskt, och vid överlast kommer en varning.' },
    { title: 'På kvällen stängs dagen', text: 'Dagen slutar vid sista tömningen + 30 minuter, precis som förarna själva skriver upp den. Marginalen ställs in per arbetsplats.' },
    { title: 'Arbetsledaren godkänner', text: 'Arbetsledaren öppnar länken utan inloggning, ser dagar, lass och timmar och godkänner. Priserna visas inte. Vid behov godkänner åkeriet själv.' },
    { title: 'Faktura till kunden', text: 'Godkända dagar faktureras en gång: en PDF-faktura med referensnummer och moms går till kundens e-post i ditt företags namn.' },
  ],
  featuresTitle: 'Det här får du',
  features: [
    { title: 'Lass och vägningar', text: 'Brutto, tara, netto och vägsedel för varje lass. Vågar och mottagningsplatser väljs ur en lista, och en ny plats kan läggas till direkt från arbetsplatsen. Föraren kan också fotografera vägsedeln, så läses värdena in i formuläret.' },
    { title: 'Finskt transportdokument för avfall', text: 'För arbetsplatser i Finland skapas transportdokumentet (siirtoasiakirja) enligt 121 § i finska avfallslagen från lasset när det behövs: byggavfall och förorenad jord (PIMA), som du markerar på arbetsplatsen. För ren jord blir det ett lasskvitto – inget transportdokument behövs.' },
    { title: 'Timmar utan lappar', text: 'Ankomst på morgonen, sista tömning + 30 min på kvällen. Inga handskrivna tidlappar och ingen gissning i efterhand.' },
    { title: 'Axeltryck och överlast', text: 'Bil, släp och ekipagets högsta tillåtna bruttovikt per land (Finland 76 t, Sverige, Norge, Danmark, Estland, Tyskland…). Varning för överlast redan vid vågen.' },
    { title: 'Fakturering i eget namn', text: 'Fakturor med ditt företags FO-nummer (Y-tunnus), kontonummer och egen nummerserie. Per timme, per lass eller per ton. Skickas med en knapptryckning, varje vecka eller varannan vecka.' },
    { title: 'Appen på förarens språk', text: 'Förarappen finns på tio språk, även estniska, ryska och polska. Den fungerar utan nät och skickar uppgifterna när anslutningen är tillbaka.' },
  ],
  priceTitle: 'Pris',
  priceText: 'Första bilen gratis, varje ytterligare bil 14,90 € (exkl. moms) i månaden – bara för bilar som har kört under månaden. Ingen procent på dina egna kunder och arbetsplatser. Första månaden gratis.',
  faqTitle: 'Vanliga frågor',
  faq: [
    { q: 'Behöver arbetsledaren ett konto?', a: 'Nej. Arbetsledaren får arbetsplatsens länk, ser dagar, lass och timmar där och godkänner dagen med sitt namn. Priserna ser arbetsledaren inte.' },
    { q: 'Hur räknas timmarna?', a: 'Dagen börjar när föraren registrerar ankomst till arbetsplatsen och slutar vid sista tömningen + marginal (30 min som standard). Om föraren avslutar dagen senare räknas avslutet.' },
    { q: 'I vems namn går fakturan?', a: 'Åkeriets: FO-nummer (Y-tunnus), kontonummer, fakturanummer och referensnummer är ditt företags. RAHTIS gör fakturan av godkända dagar och skickar den till kunden som PDF.' },
    { q: 'Får jag transportdokument för avfall?', a: 'Ja, på arbetsplatser i Finland, när det behövs: för byggavfall och förorenad jord (markerad som PIMA på arbetsplatsen) får du ett siirtoasiakirja enligt finska avfallslagen, med avfallskoder, och lassen markeras för anmälan till registret över transportdokument. Ren jord kräver inget transportdokument – lasset får ett lasskvitto i stället. Utanför Finland gäller nationella krav, i Sverige till exempel Naturvårdsverkets avfallsregister – det stöds inte ännu, vi lägger till land för land.' },
    { q: 'Fungerar appen i en grop utan täckning?', a: 'Ja. Uppgifterna sparas i mobilen och skickas när anslutningen är tillbaka. Tiden är när föraren tryckte, inte när det skickades.' },
    { q: 'Vad kostar det?', a: 'Första bilen är gratis. Varje ytterligare bil kostar 14,90 € (exkl. moms) i månaden, bara om den har kört. Från 100 bilar pris på begäran. Betala ett år i förväg: −10 %. Första månaden är gratis.' },
  ],
  finalTitle: 'Prova på din egen arbetsplats',
  finalText: 'Lägg till en arbetsplats, bjud in en förare och skicka länken till arbetsledaren. Första månaden är gratis.',
  teaserEyebrow: 'Nytt: masstransporter',
  teaserTitle: 'Tippbilar på arbetsplatsen: lass, timmar och fakturor',
  teaserText: 'Vägda lass, finska transportdokument för avfall, timmar till sista tömningen + 30 min och arbetsledarens godkännande via länk. Faktura till kunden i ditt företags namn.',
  teaserCta: 'Läs mer',
  footerLink: 'Masstransporter och tippbilar',
  serviceTitle: 'Markarbeten och tippbilar',
  serviceText: 'Tippbilen kör en hel dag på arbetsplatsen: föraren registrerar ankomst och varje lass med vägning och tippställe. Timmarna räknas till sista tömningen + 30 minuter.',
  serviceText2: 'Arbetsledaren godkänner dagen via en länk utan inloggning, och fakturan går till kunden i åkeriets eget namn.',
  serviceType: 'Arbetsplatsapp för masstransporter',
  features_ld: [
    'Lass och vägningar (brutto, tara, netto, vägsedel)',
    'Finskt transportdokument för avfall (siirtoasiakirja) för arbetsplatser i Finland: byggavfall och förorenad jord (PIMA)',
    'Vägsedel läses från ett foto',
    'Timmar: ankomst – sista tömning + 30 min',
    'Arbetsledarens godkännande via länk',
    'Fakturor till kunden i åkeriets namn',
    'Axeltryck och överlastvarning per land',
  ],
};

const et: EarthworksCopy = {
  metaTitle: 'Pinnasetööd ja kallurid: koormad, tunnid ja arved',
  metaDescription:
    'Kallurite objektirakendus: kaalutud koormad, Soome jäätmeveo saatelehed, tunnid (viimane mahalaadimine + 30 min), töödejuhataja kinnitus ja arved kliendile.',
  eyebrow: 'Pinnasetööd ja kallurid',
  title: 'Objekti koormad, tunnid ja arved ühes kohas',
  lede:
    'Juht märgib telefonis saabumise, koormad ja kaalumised. Töödejuhataja kinnitab päeva lingi kaudu. Arve läheb kliendile sinu firma nimel – nupuvajutusega, iga nädal või üle nädala.',
  ctaApply: 'Liitu',
  ctaSignIn: 'Logi sisse',
  dayTitle: 'Nii kulgeb päev',
  day: [
    { title: 'Hommikul objektile', text: 'Juht vajutab rakenduses „Jõudsin objektile“. Aeg ja koht salvestuvad, auto ja haagis valitakse päevaks üks kord.' },
    { title: 'Koormad läbi kaalu', text: 'Iga koorma kohta materjal, vastuvõtukoht, bruto, taara ja kaalutõendi number. Neto arvutatakse ise, ülekoormuse korral tuleb hoiatus.' },
    { title: 'Õhtul päev kinni', text: 'Päev lõpeb viimase mahalaadimisega + 30 minutit, nii nagu juhid ka ise kirja panevad. Varuaeg on objekti seade.' },
    { title: 'Töödejuhataja kinnitab', text: 'Töödejuhataja avab lingi ilma kasutajakontota, näeb päevi, koormaid ja tunde ning kinnitab. Hindu ta ei näe. Vajaduse korral kinnitab vedaja ise.' },
    { title: 'Arve kliendile', text: 'Kinnitatud päevad arveldatakse üks kord: PDF-arve viitenumbri ja käibemaksuga läheb kliendi e-postile sinu firma nimel.' },
  ],
  featuresTitle: 'Mida sa saad',
  features: [
    { title: 'Koormad ja kaalumised', text: 'Bruto, taara, neto ja kaalutõend igast koormast. Kaalud ja vastuvõtukohad valitakse nimekirjast, uue koha saab lisada otse objektilt. Juht võib kaalutõendi ka pildistada – andmed loetakse vormi.' },
    { title: 'Soome jäätmeveo saateleht', text: 'Soomes asuvatel objektidel tekib Soome jäätmeseaduse § 121 kohane saateleht (siirtoasiakirja) koormast siis, kui seda on vaja: ehitusjäätmed ja saastunud pinnas (PIMA), mille märgite objektile. Puhta pinnase kohta tekib koormatõend – saatelehte pole vaja.' },
    { title: 'Tunnid ilma paberita', text: 'Saabumine hommikul, viimane mahalaadimine + 30 min õhtul. Ei mingeid käsitsi täidetud tunnilehti ega tagantjärele oletamist.' },
    { title: 'Teljekoormused ja ülekoormus', text: 'Auto, haagis ja autorongi suurim lubatud täismass riigiti (Soome 76 t, Rootsi, Norra, Taani, Eesti, Saksamaa…). Ülekoormuse hoiatus juba kaalul.' },
    { title: 'Arved oma nimel', text: 'Arved sinu firma registrikoodi (Y-tunnus), arvelduskonto ja oma numbriseeriaga. Tunnitöö, koorma või tonni järgi. Lähevad teele nupuvajutusega, iga nädal või üle nädala.' },
    { title: 'Rakendus juhi keeles', text: 'Juhi rakendus töötab kümnes keeles, sh eesti, vene ja poola keeles. See töötab ka ilma võrguta ja saadab kanded, kui ühendus taastub.' },
  ],
  priceTitle: 'Hind',
  priceText: 'Esimene auto tasuta, iga järgmine 14,90 € (km-ta) kuus – ainult nende autode eest, mis kuu jooksul sõitsid. Oma klientidelt ja objektidelt protsenti ei võeta. Esimene kuu tasuta.',
  faqTitle: 'Korduma kippuvad küsimused',
  faq: [
    { q: 'Kas töödejuhataja vajab kasutajakontot?', a: 'Ei. Töödejuhataja saab objekti lingi, näeb sealt päevi, koormaid ja tunde ning kinnitab päeva oma nimega. Hindu ta ei näe.' },
    { q: 'Kuidas tunde arvestatakse?', a: 'Päev algab, kui juht märgib saabumise objektile, ja lõpeb viimase mahalaadimise + varuajaga (vaikimisi 30 min). Kui juht lõpetab päeva hiljem, arvestatakse lõpetamise aega.' },
    { q: 'Kelle nimel arve läheb?', a: 'Vedaja nimel: Y-tunnus, arvelduskonto, arve number ja viitenumber on sinu firma omad. RAHTIS koostab arve kinnitatud päevadest ja saadab selle kliendile PDF-ina.' },
    { q: 'Kas jäätmeveo saatelehe saab?', a: 'Jah, Soomes asuvatel objektidel, kui seda on vaja: ehitusjäätmete ja saastunud pinnase (objektil märgitud kui PIMA) kohta saab Soome jäätmeseaduse kohase saatelehe (siirtoasiakirja) koos jäätmekoodidega ning koormad märgitakse saatelehtede registrisse teatamiseks. Puhas pinnas saatelehte ei vaja – koorma kohta tekib koormatõend. Eestis kehtib JVIS-i elektrooniline saateleht – seda me veel ei toeta, teiste riikide nõudeid lisame järk-järgult.' },
    { q: 'Kas rakendus töötab kaevikus ilma levita?', a: 'Töötab. Kanded salvestuvad telefoni ja lähevad teele, kui ühendus taastub. Arvesse läheb vajutamise, mitte saatmise hetk.' },
    { q: 'Mis see maksab?', a: 'Esimene auto on tasuta. Iga järgmine auto maksab 14,90 € (km-ta) kuus, ainult siis, kui see kuu jooksul sõitis. Alates 100 autost hind päringu alusel. Aasta ette makstes −10 %. Esimene kuu on tasuta.' },
  ],
  finalTitle: 'Proovi oma objektil',
  finalText: 'Lisa objekt, kutsu juht ja saada töödejuhatajale link. Esimene kuu on tasuta.',
  teaserEyebrow: 'Uus: pinnasetööd',
  teaserTitle: 'Kallurid objektil: koormad, tunnid ja arved',
  teaserText: 'Kaalutud koormad, Soome jäätmeveo saatelehed, tunnid viimase mahalaadimiseni + 30 min ja töödejuhataja kinnitus lingi kaudu. Arve kliendile sinu firma nimel.',
  teaserCta: 'Loe edasi',
  footerLink: 'Pinnasetööd ja kallurid',
  serviceTitle: 'Pinnasetööd ja kallurid',
  serviceText: 'Kallur töötab objektil terve päeva: juht märgib saabumise ning iga koorma koos kaalumise ja mahalaadimiskohaga. Tunnid arvestatakse viimase mahalaadimiseni + 30 minutit.',
  serviceText2: 'Töödejuhataja kinnitab päeva lingi kaudu ilma sisse logimata ja arve läheb kliendile veofirma enda nimel.',
  serviceType: 'Pinnaseveo objektirakendus',
  features_ld: [
    'Koormad ja kaalumised (bruto, taara, neto, kaalutõend)',
    'Soome jäätmeveo saateleht (siirtoasiakirja) Soome objektidele: ehitusjäätmed ja saastunud pinnas (PIMA)',
    'Kaalutõendi lugemine fotolt',
    'Tunnid: saabumine – viimane mahalaadimine + 30 min',
    'Töödejuhataja kinnitus lingi kaudu',
    'Arved kliendile vedaja nimel',
    'Teljekoormused ja ülekoormuse hoiatus riigiti',
  ],
};

const lv: EarthworksCopy = {
  metaTitle: 'Zemes darbi un pašizgāzēji: kravas, stundas, rēķini',
  metaDescription:
    'Lietotne pašizgāzējiem objektā: svērtas kravas, Somijas atkritumu pavadzīmes, stundas (pēdējā izkraušana + 30 min), darbu vadītāja apstiprinājums un rēķini.',
  eyebrow: 'Zemes darbi un pašizgāzēji',
  title: 'Objekta kravas, stundas un rēķini vienuviet',
  lede:
    'Vadītājs telefonā atzīmē ierašanos, kravas un svēršanas. Darbu vadītājs apstiprina dienu caur saiti. Rēķins klientam aiziet jūsu uzņēmuma vārdā – ar vienu pogu, katru nedēļu vai reizi divās nedēļās.',
  ctaApply: 'Pieteikties',
  ctaSignIn: 'Pieslēgties',
  dayTitle: 'Kā paiet diena',
  day: [
    { title: 'No rīta uz objektu', text: 'Vadītājs lietotnē nospiež „Esmu objektā“. Laiks un vieta saglabājas, auto un piekabi izvēlas vienreiz dienā.' },
    { title: 'Kravas caur svariem', text: 'Par katru kravu: materiāls, pieņemšanas vieta, bruto, tara un svēršanas kvīts numurs. Neto aprēķina automātiski, pārslodzes gadījumā parādās brīdinājums.' },
    { title: 'Vakarā diena slēgta', text: 'Diena beidzas ar pēdējo izkraušanu + 30 minūtes, tāpat kā vadītāji paši to pieraksta. Rezerves laiks ir objekta iestatījums.' },
    { title: 'Darbu vadītājs apstiprina', text: 'Darbu vadītājs atver saiti bez pieteikšanās, redz dienas, kravas un stundas un apstiprina. Cenas viņam nav redzamas. Ja vajag, pārvadātājs apstiprina pats.' },
    { title: 'Rēķins klientam', text: 'Apstiprinātās dienas rēķinā iekļauj vienreiz: PDF rēķins ar atsauces numuru un PVN aiziet uz klienta e-pastu jūsu uzņēmuma vārdā.' },
  ],
  featuresTitle: 'Ko jūs iegūstat',
  features: [
    { title: 'Kravas un svēršanas', text: 'Bruto, tara, neto un svēršanas kvīts par katru kravu. Svarus un pieņemšanas vietas izvēlas no saraksta, jaunu vietu var pievienot tieši no objekta. Vadītājs var arī nofotografēt svēršanas kvīti, un dati tiek nolasīti veidlapā.' },
    { title: 'Somijas atkritumu pārvadājuma pavadzīme', text: 'Objektiem Somijā Somijas Atkritumu likuma 121. pantam atbilstoša pavadzīme (siirtoasiakirja) veidojas no kravas, kad tā ir vajadzīga: būvniecības atkritumi un piesārņota grunts (PIMA), ko atzīmējat objektā. Tīrai gruntij veidojas kravas apliecinājums – pavadzīme nav vajadzīga.' },
    { title: 'Stundas bez papīriem', text: 'Ierašanās no rīta, pēdējā izkraušana + 30 min vakarā. Nekādu ar roku rakstītu stundu lapu un minēšanas pēc tam.' },
    { title: 'Ass slodzes un pārslodze', text: 'Auto, piekabe un sastāva maksimālā pieļaujamā masa pa valstīm (Somija 76 t, Zviedrija, Norvēģija, Dānija, Igaunija, Vācija…). Brīdinājums par pārslodzi jau pie svariem.' },
    { title: 'Rēķini savā vārdā', text: 'Rēķini ar jūsu uzņēmuma reģistrācijas numuru (Y-tunnus), bankas kontu un savu numerāciju. Par stundām, par kravu vai par tonnu. Aiziet ar vienu pogu, katru nedēļu vai reizi divās nedēļās.' },
    { title: 'Lietotne vadītāja valodā', text: 'Vadītāja lietotne darbojas desmit valodās, arī igauņu, krievu un poļu valodā. Tā strādā bez interneta un nosūta ierakstus, kad savienojums atjaunojas.' },
  ],
  priceTitle: 'Cena',
  priceText: 'Pirmais auto bez maksas, katrs nākamais 14,90 € (bez PVN) mēnesī – tikai par tiem auto, kas mēneša laikā brauca. Nekādu procentu no jūsu pašu klientiem un objektiem. Pirmais mēnesis bez maksas.',
  faqTitle: 'Biežāk uzdotie jautājumi',
  faq: [
    { q: 'Vai darbu vadītājam vajag kontu?', a: 'Nē. Darbu vadītājs saņem objekta saiti, tur redz dienas, kravas un stundas un apstiprina dienu ar savu vārdu. Cenas viņš neredz.' },
    { q: 'Kā tiek skaitītas stundas?', a: 'Diena sākas, kad vadītājs atzīmē ierašanos objektā, un beidzas ar pēdējo izkraušanu + rezerves laiku (pēc noklusējuma 30 min). Ja vadītājs dienu noslēdz vēlāk, skaitās noslēgšanas laiks.' },
    { q: 'Kura vārdā aiziet rēķins?', a: 'Pārvadātāja: Y-tunnus, bankas konts, rēķina numurs un atsauces numurs ir jūsu uzņēmuma. RAHTIS sagatavo rēķinu no apstiprinātajām dienām un nosūta to klientam PDF formātā.' },
    { q: 'Vai var saņemt atkritumu pavadzīmi?', a: 'Jā, objektiem Somijā, kad tā ir vajadzīga: būvniecības atkritumiem un piesārņotai gruntij (objektā atzīmēta kā PIMA) var saņemt Somijas Atkritumu likumam atbilstošu pavadzīmi (siirtoasiakirja) ar atkritumu kodiem, un kravas tiek atzīmētas paziņošanai pavadzīmju reģistrā. Tīrai gruntij pavadzīme nav vajadzīga – kravai veidojas kravas apliecinājums. Latvijā pavadzīmes kārto valsts informācijas sistēmā „Atkritumi” – to vēl neatbalstām, citu valstu prasības pievienojam pakāpeniski.' },
    { q: 'Vai lietotne strādā būvbedrē bez pārklājuma?', a: 'Strādā. Ieraksti saglabājas telefonā un aiziet, kad savienojums atjaunojas. Laiks ir pogas nospiešanas brīdis, nevis nosūtīšanas.' },
    { q: 'Cik tas maksā?', a: 'Pirmais auto ir bez maksas. Katrs nākamais auto maksā 14,90 € (bez PVN) mēnesī, tikai ja tas mēneša laikā brauca. No 100 automašīnām – cena pēc pieprasījuma. Samaksājot gadu uz priekšu −10 %. Pirmais mēnesis ir bez maksas.' },
  ],
  finalTitle: 'Izmēģiniet savā objektā',
  finalText: 'Pievienojiet objektu, uzaiciniet vadītāju un nosūtiet darbu vadītājam saiti. Pirmais mēnesis ir bez maksas.',
  teaserEyebrow: 'Jaunums: zemes darbi',
  teaserTitle: 'Pašizgāzēji objektā: kravas, stundas un rēķini',
  teaserText: 'Svērtas kravas, Somijas atkritumu pavadzīmes, stundas līdz pēdējai izkraušanai + 30 min un darbu vadītāja apstiprinājums caur saiti. Rēķins klientam jūsu uzņēmuma vārdā.',
  teaserCta: 'Lasīt vairāk',
  footerLink: 'Zemes darbi un pašizgāzēji',
  serviceTitle: 'Zemes darbi un pašizgāzēji',
  serviceText: 'Pašizgāzējs visu dienu strādā objektā: vadītājs atzīmē ierašanos un katru kravu ar svēršanu un izkraušanas vietu. Stundas skaita līdz pēdējai izkraušanai + 30 minūtes.',
  serviceText2: 'Darbu vadītājs apstiprina dienu caur saiti bez pieteikšanās, un rēķins klientam aiziet pārvadātāja vārdā.',
  serviceType: 'Objekta lietotne zemes darbu pārvadājumiem',
  features_ld: [
    'Kravas un svēršanas (bruto, tara, neto, svēršanas kvīts)',
    'Somijas atkritumu pavadzīme (siirtoasiakirja) objektiem Somijā: būvniecības atkritumi un piesārņota grunts (PIMA)',
    'Svēršanas kvīts nolasīšana no fotoattēla',
    'Stundas: ierašanās – pēdējā izkraušana + 30 min',
    'Darbu vadītāja apstiprinājums caur saiti',
    'Rēķini klientam pārvadātāja vārdā',
    'Ass slodzes un pārslodzes brīdinājums pa valstīm',
  ],
};

const lt: EarthworksCopy = {
  metaTitle: 'Žemės darbai ir savivarčiai: kroviniai ir sąskaitos',
  metaDescription:
    'Programėlė savivarčiams: pasverti kroviniai, Suomijos atliekų lydraščiai, valandos (paskutinis iškrovimas + 30 min), darbų vadovo patvirtinimas ir sąskaitos.',
  eyebrow: 'Žemės darbai ir savivarčiai',
  title: 'Objekto kroviniai, valandos ir sąskaitos vienoje vietoje',
  lede:
    'Vairuotojas telefone pažymi atvykimą, krovinius ir svėrimus. Darbų vadovas patvirtina dieną per nuorodą. Sąskaita klientui išeina jūsų įmonės vardu – vienu mygtuku, kas savaitę arba kas dvi savaites.',
  ctaApply: 'Pateikti paraišką',
  ctaSignIn: 'Prisijungti',
  dayTitle: 'Kaip praeina diena',
  day: [
    { title: 'Ryte į objektą', text: 'Vairuotojas programėlėje paspaudžia „Atvykau į objektą“. Laikas ir vieta išsaugomi, sunkvežimis ir priekaba pasirenkami kartą per dieną.' },
    { title: 'Kroviniai per svarstykles', text: 'Kiekvienam kroviniui: medžiaga, priėmimo vieta, bruto, tara ir svėrimo kvito numeris. Neto apskaičiuojamas automatiškai, o perkrovus parodomas įspėjimas.' },
    { title: 'Vakare diena uždaryta', text: 'Diena baigiasi paskutiniu iškrovimu + 30 minučių – taip, kaip vairuotojai ir patys užsirašo. Atsargos laikas yra objekto nustatymas.' },
    { title: 'Darbų vadovas patvirtina', text: 'Darbų vadovas atidaro nuorodą be prisijungimo, mato dienas, krovinius ir valandas ir patvirtina. Kainų jis nemato. Jei reikia, vežėjas patvirtina pats.' },
    { title: 'Sąskaita klientui', text: 'Patvirtintos dienos į sąskaitą įtraukiamos vieną kartą: PDF sąskaita su įmokos kodu ir PVM išsiunčiama kliento el. paštu jūsų įmonės vardu.' },
  ],
  featuresTitle: 'Ką gaunate',
  features: [
    { title: 'Kroviniai ir svėrimai', text: 'Bruto, tara, neto ir svėrimo kvitas kiekvienam kroviniui. Svarstyklės ir priėmimo vietos pasirenkamos iš sąrašo, naują vietą galima pridėti tiesiai iš objekto. Vairuotojas taip pat gali nufotografuoti svėrimo kvitą – duomenys nuskaitomi į formą.' },
    { title: 'Suomijos atliekų vežimo lydraštis', text: 'Objektams Suomijoje Suomijos atliekų įstatymo 121 straipsnį atitinkantis lydraštis (siirtoasiakirja) sudaromas iš krovinio, kai jo reikia: statybinėms atliekoms ir užterštam gruntui (PIMA), kurį pažymite objekte. Švariam gruntui sudaroma krovinio pažyma – lydraščio nereikia.' },
    { title: 'Valandos be popierių', text: 'Atvykimas ryte, paskutinis iškrovimas + 30 min vakare. Jokių ranka pildomų darbo laiko lapų ir jokio spėliojimo vėliau.' },
    { title: 'Ašių apkrovos ir perkrova', text: 'Sunkvežimis, priekaba ir didžiausia leidžiama junginio masė pagal šalį (Suomija 76 t, Švedija, Norvegija, Danija, Estija, Vokietija…). Įspėjimas apie perkrovą jau prie svarstyklių.' },
    { title: 'Sąskaitos savo vardu', text: 'Sąskaitos su jūsų įmonės kodu (Y-tunnus), banko sąskaita ir savo numeracija. Už valandas, už krovinį ar už toną. Išsiunčiama vienu mygtuku, kas savaitę arba kas dvi savaites.' },
    { title: 'Programėlė vairuotojo kalba', text: 'Vairuotojo programėlė veikia dešimčia kalbų, taip pat estų, rusų ir lenkų. Ji veikia be interneto ir išsiunčia įrašus, kai ryšys grįžta.' },
  ],
  priceTitle: 'Kaina',
  priceText: 'Pirmas sunkvežimis nemokamai, už kiekvieną kitą – 14,90 € (be PVM) per mėnesį, tik jei jis tą mėnesį važiavo. Jokių procentų nuo jūsų pačių klientų ir objektų. Pirmas mėnuo nemokamai.',
  faqTitle: 'Dažni klausimai',
  faq: [
    { q: 'Ar darbų vadovui reikia paskyros?', a: 'Ne. Darbų vadovas gauna objekto nuorodą, mato joje dienas, krovinius ir valandas ir patvirtina dieną savo vardu. Kainų jis nemato.' },
    { q: 'Kaip skaičiuojamos valandos?', a: 'Diena prasideda, kai vairuotojas pažymi atvykimą į objektą, ir baigiasi paskutiniu iškrovimu + atsargos laiku (numatytasis 30 min). Jei vairuotojas dieną baigia vėliau, skaičiuojamas pabaigos laikas.' },
    { q: 'Kieno vardu siunčiama sąskaita?', a: 'Vežėjo: Y-tunnus, banko sąskaita, sąskaitos numeris ir įmokos kodas yra jūsų įmonės. RAHTIS parengia sąskaitą iš patvirtintų dienų ir išsiunčia ją klientui PDF formatu.' },
    { q: 'Ar galima gauti atliekų lydraštį?', a: 'Taip, objektams Suomijoje, kai jo reikia: statybinėms atliekoms ir užterštam gruntui (objekte pažymėtam kaip PIMA) galima gauti Suomijos atliekų įstatymą atitinkantį lydraštį (siirtoasiakirja) su atliekų kodais, o kroviniai pažymimi, kad apie juos būtų pranešta lydraščių registrui. Švariam gruntui lydraščio nereikia – kroviniui sudaroma krovinio pažyma. Lietuvoje lydraščiai pildomi GPAIS – to dar nepalaikome, kitų šalių reikalavimus pridedame palaipsniui.' },
    { q: 'Ar programėlė veikia duobėje be ryšio?', a: 'Veikia. Įrašai išsaugomi telefone ir išsiunčiami, kai ryšys grįžta. Laikas – tai paspaudimo, o ne išsiuntimo momentas.' },
    { q: 'Kiek tai kainuoja?', a: 'Pirmas sunkvežimis nemokamas. Kiekvienas kitas kainuoja 14,90 € (be PVM) per mėnesį, tik jei tą mėnesį važiavo. Nuo 100 sunkvežimių – kaina pagal užklausą. Sumokėjus metams iš anksto −10 %. Pirmas mėnuo nemokamas.' },
  ],
  finalTitle: 'Išbandykite savo objekte',
  finalText: 'Pridėkite objektą, pakvieskite vairuotoją ir nusiųskite darbų vadovui nuorodą. Pirmas mėnuo nemokamas.',
  teaserEyebrow: 'Nauja: žemės darbai',
  teaserTitle: 'Savivarčiai objekte: kroviniai, valandos ir sąskaitos',
  teaserText: 'Pasverti kroviniai, Suomijos atliekų lydraščiai, valandos iki paskutinio iškrovimo + 30 min ir darbų vadovo patvirtinimas per nuorodą. Sąskaita klientui jūsų įmonės vardu.',
  teaserCta: 'Skaityti daugiau',
  footerLink: 'Žemės darbai ir savivarčiai',
  serviceTitle: 'Žemės darbai ir savivarčiai',
  serviceText: 'Savivartis visą dieną dirba objekte: vairuotojas pažymi atvykimą ir kiekvieną krovinį su svėrimu bei iškrovimo vieta. Valandos skaičiuojamos iki paskutinio iškrovimo + 30 minučių.',
  serviceText2: 'Darbų vadovas patvirtina dieną per nuorodą be prisijungimo, o sąskaita klientui siunčiama vežėjo vardu.',
  serviceType: 'Objekto programėlė žemės darbų pervežimams',
  features_ld: [
    'Kroviniai ir svėrimai (bruto, tara, neto, svėrimo kvitas)',
    'Suomijos atliekų lydraštis (siirtoasiakirja) objektams Suomijoje: statybinės atliekos ir užterštas gruntas (PIMA)',
    'Svėrimo kvito nuskaitymas iš nuotraukos',
    'Valandos: atvykimas – paskutinis iškrovimas + 30 min',
    'Darbų vadovo patvirtinimas per nuorodą',
    'Sąskaitos klientui vežėjo vardu',
    'Ašių apkrovos ir perkrovos įspėjimas pagal šalį',
  ],
};

const pl: EarthworksCopy = {
  metaTitle: 'Roboty ziemne i wywrotki: kursy, godziny i faktury',
  metaDescription:
    'Aplikacja dla wywrotek na budowie: kursy z ważeniem, fińskie dokumenty przewozu odpadów, godziny (ostatni rozładunek + 30 min), akceptacja kierownika i faktury.',
  eyebrow: 'Roboty ziemne i wywrotki',
  title: 'Kursy, godziny i faktury z budowy w jednym miejscu',
  lede:
    'Kierowca zaznacza w telefonie przyjazd, kursy i ważenia. Kierownik robót zatwierdza dzień przez link. Faktura idzie do klienta w imieniu Twojej firmy – jednym przyciskiem, co tydzień albo co dwa tygodnie.',
  ctaApply: 'Dołącz',
  ctaSignIn: 'Zaloguj się',
  dayTitle: 'Tak wygląda dzień',
  day: [
    { title: 'Rano na budowę', text: 'Kierowca naciska w aplikacji „Jestem na budowie”. Czas i miejsce się zapisują, a auto i przyczepę wybiera się raz na cały dzień.' },
    { title: 'Kursy przez wagę', text: 'Przy każdym kursie: materiał, miejsce przyjęcia, brutto, tara i numer kwitu wagowego. Netto liczy się samo, a przy przeładowaniu pojawia się ostrzeżenie.' },
    { title: 'Wieczorem dzień zamknięty', text: 'Dzień kończy się ostatnim rozładunkiem + 30 minut, tak jak kierowcy sami to zapisują. Zapas czasu ustawia się osobno dla każdej budowy.' },
    { title: 'Kierownik robót zatwierdza', text: 'Kierownik robót otwiera link bez logowania, widzi dni, kursy i godziny i zatwierdza. Cen nie widzi. W razie potrzeby firma przewozowa zatwierdza dzień sama.' },
    { title: 'Faktura do klienta', text: 'Zatwierdzone dni fakturuje się raz: faktura PDF z numerem referencyjnym i VAT trafia na e-mail klienta w imieniu Twojej firmy.' },
  ],
  featuresTitle: 'Co dostajesz',
  features: [
    { title: 'Kursy i ważenia', text: 'Brutto, tara, netto i kwit wagowy z każdego kursu. Wagi i miejsca przyjęcia wybiera się z listy, a nowe miejsce można dodać prosto z budowy. Kierowca może też zrobić zdjęcie kwitu wagowego – dane trafią do formularza.' },
    { title: 'Fiński dokument przewozu odpadów', text: 'Dla budów w Finlandii dokument przewozu odpadów (siirtoasiakirja) zgodny z § 121 fińskiej ustawy o odpadach powstaje z kursu wtedy, gdy jest potrzebny: dla odpadów budowlanych i zanieczyszczonej ziemi (PIMA), którą oznaczasz na budowie. Dla czystej ziemi powstaje potwierdzenie przewozu – dokument przewozu odpadów nie jest potrzebny.' },
    { title: 'Godziny bez karteczek', text: 'Przyjazd rano, ostatni rozładunek + 30 min wieczorem. Żadnych ręcznie pisanych kart pracy ani zgadywania po fakcie.' },
    { title: 'Naciski osi i przeładowanie', text: 'Auto, przyczepa i dopuszczalna masa całkowita zestawu według kraju (Finlandia 76 t, Szwecja, Norwegia, Dania, Estonia, Niemcy…). Ostrzeżenie o przeładowaniu już na wadze.' },
    { title: 'Faktury we własnym imieniu', text: 'Faktury z numerem identyfikacyjnym Twojej firmy (Y-tunnus), numerem konta i własną numeracją. Za godziny, za kurs albo za tonę. Wysyłka jednym przyciskiem, co tydzień albo co dwa tygodnie.' },
    { title: 'Aplikacja w języku kierowcy', text: 'Aplikacja kierowcy działa w dziesięciu językach, także po estońsku, rosyjsku i polsku. Działa bez zasięgu i wysyła wpisy, gdy połączenie wróci.' },
  ],
  priceTitle: 'Cena',
  priceText: 'Pierwsze auto gratis, za każde kolejne 14,90 € netto (bez VAT) miesięcznie – tylko za auta, które w danym miesiącu jeździły. Zero procent od Twoich własnych klientów i budów. Pierwszy miesiąc za darmo.',
  faqTitle: 'Częste pytania',
  faq: [
    { q: 'Czy kierownik robót potrzebuje konta?', a: 'Nie. Kierownik robót dostaje link do budowy, widzi w nim dni, kursy i godziny i zatwierdza dzień swoim nazwiskiem. Cen nie widzi.' },
    { q: 'Jak liczone są godziny?', a: 'Dzień zaczyna się, gdy kierowca zaznaczy przyjazd na budowę, a kończy ostatnim rozładunkiem + zapasem (domyślnie 30 min). Jeśli kierowca zakończy dzień później, liczy się zakończenie.' },
    { q: 'W czyim imieniu idzie faktura?', a: 'Firmy przewozowej: Y-tunnus, numer konta, numer faktury i numer referencyjny należą do Twojej firmy. RAHTIS przygotowuje fakturę z zatwierdzonych dni i wysyła ją klientowi w PDF.' },
    { q: 'Czy dostanę dokument przewozu odpadów?', a: 'Tak, dla budów w Finlandii, gdy jest potrzebny: dla odpadów budowlanych i zanieczyszczonej ziemi (oznaczonej na budowie jako PIMA) można pobrać fiński dokument przewozu odpadów (siirtoasiakirja) z kodami odpadów, a kursy są oznaczane do zgłoszenia w fińskim rejestrze. Czysta ziemia nie wymaga dokumentu przewozu odpadów – do kursu powstaje potwierdzenie przewozu. W Polsce obowiązuje BDO i KPO – tego jeszcze nie obsługujemy, wymagania kolejnych krajów dodajemy stopniowo.' },
    { q: 'Czy aplikacja działa w wykopie bez zasięgu?', a: 'Tak. Wpisy zapisują się w telefonie i wysyłają, gdy połączenie wróci. Liczy się chwila naciśnięcia, a nie wysłania.' },
    { q: 'Ile to kosztuje?', a: 'Pierwsze auto jest bezpłatne. Każde kolejne kosztuje 14,90 € netto miesięcznie, tylko jeśli w danym miesiącu jeździło. Od 100 aut cena na zapytanie. Płacąc za rok z góry −10 %. Pierwszy miesiąc jest darmowy.' },
  ],
  finalTitle: 'Wypróbuj na własnej budowie',
  finalText: 'Dodaj budowę, zaproś kierowcę i wyślij kierownikowi robót link. Pierwszy miesiąc jest darmowy.',
  teaserEyebrow: 'Nowość: roboty ziemne',
  teaserTitle: 'Wywrotki na budowie: kursy, godziny i faktury',
  teaserText: 'Kursy z ważeniem, fińskie dokumenty przewozu odpadów, godziny do ostatniego rozładunku + 30 min i akceptacja kierownika robót przez link. Faktura do klienta w imieniu Twojej firmy.',
  teaserCta: 'Czytaj więcej',
  footerLink: 'Roboty ziemne i wywrotki',
  serviceTitle: 'Roboty ziemne i wywrotki',
  serviceText: 'Wywrotka pracuje na budowie cały dzień: kierowca zaznacza przyjazd i każdy kurs z ważeniem i miejscem wysypu. Godziny liczą się do ostatniego wysypu + 30 minut.',
  serviceText2: 'Kierownik robót zatwierdza dzień z linku bez logowania, a faktura idzie do klienta w imieniu przewoźnika.',
  serviceType: 'Aplikacja budowlana do przewozu ziemi',
  features_ld: [
    'Kursy i ważenia (brutto, tara, netto, kwit wagowy)',
    'Fiński dokument przewozu odpadów (siirtoasiakirja) dla budów w Finlandii: odpady budowlane i zanieczyszczona ziemia (PIMA)',
    'Odczyt kwitu wagowego ze zdjęcia',
    'Godziny: przyjazd – ostatni rozładunek + 30 min',
    'Akceptacja kierownika robót przez link',
    'Faktury do klienta w imieniu przewoźnika',
    'Naciski osi i ostrzeżenie o przeładowaniu według kraju',
  ],
};

const de: EarthworksCopy = {
  metaTitle: 'Erdbau und Kipper: Fuhren, Stunden und Rechnungen',
  metaDescription:
    'Baustellen-App für Kipper: gewogene Fuhren, finnische Abfall-Transportdokumente, Stunden (letzte Entladung + 30 Min.), Freigabe vom Bauleiter und Rechnungen.',
  eyebrow: 'Erdbau und Kipper',
  title: 'Fuhren, Stunden und Rechnungen der Baustelle an einem Ort',
  lede:
    'Der Fahrer erfasst Ankunft, Fuhren und Wiegungen auf dem Handy. Der Bauleiter gibt den Tag per Link frei. Die Rechnung geht im Namen Ihres Unternehmens an den Kunden – per Knopfdruck, wöchentlich oder alle zwei Wochen.',
  ctaApply: 'Jetzt mitmachen',
  ctaSignIn: 'Anmelden',
  dayTitle: 'So läuft ein Tag',
  day: [
    { title: 'Morgens auf die Baustelle', text: 'Der Fahrer tippt in der App auf „Auf der Baustelle angekommen“. Zeit und Ort werden gespeichert, Lkw und Anhänger wählt er einmal für den ganzen Tag.' },
    { title: 'Fuhren über die Waage', text: 'Zu jeder Fuhre: Material, Annahmestelle, Brutto, Tara und die Nummer des Wiegescheins. Netto wird automatisch berechnet, bei Überladung kommt eine Warnung.' },
    { title: 'Abends ist der Tag zu', text: 'Der Tag endet mit der letzten Entladung + 30 Minuten – so, wie die Fahrer es auch selbst aufschreiben. Der Puffer wird pro Baustelle eingestellt.' },
    { title: 'Der Bauleiter gibt frei', text: 'Der Bauleiter öffnet den Link ohne Zugangsdaten, sieht Tage, Fuhren und Stunden und gibt frei. Preise sieht er nicht. Bei Bedarf gibt das Fuhrunternehmen selbst frei.' },
    { title: 'Rechnung an den Kunden', text: 'Freigegebene Tage werden einmal abgerechnet: Eine PDF-Rechnung mit Referenznummer und MwSt. geht im Namen Ihres Unternehmens an die E-Mail-Adresse des Kunden.' },
  ],
  featuresTitle: 'Was Sie bekommen',
  features: [
    { title: 'Fuhren und Wiegungen', text: 'Brutto, Tara, Netto und Wiegeschein zu jeder Fuhre. Waagen und Annahmestellen werden aus einer Liste gewählt, eine neue Stelle lässt sich direkt auf der Baustelle anlegen. Der Fahrer kann den Wiegeschein auch fotografieren, die Werte werden ins Formular übernommen.' },
    { title: 'Finnisches Abfall-Transportdokument', text: 'Für Baustellen in Finnland entsteht das Transportdokument (siirtoasiakirja) nach § 121 des finnischen Abfallgesetzes aus der Fuhre, wenn es nötig ist: für Bauabfälle und belasteten Boden (PIMA), den Sie an der Baustelle markieren. Für unbelasteten Boden gibt es einen Fuhrennachweis – ohne Transportdokument.' },
    { title: 'Stunden ohne Zettel', text: 'Ankunft am Morgen, letzte Entladung + 30 Min. am Abend. Keine handgeschriebenen Stundenzettel und kein Raten im Nachhinein.' },
    { title: 'Achslasten und Überladung', text: 'Lkw, Anhänger und zulässiges Gesamtgewicht des Zuges je Land (Finnland 76 t, Schweden, Norwegen, Dänemark, Estland, Deutschland…). Warnung bei Überladung schon an der Waage.' },
    { title: 'Rechnungen im eigenen Namen', text: 'Rechnungen mit der Unternehmenskennung Ihrer Firma (Y-tunnus), Ihrer Bankverbindung und eigenem Nummernkreis. Nach Stunden, pro Fuhre oder pro Tonne. Versand per Knopfdruck, wöchentlich oder alle zwei Wochen.' },
    { title: 'App in der Sprache des Fahrers', text: 'Die Fahrer-App gibt es in zehn Sprachen, auch auf Estnisch, Russisch und Polnisch. Sie funktioniert ohne Netz und sendet die Einträge, sobald die Verbindung wieder da ist.' },
  ],
  priceTitle: 'Preis',
  priceText: 'Erster Lkw kostenlos, jeder weitere 14,90 € (zzgl. MwSt.) im Monat – nur für Lkw, die in dem Monat gefahren sind. Keine Prozente auf Ihre eigenen Kunden und Baustellen. Erster Monat kostenlos.',
  faqTitle: 'Häufige Fragen',
  faq: [
    { q: 'Braucht der Bauleiter Zugangsdaten?', a: 'Nein. Der Bauleiter bekommt den Link zur Baustelle, sieht dort Tage, Fuhren und Stunden und gibt den Tag mit seinem Namen frei. Preise sieht er nicht.' },
    { q: 'Wie werden die Stunden berechnet?', a: 'Der Tag beginnt, wenn der Fahrer die Ankunft auf der Baustelle meldet, und endet mit der letzten Entladung + Puffer (standardmäßig 30 Min.). Beendet der Fahrer den Tag später, zählt das spätere Ende.' },
    { q: 'In wessen Namen geht die Rechnung raus?', a: 'Im Namen des Fuhrunternehmens: Y-tunnus, Bankverbindung, Rechnungsnummer und Referenznummer gehören Ihrem Unternehmen. RAHTIS erstellt die Rechnung aus den freigegebenen Tagen und schickt sie dem Kunden als PDF.' },
    { q: 'Bekomme ich ein Abfall-Transportdokument?', a: 'Ja, für Baustellen in Finnland, wenn es nötig ist: Für Bauabfälle und belasteten Boden (an der Baustelle als PIMA markiert) gibt es ein Transportdokument (siirtoasiakirja) nach dem finnischen Abfallgesetz, mit Abfallschlüsseln, und die Fuhren werden für die Meldung an das finnische Register markiert. Unbelasteter Boden braucht kein Transportdokument – die Fuhre bekommt einen Fuhrennachweis. In Deutschland gelten eANV und der Lieferschein nach ErsatzbaustoffV – das unterstützen wir noch nicht, weitere Länder folgen nach und nach.' },
    { q: 'Funktioniert die App in der Grube ohne Netz?', a: 'Ja. Die Einträge werden auf dem Handy gespeichert und gesendet, sobald die Verbindung zurück ist. Es zählt der Moment des Tippens, nicht des Sendens.' },
    { q: 'Was kostet das?', a: 'Der erste Lkw ist kostenlos. Jeder weitere kostet 14,90 € (zzgl. MwSt.) im Monat, nur wenn er in dem Monat gefahren ist. Ab 100 Lkw Preis auf Anfrage. Ein Jahr im Voraus: −10 %. Der erste Monat ist kostenlos.' },
  ],
  finalTitle: 'Testen Sie es auf Ihrer eigenen Baustelle',
  finalText: 'Legen Sie eine Baustelle an, laden Sie einen Fahrer ein und schicken Sie dem Bauleiter den Link. Der erste Monat ist kostenlos.',
  teaserEyebrow: 'Neu: Erdbau',
  teaserTitle: 'Kipper auf der Baustelle: Fuhren, Stunden und Rechnungen',
  teaserText: 'Gewogene Fuhren, finnische Abfall-Transportdokumente, Stunden bis zur letzten Entladung + 30 Min. und Freigabe durch den Bauleiter per Link. Rechnung an den Kunden im Namen Ihres Unternehmens.',
  teaserCta: 'Mehr erfahren',
  footerLink: 'Erdbau und Kipper',
  serviceTitle: 'Erdbau und Kipper',
  serviceText: 'Der Kipper fährt den ganzen Tag auf der Baustelle: Der Fahrer erfasst die Ankunft und jede Ladung mit Wiegung und Abladestelle. Die Stunden laufen bis zur letzten Entladung + 30 Minuten.',
  serviceText2: 'Der Bauleiter bestätigt den Tag per Link ohne Anmeldung, und die Rechnung geht im eigenen Namen des Transportunternehmens an den Kunden.',
  serviceType: 'Baustellen-App für Erdbautransporte',
  features_ld: [
    'Fuhren und Wiegungen (Brutto, Tara, Netto, Wiegeschein)',
    'Finnisches Abfall-Transportdokument (siirtoasiakirja) für Baustellen in Finnland: Bauabfälle und belasteter Boden (PIMA)',
    'Wiegeschein per Foto auslesen',
    'Stunden: Ankunft bis letzte Entladung + 30 Min.',
    'Freigabe durch den Bauleiter per Link',
    'Rechnungen an den Kunden im Namen des Fuhrunternehmens',
    'Achslasten und Überladungswarnung je Land',
  ],
};

const ru: EarthworksCopy = {
  metaTitle: 'Земляные работы и самосвалы: рейсы, часы и счета',
  metaDescription:
    'Приложение для самосвалов: рейсы со взвешиванием, финские документы на перевозку отходов, часы (последняя выгрузка + 30 мин), подтверждение прораба и счета.',
  eyebrow: 'Земляные работы и самосвалы',
  title: 'Рейсы, часы и счета по объекту в одном месте',
  lede:
    'Водитель отмечает в телефоне прибытие, рейсы и взвешивания. Прораб подтверждает день по ссылке. Счёт уходит заказчику от имени вашей компании — одной кнопкой, раз в неделю или раз в две недели.',
  ctaApply: 'Подключиться',
  ctaSignIn: 'Войти',
  dayTitle: 'Как проходит день',
  day: [
    { title: 'Утром на объект', text: 'Водитель нажимает в приложении «Я на объекте». Время и место сохраняются, машина и прицеп выбираются один раз на весь день.' },
    { title: 'Рейсы через весы', text: 'По каждому рейсу: материал, место приёмки, брутто, тара и номер весового талона. Нетто считается само, при перегрузе появляется предупреждение.' },
    { title: 'Вечером день закрыт', text: 'День заканчивается последней выгрузкой + 30 минут — так, как водители и сами записывают. Запас времени задаётся в настройках объекта.' },
    { title: 'Прораб подтверждает', text: 'Прораб открывает ссылку без логина, видит дни, рейсы и часы и подтверждает. Цены ему не видны. При необходимости перевозчик подтверждает день сам.' },
    { title: 'Счёт заказчику', text: 'Подтверждённые дни попадают в счёт один раз: PDF-счёт со ссылочным номером (viitenumero) и НДС уходит на почту заказчика от имени вашей компании.' },
  ],
  featuresTitle: 'Что вы получаете',
  features: [
    { title: 'Рейсы и взвешивания', text: 'Брутто, тара, нетто и весовой талон по каждому рейсу. Весы и места приёмки выбираются из списка, новое место можно добавить прямо с объекта. Водитель может просто сфотографировать весовой талон — данные считаются в форму.' },
    { title: 'Финский документ на перевозку отходов', text: 'Для объектов в Финляндии сопроводительный документ (siirtoasiakirja) по § 121 финского Закона об отходах формируется из рейса, когда он нужен: строительные отходы и загрязнённый грунт (PIMA), который вы отмечаете на объекте. Для чистого грунта — запись о рейсе (kuormatosite), сопроводительный документ не нужен.' },
    { title: 'Часы без бумажек', text: 'Прибытие утром, последняя выгрузка + 30 мин вечером. Никаких рукописных табелей и догадок задним числом.' },
    { title: 'Осевые нагрузки и перегруз', text: 'Машина, прицеп и максимальная разрешённая масса автопоезда по странам (Финляндия 76 т, Швеция, Норвегия, Дания, Эстония, Германия…). Предупреждение о перегрузе уже на весах.' },
    { title: 'Счета от своего имени', text: 'Счета с Y-tunnus вашей компании, её банковским счётом и собственной нумерацией. Почасово, за рейс или за тонну. Отправка одной кнопкой, раз в неделю или раз в две недели.' },
    { title: 'Приложение на языке водителя', text: 'Приложение водителя работает на десяти языках, в том числе на эстонском, русском и польском. Оно работает без сети и отправляет записи, когда связь появится.' },
  ],
  priceTitle: 'Цена',
  priceText: 'Первая машина бесплатно, каждая следующая — 14,90 € (без НДС) в месяц, и только если она в этом месяце работала. Никаких процентов с ваших собственных заказчиков и объектов. Первый месяц бесплатно.',
  faqTitle: 'Вопросы и ответы',
  faq: [
    { q: 'Нужен ли прорабу логин?', a: 'Нет. Прораб получает ссылку на объект, видит там дни, рейсы и часы и подтверждает день своим именем. Цен он не видит.' },
    { q: 'Как считаются часы?', a: 'День начинается, когда водитель отмечает прибытие на объект, и заканчивается последней выгрузкой + запас (по умолчанию 30 мин). Если водитель закрывает день позже, считается время закрытия.' },
    { q: 'От чьего имени уходит счёт?', a: 'От имени перевозчика: Y-tunnus, банковский счёт, номер счёта и ссылочный номер — вашей компании. RAHTIS составляет счёт по подтверждённым дням и отправляет его заказчику в PDF.' },
    { q: 'Можно ли получить документ на перевозку отходов?', a: 'Да, для объектов в Финляндии, когда он нужен: на строительные отходы и загрязнённый грунт (на объекте отмечен как PIMA) формируется siirtoasiakirja по финскому Закону об отходах с кодами отходов, и такие рейсы помечаются для подачи в финский реестр сопроводительных документов. Для чистого грунта документ не нужен — по рейсу формируется запись о рейсе (kuormatosite). В других странах — свои национальные системы, их пока нет, подключаем по очереди.' },
    { q: 'Работает ли приложение в котловане без связи?', a: 'Работает. Записи сохраняются в телефоне и уходят, когда связь появится. Время — это момент нажатия, а не отправки.' },
    { q: 'Сколько это стоит?', a: 'Первая машина бесплатно. Каждая следующая — 14,90 € (без НДС) в месяц, только если в этом месяце работала. От 100 машин — цена по запросу. При оплате года вперёд −10 %. Первый месяц бесплатно.' },
  ],
  finalTitle: 'Попробуйте на своём объекте',
  finalText: 'Добавьте объект, пригласите водителя и отправьте прорабу ссылку. Первый месяц бесплатно.',
  teaserEyebrow: 'Новое: земляные работы',
  teaserTitle: 'Самосвалы на объекте: рейсы, часы и счета',
  teaserText: 'Рейсы со взвешиванием, финские документы на перевозку отходов, часы до последней выгрузки + 30 мин и подтверждение прораба по ссылке. Счёт заказчику от имени вашей компании.',
  teaserCta: 'Подробнее',
  footerLink: 'Земляные работы и самосвалы',
  serviceTitle: 'Земляные работы и самосвалы',
  serviceText: 'Самосвал весь день работает на объекте: водитель отмечает приезд и каждый рейс со взвешиванием и местом выгрузки. Часы считаются до последней выгрузки + 30 минут.',
  serviceText2: 'Прораб подтверждает день по ссылке без входа в систему, а счёт уходит заказчику от имени перевозчика.',
  serviceType: 'Приложение для перевозок на земляных работах',
  features_ld: [
    'Рейсы и взвешивания (брутто, тара, нетто, весовой талон)',
    'Финский документ на перевозку отходов (siirtoasiakirja) для объектов в Финляндии: строительные отходы и загрязнённый грунт (PIMA)',
    'Чтение весового талона по фото',
    'Часы: прибытие — последняя выгрузка + 30 мин',
    'Подтверждение прораба по ссылке',
    'Счета заказчику от имени перевозчика',
    'Осевые нагрузки и предупреждение о перегрузе по странам',
  ],
};

/* Остальные языки — перевод с финского (смысл) и английского (помощь). */
export const EARTHWORKS: Record<Locale, EarthworksCopy> = {
  fi,
  en,
  sv,
  et,
  lv,
  lt,
  pl,
  de,
  ru,
};

/** Адрес страницы: финский слаг у финского, английский у остальных. */
export const earthworksPath = (locale: Locale) => `/${locale}/${locale === 'fi' ? 'maansiirto' : 'earthworks'}`;
