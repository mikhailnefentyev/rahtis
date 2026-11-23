import type { Locale } from '../../i18n/config.ts';
import type { InstallmentLawCopy } from './types.ts';

/**
 * Швеция — тексты кабинета на десяти языках (23.11.2026). Источник фактов —
 * docs/equipment-sale/countries/se.md:
 *   · сделка — avbetalningsköp по lag (1978:599) om avbetalningsköp mellan
 *     näringsidkare; закон императивен в пользу покупателя;
 *   · порог (7 §): просрочка БОЛЬШЕ 14 дней и сумма БОЛЬШЕ 1/10 (один взнос)
 *     или 1/20 (два и больше) kreditfordran — части цены в кредит плюс все
 *     проценты, а не цены, — либо весь остаток. Покупатель снимает право на
 *     изъятие, погасив просрочку с пенями и расходами до фактического возврата
 *     (8 §). Расчёт (avräkning) обязателен, изъятие — только через Kronofogden
 *     (handräckning), и только при «очевидном» праве: срок и результат не
 *     обещаются;
 *   · в реестре Transportstyrelsen владельцем (ägare) записывается ПОКУПАТЕЛЬ;
 *     у продавца — только отметка о kreditköp, она не мешает перепродаже.
 *     Поэтому нигде не сказано, что продавец «остаётся владельцем в реестре».
 *     Принимает ли Transportstyrelsen отметку от продавца — не автодилера, не
 *     подтверждено (открытый вопрос 3): текст советует спросить до передачи;
 *   · срок заявления о смене владельца — 10 дней; страховку (trafikförsäkring)
 *     и налог несёт покупатель по закону;
 *   · проценты не предлагаются: их НДС не выяснен (открытый вопрос 1), ставка
 *     в форме стоит 0 — подсказка rateHint объясняет почему;
 *   · при возврате машина оценивается без НДС и покупатель счёта не выставляет
 *     — это вывод исследования по справочнику 2014 года, бухгалтером не
 *     подтверждён (открытый вопрос 2): текст говорит об этом прямо;
 *   · счёт в PDF действителен при согласии получателя; ссылка платежа — RF,
 *     OCR-номера и bankgiro нет.
 * Исследование не проверено шведским юристом: формулировки не обещают
 * результата и не называют расчёт базы порога подтверждённым.
 * Тексты носителем языка не вычитаны — вычитать до рекламы раздела.
 */
