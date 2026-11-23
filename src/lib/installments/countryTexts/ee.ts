import type { Locale } from '../../i18n/config.ts';
import type { InstallmentLawCopy } from './types.ts';

/**
 * Эстония — тексты кабинета на десяти языках (23.11.2026). Источник фактов —
 * docs/equipment-sale/countries/ee.md:
 *   · специального закона о рассрочке нет: договор по võlaõigusseadus, § 233;
 *   · порогов в законе нет — их задаёт договор (п. 9.1), затем дополнительный
 *     срок не короче 14 дней (täiendav tähtaeg, § 114) и только потом отказ
 *     от договора (taganemine); забрать машину самому нельзя — добровольно
 *     по акту либо через суд и kohtutäitur;
 *   · реестр — liiklusregister (Transpordiamet): продавец omanik, покупатель
 *     vastutav kasutaja, пять рабочих дней; ОСАГО оформляет покупатель;
 *   · e-arve: покупатель из äriregister вправе требовать машиночитаемый счёт.
 * Исследование не проверено эстонским юристом: формулировки не обещают
 * результата в суде и не называют расчёт «законным».
 * Тексты носителем языка не вычитаны — вычитать до рекламы раздела.
 */
export const EE_TEXTS: Record<Locale, InstallmentLawCopy> = {
  fi: {
    intro:
      'Myy oma auto osamaksulla tarkastetulle kuljetusliikkeelle tai osta auto osamaksulla. RAHTIS laatii Viron lain mukaisen sopimuksen (omistuksenpidätysehtoinen kauppa, võlaõigusseadus § 233), maksusuunnitelman ja laskut myyjän nimissä; ostaja maksaa suoraan myyjän tilille.',
    introSeller:
      'Myy auto osamaksulla tarkastetulle kuljetusliikkeelle. Lisää myytävä auto, me tarkastamme sen tiedot, ja hyväksynnän jälkeen voit julkaista myynti-ilmoituksen. RAHTIS laatii Viron lain mukaisen sopimuksen (omistuksenpidätysehtoinen kauppa, võlaõigusseadus § 233), maksusuunnitelman ja laskut myyjän nimissä; ostaja maksaa suoraan tilillesi.',
    notAllowed:
      'Kalustoa voi myydä osamaksulla jokainen RAHTIKSEEN rekisteröitynyt ja tarkastettu virolainen yritys, ja ostajana on aina tarkastettu virolainen kuljetusliike. Kaupan tekee yrityksen pääkäyttäjä.',
    contract: 'Osamaksusopimus (PDF, viroksi)',
    nextSteps:
      'Ennen luovutusta: sopimus allekirjoitettu, ensimmäinen lasku maksettu, ostaja merkitty Viron liikennerekisteriin (liiklusregister, Transpordiamet) vastuulliseksi käyttäjäksi (vastutav kasutaja) ja myyjä edelleen omistajana – hakemuksen tekee myyjä ostajan kirjallisella suostumuksella viiden työpäivän kuluessa muutoksesta; ostaja on ottanut pakollisen liikennevakuutuksen (liikluskindlustus) luovutuspäivästä alkaen ja kaskovakuutukseen on merkitty edunsaajaksi myyjä. Ennen maksullista tavarankuljetusta ostaja hankkii autolle liikenneluvan jäljennöksen (tegevusloa ärakiri).',
    invoiceNote:
      'Laskut lähetetään PDF-muodossa. Jos ostaja on merkitty kaupparekisteriin (äriregister) verkkolaskun vastaanottajaksi ja vaatii verkkolaskun (e-arve), myyjän on lähetettävä koneluettava lasku omasta taloushallinto-ohjelmastaan – RAHTIS ei laadi verkkolaskuja.',
    thresholdsText:
      'Viron laissa ei ole valmiita rajoja; ne tulevat sopimuksesta (kohta 9.1). Myyjä voi ryhtyä purkamaan kauppaa vasta, kun maksu on ollut myöhässä vähintään 14 päivää ja myöhässä on vähintään {tenth} (yksi erä) tai {twentieth} (kaksi tai useampia eriä) – tässä kaupassa se tarkoittaa {needed} erän viivästystä. Sen jälkeen myyjän on annettava kirjallisesti vähintään 14 päivän lisäaika; vasta sen päätyttyä myyjä voi purkaa sopimuksen ja vaatia auton takaisin.',
    thresholdTitle: 'Sopimuksen raja täyttyy: {plate}',
    threshold:
      'Myöhässä olevat erät täyttävät sopimuksen kohdan 9.1 rajan. Seuraava vaihe on kirjallinen, vähintään 14 päivän lisäaika maksulle (täiendav tähtaeg, VÕS § 114). Vasta jos se päättyy ilman maksua, voit vaatia koko loppuosan tai purkaa sopimuksen ja vaatia auton takaisin. Autoa ei saa ottaa itse: se palautetaan vapaaehtoisesti palautuspöytäkirjalla tai tuomioistuimen ja ulosottomiehen (kohtutäitur) kautta. Käynnistyksenestoa ei käytetä perintään.',
    checkRegister: 'Ostaja on merkitty liikennerekisteriin (Transpordiamet) vastuulliseksi käyttäjäksi (vastutav kasutaja), myyjä on edelleen omistaja.',
    checkInsurance: 'Ostajan ottama pakollinen liikennevakuutus (liikluskindlustus) on voimassa luovutuspäivästä, ja kaskovakuutukseen on merkitty edunsaajaksi myyjä.',
    afterPaid:
      'Omistusoikeus siirtyi ostajalle viimeisen maksun päivänä. Osapuolet tekevät viiden työpäivän kuluessa Transpordiametille yhteisen hakemuksen ostajan merkitsemiseksi omistajaksi, tai myyjä ilmoittaa luovutuksesta ja ostaja hakee muutosta.',
    terminationHint:
      'Kirjaa kauppa päättyneeksi, kun olet purkanut sopimuksen ja auto on palautettu sinulle (vapaaehtoisesti tai tuomioistuimen ja ulosottomiehen kautta) tai kun olette sopineet ostajan kanssa kaupan purkamisesta. Maksuerien laskutus ja muistutukset loppuvat. Merkintää ei voi perua.',
    reasonRepossessed: 'Myyjä on purkanut sopimuksen ja auto on palautettu',
    settlement:
      'RAHTIS ei laske eikä toimita lopputilitystä. Sopimuksen kohdan 9.6 mukainen lopputilitys (lõpparveldus) tehdään osapuolten kesken; riidan ratkaisee tuomioistuin. Palautuksen arvonlisäverokäsittely (hyvityslasku tai takaisinmyynti) sovitaan kirjanpitäjän kanssa. Ostaja hakee itsensä poistamista liikennerekisteristä vastuullisena käyttäjänä viiden työpäivän kuluessa palautuksesta.',
  },
  en: {
    intro:
      'Sell your own truck in instalments to a verified carrier, or buy one in instalments. RAHTIS prepares a contract under Estonian law (sale with retention of title, võlaõigusseadus § 233), the payment plan and the invoices in the seller’s name; the buyer pays straight to the seller’s account.',
    introSeller:
      'Sell a truck in instalments to a verified carrier. Add the vehicle you want to sell; we check its details, and once it is approved you can publish a listing. RAHTIS prepares a contract under Estonian law (sale with retention of title, võlaõigusseadus § 233), the payment plan and the invoices in the seller’s name; the buyer pays straight to your account.',
    notAllowed:
      'Any verified Estonian company registered in RAHTIS can sell equipment in instalments; the buyer is always a verified Estonian carrier. The sale is made by the company’s main user.',
    contract: 'Instalment sale contract (PDF, in Estonian)',
    nextSteps:
      'Before handover: contract signed, first invoice paid, the buyer entered in the Estonian traffic register (liiklusregister, Transpordiamet) as responsible user (vastutav kasutaja) while the seller stays the owner – the seller applies with the buyer’s written consent within 5 working days of the change; compulsory motor insurance (liikluskindlustus) taken out by the buyer from the handover date, and the seller named as beneficiary on the comprehensive (kasko) policy. Before carrying goods for hire the buyer obtains a copy of its operating licence for the vehicle (tegevusloa ärakiri).',
    invoiceNote:
      'Invoices are sent as PDF. If the buyer is marked in the business register (äriregister) as an e-invoice recipient and asks for an e-invoice (e-arve), the seller must send a machine-readable invoice from its own accounting software – RAHTIS does not produce e-invoices.',
    thresholdsText:
      'Estonian law sets no default thresholds; they come from the contract (clause 9.1). The seller may start ending the sale only after a payment has been overdue for at least 14 days and at least {tenth} (one instalment) or {twentieth} (two or more) is overdue – in this deal: overdue instalments needed – {needed}. The seller must then give a written additional period of at least 14 days; only after it has passed may the seller withdraw from the contract and ask for the truck back.',
    thresholdTitle: 'Contract threshold reached: {plate}',
    threshold:
      'The overdue instalments meet the threshold of clause 9.1 of the contract. The next step is a written additional period of at least 14 days for payment (täiendav tähtaeg, VÕS § 114). Only if it passes without payment may you demand the whole remainder or withdraw from the contract and ask for the vehicle back. You may not take the vehicle yourself: it is returned voluntarily under a return record, or through a court and a bailiff (kohtutäitur). The immobiliser is not used for debt collection.',
    checkRegister: 'The buyer is entered in the traffic register (Transpordiamet) as responsible user (vastutav kasutaja); the seller remains the owner.',
    checkInsurance: 'Compulsory motor insurance (liikluskindlustus) taken out by the buyer is in force from the handover date, and the seller is named as beneficiary on the comprehensive (kasko) policy.',
    afterPaid:
      'Ownership passed to the buyer on the day of the last payment. Within 5 working days the parties file a joint application with Transpordiamet to register the buyer as owner, or the seller reports the transfer and the buyer applies for the change.',
    terminationHint:
      'Record this when you have withdrawn from the contract and the vehicle has been returned to you (voluntarily or through a court and a bailiff), or when you and the buyer have agreed to end the sale. Instalment invoices and reminders stop. This cannot be undone.',
    reasonRepossessed: 'The seller withdrew from the contract and the vehicle was returned',
    settlement:
      'RAHTIS does not calculate or carry out the settlement. The final settlement (lõpparveldus) under clause 9.6 of the contract is made between the parties; a dispute is decided by a court. How VAT is handled on the return (credit invoice or resale) is agreed with an accountant. The buyer applies to be removed from the traffic register as responsible user within 5 working days of the return.',
  },
  sv: {
    intro:
      'Sälj din egen bil på avbetalning till ett kontrollerat åkeri eller köp en bil på avbetalning. RAHTIS upprättar ett avtal enligt estnisk lag (köp med äganderättsförbehåll, võlaõigusseadus § 233), en betalningsplan och fakturor i säljarens namn; köparen betalar direkt till säljarens konto.',
    introSeller:
      'Sälj en bil på avbetalning till ett kontrollerat åkeri. Lägg till bilen du vill sälja; vi kontrollerar uppgifterna, och när den har godkänts kan du publicera en annons. RAHTIS upprättar ett avtal enligt estnisk lag (köp med äganderättsförbehåll, võlaõigusseadus § 233), en betalningsplan och fakturor i säljarens namn; köparen betalar direkt till ditt konto.',
    notAllowed:
      'Varje kontrollerat estniskt företag som är registrerat i RAHTIS kan sälja fordon på avbetalning; köparen är alltid ett kontrollerat estniskt åkeri. Köpet görs av företagets huvudanvändare.',
    contract: 'Avbetalningsavtal (PDF, på estniska)',
    nextSteps:
      'Före överlämnandet: avtalet undertecknat, första fakturan betald, köparen införd i det estniska trafikregistret (liiklusregister, Transpordiamet) som ansvarig användare (vastutav kasutaja) och säljaren kvar som ägare – säljaren ansöker med köparens skriftliga samtycke inom 5 arbetsdagar från ändringen; köparen har tecknat obligatorisk trafikförsäkring (liikluskindlustus) från överlämnandedagen och säljaren står som förmånstagare i kaskoförsäkringen. Före yrkesmässig godstransport skaffar köparen en kopia av trafiktillståndet för bilen (tegevusloa ärakiri).',
    invoiceNote:
      'Fakturorna skickas som PDF. Om köparen är antecknad i handelsregistret (äriregister) som mottagare av e-fakturor och begär e-faktura (e-arve), måste säljaren skicka en maskinläsbar faktura från sitt eget ekonomiprogram – RAHTIS skapar inga e-fakturor.',
    thresholdsText:
      'Estnisk lag har inga färdiga gränser; de kommer från avtalet (punkt 9.1). Säljaren får börja avsluta köpet först när en betalning har varit försenad i minst 14 dagar och minst {tenth} (en delbetalning) eller {twentieth} (två eller flera) är försenat – antal försenade delbetalningar som krävs i det här köpet: {needed}. Därefter måste säljaren ge en skriftlig tilläggsfrist på minst 14 dagar; först när den har löpt ut får säljaren häva avtalet och kräva tillbaka bilen.',
    thresholdTitle: 'Avtalets gräns är nådd: {plate}',
    threshold:
      'De försenade delbetalningarna når gränsen i avtalets punkt 9.1. Nästa steg är en skriftlig tilläggsfrist på minst 14 dagar för betalning (täiendav tähtaeg, VÕS § 114). Först om den löper ut utan betalning får du kräva hela återstoden eller häva avtalet och kräva tillbaka fordonet. Du får inte själv ta fordonet: det lämnas tillbaka frivilligt med ett protokoll eller via domstol och exekutor (kohtutäitur). Startspärr används inte för indrivning.',
    checkRegister: 'Köparen är införd i trafikregistret (Transpordiamet) som ansvarig användare (vastutav kasutaja); säljaren är fortfarande ägare.',
    checkInsurance: 'Den obligatoriska trafikförsäkringen (liikluskindlustus) som köparen har tecknat gäller från överlämnandedagen, och säljaren står som förmånstagare i kaskoförsäkringen.',
    afterPaid:
      'Äganderätten övergick till köparen den dag den sista betalningen kom in. Inom 5 arbetsdagar lämnar parterna en gemensam ansökan till Transpordiamet om att köparen registreras som ägare, eller så anmäler säljaren överlåtelsen och köparen ansöker om ändringen.',
    terminationHint:
      'Registrera detta när du har hävt avtalet och fordonet har lämnats tillbaka till dig (frivilligt eller via domstol och exekutor), eller när du och köparen har kommit överens om att avsluta köpet. Fakturor för delbetalningar och påminnelser upphör. Det går inte att ångra.',
    reasonRepossessed: 'Säljaren har hävt avtalet och fordonet har lämnats tillbaka',
    settlement:
      'RAHTIS beräknar eller genomför inte avräkningen. Slutavräkningen (lõpparveldus) enligt avtalets punkt 9.6 görs mellan parterna; en tvist avgörs av domstol. Hur momsen hanteras vid återlämnandet (kreditfaktura eller återförsäljning) bestäms tillsammans med en redovisare. Köparen ansöker om att strykas ur trafikregistret som ansvarig användare inom 5 arbetsdagar från återlämnandet.',
  },
  et: {
    intro:
      'Müüge oma veok järelmaksuga kontrollitud veoettevõtjale või ostke veok järelmaksuga. RAHTIS koostab Eesti õiguse kohase lepingu (omandireservatsiooniga müügileping, võlaõigusseadus § 233), maksegraafiku ja arved müüja nimel; ostja tasub otse müüja kontole.',
    introSeller:
      'Müüge veok järelmaksuga kontrollitud veoettevõtjale. Lisage müüdav veok; kontrollime selle andmed ja pärast heakskiitmist saate avaldada müügikuulutuse. RAHTIS koostab Eesti õiguse kohase lepingu (omandireservatsiooniga müügileping, võlaõigusseadus § 233), maksegraafiku ja arved müüja nimel; ostja tasub otse teie kontole.',
    notAllowed:
      'Järelmaksuga saab tehnikat müüa iga RAHTISes registreeritud ja kontrollitud Eesti ettevõte; ostja on alati kontrollitud Eesti veoettevõtja. Tehingu teeb ettevõtte peakasutaja.',
    contract: 'Järelmaksuga müügi leping (PDF)',
    nextSteps:
      'Enne üleandmist: leping allkirjastatud, esimene arve tasutud, ostja kantud liiklusregistrisse (Transpordiamet) vastutava kasutajana ja müüja jätkuvalt omanikuna – taotluse esitab müüja ostja kirjalikul nõusolekul viie tööpäeva jooksul andmete muutumisest; ostja on sõlminud kohustusliku liikluskindlustuse lepingu alates üleandmise päevast ja kaskokindlustuses on müüja märgitud soodustatud isikuks. Enne tasulist veosevedu taotleb ostja sõidukile tegevusloa ärakirja.',
    invoiceNote:
      'Arved saadetakse PDF-vormingus. Kui ostja on äriregistris märgitud e-arve vastuvõtjaks ja nõuab e-arvet, peab müüja saatma masintöödeldava arve oma raamatupidamistarkvarast – RAHTIS e-arveid ei koosta.',
    thresholdsText:
      'Eesti seadus valmis lävesid ette ei näe; need tulenevad lepingust (punkt 9.1). Müüja võib asuda tehingut lõpetama alles siis, kui makse on olnud vähemalt 14 päeva hilinenud ja hilinenud on vähemalt {tenth} (üks osamakse) või {twentieth} (kaks või rohkem osamakset) – selles tehingus tähendab see {needed} osamakse hilinemist. Seejärel peab müüja andma kirjaliku täiendava tähtaja vähemalt 14 päeva; alles pärast selle möödumist võib müüja lepingust taganeda ja nõuda veoki tagastamist.',
    thresholdTitle: 'Lepinguline lävi on täitunud: {plate}',
    threshold:
      'Hilinenud osamaksed täidavad lepingu punkti 9.1 läve. Järgmine samm on kirjalik täiendav tähtaeg tasumiseks, vähemalt 14 päeva (VÕS § 114). Alles siis, kui see möödub tasumata, võite nõuda kogu jäägi tasumist või lepingust taganeda ja nõuda sõiduki tagastamist. Sõidukit ei tohi ise ära võtta: see tagastatakse vabatahtlikult akti alusel või kohtu ja kohtutäituri kaudu. Käivitustõket võla sissenõudmiseks ei kasutata.',
    checkRegister: 'Ostja on kantud liiklusregistrisse (Transpordiamet) vastutava kasutajana, müüja on jätkuvalt omanik.',
    checkInsurance: 'Ostja sõlmitud kohustuslik liikluskindlustus kehtib üleandmise päevast ja kaskokindlustuses on müüja märgitud soodustatud isikuks.',
    afterPaid:
      'Omand läks ostjale üle viimase makse laekumise päeval. Pooled esitavad viie tööpäeva jooksul Transpordiametile ühise taotluse ostja kandmiseks omanikuna või teatab müüja võõrandamisest ja ostja esitab taotluse andmete muutmiseks.',
    terminationHint:
      'Märkige tehing lõppenuks, kui olete lepingust taganenud ja sõiduk on teile tagastatud (vabatahtlikult või kohtu ja kohtutäituri kaudu) või kui olete ostjaga kokku leppinud tehingu lõpetamises. Osamaksete arved ja meeldetuletused lõpevad. Märget ei saa tagasi võtta.',
    reasonRepossessed: 'Müüja taganes lepingust ja sõiduk on tagastatud',
    settlement:
      'RAHTIS lõpparveldust ei arvuta ega tee. Lepingu punkti 9.6 kohane lõpparveldus tehakse poolte vahel; vaidluse lahendab kohus. Tagastamise käibemaksu vormistus (kreeditarve või tagasimüük) otsustatakse koos raamatupidajaga. Ostja taotleb enda kustutamist liiklusregistrist vastutava kasutajana viie tööpäeva jooksul tagastamisest.',
  },
  lv: {
    intro:
      'Pārdodiet savu automašīnu uz nomaksu pārbaudītam pārvadātājam vai iegādājieties automašīnu uz nomaksu. RAHTIS sagatavo līgumu saskaņā ar Igaunijas tiesībām (pirkums ar īpašuma tiesību paturēšanu, võlaõigusseadus § 233), maksājumu grafiku un rēķinus pārdevēja vārdā; pircējs maksā tieši uz pārdevēja kontu.',
    introSeller:
      'Pārdodiet automašīnu uz nomaksu pārbaudītam pārvadātājam. Pievienojiet pārdodamo automašīnu; mēs pārbaudīsim tās datus, un pēc apstiprināšanas varēsiet publicēt sludinājumu. RAHTIS sagatavo līgumu saskaņā ar Igaunijas tiesībām (pirkums ar īpašuma tiesību paturēšanu, võlaõigusseadus § 233), maksājumu grafiku un rēķinus pārdevēja vārdā; pircējs maksā tieši uz jūsu kontu.',
    notAllowed:
      'Tehniku uz nomaksu var pārdot jebkurš RAHTIS reģistrēts un pārbaudīts Igaunijas uzņēmums; pircējs vienmēr ir pārbaudīts Igaunijas pārvadātājs. Darījumu noformē uzņēmuma galvenais lietotājs.',
    contract: 'Nomaksas pirkuma līgums (PDF, igauņu valodā)',
    nextSteps:
      'Pirms nodošanas: līgums parakstīts, pirmais rēķins samaksāts, pircējs ierakstīts Igaunijas satiksmes reģistrā (liiklusregister, Transpordiamet) kā atbildīgais lietotājs (vastutav kasutaja), bet pārdevējs joprojām ir īpašnieks – iesniegumu iesniedz pārdevējs ar pircēja rakstveida piekrišanu 5 darbdienu laikā pēc izmaiņām; pircējs ir noslēdzis obligāto transportlīdzekļa apdrošināšanu (liikluskindlustus) no nodošanas dienas, un KASKO polisē pārdevējs norādīts kā labuma guvējs. Pirms komercpārvadājumiem pircējs saņem automašīnai darbības atļaujas kopiju (tegevusloa ärakiri).',
    invoiceNote:
      'Rēķinus nosūta PDF formātā. Ja pircējs komercreģistrā (äriregister) ir atzīmēts kā e-rēķinu saņēmējs un pieprasa e-rēķinu (e-arve), pārdevējam jānosūta mašīnlasāms rēķins no savas grāmatvedības programmas – RAHTIS e-rēķinus nesagatavo.',
    thresholdsText:
      'Igaunijas likumā gatavu sliekšņu nav; tie izriet no līguma (9.1. punkts). Pārdevējs var sākt darījuma izbeigšanu tikai tad, ja maksājums kavēts vismaz 14 dienas un nokavēti ir vismaz {tenth} (viens maksājums) vai {twentieth} (divi vai vairāk maksājumi) – šajā darījumā tam vajadzīgais nokavēto maksājumu skaits: {needed}. Pēc tam pārdevējam rakstveidā jādod papildu termiņš, vismaz 14 dienas; tikai pēc tā beigām pārdevējs var atkāpties no līguma un prasīt automašīnas atdošanu.',
    thresholdTitle: 'Līguma slieksnis sasniegts: {plate}',
    threshold:
      'Nokavētie maksājumi sasniedz līguma 9.1. punkta slieksni. Nākamais solis ir rakstveida papildu termiņš samaksai, vismaz 14 dienas (täiendav tähtaeg, VÕS § 114). Tikai tad, ja tas paiet bez samaksas, varat prasīt visu atlikumu vai atkāpties no līguma un prasīt transportlīdzekļa atdošanu. Transportlīdzekli nedrīkst paņemt pašam: to atdod labprātīgi ar aktu vai ar tiesas un tiesu izpildītāja (kohtutäitur) starpniecību. Iedarbināšanas bloķēšanu parāda piedziņai neizmanto.',
    checkRegister: 'Pircējs ir ierakstīts satiksmes reģistrā (Transpordiamet) kā atbildīgais lietotājs (vastutav kasutaja); pārdevējs joprojām ir īpašnieks.',
    checkInsurance: 'Pircēja noslēgtā obligātā transportlīdzekļa apdrošināšana (liikluskindlustus) ir spēkā no nodošanas dienas, un KASKO polisē pārdevējs norādīts kā labuma guvējs.',
    afterPaid:
      'Īpašuma tiesības pārgāja pircējam pēdējā maksājuma saņemšanas dienā. Puses 5 darbdienu laikā iesniedz Transpordiamet kopīgu iesniegumu par pircēja reģistrāciju īpašnieka statusā, vai arī pārdevējs paziņo par atsavināšanu un pircējs iesniedz iesniegumu par datu maiņu.',
    terminationHint:
      'Reģistrējiet darījuma izbeigšanos, kad esat atkāpies no līguma un transportlīdzeklis jums ir atdots (labprātīgi vai ar tiesas un tiesu izpildītāja starpniecību) vai kad esat ar pircēju vienojušies izbeigt darījumu. Maksājumu rēķini un atgādinājumi tiek pārtraukti. Atzīmi nevar atsaukt.',
    reasonRepossessed: 'Pārdevējs atkāpās no līguma, un transportlīdzeklis ir atdots',
    settlement:
      'RAHTIS neaprēķina un neveic norēķinu. Galīgo norēķinu (lõpparveldus) saskaņā ar līguma 9.6. punktu puses veic savā starpā; strīdu izšķir tiesa. PVN noformēšanu, atdodot transportlīdzekli (kredītrēķins vai atpakaļpārdošana), saskaņo ar grāmatvedi. Pircējs 5 darbdienu laikā pēc atdošanas lūdz svītrot sevi no satiksmes reģistra kā atbildīgo lietotāju.',
  },
  lt: {
    intro:
      'Parduokite savo sunkvežimį išsimokėtinai patikrintam vežėjui arba pirkite sunkvežimį išsimokėtinai. RAHTIS parengia sutartį pagal Estijos teisę (pirkimas–pardavimas su nuosavybės teisės išlaikymu, võlaõigusseadus § 233), mokėjimų grafiką ir sąskaitas pardavėjo vardu; pirkėjas moka tiesiai į pardavėjo sąskaitą.',
    introSeller:
      'Parduokite sunkvežimį išsimokėtinai patikrintam vežėjui. Pridėkite parduodamą sunkvežimį; patikrinsime jo duomenis, o jį patvirtinus galėsite paskelbti skelbimą. RAHTIS parengia sutartį pagal Estijos teisę (pirkimas–pardavimas su nuosavybės teisės išlaikymu, võlaõigusseadus § 233), mokėjimų grafiką ir sąskaitas pardavėjo vardu; pirkėjas moka tiesiai į jūsų sąskaitą.',
    notAllowed:
      'Techniką išsimokėtinai gali parduoti kiekviena RAHTIS užregistruota ir patikrinta Estijos įmonė; pirkėjas visada yra patikrintas Estijos vežėjas. Sandorį sudaro pagrindinis įmonės naudotojas.',
    contract: 'Pirkimo išsimokėtinai sutartis (PDF, estų kalba)',
    nextSteps:
      'Iki perdavimo: sutartis pasirašyta, pirmoji sąskaita apmokėta, pirkėjas įrašytas į Estijos eismo registrą (liiklusregister, Transpordiamet) kaip atsakingas naudotojas (vastutav kasutaja), o pardavėjas lieka savininku – prašymą pateikia pardavėjas su rašytiniu pirkėjo sutikimu per 5 darbo dienas nuo pasikeitimo; pirkėjas yra sudaręs privalomąjį transporto priemonės draudimą (liikluskindlustus) nuo perdavimo dienos, o KASKO draudime pardavėjas nurodytas naudos gavėju. Prieš veždamas krovinius už atlygį pirkėjas gauna sunkvežimiui veiklos licencijos kopiją (tegevusloa ärakiri).',
    invoiceNote:
      'Sąskaitos siunčiamos PDF formatu. Jei pirkėjas verslo registre (äriregister) pažymėtas kaip e. sąskaitų gavėjas ir reikalauja e. sąskaitos (e-arve), pardavėjas turi išsiųsti kompiuterio skaitomą sąskaitą iš savo apskaitos programos – RAHTIS e. sąskaitų nerengia.',
    thresholdsText:
      'Estijos įstatymas ribų nenustato; jos kyla iš sutarties (9.1 punktas). Pardavėjas gali pradėti nutraukti sandorį tik tada, kai mokėjimas vėluoja bent 14 dienų ir vėluoja bent {tenth} (viena įmoka) arba {twentieth} (dvi ar daugiau įmokų) – šiame sandoryje tam reikalingas vėluojančių įmokų skaičius: {needed}. Tada pardavėjas privalo raštu duoti papildomą bent 14 dienų terminą; tik jam pasibaigus pardavėjas gali atsisakyti sutarties ir reikalauti grąžinti sunkvežimį.',
    thresholdTitle: 'Pasiekta sutarties riba: {plate}',
    threshold:
      'Vėluojančios įmokos pasiekė sutarties 9.1 punkto ribą. Kitas žingsnis – rašytinis papildomas bent 14 dienų terminas sumokėti (täiendav tähtaeg, VÕS § 114). Tik jam pasibaigus be mokėjimo galite reikalauti viso likučio arba atsisakyti sutarties ir reikalauti grąžinti transporto priemonę. Pasiimti transporto priemonės patys negalite: ji grąžinama savanoriškai pagal aktą arba per teismą ir antstolį (kohtutäitur). Užvedimo blokavimas skolai išieškoti nenaudojamas.',
    checkRegister: 'Pirkėjas įrašytas į eismo registrą (Transpordiamet) kaip atsakingas naudotojas (vastutav kasutaja); pardavėjas lieka savininku.',
    checkInsurance: 'Pirkėjo sudarytas privalomasis transporto priemonės draudimas (liikluskindlustus) galioja nuo perdavimo dienos, o KASKO draudime pardavėjas nurodytas naudos gavėju.',
    afterPaid:
      'Nuosavybės teisė perėjo pirkėjui paskutinio mokėjimo gavimo dieną. Per 5 darbo dienas šalys pateikia Transpordiamet bendrą prašymą įregistruoti pirkėją savininku arba pardavėjas praneša apie perleidimą, o pirkėjas pateikia prašymą pakeisti duomenis.',
    terminationHint:
      'Pažymėkite sandorio pabaigą, kai atsisakėte sutarties ir transporto priemonė jums grąžinta (savanoriškai arba per teismą ir antstolį) arba kai su pirkėju susitarėte nutraukti sandorį. Įmokų sąskaitos ir priminimai nebesiunčiami. Žymos atšaukti negalima.',
    reasonRepossessed: 'Pardavėjas atsisakė sutarties, transporto priemonė grąžinta',
    settlement:
      'RAHTIS galutinio atsiskaitymo neskaičiuoja ir neatlieka. Galutinį atsiskaitymą (lõpparveldus) pagal sutarties 9.6 punktą šalys atlieka tarpusavyje; ginčą sprendžia teismas. PVM įforminimas grąžinant (kreditinė sąskaita arba pardavimas atgal) sutariamas su buhalteriu. Pirkėjas per 5 darbo dienas nuo grąžinimo prašo išbraukti jį iš eismo registro kaip atsakingą naudotoją.',
  },
  pl: {
    intro:
      'Sprzedaj własny pojazd na raty sprawdzonemu przewoźnikowi albo kup pojazd na raty. RAHTIS przygotowuje umowę według prawa estońskiego (sprzedaż z zastrzeżeniem własności, võlaõigusseadus § 233), harmonogram płatności i faktury w imieniu sprzedawcy; kupujący płaci bezpośrednio na rachunek sprzedawcy.',
    introSeller:
      'Sprzedaj pojazd na raty sprawdzonemu przewoźnikowi. Dodaj pojazd, który chcesz sprzedać; sprawdzimy jego dane, a po zatwierdzeniu możesz opublikować ogłoszenie. RAHTIS przygotowuje umowę według prawa estońskiego (sprzedaż z zastrzeżeniem własności, võlaõigusseadus § 233), harmonogram płatności i faktury w imieniu sprzedawcy; kupujący płaci bezpośrednio na Twój rachunek.',
    notAllowed:
      'Sprzęt na raty może sprzedać każda sprawdzona estońska firma zarejestrowana w RAHTIS; kupującym jest zawsze sprawdzony estoński przewoźnik. Transakcję zawiera główny użytkownik firmy.',
    contract: 'Umowa sprzedaży na raty (PDF, po estońsku)',
    nextSteps:
      'Przed wydaniem: umowa podpisana, pierwsza faktura zapłacona, kupujący wpisany do estońskiego rejestru pojazdów (liiklusregister, Transpordiamet) jako użytkownik odpowiedzialny (vastutav kasutaja), a sprzedawca pozostaje właścicielem – wniosek składa sprzedawca za pisemną zgodą kupującego w ciągu 5 dni roboczych od zmiany; kupujący zawarł obowiązkowe ubezpieczenie OC (liikluskindlustus) od dnia wydania, a w polisie autocasco sprzedawca jest wskazany jako uposażony. Przed zarobkowym przewozem rzeczy kupujący uzyskuje dla pojazdu wypis z licencji (tegevusloa ärakiri).',
    invoiceNote:
      'Faktury są wysyłane w formacie PDF. Jeżeli kupujący jest oznaczony w rejestrze handlowym (äriregister) jako odbiorca e-faktur i żąda e-faktury (e-arve), sprzedawca musi wysłać fakturę w formie nadającej się do przetwarzania maszynowego ze swojego programu księgowego – RAHTIS nie tworzy e-faktur.',
    thresholdsText:
      'Prawo estońskie nie określa gotowych progów; wynikają one z umowy (pkt 9.1). Sprzedawca może przystąpić do zakończenia transakcji dopiero wtedy, gdy płatność jest opóźniona o co najmniej 14 dni, a zaległość wynosi co najmniej {tenth} (jedna rata) lub {twentieth} (dwie raty lub więcej) – w tej transakcji oznacza to liczbę zaległych rat: {needed}. Następnie sprzedawca musi wyznaczyć na piśmie dodatkowy termin, co najmniej 14 dni; dopiero po jego upływie może odstąpić od umowy i żądać zwrotu pojazdu.',
    thresholdTitle: 'Osiągnięto próg z umowy: {plate}',
    threshold:
      'Zaległe raty osiągnęły próg z pkt 9.1 umowy. Kolejny krok to pisemny dodatkowy termin na zapłatę, co najmniej 14 dni (täiendav tähtaeg, VÕS § 114). Dopiero gdy upłynie on bez zapłaty, możesz żądać całej pozostałej kwoty albo odstąpić od umowy i żądać zwrotu pojazdu. Pojazdu nie wolno zabrać samodzielnie: zwrot następuje dobrowolnie na podstawie protokołu albo przez sąd i komornika (kohtutäitur). Blokady rozruchu nie stosuje się do windykacji.',
    checkRegister: 'Kupujący jest wpisany do rejestru pojazdów (Transpordiamet) jako użytkownik odpowiedzialny (vastutav kasutaja); sprzedawca pozostaje właścicielem.',
    checkInsurance: 'Obowiązkowe ubezpieczenie OC (liikluskindlustus) zawarte przez kupującego obowiązuje od dnia wydania, a w polisie autocasco sprzedawca jest wskazany jako uposażony.',
    afterPaid:
      'Własność przeszła na kupującego w dniu wpływu ostatniej płatności. W ciągu 5 dni roboczych strony składają w Transpordiamet wspólny wniosek o wpisanie kupującego jako właściciela albo sprzedawca zgłasza zbycie, a kupujący składa wniosek o zmianę danych.',
    terminationHint:
      'Odnotuj zakończenie, gdy odstąpiłeś od umowy, a pojazd został Ci zwrócony (dobrowolnie albo przez sąd i komornika), albo gdy uzgodniłeś z kupującym zakończenie sprzedaży. Faktury za raty i przypomnienia przestają być wysyłane. Tej operacji nie można cofnąć.',
    reasonRepossessed: 'Sprzedawca odstąpił od umowy, pojazd został zwrócony',
    settlement:
      'RAHTIS nie oblicza ani nie przeprowadza rozliczenia. Rozliczenie końcowe (lõpparveldus) według pkt 9.6 umowy strony przeprowadzają między sobą; spór rozstrzyga sąd. Sposób ujęcia VAT przy zwrocie (faktura korygująca albo odsprzedaż) ustala się z księgowym. Kupujący w ciągu 5 dni roboczych od zwrotu wnosi o wykreślenie go z rejestru pojazdów jako użytkownika odpowiedzialnego.',
  },
  de: {
    intro:
      'Verkaufen Sie Ihren eigenen Lkw auf Raten an ein geprüftes Transportunternehmen oder kaufen Sie einen Lkw auf Raten. RAHTIS erstellt einen Vertrag nach estnischem Recht (Kauf unter Eigentumsvorbehalt, võlaõigusseadus § 233), den Zahlungsplan und die Rechnungen im Namen des Verkäufers; der Käufer zahlt direkt auf das Konto des Verkäufers.',
    introSeller:
      'Verkaufen Sie einen Lkw auf Raten an ein geprüftes Transportunternehmen. Fügen Sie das Fahrzeug hinzu, das Sie verkaufen möchten; wir prüfen die Angaben, und nach der Freigabe können Sie ein Angebot veröffentlichen. RAHTIS erstellt einen Vertrag nach estnischem Recht (Kauf unter Eigentumsvorbehalt, võlaõigusseadus § 233), den Zahlungsplan und die Rechnungen im Namen des Verkäufers; der Käufer zahlt direkt auf Ihr Konto.',
    notAllowed:
      'Fahrzeuge auf Raten verkaufen kann jedes geprüfte estnische Unternehmen, das bei RAHTIS registriert ist; Käufer ist immer ein geprüftes estnisches Transportunternehmen. Den Kauf schließt der Hauptnutzer des Unternehmens ab.',
    contract: 'Ratenkaufvertrag (PDF, auf Estnisch)',
    nextSteps:
      'Vor der Übergabe: Vertrag unterzeichnet, erste Rechnung bezahlt, der Käufer im estnischen Verkehrsregister (liiklusregister, Transpordiamet) als verantwortlicher Nutzer (vastutav kasutaja) eingetragen, der Verkäufer bleibt Eigentümer – den Antrag stellt der Verkäufer mit schriftlicher Zustimmung des Käufers innerhalb von 5 Arbeitstagen nach der Änderung; der Käufer hat die Kfz-Haftpflichtversicherung (liikluskindlustus) ab dem Übergabetag abgeschlossen, und in der Kaskoversicherung ist der Verkäufer als Begünstigter eingetragen. Vor dem gewerblichen Güterverkehr beschafft der Käufer für das Fahrzeug eine Abschrift der Lizenz (tegevusloa ärakiri).',
    invoiceNote:
      'Rechnungen werden als PDF versandt. Ist der Käufer im Handelsregister (äriregister) als Empfänger von E-Rechnungen vermerkt und verlangt eine E-Rechnung (e-arve), muss der Verkäufer eine maschinenlesbare Rechnung aus seiner eigenen Buchhaltungssoftware senden – RAHTIS erstellt keine E-Rechnungen.',
    thresholdsText:
      'Das estnische Recht kennt keine festen Schwellen; sie ergeben sich aus dem Vertrag (Ziffer 9.1). Der Verkäufer darf den Kauf erst dann beenden, wenn eine Zahlung seit mindestens 14 Tagen überfällig ist und mindestens {tenth} (eine Rate) oder {twentieth} (zwei oder mehr Raten) im Rückstand sind – erforderliche Zahl überfälliger Raten bei diesem Kauf: {needed}. Danach muss der Verkäufer schriftlich eine Nachfrist von mindestens 14 Tagen setzen; erst nach deren Ablauf darf er vom Vertrag zurücktreten und den Lkw herausverlangen.',
    thresholdTitle: 'Vertragliche Schwelle erreicht: {plate}',
    threshold:
      'Die überfälligen Raten erreichen die Schwelle nach Ziffer 9.1 des Vertrags. Der nächste Schritt ist eine schriftliche Nachfrist von mindestens 14 Tagen zur Zahlung (täiendav tähtaeg, VÕS § 114). Erst wenn sie ohne Zahlung abläuft, können Sie den gesamten Restbetrag verlangen oder vom Vertrag zurücktreten und das Fahrzeug herausverlangen. Sie dürfen das Fahrzeug nicht selbst an sich nehmen: Es wird freiwillig mit Protokoll zurückgegeben oder über Gericht und Gerichtsvollzieher (kohtutäitur). Eine Wegfahrsperre wird nicht zur Eintreibung von Forderungen eingesetzt.',
    checkRegister: 'Der Käufer ist im Verkehrsregister (Transpordiamet) als verantwortlicher Nutzer (vastutav kasutaja) eingetragen; der Verkäufer bleibt Eigentümer.',
    checkInsurance: 'Die vom Käufer abgeschlossene Kfz-Haftpflichtversicherung (liikluskindlustus) gilt ab dem Übergabetag, und in der Kaskoversicherung ist der Verkäufer als Begünstigter eingetragen.',
    afterPaid:
      'Das Eigentum ist am Tag des Eingangs der letzten Zahlung auf den Käufer übergegangen. Innerhalb von 5 Arbeitstagen stellen die Parteien bei Transpordiamet einen gemeinsamen Antrag auf Eintragung des Käufers als Eigentümer, oder der Verkäufer meldet die Veräußerung und der Käufer beantragt die Änderung.',
    terminationHint:
      'Erfassen Sie dies, wenn Sie vom Vertrag zurückgetreten sind und das Fahrzeug an Sie zurückgegeben wurde (freiwillig oder über Gericht und Gerichtsvollzieher) oder wenn Sie mit dem Käufer die Beendigung des Kaufs vereinbart haben. Ratenrechnungen und Erinnerungen enden. Der Eintrag kann nicht rückgängig gemacht werden.',
    reasonRepossessed: 'Der Verkäufer ist vom Vertrag zurückgetreten, das Fahrzeug wurde zurückgegeben',
    settlement:
      'RAHTIS berechnet die Abrechnung nicht und führt sie nicht durch. Die Schlussabrechnung (lõpparveldus) nach Ziffer 9.6 des Vertrags erfolgt zwischen den Parteien; über einen Streit entscheidet ein Gericht. Die umsatzsteuerliche Behandlung der Rückgabe (Gutschrift oder Rückverkauf) wird mit dem Buchhalter festgelegt. Der Käufer beantragt innerhalb von 5 Arbeitstagen nach der Rückgabe seine Löschung als verantwortlicher Nutzer im Verkehrsregister.',
  },
  ru: {
    intro:
      'Продайте свою машину в рассрочку проверенному перевозчику или купите машину в рассрочку. RAHTIS готовит договор по эстонскому праву (продажа с сохранением права собственности, võlaõigusseadus § 233), график платежей и счета от имени продавца; покупатель платит напрямую на счёт продавца.',
    introSeller:
      'Продайте машину в рассрочку проверенному перевозчику. Добавьте машину, которую хотите продать: мы проверим её данные, и после одобрения вы сможете опубликовать объявление. RAHTIS готовит договор по эстонскому праву (продажа с сохранением права собственности, võlaõigusseadus § 233), график платежей и счета от имени продавца; покупатель платит напрямую на ваш счёт.',
    notAllowed:
      'Продать технику в рассрочку может любая проверенная эстонская компания, зарегистрированная в RAHTIS; покупатель — всегда проверенный эстонский перевозчик. Сделку оформляет главный пользователь компании.',
    contract: 'Договор продажи в рассрочку (PDF, на эстонском)',
    nextSteps:
      'До передачи: договор подписан, первый счёт оплачен, покупатель внесён в эстонский регистр движения (liiklusregister, Transpordiamet) как ответственный пользователь (vastutav kasutaja), а продавец остаётся собственником — заявление подаёт продавец с письменного согласия покупателя в течение 5 рабочих дней с изменения; покупатель оформил обязательное дорожное страхование (liikluskindlustus) с даты передачи, а в полисе каско продавец указан выгодоприобретателем. До платных перевозок покупатель получает на машину копию лицензии (tegevusloa ärakiri).',
    invoiceNote:
      'Счета отправляются в PDF. Если покупатель отмечен в коммерческом регистре (äriregister) как получатель электронных счетов и требует электронный счёт (e-arve), продавец должен отправить машиночитаемый счёт из своей бухгалтерской программы — RAHTIS электронных счетов не делает.',
    thresholdsText:
      'Эстонский закон готовых порогов не задаёт: они записаны в договоре (п. 9.1). Продавец может начать прекращение сделки, только если платёж просрочен не менее 14 дней и просрочено не меньше {tenth} (один платёж) или {twentieth} (два платежа и больше); в этой сделке — просроченных платежей: {needed}. После этого продавец обязан письменно дать дополнительный срок не короче 14 дней, и только когда он истёк, может отказаться от договора и потребовать машину назад.',
    thresholdTitle: 'Достигнут порог договора: {plate}',
    threshold:
      'Просроченные платежи достигли порога п. 9.1 договора. Следующий шаг — письменный дополнительный срок для оплаты не короче 14 дней (täiendav tähtaeg, VÕS § 114). Только если он истёк без оплаты, вы можете потребовать весь остаток либо отказаться от договора и потребовать вернуть машину. Забирать машину самому нельзя: её возвращают добровольно по акту либо через суд и судебного исполнителя (kohtutäitur). Блокировка запуска двигателя для взыскания не применяется.',
    checkRegister: 'Покупатель внесён в регистр движения (Transpordiamet) как ответственный пользователь (vastutav kasutaja), продавец остаётся собственником.',
    checkInsurance: 'Обязательное дорожное страхование (liikluskindlustus), оформленное покупателем, действует с даты передачи, а в полисе каско продавец указан выгодоприобретателем.',
    afterPaid:
      'Право собственности перешло к покупателю в день поступления последнего платежа. В течение 5 рабочих дней стороны подают в Transpordiamet общее заявление о записи покупателя собственником, либо продавец сообщает об отчуждении, а покупатель подаёт заявление об изменении данных.',
    terminationHint:
      'Отметьте прекращение сделки, когда вы отказались от договора и машина вам возвращена (добровольно либо через суд и судебного исполнителя) или когда вы договорились с покупателем прекратить продажу. Счета на платежи и напоминания прекратятся. Отменить отметку нельзя.',
    reasonRepossessed: 'Продавец отказался от договора, машина возвращена',
    settlement:
      'RAHTIS не считает и не проводит взаиморасчёт. Окончательный расчёт (lõpparveldus) по п. 9.6 договора стороны проводят между собой; спор решает суд. Как оформить НДС при возврате (кредит-счёт или обратная продажа), решают с бухгалтером. Покупатель в течение 5 рабочих дней после возврата просит исключить его из регистра движения как ответственного пользователя.',
  },
  ro: {
    intro:
      'Vindeți propriul camion cu plata în rate unui transportator verificat sau cumpărați un camion în rate. RAHTIS întocmește un contract conform dreptului estonian (vânzare cu rezerva dreptului de proprietate, võlaõigusseadus § 233), graficul de plăți și facturile în numele vânzătorului; cumpărătorul plătește direct în contul vânzătorului.',
    introSeller:
      'Vindeți un camion cu plata în rate unui transportator verificat. Adăugați vehiculul pe care doriți să îl vindeți; îi verificăm datele, iar după aprobare puteți publica un anunț. RAHTIS întocmește un contract conform dreptului estonian (vânzare cu rezerva dreptului de proprietate, võlaõigusseadus § 233), graficul de plăți și facturile în numele vânzătorului; cumpărătorul plătește direct în contul dumneavoastră.',
    notAllowed:
      'Orice firmă estoniană verificată, înregistrată în RAHTIS, poate vinde echipamente în rate; cumpărătorul este întotdeauna un transportator estonian verificat. Vânzarea o încheie utilizatorul principal al firmei.',
    contract: 'Contract de vânzare în rate (PDF, în estonă)',
    nextSteps:
      'Înainte de predare: contractul semnat, prima factură plătită, cumpărătorul înscris în registrul de circulație estonian (liiklusregister, Transpordiamet) ca utilizator responsabil (vastutav kasutaja), vânzătorul rămânând proprietar – cererea o depune vânzătorul cu acordul scris al cumpărătorului, în 5 zile lucrătoare de la modificare; cumpărătorul a încheiat asigurarea obligatorie de răspundere civilă auto (liikluskindlustus) de la data predării, iar în polița casco vânzătorul este trecut ca beneficiar. Înainte de transportul de mărfuri contra cost, cumpărătorul obține pentru vehicul copia licenței (tegevusloa ärakiri).',
    invoiceNote:
      'Facturile se trimit în format PDF. Dacă cumpărătorul este marcat în registrul comerțului (äriregister) ca destinatar de facturi electronice și cere o factură electronică (e-arve), vânzătorul trebuie să trimită o factură prelucrabilă automat din propriul program de contabilitate – RAHTIS nu emite facturi electronice.',
    thresholdsText:
      'Legea estoniană nu stabilește praguri; ele rezultă din contract (punctul 9.1). Vânzătorul poate începe încetarea vânzării numai după ce o plată este restantă de cel puțin 14 zile și suma restantă este de cel puțin {tenth} (o rată) sau {twentieth} (două sau mai multe rate) – în această tranzacție, numărul de rate restante necesar este {needed}. Apoi vânzătorul trebuie să acorde în scris un termen suplimentar de cel puțin 14 zile; abia după expirarea lui poate denunța contractul și cere restituirea camionului.',
    thresholdTitle: 'Pragul din contract a fost atins: {plate}',
    threshold:
      'Ratele restante ating pragul de la punctul 9.1 din contract. Pasul următor este un termen suplimentar scris de cel puțin 14 zile pentru plată (täiendav tähtaeg, VÕS § 114). Numai dacă acesta expiră fără plată puteți cere întregul rest sau puteți denunța contractul și cere restituirea vehiculului. Nu puteți lua singur vehiculul: acesta se restituie de bunăvoie, pe bază de proces-verbal, sau prin instanță și executor judecătoresc (kohtutäitur). Imobilizatorul nu se folosește pentru recuperarea datoriilor.',
    checkRegister: 'Cumpărătorul este înscris în registrul de circulație (Transpordiamet) ca utilizator responsabil (vastutav kasutaja); vânzătorul rămâne proprietar.',
    checkInsurance: 'Asigurarea obligatorie de răspundere civilă auto (liikluskindlustus) încheiată de cumpărător este valabilă de la data predării, iar în polița casco vânzătorul este trecut ca beneficiar.',
    afterPaid:
      'Proprietatea a trecut la cumpărător în ziua încasării ultimei plăți. În 5 zile lucrătoare părțile depun la Transpordiamet o cerere comună de înscriere a cumpărătorului ca proprietar sau vânzătorul anunță înstrăinarea, iar cumpărătorul cere modificarea datelor.',
    terminationHint:
      'Înregistrați încetarea după ce ați denunțat contractul și vehiculul v-a fost restituit (de bunăvoie sau prin instanță și executor judecătoresc) ori după ce ați convenit cu cumpărătorul încetarea vânzării. Facturile pentru rate și notificările se opresc. Înregistrarea nu poate fi anulată.',
    reasonRepossessed: 'Vânzătorul a denunțat contractul, iar vehiculul a fost restituit',
    settlement:
      'RAHTIS nu calculează și nu efectuează decontarea. Decontarea finală (lõpparveldus) potrivit punctului 9.6 din contract se face între părți; litigiul îl soluționează instanța. Tratamentul TVA la restituire (factură de stornare sau revânzare) se stabilește cu contabilul. Cumpărătorul cere, în 5 zile lucrătoare de la restituire, radierea sa din registrul de circulație ca utilizator responsabil.',
  },
};
