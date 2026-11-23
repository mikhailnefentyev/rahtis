import type { Locale } from '../../i18n/config.ts';
import type { InstallmentLawCopy } from './types.ts';

/**
 * Латвия — тексты кабинета на десяти языках (23.11.2026). Источник фактов —
 * docs/equipment-sale/countries/lv.md:
 *   · специального закона нет: nomaksas pirkums, Civillikums 2069.–2071. p.;
 *   · порог — закон, императивно (2070. p.): два пропущенных срока платежа;
 *     ни дней, ни доли цены. Толкование не подтверждено практикой, поэтому
 *     везде осторожный вариант договора: оба платежа просрочены и не уплачены,
 *     затем письменное предупреждение на 14 дней. Одна просрочка, даже
 *     крупного последнего платежа, даёт только взыскание долга;
 *   · забрать машину самому нельзя (1732. p.): добровольно по акту либо суд
 *     и zvērināts tiesu izpildītājs;
 *   · расчёт при возврате обязателен (2070. p.): плата за пользование и
 *     убытки, все платежи покупателя засчитываются, излишек возвращается;
 *   · реестр — CSDD: продавец īpašnieks, покупатель turētājs, пять дней;
 *     OCTA — кто оформляет, решает договор (п. 7.1), по закону обязанность
 *     на собственнике;
 *   · с 01.01.2028 счёт между латвийскими компаниями — только
 *     структурированный электронный: платформа с этой даты шлёт уведомления.
 * Исследование не проверено латвийским адвокатом; тексты носителем языка не
 * вычитаны — вычитать до рекламы раздела.
 */