export const SE_TEXTS: Record<Locale, InstallmentLawCopy> = {
  fi: {
    intro:
      'Myy oma auto osamaksulla tarkastetulle kuljetusliikkeelle tai osta auto osamaksulla. RAHTIS laatii Ruotsin lain mukaisen sopimuksen (avbetalningsköp, takaisinottoehto – förbehåll om återtaganderätt, laki 1978:599), maksusuunnitelman ja laskut myyjän nimissä; ostaja maksaa suoraan myyjän tilille. Summat ovat Ruotsin kruunuina.',
    introSeller:
      'Myy auto osamaksulla tarkastetulle kuljetusliikkeelle. Lisää myytävä auto, me tarkastamme sen tiedot, ja hyväksynnän jälkeen voit julkaista myynti-ilmoituksen. RAHTIS laatii Ruotsin lain mukaisen sopimuksen (avbetalningsköp, takaisinottoehto – förbehåll om återtaganderätt, laki 1978:599), maksusuunnitelman ja laskut myyjän nimissä; ostaja maksaa suoraan tilillesi. Summat ovat Ruotsin kruunuina.',
    notAllowed:
      'Kalustoa voi myydä osamaksulla jokainen RAHTIKSEEN rekisteröitynyt ja tarkastettu ruotsalainen yritys, ja ostajana on aina tarkastettu ruotsalainen kuljetusliike. Kaupan tekee yrityksen pääkäyttäjä.',
    contract: 'Osamaksusopimus (PDF, ruotsiksi)',
    nextSteps:
      'Ennen luovutusta: sopimus on allekirjoitettu – ostaja allekirjoittaa käsin tai vähintään kehittyneellä sähköisellä allekirjoituksella, muuten sopimuksella ei voi hakea virka-apua (handräckning) Kronofogdenilta; ensimmäinen lasku on maksettu; osapuolet ovat allekirjoittaneet omistajanvaihdosilmoituksen Transportstyrelsenille, ja siinä on ilmoitettu, että auto on myyty luotolla takaisinottoehdoin (kreditköp med förbehåll om återtaganderätt), sekä ehdon päättymispäivä – ilmoituksen on saavuttava 10 päivän kuluessa vaihdoksesta. Rekisteriin omistajaksi (ägare) merkitään ostaja; myyjä näkyy vain luotonantajana (kreditgivare), eikä merkintä estä ostajaa myymästä autoa edelleen. Ei ole varmistettu, hyväksyykö Transportstyrelsen merkinnän myyjältä, joka ei ole autoliike tai rahoitusyhtiö – kysy Transportstyrelseniltä ennen luovutusta. Liikennevakuutus (trafikförsäkring) ja ajoneuvovero kuuluvat lain mukaan ostajalle; vakuutusyhtiö vahvistaa kirjallisesti, että kaskovakuutus (vagnskadeförsäkring) on voimassa myyjän hyväksi. Ennen ammattiliikennettä ostaja ilmoittaa auton Transportstyrelsenille liikennelupansa (yrkestrafiktillstånd) käyttöön.',
    invoiceNote:
      'Laskut lähetetään PDF-muodossa Ruotsin kruunuina (kr); PDF-lasku on Ruotsissa pätevä, kun vastaanottaja hyväksyy sähköisen laskun. Maksuviite on kansainvälinen RF-viite: laskuissa ei ole OCR-numeroa eikä bankgiroa, koska ne edellyttävät myyjän omaa pankkisopimusta – ostaja maksaa myyjän tilille (IBAN) ja antaa viitteen viestinä.',
    thresholdsText:
      'Ruotsin lain (1978:599) 7 §:n mukaan myyjä voi vaatia loput tai ottaa auton takaisin vasta, kun maksu on ollut myöhässä yli 14 päivää ja myöhässä on enemmän kuin {tenth} (yksi erä) tai enemmän kuin {twentieth} (kaksi tai useampia eri päivinä erääntyneitä eriä) taikka koko loppuosa. Rajat ovat 1/10 ja 1/20 luottosaatavasta (kreditfordran: luotolle jäävä osa hinnasta ja kaikki korot), eivät kauppahinnasta. Tässä kaupassa se tarkoittaa {needed} erän viivästystä. Ruotsalainen juristi ei ole vahvistanut laskentaperustetta.',
    thresholdTitle: 'Osamaksulain raja ylittyy: {plate}',
    threshold:
      'Myöhässä olevat erät ylittävät lain (1978:599) 7 §:n rajan (sopimuksen kohta 9.1): yli 14 päivää myöhässä ja yli 1/10 (kahdella tai useammalla erällä 1/20) luottosaatavasta (kreditfordran) tai koko loppuosa. Voit nyt vaatia kirjallisesti koko loppuosan tai ottaa auton takaisin. Jos ostaja maksaa myöhässä olevan määrän viivästyskorkoineen (dröjsmålsränta) ja kuluinesi ennen kuin auto on tosiasiallisesti palautettu, et saa ottaa autoa takaisin etkä vaatia ennenaikaista maksua (8 §). Takaisinotossa on tehtävä tilitys (avräkning). Autoa ei saa ottaa itse: jos ostaja ei luovuta sitä vapaaehtoisesti, hae virka-apua (handräckning) Kronofogdenilta; sitä annetaan vain, kun oikeutesi on ilmeinen. Käynnistyksenestoa ei käytetä perintään.',
    checkRegister:
      'Omistajanvaihdosilmoitus Transportstyrelsenille on molempien allekirjoittama, ja siinä on ilmoitettu luottokauppa takaisinottoehdoin ja ehdon päättymispäivä; ostaja merkitään omistajaksi (ägare), myyjä näkyy luotonantajana (kreditgivare).',
    checkInsurance:
      'Ostajan ottama liikennevakuutus (trafikförsäkring) on voimassa luovutuspäivästä, ja vakuutusyhtiö on vahvistanut kirjallisesti, että kaskovakuutus (vagnskadeförsäkring) on voimassa myyjän hyväksi.',
    afterPaid:
      'Omistusoikeus siirtyi ostajalle päivänä, jona viimeinen maksu kirjautui myyjän tilille. Ostaja on jo rekisterissä omistajana: myyjän on heti ilmoitettava Transportstyrelsenille, että takaisinottoehto on päättynyt, ja vahvistettava se ostajalle kirjallisesti.',
    terminationHint:
      'Kirjaa kauppa päättyneeksi, kun olet ottanut auton takaisin (ostaja luovutti sen vapaaehtoisesti tai Kronofogdenin kautta) tai kun olette sopineet ostajan kanssa kaupan purkamisesta. Maksuerien laskutus ja muistutukset loppuvat. Merkintää ei voi perua.',
    reasonRepossessed: 'Myyjä on ottanut auton takaisin (återtagande)',
    settlement:
      'RAHTIS ei laske eikä toimita tilitystä. Sopimuksen kohdan 9.5 ja lain (1978:599) 9–10 §:n mukainen tilitys (avräkning) tehdään osapuolten kesken; virka-apumenettelyssä auton arvioi Kronofogden. Alustan selvityksen mukaan auto arvioidaan ilman arvonlisäveroa eikä ostaja laskuta palautuksesta, jos ostajalla on ollut oikeus vähentää kaupan vero – kirjanpitäjä ei ole vahvistanut tätä, joten varmista käsittely omalta kirjanpitäjältäsi. Myyjä ilmoittaa uuden omistajan Transportstyrelsenille.',
    rateHint:
      'Ruotsissa RAHTIS ei toistaiseksi tarjoa korkoa: osamaksukaupan koron arvonlisäverokäsittely on epäselvä (Ruotsin verohallinnon lähteet poikkeavat toisistaan) eikä kirjanpitäjä ole vahvistanut sitä. Korko on kiinteästi 0.',
  },
  en: {
    intro:
      'Sell your own truck in instalments to a verified carrier, or buy one in instalments. RAHTIS prepares a contract under Swedish law (avbetalningsköp with a reservation of the right to repossess – förbehåll om återtaganderätt, Act 1978:599), the payment plan and the invoices in the seller’s name; the buyer pays straight to the seller’s account. Amounts are in Swedish kronor.',
    introSeller:
      'Sell a truck in instalments to a verified carrier. Add the vehicle you want to sell; we check its details, and once it is approved you can publish a listing. RAHTIS prepares a contract under Swedish law (avbetalningsköp with a reservation of the right to repossess – förbehåll om återtaganderätt, Act 1978:599), the payment plan and the invoices in the seller’s name; the buyer pays straight to your account. Amounts are in Swedish kronor.',
    notAllowed:
      'Any verified Swedish company registered in RAHTIS can sell equipment in instalments; the buyer is always a verified Swedish carrier. The sale is made by the company’s main user.',
    contract: 'Instalment purchase contract (PDF, in Swedish)',
    nextSteps:
      'Before handover: the contract is signed – the buyer signs by hand or with at least an advanced electronic signature, otherwise the contract cannot be used to ask Kronofogden for assistance (handräckning); the first invoice is paid; both parties have signed the notification of change of owner to Transportstyrelsen, stating that the vehicle is sold as a credit purchase with a reservation of the right to repossess (kreditköp med förbehåll om återtaganderätt) and the end date of the reservation – it must arrive within 10 days of the change. In the register the buyer becomes the owner (ägare); the seller is shown only as credit provider (kreditgivare), and this note does not stop the buyer from reselling the vehicle. Whether Transportstyrelsen accepts the note from a seller that is not a vehicle dealer or a finance company is not confirmed – ask Transportstyrelsen before handover. Motor insurance (trafikförsäkring) and vehicle tax are the buyer’s by law; the insurer confirms in writing that the comprehensive cover (vagnskadeförsäkring) is in the seller’s favour. Before using the vehicle in commercial traffic the buyer reports it to Transportstyrelsen under its licence (yrkestrafiktillstånd).',
    invoiceNote:
      'Invoices are sent as PDF in Swedish kronor (kr); a PDF invoice is valid in Sweden when the recipient accepts electronic invoices. The payment reference is an international RF reference: the invoices carry no OCR number and no bankgiro, because those need the seller’s own bank agreement – the buyer pays to the seller’s account (IBAN) and quotes the reference as the message.',
    thresholdsText:
      'Under section 7 of the Swedish Act (1978:599) the seller may demand the rest or take the truck back only when a payment has been overdue for more than 14 days and more than {tenth} (one instalment) or more than {twentieth} (two or more instalments due on different dates) is overdue, or the whole remainder. The limits are 1/10 and 1/20 of the credit claim (kreditfordran: the credited part of the price plus all interest), not of the price. In this deal: overdue instalments needed – {needed}. The basis of the calculation has not been confirmed by a Swedish lawyer.',
    thresholdTitle: 'Instalment Purchase Act threshold exceeded: {plate}',
    threshold:
      'The overdue instalments exceed the threshold of section 7 of the Act (1978:599) (clause 9.1 of the contract): more than 14 days late and more than 1/10 (1/20 with two or more instalments) of the credit claim (kreditfordran), or the whole remainder. You may now demand the whole remainder in writing or take the vehicle back. If the buyer pays the overdue amount with default interest (dröjsmålsränta) and your costs before the vehicle has actually been returned, you may neither take it back nor demand early payment (section 8). A settlement (avräkning) is mandatory on taking back. You may not take the vehicle yourself: if the buyer does not hand it over voluntarily, apply to Kronofogden for assistance (handräckning); it is given only when your right is evident. The immobiliser is not used for debt collection.',
    checkRegister:
      'The notification of change of owner to Transportstyrelsen is signed by both parties and states the credit purchase with a reservation of the right to repossess and its end date; the buyer is registered as owner (ägare), the seller is shown as credit provider (kreditgivare).',
    checkInsurance:
      'Motor insurance (trafikförsäkring) taken out by the buyer is in force from the handover date, and the insurer has confirmed in writing that the comprehensive cover (vagnskadeförsäkring) is in the seller’s favour.',
    afterPaid:
      'Ownership passed to the buyer on the day the last payment was booked on the seller’s account. The buyer is already the registered owner: the seller must immediately notify Transportstyrelsen that the reservation of the right to repossess has ended, and confirm this to the buyer in writing.',
    terminationHint:
      'Record this when you have taken the vehicle back (the buyer handed it over voluntarily or through Kronofogden), or when you and the buyer have agreed to undo the sale. Instalment invoices and reminders stop. This cannot be undone.',
    reasonRepossessed: 'The seller has taken the vehicle back (återtagande)',
    settlement:
      'RAHTIS does not calculate or carry out the settlement. The settlement (avräkning) under clause 9.5 of the contract and sections 9–10 of the Act (1978:599) is made between the parties; in assistance proceedings Kronofogden values the vehicle. According to the platform’s research the vehicle is valued excluding VAT and the buyer issues no invoice for the return if the buyer had the right to deduct the VAT on the purchase – this has not been confirmed by an accountant, so check the treatment with your own. The seller reports the new owner to Transportstyrelsen.',
    rateHint:
      'In Sweden RAHTIS does not offer interest for now: the VAT treatment of interest on an instalment purchase is unclear (the Swedish Tax Agency’s sources differ) and has not been confirmed by an accountant. The rate is fixed at 0.',
  },
  sv: {
    intro:
      'Sälj din egen bil på avbetalning till ett kontrollerat åkeri eller köp en bil på avbetalning. RAHTIS upprättar ett avtal enligt svensk lag (avbetalningsköp med förbehåll om återtaganderätt, lagen (1978:599) om avbetalningsköp mellan näringsidkare m.fl.), en betalningsplan och fakturor i säljarens namn; köparen betalar direkt till säljarens konto. Beloppen anges i svenska kronor.',
    introSeller:
      'Sälj en bil på avbetalning till ett kontrollerat åkeri. Lägg till bilen du vill sälja; vi kontrollerar uppgifterna, och när den har godkänts kan du publicera en annons. RAHTIS upprättar ett avtal enligt svensk lag (avbetalningsköp med förbehåll om återtaganderätt, lagen (1978:599) om avbetalningsköp mellan näringsidkare m.fl.), en betalningsplan och fakturor i säljarens namn; köparen betalar direkt till ditt konto. Beloppen anges i svenska kronor.',
    notAllowed:
      'Varje kontrollerat svenskt företag som är registrerat i RAHTIS kan sälja fordon på avbetalning; köparen är alltid ett kontrollerat svenskt åkeri. Köpet görs av företagets huvudanvändare.',
    contract: 'Avtal om avbetalningsköp (PDF)',
    nextSteps:
      'Före utlämnandet: avtalet är undertecknat – köparen undertecknar för hand eller med minst avancerad elektronisk underskrift, annars kan avtalet inte ligga till grund för handräckning hos Kronofogden; första fakturan är betald; parterna har undertecknat anmälan om ägarbyte till Transportstyrelsen med uppgift om att fordonet har överlåtits genom kreditköp med förbehåll om återtaganderätt och om förbehållets slutdatum – anmälan ska komma in inom 10 dagar från ägarbytet. I vägtrafikregistret registreras köparen som ägare; säljaren syns bara som kreditgivare, och uppgiften hindrar inte köparen från att sälja fordonet vidare. Det är inte bekräftat att Transportstyrelsen godtar uppgiften från en säljare som inte är bilhandlare eller finansbolag – fråga Transportstyrelsen före utlämnandet. Trafikförsäkring och fordonsskatt ligger enligt lag på köparen; försäkringsgivaren bekräftar skriftligen att vagnskadeförsäkringen gäller till förmån för säljaren. Innan fordonet används i yrkesmässig trafik anmäler köparen det till Transportstyrelsen på sitt tillstånd (yrkestrafiktillstånd).',
    invoiceNote:
      'Fakturorna skickas som PDF i svenska kronor (kr); en PDF-faktura är giltig i Sverige när mottagaren godtar elektroniska fakturor. Betalningsreferensen är en internationell RF-referens: fakturorna har inget OCR-nummer och inget bankgiro, eftersom de kräver säljarens eget avtal med banken – köparen betalar till säljarens konto (IBAN) och anger referensen som meddelande.',
    thresholdsText:
      'Enligt 7 § lagen (1978:599) får säljaren kräva resten eller återta bilen först när en betalning har varit försenad i mer än 14 dagar och det försenade beloppet är mer än {tenth} (en avbetalning) eller mer än {twentieth} (två eller flera poster som förfallit vid olika tidpunkter), eller utgör hela återstoden. Gränserna är 1/10 och 1/20 av kreditfordran (kreditbeloppet och all ränta), inte av priset. Antal försenade avbetalningar som krävs i det här köpet: {needed}. Beräkningsgrunden har inte bekräftats av en svensk jurist.',
    thresholdTitle: 'Avbetalningsköplagens gräns är överskriden: {plate}',
    threshold:
      'De försenade avbetalningarna överskrider gränsen i 7 § lagen (1978:599) (avtalets punkt 9.1): mer än 14 dagars dröjsmål och mer än 1/10 (1/20 vid två eller flera poster) av kreditfordran, eller hela återstoden. Du får nu skriftligen kräva hela återstoden eller återta fordonet. Om köparen betalar det försenade beloppet med dröjsmålsränta och dina kostnader innan fordonet faktiskt har lämnats tillbaka, får du varken återta det eller kräva betalning i förtid (8 §). Vid återtagande ska avräkning göras. Du får inte själv ta fordonet: om köparen inte lämnar ut det frivilligt ansöker du om handräckning hos Kronofogden; den beviljas bara när din rätt är uppenbar. Startspärr används inte för indrivning.',
    checkRegister:
      'Anmälan om ägarbyte till Transportstyrelsen är undertecknad av båda parter och anger kreditköp med förbehåll om återtaganderätt och förbehållets slutdatum; köparen registreras som ägare, säljaren syns som kreditgivare.',
    checkInsurance:
      'Trafikförsäkringen som köparen har tecknat gäller från leveransdagen, och försäkringsgivaren har skriftligen bekräftat att vagnskadeförsäkringen gäller till förmån för säljaren.',
    afterPaid:
      'Äganderätten övergick till köparen den dag den sista betalningen bokfördes på säljarens konto. Köparen är redan registrerad ägare: säljaren ska genast anmäla till Transportstyrelsen att förbehållet om återtaganderätt har upphört och bekräfta det skriftligen för köparen.',
    terminationHint:
      'Registrera detta när du har återtagit fordonet (köparen lämnade ut det frivilligt eller genom Kronofogden) eller när du och köparen har kommit överens om att köpet ska gå åter. Fakturor på avbetalningar och påminnelser upphör. Det går inte att ångra.',
    reasonRepossessed: 'Säljaren har återtagit fordonet (återtagande)',
    settlement:
      'RAHTIS beräknar eller genomför inte avräkningen. Avräkningen enligt avtalets punkt 9.5 och 9–10 §§ lagen (1978:599) görs mellan parterna; vid handräckning värderar Kronofogden fordonet. Enligt plattformens utredning värderas fordonet exklusive mervärdesskatt och köparen utfärdar ingen faktura för återtagandet, om köparen har haft rätt till avdrag för skatten på köpet – detta har inte bekräftats av en redovisningskonsult, så kontrollera hanteringen med din egen. Säljaren anmäler den nya ägaren till Transportstyrelsen.',
    rateHint:
      'I Sverige erbjuder RAHTIS tills vidare ingen ränta: hur ränta vid avbetalningsköp ska behandlas i mervärdesskatten är oklart (Skatteverkets källor går isär) och har inte bekräftats av en redovisningskonsult. Räntan är fast 0.',
  },
  et: {
    intro:
      'Müüge oma veok järelmaksuga kontrollitud veoettevõtjale või ostke veok järelmaksuga. RAHTIS koostab Rootsi õiguse kohase lepingu (avbetalningsköp tagasivõtmisõiguse reservatsiooniga – förbehåll om återtaganderätt, seadus 1978:599), maksegraafiku ja arved müüja nimel; ostja tasub otse müüja kontole. Summad on Rootsi kroonides.',
    introSeller:
      'Müüge veok järelmaksuga kontrollitud veoettevõtjale. Lisage müüdav veok; kontrollime selle andmed ja pärast heakskiitmist saate avaldada müügikuulutuse. RAHTIS koostab Rootsi õiguse kohase lepingu (avbetalningsköp tagasivõtmisõiguse reservatsiooniga – förbehåll om återtaganderätt, seadus 1978:599), maksegraafiku ja arved müüja nimel; ostja tasub otse teie kontole. Summad on Rootsi kroonides.',
    notAllowed:
      'Järelmaksuga saab tehnikat müüa iga RAHTISes registreeritud ja kontrollitud Rootsi ettevõte; ostja on alati kontrollitud Rootsi veoettevõtja. Tehingu teeb ettevõtte peakasutaja.',
    contract: 'Järelmaksuga ostu leping (PDF, rootsi keeles)',
    nextSteps:
      'Enne üleandmist: leping on allkirjastatud – ostja allkirjastab omakäeliselt või vähemalt täiustatud e-allkirjaga, muidu ei saa lepingu alusel taotleda Kronofogdenilt abi (handräckning); esimene arve on tasutud; pooled on allkirjastanud omanikuvahetuse teate Transportstyrelsenile, milles on märgitud, et sõiduk on müüdud krediidiga tagasivõtmisõiguse reservatsiooniga (kreditköp med förbehåll om återtaganderätt), ja reservatsiooni lõppkuupäev – teade peab saabuma 10 päeva jooksul vahetusest. Registris märgitakse omanikuks (ägare) ostja; müüja on nähtav ainult krediidiandjana (kreditgivare) ja see märge ei takista ostjal sõidukit edasi müüa. Ei ole kinnitatud, kas Transportstyrelsen võtab märke vastu müüjalt, kes ei ole autokaupmees ega finantseerimisettevõte – küsige Transportstyrelsenilt enne üleandmist. Liikluskindlustus (trafikförsäkring) ja sõidukimaks on seaduse järgi ostja kanda; kindlustusandja kinnitab kirjalikult, et kaskokindlustus (vagnskadeförsäkring) kehtib müüja kasuks. Enne tasulist vedu teatab ostja sõidukist Transportstyrelsenile oma tegevusloa (yrkestrafiktillstånd) alla.',
    invoiceNote:
      'Arved saadetakse PDF-vormingus Rootsi kroonides (kr); PDF-arve kehtib Rootsis, kui saaja on elektroonilise arvega nõus. Makseviide on rahvusvaheline RF-viide: arvetel ei ole OCR-numbrit ega bankgiro numbrit, sest need eeldavad müüja enda lepingut pangaga – ostja tasub müüja kontole (IBAN) ja märgib viite selgitusse.',
    thresholdsText:
      'Rootsi seaduse (1978:599) § 7 järgi võib müüja nõuda jääki või võtta veoki tagasi alles siis, kui makse on hilinenud üle 14 päeva ja hilinenud summa on suurem kui {tenth} (üks osamakse) või suurem kui {twentieth} (kaks või rohkem eri päevadel sissenõutavaks muutunud osamakset) või kogu jääk. Piirid on 1/10 ja 1/20 krediidinõudest (kreditfordran: krediiti jäetud osa hinnast ja kogu intress), mitte hinnast. Selles tehingus tähendab see {needed} osamakse hilinemist. Arvutuse alust ei ole Rootsi jurist kinnitanud.',
    thresholdTitle: 'Järelmaksuseaduse piir on ületatud: {plate}',
    threshold:
      'Hilinenud osamaksed ületavad seaduse (1978:599) § 7 piiri (lepingu punkt 9.1): üle 14 päeva hilinenud ja üle 1/10 (kahe või enama osamakse korral 1/20) krediidinõudest (kreditfordran) või kogu jääk. Nüüd võite kirjalikult nõuda kogu jäägi tasumist või võtta sõiduki tagasi. Kui ostja tasub hilinenud summa koos viivise (dröjsmålsränta) ja teie kuludega enne, kui sõiduk on tegelikult tagastatud, ei või te sõidukit tagasi võtta ega nõuda ennetähtaegset tasumist (§ 8). Tagasivõtmisel tuleb teha arveldus (avräkning). Sõidukit ei tohi ise ära võtta: kui ostja seda vabatahtlikult üle ei anna, taotlege Kronofogdenilt abi (handräckning); seda antakse ainult siis, kui teie õigus on ilmne. Käivitustõket võla sissenõudmiseks ei kasutata.',
    checkRegister:
      'Omanikuvahetuse teade Transportstyrelsenile on mõlema poole allkirjastatud ning selles on märgitud krediidiga ost tagasivõtmisõiguse reservatsiooniga ja selle lõppkuupäev; ostja registreeritakse omanikuna (ägare), müüja on nähtav krediidiandjana (kreditgivare).',
    checkInsurance:
      'Ostja sõlmitud liikluskindlustus (trafikförsäkring) kehtib üleandmise päevast ja kindlustusandja on kirjalikult kinnitanud, et kaskokindlustus (vagnskadeförsäkring) kehtib müüja kasuks.',
    afterPaid:
      'Omand läks ostjale üle päeval, mil viimane makse laekus müüja kontole. Ostja on registris juba omanik: müüja peab viivitamata teatama Transportstyrelsenile, et tagasivõtmisõiguse reservatsioon on lõppenud, ja kinnitama seda ostjale kirjalikult.',
    terminationHint:
      'Märkige tehing lõppenuks, kui olete sõiduki tagasi võtnud (ostja andis selle üle vabatahtlikult või Kronofogdeni kaudu) või kui olete ostjaga kokku leppinud tehingu tagasitäitmises. Osamaksete arved ja meeldetuletused lõpevad. Märget ei saa tagasi võtta.',
    reasonRepossessed: 'Müüja on sõiduki tagasi võtnud (återtagande)',
    settlement:
      'RAHTIS arveldust ei arvuta ega tee. Lepingu punkti 9.5 ja seaduse (1978:599) §-de 9–10 kohane arveldus (avräkning) tehakse poolte vahel; abimenetluses hindab sõiduki Kronofogden. Platvormi uuringu järgi hinnatakse sõiduk käibemaksuta ja ostja tagastamise kohta arvet ei esita, kui ostjal oli õigus ostu käibemaks maha arvata – raamatupidaja ei ole seda kinnitanud, seega kontrollige käsitlust oma raamatupidajaga. Müüja teatab uuest omanikust Transportstyrelsenile.',
    rateHint:
      'Rootsis RAHTIS esialgu intressi ei paku: järelmaksuga ostu intressi käibemaksukäsitlus on ebaselge (Rootsi maksuameti allikad lähevad lahku) ja raamatupidaja ei ole seda kinnitanud. Intressimäär on kindlalt 0.',
  },
  lv: {
    intro:
      'Pārdodiet savu automašīnu uz nomaksu pārbaudītam pārvadātājam vai iegādājieties automašīnu uz nomaksu. RAHTIS sagatavo līgumu saskaņā ar Zviedrijas tiesībām (avbetalningsköp ar atpakaļņemšanas tiesību atrunu – förbehåll om återtaganderätt, likums 1978:599), maksājumu grafiku un rēķinus pārdevēja vārdā; pircējs maksā tieši uz pārdevēja kontu. Summas ir Zviedrijas kronās.',
    introSeller:
      'Pārdodiet automašīnu uz nomaksu pārbaudītam pārvadātājam. Pievienojiet pārdodamo automašīnu; mēs pārbaudīsim tās datus, un pēc apstiprināšanas varēsiet publicēt sludinājumu. RAHTIS sagatavo līgumu saskaņā ar Zviedrijas tiesībām (avbetalningsköp ar atpakaļņemšanas tiesību atrunu – förbehåll om återtaganderätt, likums 1978:599), maksājumu grafiku un rēķinus pārdevēja vārdā; pircējs maksā tieši uz jūsu kontu. Summas ir Zviedrijas kronās.',
    notAllowed:
      'Tehniku uz nomaksu var pārdot jebkurš RAHTIS reģistrēts un pārbaudīts Zviedrijas uzņēmums; pircējs vienmēr ir pārbaudīts Zviedrijas pārvadātājs. Darījumu noformē uzņēmuma galvenais lietotājs.',
    contract: 'Nomaksas pirkuma līgums (PDF, zviedru valodā)',
    nextSteps:
      'Pirms nodošanas: līgums ir parakstīts – pircējs paraksta pašrocīgi vai vismaz ar uzlabotu elektronisko parakstu, citādi ar līgumu nevar lūgt Kronofogden palīdzību (handräckning); pirmais rēķins ir samaksāts; puses ir parakstījušas paziņojumu Transportstyrelsen par īpašnieka maiņu, kurā norādīts, ka transportlīdzeklis pārdots kredītā ar atpakaļņemšanas tiesību atrunu (kreditköp med förbehåll om återtaganderätt), un atrunas beigu datums – paziņojumam jāpienāk 10 dienu laikā pēc maiņas. Reģistrā par īpašnieku (ägare) ieraksta pircēju; pārdevējs redzams tikai kā kredīta devējs (kreditgivare), un šī atzīme neliedz pircējam transportlīdzekli pārdot tālāk. Nav apstiprināts, vai Transportstyrelsen pieņem atzīmi no pārdevēja, kas nav auto tirgotājs vai finanšu sabiedrība, – pirms nodošanas pajautājiet Transportstyrelsen. Transportlīdzekļa obligātā apdrošināšana (trafikförsäkring) un transportlīdzekļa nodoklis saskaņā ar likumu ir pircēja pienākums; apdrošinātājs rakstveidā apliecina, ka KASKO apdrošināšana (vagnskadeförsäkring) ir spēkā par labu pārdevējam. Pirms komercpārvadājumiem pircējs piesaka transportlīdzekli Transportstyrelsen savai atļaujai (yrkestrafiktillstånd).',
    invoiceNote:
      'Rēķinus nosūta PDF formātā Zviedrijas kronās (kr); PDF rēķins Zviedrijā ir derīgs, ja saņēmējs piekrīt elektroniskam rēķinam. Maksājuma atsauce ir starptautiskā RF atsauce: rēķinos nav OCR numura un bankgiro, jo tiem vajadzīgs paša pārdevēja līgums ar banku – pircējs maksā uz pārdevēja kontu (IBAN) un norāda atsauci maksājuma mērķī.',
    thresholdsText:
      'Saskaņā ar Zviedrijas likuma (1978:599) 7. pantu pārdevējs var prasīt atlikumu vai atņemt automašīnu tikai tad, ja maksājums kavēts vairāk nekā 14 dienas un nokavētā summa pārsniedz {tenth} (viens maksājums) vai pārsniedz {twentieth} (divi vai vairāk maksājumi ar dažādiem termiņiem), vai ir viss atlikums. Robežas ir 1/10 un 1/20 no kredīta prasījuma (kreditfordran: kredītā atstātā cenas daļa un visi procenti), nevis no cenas. Šajā darījumā tam vajadzīgais nokavēto maksājumu skaits: {needed}. Aprēķina bāzi Zviedrijas jurists nav apstiprinājis.',
    thresholdTitle: 'Nomaksas pirkuma likuma slieksnis pārsniegts: {plate}',
    threshold:
      'Nokavētie maksājumi pārsniedz likuma (1978:599) 7. panta slieksni (līguma 9.1. punkts): kavējums ilgāks par 14 dienām un vairāk nekā 1/10 (diviem vai vairāk maksājumiem – 1/20) no kredīta prasījuma (kreditfordran) vai viss atlikums. Tagad varat rakstveidā prasīt visu atlikumu vai atņemt transportlīdzekli. Ja pircējs samaksā nokavēto summu ar nokavējuma procentiem (dröjsmålsränta) un jūsu izdevumiem, pirms transportlīdzeklis faktiski atdots, jūs nedrīkstat ne atņemt to, ne prasīt pirmstermiņa samaksu (8. pants). Atņemot transportlīdzekli, obligāti veicams norēķins (avräkning). Transportlīdzekli nedrīkst paņemt pašam: ja pircējs to labprātīgi neatdod, lūdziet Kronofogden palīdzību (handräckning); to sniedz tikai tad, ja jūsu tiesības ir acīmredzamas. Iedarbināšanas bloķēšanu parāda piedziņai neizmanto.',
    checkRegister:
      'Paziņojumu Transportstyrelsen par īpašnieka maiņu parakstījušas abas puses, un tajā norādīts pirkums kredītā ar atpakaļņemšanas tiesību atrunu un tās beigu datums; pircēju reģistrē kā īpašnieku (ägare), pārdevējs redzams kā kredīta devējs (kreditgivare).',
    checkInsurance:
      'Pircēja noslēgtā transportlīdzekļa obligātā apdrošināšana (trafikförsäkring) ir spēkā no nodošanas dienas, un apdrošinātājs rakstveidā apliecinājis, ka KASKO apdrošināšana (vagnskadeförsäkring) ir spēkā par labu pārdevējam.',
    afterPaid:
      'Īpašuma tiesības pārgāja pircējam dienā, kad pēdējais maksājums iegrāmatots pārdevēja kontā. Pircējs reģistrā jau ir īpašnieks: pārdevējam nekavējoties jāpaziņo Transportstyrelsen, ka atpakaļņemšanas tiesību atruna ir beigusies, un tas rakstveidā jāapliecina pircējam.',
    terminationHint:
      'Reģistrējiet darījuma izbeigšanos, kad esat atņēmis transportlīdzekli (pircējs to atdeva labprātīgi vai ar Kronofogden starpniecību) vai kad esat ar pircēju vienojušies atcelt pirkumu. Maksājumu rēķini un atgādinājumi tiek pārtraukti. Atzīmi nevar atsaukt.',
    reasonRepossessed: 'Pārdevējs ir atņēmis transportlīdzekli (återtagande)',
    settlement:
      'RAHTIS neaprēķina un neveic norēķinu. Norēķinu (avräkning) saskaņā ar līguma 9.5. punktu un likuma (1978:599) 9.–10. pantu puses veic savā starpā; palīdzības procedūrā transportlīdzekli novērtē Kronofogden. Saskaņā ar platformas izpēti transportlīdzekli novērtē bez PVN un pircējs par atdošanu rēķinu neizraksta, ja pircējam bija tiesības atskaitīt pirkuma PVN, – grāmatvedis to nav apstiprinājis, tāpēc pārbaudiet kārtību pie sava grāmatveža. Pārdevējs paziņo Transportstyrelsen par jauno īpašnieku.',
    rateHint:
      'Zviedrijā RAHTIS pagaidām procentus nepiedāvā: nomaksas pirkuma procentu aplikšana ar PVN ir neskaidra (Zviedrijas nodokļu dienesta avoti atšķiras), un grāmatvedis to nav apstiprinājis. Likme ir nemainīgi 0.',
  },
  lt: {
    intro:
      'Parduokite savo sunkvežimį išsimokėtinai patikrintam vežėjui arba pirkite sunkvežimį išsimokėtinai. RAHTIS parengia sutartį pagal Švedijos teisę (avbetalningsköp su atsiėmimo teisės išlyga – förbehåll om återtaganderätt, įstatymas 1978:599), mokėjimų grafiką ir sąskaitas pardavėjo vardu; pirkėjas moka tiesiai į pardavėjo sąskaitą. Sumos nurodomos Švedijos kronomis.',
    introSeller:
      'Parduokite sunkvežimį išsimokėtinai patikrintam vežėjui. Pridėkite parduodamą sunkvežimį; patikrinsime jo duomenis, o jį patvirtinus galėsite paskelbti skelbimą. RAHTIS parengia sutartį pagal Švedijos teisę (avbetalningsköp su atsiėmimo teisės išlyga – förbehåll om återtaganderätt, įstatymas 1978:599), mokėjimų grafiką ir sąskaitas pardavėjo vardu; pirkėjas moka tiesiai į jūsų sąskaitą. Sumos nurodomos Švedijos kronomis.',
    notAllowed:
      'Techniką išsimokėtinai gali parduoti kiekviena RAHTIS užregistruota ir patikrinta Švedijos įmonė; pirkėjas visada yra patikrintas Švedijos vežėjas. Sandorį sudaro pagrindinis įmonės naudotojas.',
    contract: 'Pirkimo išsimokėtinai sutartis (PDF, švedų kalba)',
    nextSteps:
      'Iki perdavimo: sutartis pasirašyta – pirkėjas pasirašo ranka arba bent pažangiuoju elektroniniu parašu, kitaip pagal sutartį negalima prašyti Kronofogden pagalbos (handräckning); pirmoji sąskaita apmokėta; šalys pasirašė pranešimą Transportstyrelsen apie savininko pasikeitimą, kuriame nurodyta, kad transporto priemonė parduota kreditu su atsiėmimo teisės išlyga (kreditköp med förbehåll om återtaganderätt), ir išlygos pabaigos data – pranešimas turi būti gautas per 10 dienų nuo pasikeitimo. Registre savininku (ägare) įrašomas pirkėjas; pardavėjas matomas tik kaip kredito davėjas (kreditgivare), ir ši žyma netrukdo pirkėjui parduoti transporto priemonę toliau. Nepatvirtinta, ar Transportstyrelsen priima žymą iš pardavėjo, kuris nėra automobilių prekiautojas ar finansų bendrovė, – prieš perdavimą pasiteiraukite Transportstyrelsen. Privalomasis transporto priemonės draudimas (trafikförsäkring) ir transporto priemonės mokestis pagal įstatymą tenka pirkėjui; draudikas raštu patvirtina, kad KASKO draudimas (vagnskadeförsäkring) galioja pardavėjo naudai. Prieš veždamas krovinius už atlygį pirkėjas praneša Transportstyrelsen apie transporto priemonę pagal savo licenciją (yrkestrafiktillstånd).',
    invoiceNote:
      'Sąskaitos siunčiamos PDF formatu Švedijos kronomis (kr); PDF sąskaita Švedijoje galioja, kai gavėjas sutinka gauti elektroninę sąskaitą. Mokėjimo nuoroda yra tarptautinė RF nuoroda: sąskaitose nėra OCR numerio ir bankgiro, nes jiems reikia paties pardavėjo sutarties su banku – pirkėjas moka į pardavėjo sąskaitą (IBAN) ir nurodo nuorodą mokėjimo paskirtyje.',
    thresholdsText:
      'Pagal Švedijos įstatymo (1978:599) 7 straipsnį pardavėjas gali reikalauti likučio arba atsiimti sunkvežimį tik tada, kai mokėjimas vėluoja ilgiau nei 14 dienų ir vėluojanti suma didesnė nei {tenth} (viena įmoka) arba didesnė nei {twentieth} (dvi ar daugiau įmokų su skirtingais terminais), arba vėluoja visas likutis. Ribos yra 1/10 ir 1/20 kredito reikalavimo (kreditfordran: kredituojama kainos dalis ir visos palūkanos), o ne kainos. Šiame sandoryje tam reikalingas vėluojančių įmokų skaičius: {needed}. Skaičiavimo bazės Švedijos teisininkas nepatvirtino.',
    thresholdTitle: 'Viršyta pirkimo išsimokėtinai įstatymo riba: {plate}',
    threshold:
      'Vėluojančios įmokos viršija įstatymo (1978:599) 7 straipsnio ribą (sutarties 9.1 punktas): vėluojama ilgiau nei 14 dienų ir daugiau nei 1/10 (dviem ar daugiau įmokų – 1/20) kredito reikalavimo (kreditfordran) arba visas likutis. Dabar galite raštu reikalauti viso likučio arba atsiimti transporto priemonę. Jei pirkėjas sumoka vėluojančią sumą su delspinigiais (dröjsmålsränta) ir jūsų išlaidomis, kol transporto priemonė dar faktiškai negrąžinta, jūs negalite nei jos atsiimti, nei reikalauti mokėti anksčiau laiko (8 straipsnis). Atsiimant privaloma atlikti atsiskaitymą (avräkning). Pasiimti transporto priemonės patys negalite: jei pirkėjas jos savanoriškai neperduoda, kreipkitės į Kronofogden dėl pagalbos (handräckning); ji teikiama tik tada, kai jūsų teisė akivaizdi. Užvedimo blokavimas skolai išieškoti nenaudojamas.',
    checkRegister:
      'Pranešimą Transportstyrelsen apie savininko pasikeitimą pasirašė abi šalys, jame nurodytas pirkimas kreditu su atsiėmimo teisės išlyga ir jos pabaigos data; pirkėjas registruojamas savininku (ägare), pardavėjas matomas kaip kredito davėjas (kreditgivare).',
    checkInsurance:
      'Pirkėjo sudarytas privalomasis transporto priemonės draudimas (trafikförsäkring) galioja nuo perdavimo dienos, o draudikas raštu patvirtino, kad KASKO draudimas (vagnskadeförsäkring) galioja pardavėjo naudai.',
    afterPaid:
      'Nuosavybės teisė perėjo pirkėjui tą dieną, kai paskutinis mokėjimas įskaitytas į pardavėjo sąskaitą. Pirkėjas registre jau yra savininkas: pardavėjas privalo nedelsdamas pranešti Transportstyrelsen, kad atsiėmimo teisės išlyga pasibaigė, ir raštu tai patvirtinti pirkėjui.',
    terminationHint:
      'Pažymėkite sandorio pabaigą, kai atsiėmėte transporto priemonę (pirkėjas ją perdavė savanoriškai arba per Kronofogden) arba kai su pirkėju susitarėte panaikinti pirkimą. Įmokų sąskaitos ir priminimai nebesiunčiami. Žymos atšaukti negalima.',
    reasonRepossessed: 'Pardavėjas atsiėmė transporto priemonę (återtagande)',
    settlement:
      'RAHTIS atsiskaitymo neskaičiuoja ir neatlieka. Atsiskaitymą (avräkning) pagal sutarties 9.5 punktą ir įstatymo (1978:599) 9–10 straipsnius šalys atlieka tarpusavyje; pagalbos procedūroje transporto priemonę įvertina Kronofogden. Pagal platformos tyrimą transporto priemonė vertinama be PVM ir pirkėjas už grąžinimą sąskaitos neišrašo, jei pirkėjas turėjo teisę atskaityti pirkimo PVM, – buhalteris to nepatvirtino, todėl tvarką pasitikrinkite su savo buhalteriu. Pardavėjas praneša Transportstyrelsen apie naują savininką.',
    rateHint:
      'Švedijoje RAHTIS kol kas palūkanų nesiūlo: pirkimo išsimokėtinai palūkanų apmokestinimas PVM neaiškus (Švedijos mokesčių tarnybos šaltiniai skiriasi) ir buhalteris jo nepatvirtino. Palūkanų norma fiksuota – 0.',
  },
  pl: {
    intro:
      'Sprzedaj własny pojazd na raty sprawdzonemu przewoźnikowi albo kup pojazd na raty. RAHTIS przygotowuje umowę według prawa szwedzkiego (avbetalningsköp z zastrzeżeniem prawa odebrania – förbehåll om återtaganderätt, ustawa 1978:599), harmonogram płatności i faktury w imieniu sprzedawcy; kupujący płaci bezpośrednio na rachunek sprzedawcy. Kwoty są w koronach szwedzkich.',
    introSeller:
      'Sprzedaj pojazd na raty sprawdzonemu przewoźnikowi. Dodaj pojazd, który chcesz sprzedać; sprawdzimy jego dane, a po zatwierdzeniu możesz opublikować ogłoszenie. RAHTIS przygotowuje umowę według prawa szwedzkiego (avbetalningsköp z zastrzeżeniem prawa odebrania – förbehåll om återtaganderätt, ustawa 1978:599), harmonogram płatności i faktury w imieniu sprzedawcy; kupujący płaci bezpośrednio na Twój rachunek. Kwoty są w koronach szwedzkich.',
    notAllowed:
      'Sprzęt na raty może sprzedać każda sprawdzona szwedzka firma zarejestrowana w RAHTIS; kupującym jest zawsze sprawdzony szwedzki przewoźnik. Transakcję zawiera główny użytkownik firmy.',
    contract: 'Umowa sprzedaży na raty (PDF, po szwedzku)',
    nextSteps:
      'Przed wydaniem: umowa jest podpisana – kupujący podpisuje własnoręcznie albo co najmniej zaawansowanym podpisem elektronicznym, inaczej umowa nie może być podstawą wniosku do Kronofogden o pomoc (handräckning); pierwsza faktura jest zapłacona; strony podpisały zgłoszenie zmiany właściciela do Transportstyrelsen ze wskazaniem, że pojazd sprzedano na kredyt z zastrzeżeniem prawa odebrania (kreditköp med förbehåll om återtaganderätt), oraz daty końca zastrzeżenia – zgłoszenie musi wpłynąć w ciągu 10 dni od zmiany. W rejestrze właścicielem (ägare) zostaje kupujący; sprzedawca jest widoczny tylko jako kredytodawca (kreditgivare), a ta adnotacja nie przeszkadza kupującemu w dalszej sprzedaży pojazdu. Nie potwierdzono, czy Transportstyrelsen przyjmuje adnotację od sprzedawcy, który nie jest dealerem ani firmą finansową – zapytaj w Transportstyrelsen przed wydaniem. Ubezpieczenie OC (trafikförsäkring) i podatek od pojazdu z mocy ustawy obciążają kupującego; ubezpieczyciel potwierdza na piśmie, że autocasco (vagnskadeförsäkring) działa na rzecz sprzedawcy. Przed zarobkowym przewozem kupujący zgłasza pojazd do Transportstyrelsen w ramach swojej licencji (yrkestrafiktillstånd).',
    invoiceNote:
      'Faktury są wysyłane w formacie PDF w koronach szwedzkich (kr); faktura PDF jest w Szwecji ważna, gdy odbiorca akceptuje faktury elektroniczne. Tytuł płatności to międzynarodowy numer RF: faktury nie mają numeru OCR ani bankgiro, bo wymagają one własnej umowy sprzedawcy z bankiem – kupujący płaci na rachunek sprzedawcy (IBAN) i podaje numer w tytule przelewu.',
    thresholdsText:
      'Zgodnie z § 7 szwedzkiej ustawy (1978:599) sprzedawca może żądać reszty albo odebrać pojazd dopiero wtedy, gdy płatność jest opóźniona o ponad 14 dni, a zaległość przekracza {tenth} (jedna rata) albo przekracza {twentieth} (dwie raty lub więcej o różnych terminach), albo obejmuje całą pozostałą kwotę. Progi to 1/10 i 1/20 wierzytelności kredytowej (kreditfordran: kredytowana część ceny i wszystkie odsetki), a nie ceny. W tej transakcji oznacza to liczbę zaległych rat: {needed}. Podstawy obliczenia nie potwierdził szwedzki prawnik.',
    thresholdTitle: 'Przekroczono próg z ustawy o sprzedaży na raty: {plate}',
    threshold:
      'Zaległe raty przekraczają próg z § 7 ustawy (1978:599) (pkt 9.1 umowy): opóźnienie ponad 14 dni i ponad 1/10 (przy dwóch lub więcej ratach 1/20) wierzytelności kredytowej (kreditfordran) albo cała pozostała kwota. Możesz teraz zażądać na piśmie całej pozostałej kwoty albo odebrać pojazd. Jeżeli kupujący zapłaci zaległość z odsetkami za opóźnienie (dröjsmålsränta) i Twoimi kosztami, zanim pojazd zostanie faktycznie zwrócony, nie możesz ani odebrać pojazdu, ani żądać wcześniejszej zapłaty (§ 8). Przy odebraniu obowiązkowe jest rozliczenie (avräkning). Pojazdu nie wolno zabrać samodzielnie: jeśli kupujący nie wyda go dobrowolnie, złóż do Kronofogden wniosek o pomoc (handräckning); jest ona udzielana tylko wtedy, gdy Twoje prawo jest oczywiste. Blokady rozruchu nie stosuje się do windykacji.',
    checkRegister:
      'Zgłoszenie zmiany właściciela do Transportstyrelsen jest podpisane przez obie strony i wskazuje zakup na kredyt z zastrzeżeniem prawa odebrania oraz datę jego końca; kupujący jest rejestrowany jako właściciel (ägare), sprzedawca jest widoczny jako kredytodawca (kreditgivare).',
    checkInsurance:
      'Ubezpieczenie OC (trafikförsäkring) zawarte przez kupującego obowiązuje od dnia wydania, a ubezpieczyciel potwierdził na piśmie, że autocasco (vagnskadeförsäkring) działa na rzecz sprzedawcy.',
    afterPaid:
      'Własność przeszła na kupującego w dniu zaksięgowania ostatniej płatności na rachunku sprzedawcy. Kupujący jest już zarejestrowanym właścicielem: sprzedawca musi niezwłocznie zgłosić do Transportstyrelsen, że zastrzeżenie prawa odebrania wygasło, i potwierdzić to kupującemu na piśmie.',
    terminationHint:
      'Odnotuj zakończenie, gdy odebrałeś pojazd (kupujący wydał go dobrowolnie albo za pośrednictwem Kronofogden) albo gdy uzgodniłeś z kupującym cofnięcie sprzedaży. Faktury za raty i przypomnienia przestają być wysyłane. Tej operacji nie można cofnąć.',
    reasonRepossessed: 'Sprzedawca odebrał pojazd (återtagande)',
    settlement:
      'RAHTIS nie oblicza ani nie przeprowadza rozliczenia. Rozliczenie (avräkning) według pkt 9.5 umowy i §§ 9–10 ustawy (1978:599) strony przeprowadzają między sobą; w postępowaniu o pomoc pojazd wycenia Kronofogden. Według ustaleń platformy pojazd wycenia się bez VAT, a kupujący nie wystawia faktury za zwrot, jeżeli miał prawo odliczyć VAT od zakupu – nie potwierdził tego księgowy, dlatego sprawdź sposób ujęcia u swojego księgowego. Sprzedawca zgłasza nowego właściciela do Transportstyrelsen.',
    rateHint:
      'W Szwecji RAHTIS na razie nie oferuje odsetek: sposób opodatkowania VAT odsetek przy sprzedaży na raty jest niejasny (źródła szwedzkiego urzędu skarbowego są rozbieżne) i nie został potwierdzony przez księgowego. Stopa jest stała – 0.',
  },
  de: {
    intro:
      'Verkaufen Sie Ihren eigenen Lkw auf Raten an ein geprüftes Transportunternehmen oder kaufen Sie einen Lkw auf Raten. RAHTIS erstellt einen Vertrag nach schwedischem Recht (avbetalningsköp mit Rücknahmevorbehalt – förbehåll om återtaganderätt, Gesetz 1978:599), den Zahlungsplan und die Rechnungen im Namen des Verkäufers; der Käufer zahlt direkt auf das Konto des Verkäufers. Die Beträge lauten auf schwedische Kronen.',
    introSeller:
      'Verkaufen Sie einen Lkw auf Raten an ein geprüftes Transportunternehmen. Fügen Sie das Fahrzeug hinzu, das Sie verkaufen möchten; wir prüfen die Angaben, und nach der Freigabe können Sie ein Angebot veröffentlichen. RAHTIS erstellt einen Vertrag nach schwedischem Recht (avbetalningsköp mit Rücknahmevorbehalt – förbehåll om återtaganderätt, Gesetz 1978:599), den Zahlungsplan und die Rechnungen im Namen des Verkäufers; der Käufer zahlt direkt auf Ihr Konto. Die Beträge lauten auf schwedische Kronen.',
    notAllowed:
      'Fahrzeuge auf Raten verkaufen kann jedes geprüfte schwedische Unternehmen, das bei RAHTIS registriert ist; Käufer ist immer ein geprüftes schwedisches Transportunternehmen. Den Kauf schließt der Hauptnutzer des Unternehmens ab.',
    contract: 'Ratenkaufvertrag (PDF, auf Schwedisch)',
    nextSteps:
      'Vor der Übergabe: Der Vertrag ist unterzeichnet – der Käufer unterschreibt eigenhändig oder mindestens mit fortgeschrittener elektronischer Signatur, sonst kann auf den Vertrag kein Antrag auf Amtshilfe (handräckning) bei Kronofogden gestützt werden; die erste Rechnung ist bezahlt; beide Parteien haben die Anzeige des Eigentümerwechsels an Transportstyrelsen unterzeichnet, mit der Angabe, dass das Fahrzeug als Kreditkauf mit Rücknahmevorbehalt (kreditköp med förbehåll om återtaganderätt) verkauft wurde, und mit dem Enddatum des Vorbehalts – sie muss innerhalb von 10 Tagen nach dem Wechsel eingehen. Im Register wird der Käufer als Eigentümer (ägare) eingetragen; der Verkäufer erscheint nur als Kreditgeber (kreditgivare), und dieser Vermerk hindert den Käufer nicht am Weiterverkauf. Ob Transportstyrelsen den Vermerk von einem Verkäufer annimmt, der kein Fahrzeughändler und kein Finanzierungsunternehmen ist, ist nicht bestätigt – fragen Sie vor der Übergabe bei Transportstyrelsen nach. Kfz-Haftpflichtversicherung (trafikförsäkring) und Kfz-Steuer trägt nach dem Gesetz der Käufer; der Versicherer bestätigt schriftlich, dass die Kaskoversicherung (vagnskadeförsäkring) zugunsten des Verkäufers gilt. Vor dem gewerblichen Güterverkehr meldet der Käufer das Fahrzeug bei Transportstyrelsen unter seiner Lizenz (yrkestrafiktillstånd) an.',
    invoiceNote:
      'Rechnungen werden als PDF in schwedischen Kronen (kr) versandt; eine PDF-Rechnung ist in Schweden gültig, wenn der Empfänger elektronische Rechnungen akzeptiert. Der Verwendungszweck ist eine internationale RF-Referenz: Die Rechnungen tragen keine OCR-Nummer und kein Bankgiro, weil dafür ein eigener Bankvertrag des Verkäufers nötig ist – der Käufer zahlt auf das Konto des Verkäufers (IBAN) und gibt die Referenz als Mitteilung an.',
    thresholdsText:
      'Nach § 7 des schwedischen Gesetzes (1978:599) darf der Verkäufer den Rest erst verlangen oder den Lkw zurücknehmen, wenn eine Zahlung seit mehr als 14 Tagen überfällig ist und mehr als {tenth} (eine Rate) oder mehr als {twentieth} (zwei oder mehr zu verschiedenen Zeitpunkten fällige Raten) im Rückstand sind oder der gesamte Rest. Die Grenzen sind 1/10 und 1/20 der Kreditforderung (kreditfordran: kreditierter Teil des Preises und alle Zinsen), nicht des Preises. Erforderliche Zahl überfälliger Raten bei diesem Kauf: {needed}. Die Berechnungsgrundlage wurde nicht von einem schwedischen Juristen bestätigt.',
    thresholdTitle: 'Schwelle des Ratenkaufgesetzes überschritten: {plate}',
    threshold:
      'Die überfälligen Raten überschreiten die Schwelle des § 7 des Gesetzes (1978:599) (Ziffer 9.1 des Vertrags): mehr als 14 Tage Verzug und mehr als 1/10 (bei zwei oder mehr Raten 1/20) der Kreditforderung (kreditfordran) oder der gesamte Rest. Sie können jetzt schriftlich den gesamten Rest verlangen oder das Fahrzeug zurücknehmen. Zahlt der Käufer den Rückstand mit Verzugszinsen (dröjsmålsränta) und Ihren Kosten, bevor das Fahrzeug tatsächlich zurückgegeben ist, dürfen Sie es weder zurücknehmen noch vorzeitige Zahlung verlangen (§ 8). Bei der Rücknahme ist eine Abrechnung (avräkning) zwingend. Sie dürfen das Fahrzeug nicht selbst an sich nehmen: Gibt der Käufer es nicht freiwillig heraus, beantragen Sie Amtshilfe (handräckning) bei Kronofogden; sie wird nur gewährt, wenn Ihr Recht offensichtlich ist. Eine Wegfahrsperre wird nicht zur Eintreibung von Forderungen eingesetzt.',
    checkRegister:
      'Die Anzeige des Eigentümerwechsels an Transportstyrelsen ist von beiden Parteien unterzeichnet und nennt den Kreditkauf mit Rücknahmevorbehalt und dessen Enddatum; der Käufer wird als Eigentümer (ägare) eingetragen, der Verkäufer erscheint als Kreditgeber (kreditgivare).',
    checkInsurance:
      'Die vom Käufer abgeschlossene Kfz-Haftpflichtversicherung (trafikförsäkring) gilt ab dem Übergabetag, und der Versicherer hat schriftlich bestätigt, dass die Kaskoversicherung (vagnskadeförsäkring) zugunsten des Verkäufers gilt.',
    afterPaid:
      'Das Eigentum ist an dem Tag auf den Käufer übergegangen, an dem die letzte Zahlung auf dem Konto des Verkäufers gebucht wurde. Der Käufer ist bereits als Eigentümer eingetragen: Der Verkäufer muss Transportstyrelsen unverzüglich mitteilen, dass der Rücknahmevorbehalt erloschen ist, und dies dem Käufer schriftlich bestätigen.',
    terminationHint:
      'Erfassen Sie dies, wenn Sie das Fahrzeug zurückgenommen haben (der Käufer hat es freiwillig oder über Kronofogden herausgegeben) oder wenn Sie mit dem Käufer die Rückabwicklung des Kaufs vereinbart haben. Ratenrechnungen und Erinnerungen enden. Der Eintrag kann nicht rückgängig gemacht werden.',
    reasonRepossessed: 'Der Verkäufer hat das Fahrzeug zurückgenommen (återtagande)',
    settlement:
      'RAHTIS berechnet die Abrechnung nicht und führt sie nicht durch. Die Abrechnung (avräkning) nach Ziffer 9.5 des Vertrags und §§ 9–10 des Gesetzes (1978:599) erfolgt zwischen den Parteien; im Amtshilfeverfahren bewertet Kronofogden das Fahrzeug. Nach den Recherchen der Plattform wird das Fahrzeug ohne Umsatzsteuer bewertet und der Käufer stellt für die Rückgabe keine Rechnung aus, wenn er zum Vorsteuerabzug aus dem Kauf berechtigt war – dies wurde nicht von einem Buchhalter bestätigt, klären Sie die Behandlung daher mit Ihrem eigenen. Der Verkäufer meldet den neuen Eigentümer an Transportstyrelsen.',
    rateHint:
      'In Schweden bietet RAHTIS vorerst keine Zinsen an: Die umsatzsteuerliche Behandlung von Zinsen beim Ratenkauf ist unklar (die Quellen der schwedischen Steuerbehörde weichen voneinander ab) und wurde nicht von einem Buchhalter bestätigt. Der Zinssatz ist fest 0.',
  },
  ru: {
    intro:
      'Продайте свою машину в рассрочку проверенному перевозчику или купите машину в рассрочку. RAHTIS готовит договор по шведскому праву (avbetalningsköp с оговоркой о праве возврата — förbehåll om återtaganderätt, закон 1978:599), график платежей и счета от имени продавца; покупатель платит напрямую на счёт продавца. Суммы — в шведских кронах.',
    introSeller:
      'Продайте машину в рассрочку проверенному перевозчику. Добавьте машину, которую хотите продать: мы проверим её данные, и после одобрения вы сможете опубликовать объявление. RAHTIS готовит договор по шведскому праву (avbetalningsköp с оговоркой о праве возврата — förbehåll om återtaganderätt, закон 1978:599), график платежей и счета от имени продавца; покупатель платит напрямую на ваш счёт. Суммы — в шведских кронах.',
    notAllowed:
      'Продать технику в рассрочку может любая проверенная шведская компания, зарегистрированная в RAHTIS; покупатель — всегда проверенный шведский перевозчик. Сделку оформляет главный пользователь компании.',
    contract: 'Договор покупки в рассрочку (PDF, на шведском)',
    nextSteps:
      'До передачи: договор подписан — покупатель подписывает от руки или не менее чем усиленной электронной подписью, иначе по договору нельзя просить помощи Kronofogden (handräckning); первый счёт оплачен; стороны подписали заявление в Transportstyrelsen о смене владельца, где указано, что машина продана в кредит с оговоркой о праве возврата (kreditköp med förbehåll om återtaganderätt), и дата окончания оговорки, — заявление должно поступить в течение 10 дней со смены владельца. В реестре владельцем (ägare) записывается покупатель; продавец виден только как кредитор (kreditgivare), и эта отметка не мешает покупателю перепродать машину. Принимает ли Transportstyrelsen отметку от продавца, который не автодилер и не финансовая компания, не подтверждено — уточните в Transportstyrelsen до передачи. Обязательную страховку (trafikförsäkring) и транспортный налог по закону несёт покупатель; страховщик письменно подтверждает, что каско (vagnskadeförsäkring) действует в пользу продавца. До платных перевозок покупатель заявляет машину в Transportstyrelsen по своей лицензии (yrkestrafiktillstånd).',
    invoiceNote:
      'Счета отправляются в PDF в шведских кронах (kr); счёт в PDF действителен в Швеции, если получатель согласен на электронный счёт. Ссылка платежа — международная RF: номера OCR и bankgiro в счетах нет, для них нужен собственный договор продавца с банком, — покупатель платит на счёт продавца (IBAN) и указывает ссылку в назначении платежа.',
    thresholdsText:
      'По § 7 шведского закона (1978:599) продавец может потребовать остаток или забрать машину, только если платёж просрочен больше 14 дней и просрочено больше {tenth} (один платёж) или больше {twentieth} (два платежа и больше с разными сроками) либо весь остаток. Доли — 1/10 и 1/20 кредитного требования (kreditfordran: часть цены в кредит и все проценты), а не цены. В этой сделке — просроченных платежей: {needed}. Расчёт базы шведский юрист не подтверждал.',
    thresholdTitle: 'Превышен порог закона о рассрочке: {plate}',
    threshold:
      'Просроченные платежи превысили порог § 7 закона (1978:599) (п. 9.1 договора): просрочка больше 14 дней и больше 1/10 (при двух и более платежах — 1/20) кредитного требования (kreditfordran) либо весь остаток. Теперь вы можете письменно потребовать весь остаток или забрать машину. Если покупатель оплатит просроченное с пенями (dröjsmålsränta) и вашими расходами до того, как машина фактически возвращена, вы не вправе ни забирать её, ни требовать досрочной оплаты (§ 8). При возврате обязателен расчёт (avräkning). Забирать машину самому нельзя: если покупатель не отдаёт её добровольно, подайте в Kronofogden заявление о помощи (handräckning); её дают, только когда ваше право очевидно. Блокировка запуска двигателя для взыскания не применяется.',
    checkRegister:
      'Заявление в Transportstyrelsen о смене владельца подписано обеими сторонами, в нём указаны покупка в кредит с оговоркой о праве возврата и дата её окончания; покупатель записывается владельцем (ägare), продавец виден как кредитор (kreditgivare).',
    checkInsurance:
      'Обязательная страховка (trafikförsäkring), оформленная покупателем, действует с даты передачи, и страховщик письменно подтвердил, что каско (vagnskadeförsäkring) действует в пользу продавца.',
    afterPaid:
      'Право собственности перешло к покупателю в день, когда последний платёж зачислен на счёт продавца. Покупатель уже записан владельцем: продавец обязан сразу сообщить в Transportstyrelsen, что оговорка о праве возврата прекратилась, и письменно подтвердить это покупателю.',
    terminationHint:
      'Отметьте прекращение сделки, когда вы забрали машину (покупатель отдал её добровольно или через Kronofogden) или когда вы договорились с покупателем отменить покупку. Счета на платежи и напоминания прекратятся. Отменить отметку нельзя.',
    reasonRepossessed: 'Продавец забрал машину (återtagande)',
    settlement:
      'RAHTIS не считает и не проводит расчёт. Расчёт (avräkning) по п. 9.5 договора и §§ 9–10 закона (1978:599) стороны проводят между собой; при обращении за помощью машину оценивает Kronofogden. По исследованию платформы машина оценивается без НДС и покупатель не выставляет счёт за возврат, если у него было право на вычет НДС с покупки, — бухгалтер этого не подтверждал, поэтому уточните порядок у своего. Продавец сообщает о новом владельце в Transportstyrelsen.',
    rateHint:
      'В Швеции RAHTIS пока не предлагает проценты: как проценты при покупке в рассрочку облагаются НДС, неясно (источники шведской налоговой расходятся), и бухгалтер этого не подтверждал. Ставка всегда 0.',
  },
  ro: {
    intro:
      'Vindeți propriul camion cu plata în rate unui transportator verificat sau cumpărați un camion în rate. RAHTIS întocmește un contract conform dreptului suedez (avbetalningsköp cu rezerva dreptului de reluare – förbehåll om återtaganderätt, legea 1978:599), graficul de plăți și facturile în numele vânzătorului; cumpărătorul plătește direct în contul vânzătorului. Sumele sunt în coroane suedeze.',
    introSeller:
      'Vindeți un camion cu plata în rate unui transportator verificat. Adăugați vehiculul pe care doriți să îl vindeți; îi verificăm datele, iar după aprobare puteți publica un anunț. RAHTIS întocmește un contract conform dreptului suedez (avbetalningsköp cu rezerva dreptului de reluare – förbehåll om återtaganderätt, legea 1978:599), graficul de plăți și facturile în numele vânzătorului; cumpărătorul plătește direct în contul dumneavoastră. Sumele sunt în coroane suedeze.',
    notAllowed:
      'Orice firmă suedeză verificată, înregistrată în RAHTIS, poate vinde echipamente în rate; cumpărătorul este întotdeauna un transportator suedez verificat. Vânzarea o încheie utilizatorul principal al firmei.',
    contract: 'Contract de cumpărare în rate (PDF, în suedeză)',
    nextSteps:
      'Înainte de predare: contractul este semnat – cumpărătorul semnează olograf sau cel puțin cu semnătură electronică avansată, altfel contractul nu poate sta la baza unei cereri de asistență (handräckning) la Kronofogden; prima factură este plătită; părțile au semnat notificarea de schimbare a proprietarului către Transportstyrelsen, cu mențiunea că vehiculul a fost vândut pe credit cu rezerva dreptului de reluare (kreditköp med förbehåll om återtaganderätt) și cu data de sfârșit a rezervei – notificarea trebuie să ajungă în 10 zile de la schimbare. În registru, proprietar (ägare) este înscris cumpărătorul; vânzătorul apare doar ca creditor (kreditgivare), iar această mențiune nu îl împiedică pe cumpărător să revândă vehiculul. Nu este confirmat că Transportstyrelsen acceptă mențiunea de la un vânzător care nu este dealer auto sau societate de finanțare – întrebați la Transportstyrelsen înainte de predare. Asigurarea obligatorie de răspundere civilă auto (trafikförsäkring) și taxa pe vehicul revin prin lege cumpărătorului; asigurătorul confirmă în scris că asigurarea casco (vagnskadeförsäkring) este în favoarea vânzătorului. Înainte de transportul de mărfuri contra cost, cumpărătorul declară vehiculul la Transportstyrelsen pe licența sa (yrkestrafiktillstånd).',
    invoiceNote:
      'Facturile se trimit în format PDF, în coroane suedeze (kr); factura PDF este valabilă în Suedia dacă destinatarul acceptă facturi electronice. Referința de plată este o referință internațională RF: facturile nu au număr OCR și nici bankgiro, deoarece acestea necesită un contract propriu al vânzătorului cu banca – cumpărătorul plătește în contul vânzătorului (IBAN) și trece referința la detaliile plății.',
    thresholdsText:
      'Potrivit articolului 7 din legea suedeză (1978:599), vânzătorul poate cere restul sau poate relua camionul numai după ce o plată este restantă de mai mult de 14 zile și suma restantă depășește {tenth} (o rată) sau depășește {twentieth} (două sau mai multe rate cu scadențe diferite) ori reprezintă întregul rest. Limitele sunt 1/10 și 1/20 din creanța de credit (kreditfordran: partea din preț acordată pe credit și toate dobânzile), nu din preț. În această tranzacție, numărul de rate restante necesar este {needed}. Baza de calcul nu a fost confirmată de un jurist suedez.',
    thresholdTitle: 'Pragul din legea vânzării în rate a fost depășit: {plate}',
    threshold:
      'Ratele restante depășesc pragul de la articolul 7 din lege (1978:599) (punctul 9.1 din contract): întârziere de peste 14 zile și peste 1/10 (1/20 la două sau mai multe rate) din creanța de credit (kreditfordran) ori întregul rest. Puteți acum cere în scris întregul rest sau puteți relua vehiculul. Dacă cumpărătorul plătește suma restantă cu dobânda de întârziere (dröjsmålsränta) și cheltuielile dumneavoastră înainte ca vehiculul să fie efectiv restituit, nu puteți nici să îl reluați, nici să cereți plata anticipată (articolul 8). La reluare este obligatorie decontarea (avräkning). Nu puteți lua singur vehiculul: dacă cumpărătorul nu îl predă de bunăvoie, cereți asistență (handräckning) la Kronofogden; aceasta se acordă numai când dreptul dumneavoastră este evident. Imobilizatorul nu se folosește pentru recuperarea datoriilor.',
    checkRegister:
      'Notificarea de schimbare a proprietarului către Transportstyrelsen este semnată de ambele părți și menționează cumpărarea pe credit cu rezerva dreptului de reluare și data ei de sfârșit; cumpărătorul este înscris ca proprietar (ägare), vânzătorul apare ca creditor (kreditgivare).',
    checkInsurance:
      'Asigurarea obligatorie de răspundere civilă auto (trafikförsäkring) încheiată de cumpărător este valabilă de la data predării, iar asigurătorul a confirmat în scris că asigurarea casco (vagnskadeförsäkring) este în favoarea vânzătorului.',
    afterPaid:
      'Proprietatea a trecut la cumpărător în ziua în care ultima plată a fost înregistrată în contul vânzătorului. Cumpărătorul este deja proprietarul înscris: vânzătorul trebuie să anunțe imediat Transportstyrelsen că rezerva dreptului de reluare a încetat și să confirme acest lucru în scris cumpărătorului.',
    terminationHint:
      'Înregistrați încetarea după ce ați reluat vehiculul (cumpărătorul l-a predat de bunăvoie sau prin Kronofogden) ori după ce ați convenit cu cumpărătorul desființarea vânzării. Facturile pentru rate și notificările se opresc. Înregistrarea nu poate fi anulată.',
    reasonRepossessed: 'Vânzătorul a reluat vehiculul (återtagande)',
    settlement:
      'RAHTIS nu calculează și nu efectuează decontarea. Decontarea (avräkning) potrivit punctului 9.5 din contract și articolelor 9–10 din lege (1978:599) se face între părți; în procedura de asistență, vehiculul este evaluat de Kronofogden. Potrivit cercetării platformei, vehiculul se evaluează fără TVA, iar cumpărătorul nu emite factură pentru restituire dacă a avut drept de deducere a TVA la cumpărare – acest lucru nu a fost confirmat de un contabil, așa că verificați tratamentul cu contabilul dumneavoastră. Vânzătorul anunță noul proprietar la Transportstyrelsen.',
    rateHint:
      'În Suedia, RAHTIS nu oferă deocamdată dobândă: tratamentul de TVA al dobânzii la cumpărarea în rate este neclar (sursele autorității fiscale suedeze diferă) și nu a fost confirmat de un contabil. Rata este fixă, 0.',
  },
};