export const LV_TEXTS: Record<Locale, InstallmentLawCopy> = {
  fi: {
    intro:
      'Myy oma auto osamaksulla tarkastetulle kuljetusliikkeelle tai osta auto osamaksulla. RAHTIS laatii Latvian lain mukaisen osamaksusopimuksen (nomaksas pirkums, Civillikums 2069–2071 §), maksusuunnitelman ja laskut myyjän nimissä; ostaja maksaa suoraan myyjän tilille.',
    introSeller:
      'Myy auto osamaksulla tarkastetulle kuljetusliikkeelle. Lisää myytävä auto, me tarkastamme sen tiedot, ja hyväksynnän jälkeen voit julkaista myynti-ilmoituksen. RAHTIS laatii Latvian lain mukaisen osamaksusopimuksen (nomaksas pirkums, Civillikums 2069–2071 §), maksusuunnitelman ja laskut myyjän nimissä; ostaja maksaa suoraan tilillesi.',
    notAllowed:
      'Kalustoa voi myydä osamaksulla jokainen RAHTIKSEEN rekisteröitynyt ja tarkastettu latvialainen yritys, ja ostajana on aina tarkastettu latvialainen kuljetusliike. Kaupan tekee yrityksen pääkäyttäjä.',
    contract: 'Osamaksusopimus (PDF, latviaksi)',
    nextSteps:
      'Ennen luovutusta: sopimus allekirjoitettu, ensimmäinen lasku maksettu, ostaja rekisteröity CSDD:ssä haltijaksi (turētājs) ja myyjä edelleen omistajana (īpašnieks) – hakemuksen tekee myyjä, ja ostaja on paikalla tai antaa kirjallisen valtakirjan (muutos rekisteröidään viiden päivän kuluessa); pakollinen liikennevakuutus (OCTA) on voimassa luovutuspäivästä (sopimuksen kohta 7.1 kertoo, kumpi sen ottaa; lain mukaan velvollisuus on omistajalla, jos vakuutusta ei ole), ja KASKO-vakuutuksessa korvauksen saajaksi on merkitty myyjä. Ennen kaupallisia kuljetuksia ostaja hankkii autolle yhteisön liikenneluvan jäljennöksen tai lisenssikortin (licences kartīte).',
    invoiceNote:
      'Laskut lähetetään PDF-muodossa; tämä käy niin kauan kuin ostaja hyväksyy sähköisen laskun. 1.1.2028 alkaen latvialaisten yritysten välisten laskujen on oltava rakenteisia verkkolaskuja: siitä päivästä RAHTIS lähettää vain maksuilmoituksia, ja laskut myyjä laatii omassa taloushallinto-ohjelmassaan.',
    thresholdsText:
      'Latvian lain (Civillikums 2070 §) mukaan myyjä voi vaatia sopimuksen purkamista ja auton palauttamista vasta, kun kaksi maksuerän eräpäivää on jäänyt väliin ja molemmat erät ovat edelleen maksamatta; sopimus edellyttää sen jälkeen kirjallista varoitusta ja vähintään 14 päivän maksuaikaa. Yhden erän viivästys – myös suuren viimeisen erän – antaa oikeuden vain periä erääntynyt määrä.',
    thresholdTitle: 'Kaksi erää myöhässä: {plate}',
    threshold:
      'Kaksi maksuerän eräpäivää on jäänyt väliin, ja molemmat erät ovat maksamatta (Civillikums 2070 §, sopimuksen kohta 9.1). Seuraava vaihe on kirjallinen varoitus, jossa ostajalle annetaan vähintään 14 päivää maksaa. Vasta sen jälkeen voit vaatia sopimuksen purkamista ja auton palauttamista. Autoa ei saa ottaa itse: se luovutetaan vapaaehtoisesti luovutuspöytäkirjalla tai tuomioistuimen ja ulosottomiehen (zvērināts tiesu izpildītājs) kautta. Käynnistyksenestoa ei käytetä perintään.',
    checkRegister: 'Ostaja on rekisteröity CSDD:ssä haltijaksi (turētājs), myyjä on edelleen omistaja (īpašnieks).',
    checkInsurance: 'Pakollinen liikennevakuutus (OCTA) on voimassa luovutuspäivästä, ja KASKO-vakuutuksessa korvauksen saajaksi on merkitty myyjä.',
    afterPaid:
      'Omistusoikeus siirtyi ostajalle viimeisen maksun päivänä. Myyjä antaa viiden päivän kuluessa ostajalle kirjallisen vahvistuksen ja tekee tarvittavat toimet, jotta CSDD rekisteröi omistajanvaihdoksen.',
    terminationHint:
      'Kirjaa kauppa päättyneeksi, kun sopimus on purettu ja auto on luovutettu sinulle takaisin (vapaaehtoisesti tai tuomioistuimen ja ulosottomiehen kautta) tai kun olette sopineet ostajan kanssa kaupan purkamisesta. Maksuerien laskutus ja muistutukset loppuvat. Merkintää ei voi perua.',
    reasonRepossessed: 'Sopimus on purettu ja auto on palautettu myyjälle',
    settlement:
      'RAHTIS ei laske eikä toimita tilitystä. Civillikums 2070 §:n mukainen keskinäinen tilitys (savstarpējais norēķins) on pakollinen: myyjälle kuuluu korvaus käytöstä ja vahingoista, kaikki ostajan maksut luetaan hyväksi ja ylijäämä palautetaan ostajalle. Osapuolet tekevät tilityksen keskenään; riidan ratkaisee tuomioistuin. Palautuksen arvonlisäveroasiakirjat laaditaan kirjanpitäjän kanssa. Palautuksen jälkeen myyjä hakee CSDD:ltä haltijamerkinnän poistamista.',
  },
  en: {
    intro:
      'Sell your own truck in instalments to a verified carrier, or buy one in instalments. RAHTIS prepares an instalment purchase contract under Latvian law (nomaksas pirkums, Civillikums 2069.–2071. p.), the payment plan and the invoices in the seller’s name; the buyer pays straight to the seller’s account.',
    introSeller:
      'Sell a truck in instalments to a verified carrier. Add the vehicle you want to sell; we check its details, and once it is approved you can publish a listing. RAHTIS prepares an instalment purchase contract under Latvian law (nomaksas pirkums, Civillikums 2069.–2071. p.), the payment plan and the invoices in the seller’s name; the buyer pays straight to your account.',
    notAllowed:
      'Any verified Latvian company registered in RAHTIS can sell equipment in instalments; the buyer is always a verified Latvian carrier. The sale is made by the company’s main user.',
    contract: 'Instalment purchase contract (PDF, in Latvian)',
    nextSteps:
      'Before handover: contract signed, first invoice paid, the buyer registered with CSDD as holder (turētājs) while the seller stays the owner (īpašnieks) – the seller applies, and the buyer attends or gives a written power of attorney (the change is registered within 5 days); compulsory motor insurance (OCTA) in force from the handover date (clause 7.1 of the contract says who takes it out; by law the duty stays with the owner if there is no policy), and the seller named as recipient of the indemnity on the KASKO policy. Before commercial carriage the buyer obtains a copy of the Community licence or a licence card (licences kartīte) for the vehicle.',
    invoiceNote:
      'Invoices are sent as PDF; this works as long as the buyer accepts electronic invoices. From 1 January 2028 invoices between Latvian companies must be structured e-invoices: from that date RAHTIS sends payment notices only, and the seller issues the invoices from its own accounting system.',
    thresholdsText:
      'Under Latvian law (Civillikums 2070. p.) the seller may ask to cancel the contract and get the truck back only when two instalment dates have been missed and both instalments are still unpaid; the contract then requires a written warning with at least 14 days to pay. One missed instalment – even a large final one – gives only the right to recover the overdue amount.',
    thresholdTitle: 'Two instalments overdue: {plate}',
    threshold:
      'Two instalment dates have been missed and both instalments are unpaid (Civillikums 2070. p., clause 9.1 of the contract). The next step is a written warning giving the buyer at least 14 days to pay. Only after that may you ask to cancel the contract and get the vehicle back. You may not take the vehicle yourself: it is handed back voluntarily under a handover record, or through a court and a sworn bailiff (zvērināts tiesu izpildītājs). The immobiliser is not used for debt collection.',
    checkRegister: 'The buyer is registered with CSDD as holder (turētājs); the seller remains the owner (īpašnieks).',
    checkInsurance: 'Compulsory motor insurance (OCTA) is in force from the handover date, and the seller is named as recipient of the indemnity on the KASKO policy.',
    afterPaid:
      'Ownership passed to the buyer on the day of the last payment. Within 5 days the seller gives the buyer a written confirmation and does what is needed for CSDD to register the change of owner.',
    terminationHint:
      'Record this when the contract has been cancelled and the vehicle handed back to you (voluntarily or through a court and a sworn bailiff), or when you and the buyer have agreed to end the sale. Instalment invoices and reminders stop. This cannot be undone.',
    reasonRepossessed: 'The contract was cancelled and the vehicle handed back to the seller',
    settlement:
      'RAHTIS does not calculate or carry out the settlement. The mutual settlement (savstarpējais norēķins) under Civillikums 2070. p. is mandatory: the seller is due compensation for use and for damage, all the buyer’s payments are counted, and any surplus is returned to the buyer. The parties make it between themselves; a dispute is decided by a court. VAT documents for the return are prepared with an accountant. After the return the seller applies to CSDD to remove the holder entry.',
  },
  sv: {
    intro:
      'Sälj din egen bil på avbetalning till ett kontrollerat åkeri eller köp en bil på avbetalning. RAHTIS upprättar ett avbetalningsavtal enligt lettisk lag (nomaksas pirkums, Civillikums 2069–2071 §), en betalningsplan och fakturor i säljarens namn; köparen betalar direkt till säljarens konto.',
    introSeller:
      'Sälj en bil på avbetalning till ett kontrollerat åkeri. Lägg till bilen du vill sälja; vi kontrollerar uppgifterna, och när den har godkänts kan du publicera en annons. RAHTIS upprättar ett avbetalningsavtal enligt lettisk lag (nomaksas pirkums, Civillikums 2069–2071 §), en betalningsplan och fakturor i säljarens namn; köparen betalar direkt till ditt konto.',
    notAllowed:
      'Varje kontrollerat lettiskt företag som är registrerat i RAHTIS kan sälja fordon på avbetalning; köparen är alltid ett kontrollerat lettiskt åkeri. Köpet görs av företagets huvudanvändare.',
    contract: 'Avbetalningsavtal (PDF, på lettiska)',
    nextSteps:
      'Före överlämnandet: avtalet undertecknat, första fakturan betald, köparen registrerad hos CSDD som brukare (turētājs) och säljaren kvar som ägare (īpašnieks) – säljaren ansöker, och köparen är närvarande eller ger en skriftlig fullmakt (ändringen registreras inom 5 dagar); obligatorisk trafikförsäkring (OCTA) gäller från överlämnandedagen (avtalets punkt 7.1 anger vem som tecknar den; enligt lag ligger skyldigheten på ägaren om försäkring saknas), och säljaren står som ersättningsmottagare i KASKO-försäkringen. Före yrkesmässiga transporter skaffar köparen en kopia av gemenskapstillståndet eller ett licenskort (licences kartīte) för bilen.',
    invoiceNote:
      'Fakturorna skickas som PDF; det fungerar så länge köparen godtar elektroniska fakturor. Från den 1 januari 2028 måste fakturor mellan lettiska företag vara strukturerade e-fakturor: från den dagen skickar RAHTIS bara betalningsaviseringar, och säljaren utfärdar fakturorna i sitt eget ekonomisystem.',
    thresholdsText:
      'Enligt lettisk lag (Civillikums 2070 §) får säljaren begära att avtalet hävs och att bilen lämnas tillbaka först när två förfallodagar har missats och båda delbetalningarna fortfarande är obetalda; avtalet kräver därefter en skriftlig varning med minst 14 dagar att betala. En missad delbetalning – även en stor sista – ger bara rätt att driva in det förfallna beloppet.',
    thresholdTitle: 'Två delbetalningar försenade: {plate}',
    threshold:
      'Två förfallodagar har missats och båda delbetalningarna är obetalda (Civillikums 2070 §, avtalets punkt 9.1). Nästa steg är en skriftlig varning som ger köparen minst 14 dagar att betala. Först därefter får du begära att avtalet hävs och att fordonet lämnas tillbaka. Du får inte själv ta fordonet: det lämnas tillbaka frivilligt med ett överlämnandeprotokoll eller via domstol och exekutor (zvērināts tiesu izpildītājs). Startspärr används inte för indrivning.',
    checkRegister: 'Köparen är registrerad hos CSDD som brukare (turētājs); säljaren är fortfarande ägare (īpašnieks).',
    checkInsurance: 'Obligatorisk trafikförsäkring (OCTA) gäller från överlämnandedagen, och säljaren står som ersättningsmottagare i KASKO-försäkringen.',
    afterPaid:
      'Äganderätten övergick till köparen den dag den sista betalningen kom in. Inom 5 dagar ger säljaren köparen en skriftlig bekräftelse och gör det som behövs för att CSDD ska registrera ägarbytet.',
    terminationHint:
      'Registrera detta när avtalet har hävts och fordonet har lämnats tillbaka till dig (frivilligt eller via domstol och exekutor), eller när du och köparen har kommit överens om att avsluta köpet. Fakturor för delbetalningar och påminnelser upphör. Det går inte att ångra.',
    reasonRepossessed: 'Avtalet har hävts och fordonet har lämnats tillbaka till säljaren',
    settlement:
      'RAHTIS beräknar eller genomför inte avräkningen. Den ömsesidiga avräkningen (savstarpējais norēķins) enligt Civillikums 2070 § är tvingande: säljaren har rätt till ersättning för nyttjandet och för skada, alla köparens betalningar räknas av och ett överskott betalas tillbaka till köparen. Parterna gör avräkningen sinsemellan; en tvist avgörs av domstol. Momsdokumenten vid återlämnandet upprättas tillsammans med en redovisare. Efter återlämnandet ansöker säljaren hos CSDD om att brukaren stryks.',
  },
  et: {
    intro:
      'Müüge oma veok järelmaksuga kontrollitud veoettevõtjale või ostke veok järelmaksuga. RAHTIS koostab Läti õiguse kohase järelmaksuga ostu lepingu (nomaksas pirkums, Civillikums 2069.–2071. p.), maksegraafiku ja arved müüja nimel; ostja tasub otse müüja kontole.',
    introSeller:
      'Müüge veok järelmaksuga kontrollitud veoettevõtjale. Lisage müüdav veok; kontrollime selle andmed ja pärast heakskiitmist saate avaldada müügikuulutuse. RAHTIS koostab Läti õiguse kohase järelmaksuga ostu lepingu (nomaksas pirkums, Civillikums 2069.–2071. p.), maksegraafiku ja arved müüja nimel; ostja tasub otse teie kontole.',
    notAllowed:
      'Järelmaksuga saab tehnikat müüa iga RAHTISes registreeritud ja kontrollitud Läti ettevõte; ostja on alati kontrollitud Läti veoettevõtja. Tehingu teeb ettevõtte peakasutaja.',
    contract: 'Järelmaksuga ostu leping (PDF, läti keeles)',
    nextSteps:
      'Enne üleandmist: leping allkirjastatud, esimene arve tasutud, ostja registreeritud CSDD-s valdajana (turētājs) ja müüja jätkuvalt omanikuna (īpašnieks) – taotluse esitab müüja, ostja on kohal või annab kirjaliku volikirja (muudatus registreeritakse 5 päeva jooksul); kohustuslik liikluskindlustus (OCTA) kehtib üleandmise päevast (lepingu punkt 7.1 ütleb, kes selle sõlmib; seaduse järgi lasub kohustus omanikul, kui poliisi ei ole) ja KASKO-kindlustuses on hüvitise saajaks märgitud müüja. Enne tasulisi vedusid hangib ostja sõidukile ühenduse tegevusloa koopia või litsentsikaardi (licences kartīte).',
    invoiceNote:
      'Arved saadetakse PDF-vormingus; see sobib seni, kuni ostja elektroonilist arvet aktsepteerib. Alates 1. jaanuarist 2028 peavad Läti ettevõtete vahelised arved olema struktureeritud e-arved: sellest päevast saadab RAHTIS ainult makseteatisi ja arved koostab müüja oma raamatupidamissüsteemis.',
    thresholdsText:
      'Läti seaduse (Civillikums 2070. p.) järgi võib müüja nõuda lepingu tühistamist ja veoki tagastamist alles siis, kui kaks maksetähtpäeva on mööda lastud ja mõlemad maksed on endiselt tasumata; leping nõuab seejärel kirjalikku hoiatust vähemalt 14-päevase tähtajaga. Ühe makse hilinemine – ka suure viimase makse – annab õiguse üksnes võlg sisse nõuda.',
    thresholdTitle: 'Kaks makset on hilinenud: {plate}',
    threshold:
      'Kaks maksetähtpäeva on mööda lastud ja mõlemad maksed on tasumata (Civillikums 2070. p., lepingu punkt 9.1). Järgmine samm on kirjalik hoiatus, millega antakse ostjale tasumiseks vähemalt 14 päeva. Alles pärast seda võite nõuda lepingu tühistamist ja sõiduki tagastamist. Sõidukit ei tohi ise ära võtta: see antakse tagasi vabatahtlikult akti alusel või kohtu ja kohtutäituri (zvērināts tiesu izpildītājs) kaudu. Käivitustõket võla sissenõudmiseks ei kasutata.',
    checkRegister: 'Ostja on registreeritud CSDD-s valdajana (turētājs), müüja on jätkuvalt omanik (īpašnieks).',
    checkInsurance: 'Kohustuslik liikluskindlustus (OCTA) kehtib üleandmise päevast ja KASKO-kindlustuses on hüvitise saajaks märgitud müüja.',
    afterPaid:
      'Omand läks ostjale üle viimase makse laekumise päeval. Müüja annab ostjale 5 päeva jooksul kirjaliku kinnituse ja teeb vajalikud toimingud, et CSDD registreeriks omanikuvahetuse.',
    terminationHint:
      'Märkige tehing lõppenuks, kui leping on tühistatud ja sõiduk on teile tagasi antud (vabatahtlikult või kohtu ja kohtutäituri kaudu) või kui olete ostjaga kokku leppinud tehingu lõpetamises. Maksete arved ja meeldetuletused lõpevad. Märget ei saa tagasi võtta.',
    reasonRepossessed: 'Leping on tühistatud ja sõiduk on müüjale tagasi antud',
    settlement:
      'RAHTIS arveldust ei arvuta ega tee. Civillikums 2070. p. kohane vastastikune arveldus (savstarpējais norēķins) on kohustuslik: müüjal on õigus tasule kasutamise eest ja kahju hüvitamisele, kõik ostja maksed arvestatakse ja ülejääk tagastatakse ostjale. Pooled teevad arvelduse omavahel; vaidluse lahendab kohus. Tagastamise käibemaksudokumendid koostatakse koos raamatupidajaga. Pärast tagastamist taotleb müüja CSDD-lt valdaja kande kustutamist.',
  },
  lv: {
    intro:
      'Pārdodiet savu automašīnu uz nomaksu pārbaudītam pārvadātājam vai iegādājieties automašīnu uz nomaksu. RAHTIS sagatavo nomaksas pirkuma līgumu saskaņā ar Latvijas tiesībām (Civillikuma 2069.–2071. pants), maksājumu grafiku un rēķinus pārdevēja vārdā; pircējs maksā tieši uz pārdevēja kontu.',
    introSeller:
      'Pārdodiet automašīnu uz nomaksu pārbaudītam pārvadātājam. Pievienojiet pārdodamo automašīnu; mēs pārbaudīsim tās datus, un pēc apstiprināšanas varēsiet publicēt sludinājumu. RAHTIS sagatavo nomaksas pirkuma līgumu saskaņā ar Latvijas tiesībām (Civillikuma 2069.–2071. pants), maksājumu grafiku un rēķinus pārdevēja vārdā; pircējs maksā tieši uz jūsu kontu.',
    notAllowed:
      'Tehniku uz nomaksu var pārdot jebkurš RAHTIS reģistrēts un pārbaudīts Latvijas uzņēmums; pircējs vienmēr ir pārbaudīts Latvijas pārvadātājs. Darījumu noformē uzņēmuma galvenais lietotājs.',
    contract: 'Nomaksas pirkuma līgums (PDF)',
    nextSteps:
      'Pirms nodošanas: līgums parakstīts, pirmais rēķins samaksāts, pircējs CSDD reģistrēts kā turētājs, bet pārdevējs joprojām ir īpašnieks – iesniegumu iesniedz pārdevējs, pircējs ierodas klātienē vai izsniedz rakstveida pilnvaru (izmaiņas reģistrē 5 dienu laikā); OCTA ir spēkā no nodošanas dienas (līguma 7.1. punkts nosaka, kurš to noslēdz; saskaņā ar likumu pienākums paliek īpašniekam, ja polises nav), un KASKO polisē pārdevējs norādīts kā apdrošināšanas atlīdzības saņēmējs. Pirms komercpārvadājumiem pircējs saņem automašīnai Eiropas Kopienas atļaujas kopiju vai licences kartīti.',
    invoiceNote:
      'Rēķinus nosūta PDF formātā; tas ir derīgi, kamēr pircējs pieņem elektroniskus rēķinus. No 2028. gada 1. janvāra rēķiniem starp Latvijas uzņēmumiem jābūt strukturētiem elektroniskiem rēķiniem: no šīs dienas RAHTIS nosūta tikai maksājuma paziņojumus, bet rēķinus pārdevējs izraksta savā grāmatvedības sistēmā.',
    thresholdsText:
      'Saskaņā ar Civillikuma 2070. pantu pārdevējs var prasīt līguma atcelšanu un automašīnas atdošanu tikai tad, ja palaisti garām divi maksājumu termiņi un abi maksājumi joprojām nav samaksāti; pēc tam līgums prasa rakstveida brīdinājumu ar vismaz 14 dienu termiņu samaksai. Viena maksājuma kavējums – arī liela pēdējā maksājuma – dod tikai tiesības piedzīt nokavēto summu.',
    thresholdTitle: 'Nokavēti divi maksājumi: {plate}',
    threshold:
      'Palaisti garām divi maksājumu termiņi, un abi maksājumi nav samaksāti (Civillikuma 2070. pants, līguma 9.1. punkts). Nākamais solis ir rakstveida brīdinājums, kurā pircējam dod vismaz 14 dienas samaksai. Tikai pēc tam varat prasīt līguma atcelšanu un transportlīdzekļa atdošanu. Transportlīdzekli nedrīkst pārņemt patvaļīgi: to nodod labprātīgi ar pieņemšanas–nodošanas aktu vai ar tiesas un zvērināta tiesu izpildītāja starpniecību. Iedarbināšanas bloķēšanu parāda piedziņai neizmanto.',
    checkRegister: 'Pircējs CSDD ir reģistrēts kā turētājs; pārdevējs joprojām ir īpašnieks.',
    checkInsurance: 'OCTA ir spēkā no nodošanas dienas, un KASKO polisē pārdevējs norādīts kā apdrošināšanas atlīdzības saņēmējs.',
    afterPaid:
      'Īpašuma tiesības pārgāja pircējam pēdējā maksājuma saņemšanas dienā. Pārdevējs 5 dienu laikā izsniedz pircējam rakstveida apliecinājumu un veic nepieciešamās darbības, lai CSDD reģistrētu īpašnieka maiņu.',
    terminationHint:
      'Reģistrējiet pirkuma izbeigšanos, kad līgums ir atcelts un transportlīdzeklis jums ir atdots (labprātīgi vai ar tiesas un zvērināta tiesu izpildītāja starpniecību) vai kad esat ar pircēju vienojušies par līguma atcelšanu. Maksājumu rēķini un atgādinājumi tiek pārtraukti. Atzīmi nevar atsaukt.',
    reasonRepossessed: 'Līgums ir atcelts, un transportlīdzeklis atdots pārdevējam',
    settlement:
      'RAHTIS neaprēķina un neveic norēķinu. Savstarpējais norēķins saskaņā ar Civillikuma 2070. pantu ir obligāts: pārdevējam pienākas atlīdzība par lietošanu un zaudējumiem, visi pircēja maksājumi tiek ieskaitīti, un pārpalikumu atmaksā pircējam. Puses to veic savā starpā; strīdu izšķir tiesa. PVN dokumentus, atdodot transportlīdzekli, sagatavo kopā ar grāmatvedi. Pēc atdošanas pārdevējs iesniedz CSDD iesniegumu par turētāja dzēšanu.',
  },
  lt: {
    intro:
      'Parduokite savo sunkvežimį išsimokėtinai patikrintam vežėjui arba pirkite sunkvežimį išsimokėtinai. RAHTIS parengia pirkimo išsimokėtinai sutartį pagal Latvijos teisę (nomaksas pirkums, Civillikums 2069–2071 str.), mokėjimų grafiką ir sąskaitas pardavėjo vardu; pirkėjas moka tiesiai į pardavėjo sąskaitą.',
    introSeller:
      'Parduokite sunkvežimį išsimokėtinai patikrintam vežėjui. Pridėkite parduodamą sunkvežimį; patikrinsime jo duomenis, o jį patvirtinus galėsite paskelbti skelbimą. RAHTIS parengia pirkimo išsimokėtinai sutartį pagal Latvijos teisę (nomaksas pirkums, Civillikums 2069–2071 str.), mokėjimų grafiką ir sąskaitas pardavėjo vardu; pirkėjas moka tiesiai į jūsų sąskaitą.',
    notAllowed:
      'Techniką išsimokėtinai gali parduoti kiekviena RAHTIS užregistruota ir patikrinta Latvijos įmonė; pirkėjas visada yra patikrintas Latvijos vežėjas. Sandorį sudaro pagrindinis įmonės naudotojas.',
    contract: 'Pirkimo išsimokėtinai sutartis (PDF, latvių kalba)',
    nextSteps:
      'Iki perdavimo: sutartis pasirašyta, pirmoji sąskaita apmokėta, pirkėjas įregistruotas CSDD kaip valdytojas (turētājs), o pardavėjas lieka savininku (īpašnieks) – prašymą pateikia pardavėjas, pirkėjas atvyksta arba duoda rašytinį įgaliojimą (pakeitimas įregistruojamas per 5 dienas); privalomasis draudimas (OCTA) galioja nuo perdavimo dienos (sutarties 7.1 punkte nurodyta, kas jį sudaro; pagal įstatymą pareiga lieka savininkui, jei poliso nėra), o KASKO draudime pardavėjas nurodytas išmokos gavėju. Prieš komercinius vežimus pirkėjas gauna sunkvežimiui Bendrijos licencijos kopiją arba licencijos kortelę (licences kartīte).',
    invoiceNote:
      'Sąskaitos siunčiamos PDF formatu; tai tinka tol, kol pirkėjas priima elektronines sąskaitas. Nuo 2028 m. sausio 1 d. sąskaitos tarp Latvijos įmonių turi būti struktūrizuotos e. sąskaitos: nuo tos dienos RAHTIS siunčia tik mokėjimo pranešimus, o sąskaitas pardavėjas išrašo savo apskaitos sistemoje.',
    thresholdsText:
      'Pagal Latvijos įstatymą (Civillikums 2070 str.) pardavėjas gali reikalauti nutraukti sutartį ir grąžinti sunkvežimį tik tada, kai praleisti du įmokų terminai ir abi įmokos vis dar nesumokėtos; tada sutartis reikalauja rašytinio įspėjimo su bent 14 dienų terminu sumokėti. Viena praleista įmoka – net ir didelė paskutinė – suteikia tik teisę išieškoti pradelstą sumą.',
    thresholdTitle: 'Vėluoja dvi įmokos: {plate}',
    threshold:
      'Praleisti du įmokų terminai ir abi įmokos nesumokėtos (Civillikums 2070 str., sutarties 9.1 punktas). Kitas žingsnis – rašytinis įspėjimas, kuriuo pirkėjui duodama bent 14 dienų sumokėti. Tik po to galite reikalauti nutraukti sutartį ir grąžinti transporto priemonę. Pasiimti transporto priemonės patys negalite: ji grąžinama savanoriškai pagal perdavimo aktą arba per teismą ir prisiekusįjį antstolį (zvērināts tiesu izpildītājs). Užvedimo blokavimas skolai išieškoti nenaudojamas.',
    checkRegister: 'Pirkėjas įregistruotas CSDD kaip valdytojas (turētājs); pardavėjas lieka savininku (īpašnieks).',
    checkInsurance: 'Privalomasis draudimas (OCTA) galioja nuo perdavimo dienos, o KASKO draudime pardavėjas nurodytas išmokos gavėju.',
    afterPaid:
      'Nuosavybės teisė perėjo pirkėjui paskutinio mokėjimo gavimo dieną. Per 5 dienas pardavėjas išduoda pirkėjui rašytinį patvirtinimą ir atlieka veiksmus, reikalingus, kad CSDD įregistruotų savininko pasikeitimą.',
    terminationHint:
      'Pažymėkite sandorio pabaigą, kai sutartis nutraukta ir transporto priemonė jums grąžinta (savanoriškai arba per teismą ir antstolį) arba kai su pirkėju susitarėte nutraukti sandorį. Įmokų sąskaitos ir priminimai nebesiunčiami. Žymos atšaukti negalima.',
    reasonRepossessed: 'Sutartis nutraukta, transporto priemonė grąžinta pardavėjui',
    settlement:
      'RAHTIS atsiskaitymo neskaičiuoja ir neatlieka. Tarpusavio atsiskaitymas (savstarpējais norēķins) pagal Civillikums 2070 str. yra privalomas: pardavėjui priklauso atlyginimas už naudojimąsi ir nuostolius, visi pirkėjo mokėjimai įskaitomi, o perviršis grąžinamas pirkėjui. Šalys atsiskaito tarpusavyje; ginčą sprendžia teismas. PVM dokumentai grąžinant rengiami su buhalteriu. Po grąžinimo pardavėjas pateikia CSDD prašymą išbraukti valdytoją.',
  },
  pl: {
    intro:
      'Sprzedaj własny pojazd na raty sprawdzonemu przewoźnikowi albo kup pojazd na raty. RAHTIS przygotowuje umowę sprzedaży na raty według prawa łotewskiego (nomaksas pirkums, Civillikums art. 2069–2071), harmonogram płatności i faktury w imieniu sprzedawcy; kupujący płaci bezpośrednio na rachunek sprzedawcy.',
    introSeller:
      'Sprzedaj pojazd na raty sprawdzonemu przewoźnikowi. Dodaj pojazd, który chcesz sprzedać; sprawdzimy jego dane, a po zatwierdzeniu możesz opublikować ogłoszenie. RAHTIS przygotowuje umowę sprzedaży na raty według prawa łotewskiego (nomaksas pirkums, Civillikums art. 2069–2071), harmonogram płatności i faktury w imieniu sprzedawcy; kupujący płaci bezpośrednio na Twój rachunek.',
    notAllowed:
      'Sprzęt na raty może sprzedać każda sprawdzona łotewska firma zarejestrowana w RAHTIS; kupującym jest zawsze sprawdzony łotewski przewoźnik. Transakcję zawiera główny użytkownik firmy.',
    contract: 'Umowa sprzedaży na raty (PDF, po łotewsku)',
    nextSteps:
      'Przed wydaniem: umowa podpisana, pierwsza faktura zapłacona, kupujący zarejestrowany w CSDD jako posiadacz (turētājs), a sprzedawca pozostaje właścicielem (īpašnieks) – wniosek składa sprzedawca, kupujący stawia się osobiście albo udziela pisemnego pełnomocnictwa (zmianę rejestruje się w ciągu 5 dni); obowiązkowe ubezpieczenie OC (OCTA) obowiązuje od dnia wydania (pkt 7.1 umowy określa, kto je zawiera; zgodnie z ustawą obowiązek spoczywa na właścicielu, jeśli polisy nie ma), a w polisie KASKO sprzedawca jest wskazany jako odbiorca odszkodowania. Przed przewozami zarobkowymi kupujący uzyskuje dla pojazdu wypis z licencji wspólnotowej albo kartę licencyjną (licences kartīte).',
    invoiceNote:
      'Faktury są wysyłane w formacie PDF; jest to możliwe, dopóki kupujący akceptuje faktury elektroniczne. Od 1 stycznia 2028 r. faktury między łotewskimi firmami muszą być ustrukturyzowanymi e-fakturami: od tego dnia RAHTIS wysyła tylko zawiadomienia o płatności, a faktury sprzedawca wystawia we własnym systemie księgowym.',
    thresholdsText:
      'Według prawa łotewskiego (Civillikums art. 2070) sprzedawca może żądać rozwiązania umowy i zwrotu pojazdu dopiero wtedy, gdy minęły dwa terminy płatności rat i obie raty nadal nie są zapłacone; umowa wymaga następnie pisemnego ostrzeżenia z terminem co najmniej 14 dni na zapłatę. Jedna zaległa rata – nawet duża ostatnia – daje tylko prawo dochodzenia zaległej kwoty.',
    thresholdTitle: 'Dwie raty zaległe: {plate}',
    threshold:
      'Minęły dwa terminy płatności rat i obie raty nie są zapłacone (Civillikums art. 2070, pkt 9.1 umowy). Kolejny krok to pisemne ostrzeżenie dające kupującemu co najmniej 14 dni na zapłatę. Dopiero potem możesz żądać rozwiązania umowy i zwrotu pojazdu. Pojazdu nie wolno zabrać samodzielnie: jest on wydawany dobrowolnie na podstawie protokołu zdawczo-odbiorczego albo przez sąd i komornika (zvērināts tiesu izpildītājs). Blokady rozruchu nie stosuje się do windykacji.',
    checkRegister: 'Kupujący jest zarejestrowany w CSDD jako posiadacz (turētājs); sprzedawca pozostaje właścicielem (īpašnieks).',
    checkInsurance: 'Obowiązkowe ubezpieczenie OC (OCTA) obowiązuje od dnia wydania, a w polisie KASKO sprzedawca jest wskazany jako odbiorca odszkodowania.',
    afterPaid:
      'Własność przeszła na kupującego w dniu wpływu ostatniej płatności. W ciągu 5 dni sprzedawca wydaje kupującemu pisemne potwierdzenie i podejmuje czynności potrzebne do zarejestrowania zmiany właściciela w CSDD.',
    terminationHint:
      'Odnotuj zakończenie, gdy umowa została rozwiązana, a pojazd został Ci zwrócony (dobrowolnie albo przez sąd i komornika), albo gdy uzgodniłeś z kupującym zakończenie sprzedaży. Faktury za raty i przypomnienia przestają być wysyłane. Tej operacji nie można cofnąć.',
    reasonRepossessed: 'Umowa została rozwiązana, pojazd zwrócono sprzedawcy',
    settlement:
      'RAHTIS nie oblicza ani nie przeprowadza rozliczenia. Wzajemne rozliczenie (savstarpējais norēķins) według Civillikums art. 2070 jest obowiązkowe: sprzedawcy należy się wynagrodzenie za korzystanie i odszkodowanie, wszystkie wpłaty kupującego są zaliczane, a nadwyżka jest zwracana kupującemu. Strony rozliczają się między sobą; spór rozstrzyga sąd. Dokumenty VAT przy zwrocie przygotowuje się z księgowym. Po zwrocie sprzedawca składa w CSDD wniosek o wykreślenie posiadacza.',
  },
  de: {
    intro:
      'Verkaufen Sie Ihren eigenen Lkw auf Raten an ein geprüftes Transportunternehmen oder kaufen Sie einen Lkw auf Raten. RAHTIS erstellt einen Abzahlungskaufvertrag nach lettischem Recht (nomaksas pirkums, Civillikums Art. 2069–2071), den Zahlungsplan und die Rechnungen im Namen des Verkäufers; der Käufer zahlt direkt auf das Konto des Verkäufers.',
    introSeller:
      'Verkaufen Sie einen Lkw auf Raten an ein geprüftes Transportunternehmen. Fügen Sie das Fahrzeug hinzu, das Sie verkaufen möchten; wir prüfen die Angaben, und nach der Freigabe können Sie ein Angebot veröffentlichen. RAHTIS erstellt einen Abzahlungskaufvertrag nach lettischem Recht (nomaksas pirkums, Civillikums Art. 2069–2071), den Zahlungsplan und die Rechnungen im Namen des Verkäufers; der Käufer zahlt direkt auf Ihr Konto.',
    notAllowed:
      'Fahrzeuge auf Raten verkaufen kann jedes geprüfte lettische Unternehmen, das bei RAHTIS registriert ist; Käufer ist immer ein geprüftes lettisches Transportunternehmen. Den Kauf schließt der Hauptnutzer des Unternehmens ab.',
    contract: 'Ratenkaufvertrag (PDF, auf Lettisch)',
    nextSteps:
      'Vor der Übergabe: Vertrag unterzeichnet, erste Rechnung bezahlt, der Käufer bei der CSDD als Halter (turētājs) eingetragen, der Verkäufer bleibt Eigentümer (īpašnieks) – den Antrag stellt der Verkäufer, der Käufer erscheint persönlich oder erteilt eine schriftliche Vollmacht (die Änderung wird innerhalb von 5 Tagen eingetragen); die Kfz-Haftpflichtversicherung (OCTA) gilt ab dem Übergabetag (Ziffer 7.1 des Vertrags regelt, wer sie abschließt; nach dem Gesetz bleibt die Pflicht beim Eigentümer, wenn keine Police besteht), und in der KASKO-Police ist der Verkäufer als Empfänger der Entschädigung eingetragen. Vor gewerblichen Beförderungen beschafft der Käufer für das Fahrzeug eine Kopie der Gemeinschaftslizenz oder eine Lizenzkarte (licences kartīte).',
    invoiceNote:
      'Rechnungen werden als PDF versandt; das ist möglich, solange der Käufer elektronische Rechnungen akzeptiert. Ab dem 1. Januar 2028 müssen Rechnungen zwischen lettischen Unternehmen strukturierte E-Rechnungen sein: Ab diesem Tag versendet RAHTIS nur noch Zahlungsmitteilungen, und die Rechnungen stellt der Verkäufer in seinem eigenen Buchhaltungssystem aus.',
    thresholdsText:
      'Nach lettischem Recht (Civillikums Art. 2070) kann der Verkäufer die Aufhebung des Vertrags und die Rückgabe des Lkw erst verlangen, wenn zwei Ratentermine versäumt wurden und beide Raten noch unbezahlt sind; der Vertrag verlangt danach eine schriftliche Mahnung mit einer Zahlungsfrist von mindestens 14 Tagen. Eine einzelne versäumte Rate – auch eine hohe Schlussrate – gibt nur das Recht, den fälligen Betrag einzufordern.',
    thresholdTitle: 'Zwei Raten überfällig: {plate}',
    threshold:
      'Zwei Ratentermine wurden versäumt, und beide Raten sind unbezahlt (Civillikums Art. 2070, Ziffer 9.1 des Vertrags). Der nächste Schritt ist eine schriftliche Mahnung, die dem Käufer mindestens 14 Tage zur Zahlung gibt. Erst danach können Sie die Aufhebung des Vertrags und die Rückgabe des Fahrzeugs verlangen. Sie dürfen das Fahrzeug nicht selbst an sich nehmen: Es wird freiwillig mit einem Übergabeprotokoll zurückgegeben oder über Gericht und vereidigten Gerichtsvollzieher (zvērināts tiesu izpildītājs). Eine Wegfahrsperre wird nicht zur Eintreibung von Forderungen eingesetzt.',
    checkRegister: 'Der Käufer ist bei der CSDD als Halter (turētājs) eingetragen; der Verkäufer bleibt Eigentümer (īpašnieks).',
    checkInsurance: 'Die Kfz-Haftpflichtversicherung (OCTA) gilt ab dem Übergabetag, und in der KASKO-Police ist der Verkäufer als Empfänger der Entschädigung eingetragen.',
    afterPaid:
      'Das Eigentum ist am Tag des Eingangs der letzten Zahlung auf den Käufer übergegangen. Innerhalb von 5 Tagen stellt der Verkäufer dem Käufer eine schriftliche Bestätigung aus und unternimmt das Erforderliche, damit die CSDD den Eigentümerwechsel einträgt.',
    terminationHint:
      'Erfassen Sie dies, wenn der Vertrag aufgehoben und das Fahrzeug an Sie zurückgegeben wurde (freiwillig oder über Gericht und Gerichtsvollzieher) oder wenn Sie mit dem Käufer die Beendigung des Kaufs vereinbart haben. Ratenrechnungen und Erinnerungen enden. Der Eintrag kann nicht rückgängig gemacht werden.',
    reasonRepossessed: 'Der Vertrag wurde aufgehoben, das Fahrzeug an den Verkäufer zurückgegeben',
    settlement:
      'RAHTIS berechnet die Abrechnung nicht und führt sie nicht durch. Die gegenseitige Abrechnung (savstarpējais norēķins) nach Civillikums Art. 2070 ist zwingend: Dem Verkäufer stehen eine Nutzungsentschädigung und Schadensersatz zu, alle Zahlungen des Käufers werden angerechnet, ein Überschuss wird dem Käufer erstattet. Die Parteien rechnen untereinander ab; über einen Streit entscheidet ein Gericht. Die Umsatzsteuerbelege zur Rückgabe werden mit dem Buchhalter erstellt. Nach der Rückgabe beantragt der Verkäufer bei der CSDD die Löschung des Halters.',
  },
  ru: {
    intro:
      'Продайте свою машину в рассрочку проверенному перевозчику или купите машину в рассрочку. RAHTIS готовит договор покупки в рассрочку по латвийскому праву (nomaksas pirkums, Civillikums, ст. 2069–2071), график платежей и счета от имени продавца; покупатель платит напрямую на счёт продавца.',
    introSeller:
      'Продайте машину в рассрочку проверенному перевозчику. Добавьте машину, которую хотите продать: мы проверим её данные, и после одобрения вы сможете опубликовать объявление. RAHTIS готовит договор покупки в рассрочку по латвийскому праву (nomaksas pirkums, Civillikums, ст. 2069–2071), график платежей и счета от имени продавца; покупатель платит напрямую на ваш счёт.',
    notAllowed:
      'Продать технику в рассрочку может любая проверенная латвийская компания, зарегистрированная в RAHTIS; покупатель — всегда проверенный латвийский перевозчик. Сделку оформляет главный пользователь компании.',
    contract: 'Договор покупки в рассрочку (PDF, на латышском)',
    nextSteps:
      'До передачи: договор подписан, первый счёт оплачен, покупатель записан в CSDD держателем (turētājs), а продавец остаётся собственником (īpašnieks) — заявление подаёт продавец, покупатель приходит лично или выдаёт письменную доверенность (изменение регистрируют в течение 5 дней); обязательная страховка (OCTA) действует с даты передачи (кто её оформляет, сказано в п. 7.1 договора; по закону обязанность остаётся на собственнике, если полиса нет), а в полисе KASKO продавец указан получателем возмещения. До коммерческих перевозок покупатель получает на машину копию лицензии Сообщества или карточку лицензии (licences kartīte).',
    invoiceNote:
      'Счета отправляются в PDF; это допустимо, пока покупатель принимает электронные счета. С 1 января 2028 года счета между латвийскими компаниями должны быть структурированными электронными: с этого дня RAHTIS отправляет только платёжные уведомления, а счета продавец выписывает в своей бухгалтерской программе.',
    thresholdsText:
      'По латвийскому закону (Civillikums, ст. 2070) продавец может требовать отмены договора и возврата машины, только когда пропущены два срока платежа и оба платежа всё ещё не уплачены; после этого договор требует письменного предупреждения со сроком не короче 14 дней. Одна просрочка — даже крупного последнего платежа — даёт только право взыскать просроченную сумму.',
    thresholdTitle: 'Просрочены два платежа: {plate}',
    threshold:
      'Пропущены два срока платежа, и оба платежа не уплачены (Civillikums, ст. 2070; п. 9.1 договора). Следующий шаг — письменное предупреждение, в котором покупателю даётся не меньше 14 дней на оплату. Только после этого вы можете требовать отмены договора и возврата машины. Забирать машину самому нельзя: её передают добровольно по акту приёма-передачи либо через суд и присяжного судебного исполнителя (zvērināts tiesu izpildītājs). Блокировка запуска двигателя для взыскания не применяется.',
    checkRegister: 'Покупатель записан в CSDD держателем (turētājs), продавец остаётся собственником (īpašnieks).',
    checkInsurance: 'Обязательная страховка (OCTA) действует с даты передачи, а в полисе KASKO продавец указан получателем возмещения.',
    afterPaid:
      'Право собственности перешло к покупателю в день поступления последнего платежа. В течение 5 дней продавец выдаёт покупателю письменное подтверждение и делает всё необходимое, чтобы CSDD зарегистрировала смену собственника.',
    terminationHint:
      'Отметьте прекращение сделки, когда договор отменён и машина вам возвращена (добровольно либо через суд и судебного исполнителя) или когда вы договорились с покупателем прекратить продажу. Счета на платежи и напоминания прекратятся. Отменить отметку нельзя.',
    reasonRepossessed: 'Договор отменён, машина возвращена продавцу',
    settlement:
      'RAHTIS не считает и не проводит взаиморасчёт. Взаиморасчёт (savstarpējais norēķins) по ст. 2070 Civillikums обязателен: продавцу причитается плата за пользование и возмещение убытков, все платежи покупателя засчитываются, а излишек возвращается покупателю. Стороны проводят его между собой; спор решает суд. Документы по НДС при возврате готовят с бухгалтером. После возврата продавец подаёт в CSDD заявление об удалении записи держателя.',
  },
  ro: {
    intro:
      'Vindeți propriul camion cu plata în rate unui transportator verificat sau cumpărați un camion în rate. RAHTIS întocmește un contract de vânzare în rate conform dreptului leton (nomaksas pirkums, Civillikums art. 2069–2071), graficul de plăți și facturile în numele vânzătorului; cumpărătorul plătește direct în contul vânzătorului.',
    introSeller:
      'Vindeți un camion cu plata în rate unui transportator verificat. Adăugați vehiculul pe care doriți să îl vindeți; îi verificăm datele, iar după aprobare puteți publica un anunț. RAHTIS întocmește un contract de vânzare în rate conform dreptului leton (nomaksas pirkums, Civillikums art. 2069–2071), graficul de plăți și facturile în numele vânzătorului; cumpărătorul plătește direct în contul dumneavoastră.',
    notAllowed:
      'Orice firmă letonă verificată, înregistrată în RAHTIS, poate vinde echipamente în rate; cumpărătorul este întotdeauna un transportator leton verificat. Vânzarea o încheie utilizatorul principal al firmei.',
    contract: 'Contract de vânzare în rate (PDF, în letonă)',
    nextSteps:
      'Înainte de predare: contractul semnat, prima factură plătită, cumpărătorul înregistrat la CSDD ca deținător (turētājs), vânzătorul rămânând proprietar (īpašnieks) – cererea o depune vânzătorul, iar cumpărătorul se prezintă personal sau dă o procură scrisă (modificarea se înregistrează în 5 zile); asigurarea obligatorie de răspundere civilă auto (OCTA) este valabilă de la data predării (punctul 7.1 din contract arată cine o încheie; potrivit legii, obligația rămâne proprietarului dacă nu există poliță), iar în polița KASKO vânzătorul este trecut ca beneficiar al despăgubirii. Înainte de transporturile comerciale, cumpărătorul obține pentru vehicul copia licenței comunitare sau un card de licență (licences kartīte).',
    invoiceNote:
      'Facturile se trimit în format PDF; acest lucru este posibil cât timp cumpărătorul acceptă facturi electronice. De la 1 ianuarie 2028, facturile dintre firmele letone trebuie să fie facturi electronice structurate: din acea zi RAHTIS trimite doar înștiințări de plată, iar facturile le emite vânzătorul în propriul sistem de contabilitate.',
    thresholdsText:
      'Potrivit legii letone (Civillikums art. 2070), vânzătorul poate cere desființarea contractului și restituirea camionului numai după ce au fost ratate două termene de plată și ambele rate sunt încă neplătite; contractul cere apoi un avertisment scris cu un termen de cel puțin 14 zile pentru plată. O singură rată restantă – chiar și o rată finală mare – dă doar dreptul de a recupera suma restantă.',
    thresholdTitle: 'Două rate restante: {plate}',
    threshold:
      'Au fost ratate două termene de plată și ambele rate sunt neplătite (Civillikums art. 2070, punctul 9.1 din contract). Pasul următor este un avertisment scris care îi dă cumpărătorului cel puțin 14 zile pentru plată. Numai după aceea puteți cere desființarea contractului și restituirea vehiculului. Nu puteți lua singur vehiculul: acesta se predă de bunăvoie, pe bază de proces-verbal de predare-primire, sau prin instanță și executor judecătoresc (zvērināts tiesu izpildītājs). Imobilizatorul nu se folosește pentru recuperarea datoriilor.',
    checkRegister: 'Cumpărătorul este înregistrat la CSDD ca deținător (turētājs); vânzătorul rămâne proprietar (īpašnieks).',
    checkInsurance: 'Asigurarea obligatorie de răspundere civilă auto (OCTA) este valabilă de la data predării, iar în polița KASKO vânzătorul este trecut ca beneficiar al despăgubirii.',
    afterPaid:
      'Proprietatea a trecut la cumpărător în ziua încasării ultimei plăți. În 5 zile vânzătorul îi dă cumpărătorului o confirmare scrisă și face demersurile necesare pentru ca CSDD să înregistreze schimbarea proprietarului.',
    terminationHint:
      'Înregistrați încetarea după ce contractul a fost desființat și vehiculul v-a fost restituit (de bunăvoie sau prin instanță și executor judecătoresc) ori după ce ați convenit cu cumpărătorul încetarea vânzării. Facturile pentru rate și notificările se opresc. Înregistrarea nu poate fi anulată.',
    reasonRepossessed: 'Contractul a fost desființat, iar vehiculul a fost restituit vânzătorului',
    settlement:
      'RAHTIS nu calculează și nu efectuează decontarea. Decontarea reciprocă (savstarpējais norēķins) potrivit Civillikums art. 2070 este obligatorie: vânzătorului i se cuvin o despăgubire pentru folosință și daune, toate plățile cumpărătorului se iau în calcul, iar surplusul se restituie cumpărătorului. Părțile o fac între ele; litigiul îl soluționează instanța. Documentele de TVA la restituire se întocmesc cu contabilul. După restituire, vânzătorul depune la CSDD cererea de radiere a deținătorului.',
  },
};
