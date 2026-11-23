import type { Locale } from '../../i18n/config.ts';
import type { InstallmentLawCopy } from './types.ts';

/**
 * Дания — тексты кабинета на десяти языках (23.11.2026). Источник фактов —
 * docs/equipment-sale/countries/dk.md:
 *   · сделка — kreditkøb med ejendomsforbehold; kreditaftaleloven применяется
 *     и между компаниями (глава 11) и императивен в пользу покупателя;
 *   · порог (§ 29): просрочка 30 дней и сумма не меньше 1/10 (один взнос) или
 *     1/20 (несколько) всей суммы к уплате — цена с НДС, первый взнос и все
 *     проценты — либо весь остаток. Покупатель снимает право на изъятие,
 *     погасив просрочку с процентами и расходами (§ 37); изъятие — только
 *     через fogedretten, суд может отложить его до 4 месяцев (§ 46), у
 *     покупателя 14 дней на выкуп (§ 43). Самому забирать и блокировать машину
 *     нельзя: fogedretten тогда откажет в дальнейшем взыскании (§ 48);
 *   · оговорку о собственности надо зарегистрировать в Bilbogen (tinglysning)
 *     ДО передачи: без этого она не действует против кредиторов покупателя и
 *     добросовестного приобретателя. Сбор 1 850 kr + 1,5 % платит продавец
 *     (ставки на текущий год не сверены — так и сказано). Отдельный пункт
 *     чек-листа передачи (checkBefore);
 *   · кто записан ejer в Køretøjsregisteret при оговорке, НЕ подтверждено
 *     (открытый вопрос 1): договор оставляет продавца ejer, покупателя —
 *     bruger; текст чек-листа нейтральный и советует проверить;
 *   · проценты вне базы НДС, только если показаны отдельно с суммой в каждом
 *     платеже (momsloven § 27, stk. 3, nr. 4) — так счета и устроены;
 *   · обязателен ли электронный счёт между компаниями, не подтверждено
 *     (открытый вопрос 10): в оговорке о счёте это сказано прямо;
 *   · НДС при возврате машины не проверен (открытый вопрос 3) — отсылка к
 *     бухгалтеру, без обещаний.
 * Исследование не проверено датским юристом: формулировки не обещают
 * результата в суде и не называют расчёт базы порога подтверждённым.
 * Тексты носителем языка не вычитаны — вычитать до рекламы раздела.
 */
export const DK_TEXTS: Record<Locale, InstallmentLawCopy> = {
  fi: {
    intro:
      'Myy oma auto osamaksulla tarkastetulle kuljetusliikkeelle tai osta auto osamaksulla. RAHTIS laatii Tanskan lain mukaisen sopimuksen (luottokauppa omistuksenpidätysehdoin – køb med ejendomsforbehold, kreditaftaleloven), maksusuunnitelman ja laskut myyjän nimissä; ostaja maksaa suoraan myyjän tilille. Summat ovat Tanskan kruunuina. Omistuksenpidätys suojaa myyjää ostajan velkojilta vasta, kun se on kirjattu autokirjaan (Bilbogen).',
    introSeller:
      'Myy auto osamaksulla tarkastetulle kuljetusliikkeelle. Lisää myytävä auto, me tarkastamme sen tiedot, ja hyväksynnän jälkeen voit julkaista myynti-ilmoituksen. RAHTIS laatii Tanskan lain mukaisen sopimuksen (luottokauppa omistuksenpidätysehdoin – køb med ejendomsforbehold, kreditaftaleloven), maksusuunnitelman ja laskut myyjän nimissä; ostaja maksaa suoraan tilillesi. Summat ovat Tanskan kruunuina. Omistuksenpidätys suojaa sinua ostajan velkojilta vasta, kun se on kirjattu autokirjaan (Bilbogen).',
    notAllowed:
      'Kalustoa voi myydä osamaksulla jokainen RAHTIKSEEN rekisteröitynyt ja tarkastettu tanskalainen yritys, ja ostajana on aina tarkastettu tanskalainen kuljetusliike. Kaupan tekee yrityksen pääkäyttäjä.',
    contract: 'Kauppasopimus omistuksenpidätysehdoin (PDF, tanskaksi)',
    nextSteps:
      'Ennen luovutusta: molemmat ovat allekirjoittaneet sopimuksen ja ostaja on saanut siitä kappaleen (genpart) – luovutuksen jälkeen sovittu omistuksenpidätys on pätemätön; ensimmäinen lasku on maksettu; myyjä on ilmoittanut omistuksenpidätyksen kirjattavaksi (tinglysning) autokirjaan (Bilbogen) – maksu 1 850 kr + 1,5 % turvattavasta määrästä, sen maksaa myyjä, ellei sopimuksessa sovita toisin (kuluvan vuoden maksuja ei ole tarkistettu). Ilman kirjausta ehto on voimassa vain osapuolten välillä: jos ostaja menee konkurssiin, auto ulosmitataan tai ostaja myy sen vilpittömässä mielessä olevalle, myyjä menettää auton. Varminta on odottaa, että kirjaus on tehty; kirjaus raukeaa 10 vuodessa, ellei sitä uusita. Ostaja on merkitty ajoneuvorekisteriin (Køretøjsregisteret, Motorstyrelsen) käyttäjäksi (bruger) ja ostajan tavaraliikennelupa (godskørselstilladelse) on rekisteröity autolle. Ei ole varmistettu, kumpi osapuoli omistuksenpidätyksessä merkitään omistajaksi (ejer) – sopimuksen kohdan 5.3 mukaan myyjä pysyy omistajana; varmista asia Motorstyrelseniltä tai juristiltasi ennen luovutusta. Pakollinen vastuuvakuutus (ansvarsforsikring) on voimassa luovutuksesta alkaen ja myyjän oikeus on merkitty kaskovakuutukseen.',
    invoiceNote:
      'Laskut lähetetään PDF-muodossa Tanskan kruunuina (kr.). Alustan selvitys ei ole vahvistanut, vaaditaanko Tanskassa yritysten välillä rakenteinen verkkolasku – varmista asia kirjanpitäjältäsi; RAHTIS ei laadi verkkolaskuja. Korko on jokaisessa laskussa omana rivinään summineen: vain silloin se jää arvonlisäveron perusteen ulkopuolelle (momsloven § 27, stk. 3, nr. 4). Maksuviite on kansainvälinen RF-viite: laskuissa ei ole FI-maksuriviä (+71), koska se edellyttää myyjän omaa pankkisopimusta – ostaja maksaa myyjän tilille (IBAN) ja ilmoittaa viitteen.',
    thresholdsText:
      'Tanskan luottosopimuslain (kreditaftaleloven) § 29:n mukaan myyjä voi vaatia loput tai ottaa auton takaisin vasta, kun maksu on ollut 30 päivää myöhässä ja myöhässä on vähintään {tenth} (yksi erä) tai vähintään {twentieth} (useita eriä) taikka koko loppuosa. Rajat ovat 1/10 ja 1/20 koko maksettavasta määrästä: verollinen hinta käsirahoineen ja kaikki korot. Tässä kaupassa se tarkoittaa {needed} erän viivästystä. Tanskalainen juristi ei ole vahvistanut laskentaperustetta.',
    thresholdTitle: 'Luottosopimuslain raja täyttyy: {plate}',
    threshold:
      'Myöhässä olevat erät täyttävät kreditaftaleloven § 29:n rajan (sopimuksen kohta 9.1): 30 päivää myöhässä ja vähintään 1/10 (useilla erillä 1/20) koko maksettavasta määrästä tai koko loppuosa. Voit nyt vaatia kirjallisesti koko loppuosan tai ottaa auton takaisin. Jos ostaja maksaa myöhässä olevan määrän korkoineen ja kuluinesi ennen kuin auto on otettu takaisin, et pääsääntöisesti saa tehdä kumpaakaan (§ 37). Takaisinotto (tilbagetagelse) tehdään vain voutioikeuden (fogedretten) kautta, ellei ostaja luovuta autoa vapaaehtoisesti; oikeus voi lykätä sitä enintään 4 kuukautta, ja ostaja voi lunastaa auton 14 päivän kuluessa takaisinotosta (indløsning, § 43). Älä ota autoa itse äläkä estä sen käyttöä: fogedretten hylkää silloin jatkotoimet. Takaisinotossa tehdään tilitys (opgørelse).',
    checkBefore: [
      'Omistuksenpidätys (ejendomsforbehold) on ilmoitettu kirjattavaksi (tinglysning) autokirjaan (Bilbogen) ennen luovutusta – ilman sitä myyjän oikeus ei päde ostajan velkojiin eikä vilpittömässä mielessä olevaan ostajaan.',
    ],
    checkRegister:
      'Ostaja on merkitty ajoneuvorekisteriin (Køretøjsregisteret) käyttäjäksi (bruger) ja ostajan tavaraliikennelupa on rekisteröity autolle; omistajamerkintä (ejer) on tehty sopimuksen kohdan 5.3 mukaisesti (alusta ei ole varmistanut, kumpi osapuoli merkitään omistajaksi).',
    checkInsurance:
      'Pakollinen vastuuvakuutus (ansvarsforsikring) on voimassa luovutuksesta alkaen, ja vakuutusyhtiö on vahvistanut kirjallisesti, että myyjän omistuksenpidätys on merkitty kaskovakuutukseen.',
    afterPaid:
      'Omistusoikeus siirtyi ostajalle päivänä, jona viimeinen maksu saapui myyjän tilille. Myyjä ilmoittaa viipymättä omistuksenpidätyksen poistettavaksi (aflysning) autokirjasta (Bilbogen); jos myyjä on ajoneuvorekisterissä omistajana (ejer), ostaja rekisteröi itsensä omistajaksi 4 arkipäivän kuluessa.',
    terminationHint:
      'Kirjaa kauppa päättyneeksi, kun auto on otettu takaisin (ostaja luovutti sen vapaaehtoisesti tai fogedrettenin kautta) tai kun olette sopineet ostajan kanssa kaupan päättämisestä. Ostaja voi vielä 14 päivän ajan lunastaa auton maksamalla tilityksen mukaisen saatavan. Maksuerien laskutus ja muistutukset loppuvat. Merkintää ei voi perua.',
    reasonRepossessed: 'Myyjä on ottanut auton takaisin (tilbagetagelse)',
    settlement:
      'RAHTIS ei laske eikä toimita tilitystä. Sopimuksen kohdan 9.6 ja kreditaftaleloven §§ 38–40:n mukainen tilitys (opgørelse) tehdään osapuolten kesken; jos arvosta ei päästä sopuun, sen vahvistaa fogedretten. Jos auton arvo ylittää saatavan, myyjä maksaa erotuksen ostajalle samalla, kun ottaa auton takaisin; jos arvo on pienempi, myyjä voi vaatia erotuksen. Palautuksen arvonlisäverokäsittelyä ei ole varmistettu – sovi siitä kirjanpitäjän kanssa. Myyjä ilmoittaa omistuksenpidätyksen poistettavaksi autokirjasta (Bilbogen).',
    rateHint:
      '0 = ei korkoa. Korko laskutetaan omana rivinään niin, että sen määrä näkyy jokaisessa maksussa; vain silloin se jää arvonlisäveron perusteen ulkopuolelle (momsloven § 27, stk. 3, nr. 4). Myös koroton kauppa kuuluu kreditaftaleloven piiriin.',
  },
  en: {
    intro:
      'Sell your own truck in instalments to a verified carrier, or buy one in instalments. RAHTIS prepares a contract under Danish law (credit purchase with retention of title – køb med ejendomsforbehold, kreditaftaleloven), the payment plan and the invoices in the seller’s name; the buyer pays straight to the seller’s account. Amounts are in Danish kroner. The retention of title protects the seller against the buyer’s creditors only once it is registered in the Motor Vehicle Securities Register (Bilbogen).',
    introSeller:
      'Sell a truck in instalments to a verified carrier. Add the vehicle you want to sell; we check its details, and once it is approved you can publish a listing. RAHTIS prepares a contract under Danish law (credit purchase with retention of title – køb med ejendomsforbehold, kreditaftaleloven), the payment plan and the invoices in the seller’s name; the buyer pays straight to your account. Amounts are in Danish kroner. The retention of title protects you against the buyer’s creditors only once it is registered in the Motor Vehicle Securities Register (Bilbogen).',
    notAllowed:
      'Any verified Danish company registered in RAHTIS can sell equipment in instalments; the buyer is always a verified Danish carrier. The sale is made by the company’s main user.',
    contract: 'Purchase contract with retention of title (PDF, in Danish)',
    nextSteps:
      'Before handover: the contract is signed by both parties and the buyer has received a copy (genpart) – a retention of title agreed after handover is invalid; the first invoice is paid; the seller has filed the retention of title for registration (tinglysning) in the Bilbogen – fee 1,850 kr plus 1.5 % of the secured amount, paid by the seller unless the contract says otherwise (this year’s rates have not been checked). Without registration the reservation holds only between the parties: if the buyer goes bankrupt, the vehicle is seized or the buyer sells it to someone in good faith, the seller loses the vehicle. It is safest to wait until the registration is completed; it lapses after 10 years unless renewed. The buyer is registered as user (bruger) in the motor register (Køretøjsregisteret, Motorstyrelsen) and the buyer’s haulage permit (godskørselstilladelse) is registered on the vehicle. Which party should be recorded as owner (ejer) under a retention of title is not confirmed – clause 5.3 of the contract keeps the seller as owner; check with Motorstyrelsen or your lawyer before handover. Compulsory liability insurance (ansvarsforsikring) is in force from handover and the seller’s right is noted on the comprehensive (kasko) policy.',
    invoiceNote:
      'Invoices are sent as PDF in Danish kroner (kr.). The platform’s research has not confirmed whether Danish rules require a structured electronic invoice between companies – check with your accountant; RAHTIS does not produce e-invoices. Interest is shown on its own line of every invoice with its amount: only then is it outside the VAT base (momsloven § 27, stk. 3, nr. 4). The payment reference is an international RF reference: the invoices carry no FI payment line (+71), because that needs the seller’s own bank agreement – the buyer pays to the seller’s account (IBAN) and quotes the reference.',
    thresholdsText:
      'Under section 29 of the Danish Credit Agreements Act (kreditaftaleloven) the seller may demand the rest or take the truck back only when a payment is 30 days overdue and at least {tenth} (one instalment) or at least {twentieth} (several instalments) is overdue, or the whole remainder. The limits are 1/10 and 1/20 of the total amount payable: the price with VAT including the down payment, plus all interest. In this deal: overdue instalments needed – {needed}. The basis of the calculation has not been confirmed by a Danish lawyer.',
    thresholdTitle: 'Credit Agreements Act threshold reached: {plate}',
    threshold:
      'The overdue instalments meet the threshold of kreditaftaleloven § 29 (clause 9.1 of the contract): 30 days late and at least 1/10 (1/20 with several instalments) of the total amount payable, or the whole remainder. You may now demand the whole remainder in writing or take the vehicle back. If the buyer pays the overdue amount with interest and your costs before the vehicle is taken back, you may as a rule do neither (§ 37). Taking back (tilbagetagelse) is done only through the enforcement court (fogedretten) unless the buyer hands the vehicle over voluntarily; the court may postpone it for up to 4 months, and the buyer may redeem the vehicle within 14 days after it is taken back (indløsning, § 43). Do not take the vehicle yourself and do not immobilise it: fogedretten will then refuse further enforcement. A settlement (opgørelse) is made on taking back.',
    checkBefore: [
      'The retention of title (ejendomsforbehold) has been filed for registration (tinglysning) in the Bilbogen before handover – without it the seller’s right does not hold against the buyer’s creditors or a purchaser in good faith.',
    ],
    checkRegister:
      'The buyer is registered as user (bruger) in the motor register (Køretøjsregisteret) and the buyer’s haulage permit is registered on the vehicle; the owner (ejer) entry is made as agreed in clause 5.3 of the contract (the platform has not confirmed which party should be recorded as owner).',
    checkInsurance:
      'Compulsory liability insurance (ansvarsforsikring) is in force from handover, and the insurer has confirmed in writing that the seller’s retention of title is noted on the comprehensive (kasko) policy.',
    afterPaid:
      'Ownership passed to the buyer on the day the last payment reached the seller’s account. The seller files without delay for deletion (aflysning) of the retention of title in the Bilbogen; if the seller is recorded as owner (ejer) in the motor register, the buyer registers as owner within 4 working days.',
    terminationHint:
      'Record this when the vehicle has been taken back (the buyer handed it over voluntarily or through fogedretten), or when you and the buyer have agreed to end the sale. For 14 days the buyer may still redeem the vehicle by paying the settled claim. Instalment invoices and reminders stop. This cannot be undone.',
    reasonRepossessed: 'The seller has taken the vehicle back (tilbagetagelse)',
    settlement:
      'RAHTIS does not calculate or carry out the settlement. The settlement (opgørelse) under clause 9.6 of the contract and kreditaftaleloven §§ 38–40 is made between the parties; if they cannot agree on the value, fogedretten sets it. If the vehicle is worth more than the claim, the seller pays the difference to the buyer when taking the vehicle back; if it is worth less, the seller may claim the difference. The VAT treatment of the return has not been confirmed – agree it with an accountant. The seller files for deletion of the retention of title in the Bilbogen.',
    rateHint:
      '0 = no interest. Interest is invoiced on a separate line so that its amount is visible in every payment; only then is it outside the VAT base (momsloven § 27, stk. 3, nr. 4). An interest-free sale is still covered by kreditaftaleloven.',
  },
  sv: {
    intro:
      'Sälj din egen bil på avbetalning till ett kontrollerat åkeri eller köp en bil på avbetalning. RAHTIS upprättar ett avtal enligt dansk lag (kreditköp med äganderättsförbehåll – køb med ejendomsforbehold, kreditaftaleloven), en betalningsplan och fakturor i säljarens namn; köparen betalar direkt till säljarens konto. Beloppen anges i danska kronor. Äganderättsförbehållet skyddar säljaren mot köparens borgenärer först när det är registrerat i bilboken (Bilbogen).',
    introSeller:
      'Sälj en bil på avbetalning till ett kontrollerat åkeri. Lägg till bilen du vill sälja; vi kontrollerar uppgifterna, och när den har godkänts kan du publicera en annons. RAHTIS upprättar ett avtal enligt dansk lag (kreditköp med äganderättsförbehåll – køb med ejendomsforbehold, kreditaftaleloven), en betalningsplan och fakturor i säljarens namn; köparen betalar direkt till ditt konto. Beloppen anges i danska kronor. Äganderättsförbehållet skyddar dig mot köparens borgenärer först när det är registrerat i bilboken (Bilbogen).',
    notAllowed:
      'Varje kontrollerat danskt företag som är registrerat i RAHTIS kan sälja fordon på avbetalning; köparen är alltid ett kontrollerat danskt åkeri. Köpet görs av företagets huvudanvändare.',
    contract: 'Köpekontrakt med äganderättsförbehåll (PDF, på danska)',
    nextSteps:
      'Före överlämnandet: avtalet är undertecknat av båda parter och köparen har fått ett exemplar (genpart) – ett äganderättsförbehåll som avtalas efter överlämnandet är ogiltigt; första fakturan är betald; säljaren har anmält äganderättsförbehållet för registrering (tinglysning) i bilboken (Bilbogen) – avgift 1 850 kr + 1,5 % av det säkrade beloppet, som säljaren betalar om inte avtalet säger annat (årets avgifter är inte kontrollerade). Utan registrering gäller förbehållet bara mellan parterna: om köparen går i konkurs, fordonet utmäts eller köparen säljer det till någon i god tro förlorar säljaren fordonet. Säkrast är att vänta tills registreringen är klar; den upphör efter 10 år om den inte förnyas. Köparen är registrerad som brukare (bruger) i fordonsregistret (Køretøjsregisteret, Motorstyrelsen) och köparens tillstånd för godstransporter (godskørselstilladelse) är registrerat på fordonet. Vilken part som ska stå som ägare (ejer) vid äganderättsförbehåll är inte bekräftat – enligt avtalets punkt 5.3 står säljaren kvar som ägare; kontrollera med Motorstyrelsen eller er jurist före överlämnandet. Obligatorisk ansvarsförsäkring (ansvarsforsikring) gäller från överlämnandet och säljarens rätt är antecknad i kaskoförsäkringen.',
    invoiceNote:
      'Fakturorna skickas som PDF i danska kronor (kr.). Plattformens utredning har inte bekräftat om danska regler kräver strukturerad e-faktura mellan företag – kontrollera med din redovisare; RAHTIS skapar inga e-fakturor. Räntan står på en egen rad med belopp i varje faktura: bara då ligger den utanför momsunderlaget (momsloven § 27, stk. 3, nr. 4). Betalningsreferensen är en internationell RF-referens: fakturorna har ingen FI-betalningsrad (+71), eftersom den kräver säljarens eget avtal med banken – köparen betalar till säljarens konto (IBAN) och anger referensen.',
    thresholdsText:
      'Enligt 29 § i den danska kreditavtalslagen (kreditaftaleloven) får säljaren kräva resten eller återta bilen först när en betalning är 30 dagar försenad och minst {tenth} (en delbetalning) eller minst {twentieth} (flera delbetalningar) är försenat, eller hela återstoden. Gränserna är 1/10 och 1/20 av det totala belopp som ska betalas: priset med moms inklusive kontantinsatsen och all ränta. Antal försenade delbetalningar som krävs i det här köpet: {needed}. Beräkningsgrunden har inte bekräftats av en dansk jurist.',
    thresholdTitle: 'Kreditavtalslagens gräns är nådd: {plate}',
    threshold:
      'De försenade delbetalningarna når gränsen i kreditaftaleloven § 29 (avtalets punkt 9.1): 30 dagars dröjsmål och minst 1/10 (1/20 vid flera delbetalningar) av det totala beloppet, eller hela återstoden. Du får nu skriftligen kräva hela återstoden eller återta fordonet. Om köparen betalar det försenade beloppet med ränta och dina kostnader innan fordonet har återtagits får du i regel inte göra något av det (§ 37). Återtagande (tilbagetagelse) sker bara genom fogderätten (fogedretten), om köparen inte lämnar ut fordonet frivilligt; rätten kan skjuta upp det i högst 4 månader, och köparen får lösa in fordonet inom 14 dagar efter återtagandet (indløsning, § 43). Ta inte fordonet själv och spärra det inte: fogedretten avvisar då fortsatt verkställighet. Vid återtagande görs en avräkning (opgørelse).',
    checkBefore: [
      'Äganderättsförbehållet (ejendomsforbehold) är anmält för registrering (tinglysning) i bilboken (Bilbogen) före överlämnandet – utan det gäller säljarens rätt inte mot köparens borgenärer eller en förvärvare i god tro.',
    ],
    checkRegister:
      'Köparen är registrerad som brukare (bruger) i fordonsregistret (Køretøjsregisteret) och köparens tillstånd för godstransporter är registrerat på fordonet; uppgiften om ägare (ejer) är gjord enligt avtalets punkt 5.3 (plattformen har inte bekräftat vilken part som ska stå som ägare).',
    checkInsurance:
      'Obligatorisk ansvarsförsäkring (ansvarsforsikring) gäller från överlämnandet, och försäkringsbolaget har skriftligen bekräftat att säljarens äganderättsförbehåll är antecknat i kaskoförsäkringen.',
    afterPaid:
      'Äganderätten övergick till köparen den dag den sista betalningen kom in på säljarens konto. Säljaren anmäler utan dröjsmål att äganderättsförbehållet ska avföras (aflysning) ur bilboken (Bilbogen); om säljaren står som ägare (ejer) i fordonsregistret registrerar köparen sig som ägare inom 4 vardagar.',
    terminationHint:
      'Registrera detta när fordonet har återtagits (köparen lämnade ut det frivilligt eller genom fogedretten) eller när du och köparen har kommit överens om att avsluta köpet. Köparen får i 14 dagar fortfarande lösa in fordonet genom att betala fordran enligt avräkningen. Fakturor för delbetalningar och påminnelser upphör. Det går inte att ångra.',
    reasonRepossessed: 'Säljaren har återtagit fordonet (tilbagetagelse)',
    settlement:
      'RAHTIS beräknar eller genomför inte avräkningen. Avräkningen (opgørelse) enligt avtalets punkt 9.6 och kreditaftaleloven §§ 38–40 görs mellan parterna; om de inte kan enas om värdet fastställer fogedretten det. Om fordonet är värt mer än fordran betalar säljaren mellanskillnaden till köparen samtidigt som fordonet återtas; om det är värt mindre får säljaren kräva mellanskillnaden. Hur momsen hanteras vid återtagandet är inte bekräftat – bestäm det tillsammans med en redovisare. Säljaren anmäler att äganderättsförbehållet ska avföras ur bilboken (Bilbogen).',
    rateHint:
      '0 = ingen ränta. Räntan faktureras på en egen rad så att beloppet syns i varje betalning; bara då ligger den utanför momsunderlaget (momsloven § 27, stk. 3, nr. 4). Även ett räntefritt köp omfattas av kreditaftaleloven.',
  },
  et: {
    intro:
      'Müüge oma veok järelmaksuga kontrollitud veoettevõtjale või ostke veok järelmaksuga. RAHTIS koostab Taani õiguse kohase lepingu (krediidiga ost omandireservatsiooniga – køb med ejendomsforbehold, kreditaftaleloven), maksegraafiku ja arved müüja nimel; ostja tasub otse müüja kontole. Summad on Taani kroonides. Omandireservatsioon kaitseb müüjat ostja võlausaldajate eest alles siis, kui see on kantud autoraamatusse (Bilbogen).',
    introSeller:
      'Müüge veok järelmaksuga kontrollitud veoettevõtjale. Lisage müüdav veok; kontrollime selle andmed ja pärast heakskiitmist saate avaldada müügikuulutuse. RAHTIS koostab Taani õiguse kohase lepingu (krediidiga ost omandireservatsiooniga – køb med ejendomsforbehold, kreditaftaleloven), maksegraafiku ja arved müüja nimel; ostja tasub otse teie kontole. Summad on Taani kroonides. Omandireservatsioon kaitseb teid ostja võlausaldajate eest alles siis, kui see on kantud autoraamatusse (Bilbogen).',
    notAllowed:
      'Järelmaksuga saab tehnikat müüa iga RAHTISes registreeritud ja kontrollitud Taani ettevõte; ostja on alati kontrollitud Taani veoettevõtja. Tehingu teeb ettevõtte peakasutaja.',
    contract: 'Omandireservatsiooniga ostuleping (PDF, taani keeles)',
    nextSteps:
      'Enne üleandmist: leping on mõlema poole allkirjastatud ja ostja on saanud selle eksemplari (genpart) – pärast üleandmist kokku lepitud omandireservatsioon on kehtetu; esimene arve on tasutud; müüja on esitanud omandireservatsiooni registreerimiseks (tinglysning) autoraamatusse (Bilbogen) – tasu 1 850 kr + 1,5 % tagatavast summast, selle maksab müüja, kui lepingus ei ole kokku lepitud teisiti (tänavusi määrasid ei ole kontrollitud). Ilma registreerimiseta kehtib reservatsioon ainult poolte vahel: kui ostja läheb pankrotti, sõiduk arestitakse või ostja müüb selle heausksele isikule, kaotab müüja sõiduki. Kindlaim on oodata, kuni kanne on tehtud; kanne lõpeb 10 aasta pärast, kui seda ei uuendata. Ostja on kantud sõidukiregistrisse (Køretøjsregisteret, Motorstyrelsen) kasutajana (bruger) ja ostja veoluba (godskørselstilladelse) on sõidukile registreeritud. Ei ole kinnitatud, kumb pool märgitakse omandireservatsiooni korral omanikuks (ejer) – lepingu punkti 5.3 järgi jääb omanikuks müüja; kontrollige seda Motorstyrelsenist või oma juristilt enne üleandmist. Kohustuslik vastutuskindlustus (ansvarsforsikring) kehtib üleandmisest ja müüja õigus on märgitud kaskokindlustuses.',
    invoiceNote:
      'Arved saadetakse PDF-vormingus Taani kroonides (kr.). Platvormi uuring ei ole kinnitanud, kas Taanis nõutakse ettevõtete vahel struktureeritud e-arvet – kontrollige oma raamatupidajaga; RAHTIS e-arveid ei koosta. Intress on igal arvel eraldi real koos summaga: ainult siis jääb see käibemaksu maksustatavast väärtusest välja (momsloven § 27, stk. 3, nr. 4). Makseviide on rahvusvaheline RF-viide: arvetel ei ole FI-makserida (+71), sest see eeldab müüja enda lepingut pangaga – ostja tasub müüja kontole (IBAN) ja märgib viite.',
    thresholdsText:
      'Taani krediidilepingute seaduse (kreditaftaleloven) § 29 järgi võib müüja nõuda jääki või võtta veoki tagasi alles siis, kui makse on 30 päeva hilinenud ja hilinenud on vähemalt {tenth} (üks osamakse) või vähemalt {twentieth} (mitu osamakset) või kogu jääk. Piirid on 1/10 ja 1/20 kogu tasumisele kuuluvast summast: hind koos käibemaksuga, sealhulgas sissemakse, ja kogu intress. Selles tehingus tähendab see {needed} osamakse hilinemist. Arvutuse alust ei ole Taani jurist kinnitanud.',
    thresholdTitle: 'Krediidilepingute seaduse piir on täitunud: {plate}',
    threshold:
      'Hilinenud osamaksed täidavad kreditaftaleloven § 29 piiri (lepingu punkt 9.1): 30 päeva hilinenud ja vähemalt 1/10 (mitme osamakse korral 1/20) kogu tasumisele kuuluvast summast või kogu jääk. Nüüd võite kirjalikult nõuda kogu jäägi tasumist või võtta sõiduki tagasi. Kui ostja tasub hilinenud summa koos intressi ja teie kuludega enne sõiduki tagasivõtmist, ei või te üldjuhul kumbagi teha (§ 37). Tagasivõtmine (tilbagetagelse) toimub ainult täitekohtu (fogedretten) kaudu, kui ostja sõidukit vabatahtlikult üle ei anna; kohus võib seda edasi lükata kuni 4 kuud ja ostja võib sõiduki 14 päeva jooksul pärast tagasivõtmist välja osta (indløsning, § 43). Ärge võtke sõidukit ise ära ega blokeerige seda: fogedretten keeldub siis edasisest täitmisest. Tagasivõtmisel tehakse arveldus (opgørelse).',
    checkBefore: [
      'Omandireservatsioon (ejendomsforbehold) on enne üleandmist esitatud registreerimiseks (tinglysning) autoraamatusse (Bilbogen) – ilma selleta ei kehti müüja õigus ostja võlausaldajate ega heauskse omandaja suhtes.',
    ],
    checkRegister:
      'Ostja on kantud sõidukiregistrisse (Køretøjsregisteret) kasutajana (bruger) ja ostja veoluba on sõidukile registreeritud; omaniku (ejer) kanne on tehtud lepingu punkti 5.3 kohaselt (platvorm ei ole kinnitanud, kumb pool omanikuks märgitakse).',
    checkInsurance:
      'Kohustuslik vastutuskindlustus (ansvarsforsikring) kehtib üleandmisest ja kindlustusandja on kirjalikult kinnitanud, et müüja omandireservatsioon on kaskokindlustuses märgitud.',
    afterPaid:
      'Omand läks ostjale üle päeval, mil viimane makse laekus müüja kontole. Müüja esitab viivitamata taotluse omandireservatsiooni kustutamiseks (aflysning) autoraamatust (Bilbogen); kui müüja on sõidukiregistris omanik (ejer), registreerib ostja end omanikuks 4 tööpäeva jooksul.',
    terminationHint:
      'Märkige tehing lõppenuks, kui sõiduk on tagasi võetud (ostja andis selle üle vabatahtlikult või fogedretteni kaudu) või kui olete ostjaga kokku leppinud tehingu lõpetamises. Ostja võib veel 14 päeva jooksul sõiduki välja osta, tasudes arvelduse järgse nõude. Osamaksete arved ja meeldetuletused lõpevad. Märget ei saa tagasi võtta.',
    reasonRepossessed: 'Müüja on sõiduki tagasi võtnud (tilbagetagelse)',
    settlement:
      'RAHTIS arveldust ei arvuta ega tee. Lepingu punkti 9.6 ja kreditaftaleloven §§ 38–40 kohane arveldus (opgørelse) tehakse poolte vahel; kui väärtuses kokku ei lepita, määrab selle fogedretten. Kui sõiduki väärtus ületab nõude, tasub müüja vahe ostjale sõiduki tagasivõtmisega samal ajal; kui väärtus on väiksem, võib müüja vahet nõuda. Tagastamise käibemaksukäsitlust ei ole kinnitatud – leppige see kokku raamatupidajaga. Müüja esitab taotluse omandireservatsiooni kustutamiseks autoraamatust (Bilbogen).',
    rateHint:
      '0 = intressi ei arvestata. Intress esitatakse eraldi real nii, et selle summa on igas makses näha; ainult siis jääb see käibemaksu maksustatavast väärtusest välja (momsloven § 27, stk. 3, nr. 4). Ka intressita müük kuulub kreditaftaleloven kohaldamisalasse.',
  },
  lv: {
    intro:
      'Pārdodiet savu automašīnu uz nomaksu pārbaudītam pārvadātājam vai iegādājieties automašīnu uz nomaksu. RAHTIS sagatavo līgumu saskaņā ar Dānijas tiesībām (pirkums kredītā ar īpašuma tiesību paturēšanu – køb med ejendomsforbehold, kreditaftaleloven), maksājumu grafiku un rēķinus pārdevēja vārdā; pircējs maksā tieši uz pārdevēja kontu. Summas ir Dānijas kronās. Īpašuma tiesību paturēšana aizsargā pārdevēju pret pircēja kreditoriem tikai tad, kad tā reģistrēta automašīnu grāmatā (Bilbogen).',
    introSeller:
      'Pārdodiet automašīnu uz nomaksu pārbaudītam pārvadātājam. Pievienojiet pārdodamo automašīnu; mēs pārbaudīsim tās datus, un pēc apstiprināšanas varēsiet publicēt sludinājumu. RAHTIS sagatavo līgumu saskaņā ar Dānijas tiesībām (pirkums kredītā ar īpašuma tiesību paturēšanu – køb med ejendomsforbehold, kreditaftaleloven), maksājumu grafiku un rēķinus pārdevēja vārdā; pircējs maksā tieši uz jūsu kontu. Summas ir Dānijas kronās. Īpašuma tiesību paturēšana aizsargā jūs pret pircēja kreditoriem tikai tad, kad tā reģistrēta automašīnu grāmatā (Bilbogen).',
    notAllowed:
      'Tehniku uz nomaksu var pārdot jebkurš RAHTIS reģistrēts un pārbaudīts Dānijas uzņēmums; pircējs vienmēr ir pārbaudīts Dānijas pārvadātājs. Darījumu noformē uzņēmuma galvenais lietotājs.',
    contract: 'Pirkuma līgums ar īpašuma tiesību paturēšanu (PDF, dāņu valodā)',
    nextSteps:
      'Pirms nodošanas: līgumu parakstījušas abas puses, un pircējs saņēmis tā eksemplāru (genpart) – pēc nodošanas norunāta īpašuma tiesību paturēšana nav spēkā; pirmais rēķins ir samaksāts; pārdevējs ir pieteicis īpašuma tiesību paturēšanu reģistrācijai (tinglysning) automašīnu grāmatā (Bilbogen) – nodeva 1 850 kr + 1,5 % no nodrošinātās summas, to maksā pārdevējs, ja līgumā nav noteikts citādi (šā gada likmes nav pārbaudītas). Bez reģistrācijas atruna ir spēkā tikai starp pusēm: ja pircējs bankrotē, transportlīdzekli apķīlā vai pircējs to pārdod labticīgai personai, pārdevējs transportlīdzekli zaudē. Drošāk ir sagaidīt, līdz reģistrācija ir pabeigta; tā zaudē spēku pēc 10 gadiem, ja netiek atjaunota. Pircējs ir ierakstīts transportlīdzekļu reģistrā (Køretøjsregisteret, Motorstyrelsen) kā lietotājs (bruger), un pircēja kravu pārvadājumu atļauja (godskørselstilladelse) ir reģistrēta transportlīdzeklim. Nav apstiprināts, kuru pusi īpašuma tiesību paturēšanas gadījumā ieraksta kā īpašnieku (ejer) – saskaņā ar līguma 5.3. punktu īpašnieks paliek pārdevējs; pirms nodošanas pārbaudiet to Motorstyrelsen vai pie sava jurista. Obligātā civiltiesiskās atbildības apdrošināšana (ansvarsforsikring) ir spēkā no nodošanas, un pārdevēja tiesības ir atzīmētas KASKO polisē.',
    invoiceNote:
      'Rēķinus nosūta PDF formātā Dānijas kronās (kr.). Platformas izpēte nav apstiprinājusi, vai Dānijā starp uzņēmumiem obligāts ir strukturēts elektroniskais rēķins – pārbaudiet pie sava grāmatveža; RAHTIS e-rēķinus nesagatavo. Procenti katrā rēķinā ir atsevišķā rindā ar summu: tikai tad tie nav iekļauti PVN bāzē (momsloven § 27, stk. 3, nr. 4). Maksājuma atsauce ir starptautiskā RF atsauce: rēķinos nav FI maksājuma rindas (+71), jo tai vajadzīgs paša pārdevēja līgums ar banku – pircējs maksā uz pārdevēja kontu (IBAN) un norāda atsauci.',
    thresholdsText:
      'Saskaņā ar Dānijas kredītlīgumu likuma (kreditaftaleloven) 29. pantu pārdevējs var prasīt atlikumu vai atņemt automašīnu tikai tad, ja maksājums kavēts 30 dienas un nokavēti ir vismaz {tenth} (viens maksājums) vai vismaz {twentieth} (vairāki maksājumi), vai viss atlikums. Robežas ir 1/10 un 1/20 no visas maksājamās summas: cena ar PVN, ieskaitot pirmo iemaksu, un visi procenti. Šajā darījumā tam vajadzīgais nokavēto maksājumu skaits: {needed}. Aprēķina bāzi Dānijas jurists nav apstiprinājis.',
    thresholdTitle: 'Kredītlīgumu likuma slieksnis sasniegts: {plate}',
    threshold:
      'Nokavētie maksājumi sasniedz kreditaftaleloven § 29 slieksni (līguma 9.1. punkts): kavējums 30 dienas un vismaz 1/10 (vairākiem maksājumiem – 1/20) no visas maksājamās summas vai viss atlikums. Tagad varat rakstveidā prasīt visu atlikumu vai atņemt transportlīdzekli. Ja pircējs samaksā nokavēto summu ar procentiem un jūsu izdevumiem, pirms transportlīdzeklis atņemts, parasti nedrīkstat darīt ne vienu, ne otru (§ 37). Atņemšana (tilbagetagelse) notiek tikai ar izpildu tiesas (fogedretten) starpniecību, ja pircējs transportlīdzekli neatdod labprātīgi; tiesa var to atlikt līdz 4 mēnešiem, un pircējs 14 dienu laikā pēc atņemšanas var transportlīdzekli izpirkt (indløsning, § 43). Neņemiet transportlīdzekli pats un nebloķējiet to: fogedretten tad atteiks turpmāku izpildi. Atņemot veic norēķinu (opgørelse).',
    checkBefore: [
      'Īpašuma tiesību paturēšana (ejendomsforbehold) pirms nodošanas ir pieteikta reģistrācijai (tinglysning) automašīnu grāmatā (Bilbogen) – bez tās pārdevēja tiesības nav spēkā pret pircēja kreditoriem un labticīgu ieguvēju.',
    ],
    checkRegister:
      'Pircējs ir ierakstīts transportlīdzekļu reģistrā (Køretøjsregisteret) kā lietotājs (bruger), un pircēja kravu pārvadājumu atļauja ir reģistrēta transportlīdzeklim; īpašnieka (ejer) ieraksts izdarīts saskaņā ar līguma 5.3. punktu (platforma nav apstiprinājusi, kuru pusi ieraksta kā īpašnieku).',
    checkInsurance:
      'Obligātā civiltiesiskās atbildības apdrošināšana (ansvarsforsikring) ir spēkā no nodošanas, un apdrošinātājs rakstveidā apliecinājis, ka pārdevēja īpašuma tiesību paturēšana ir atzīmēta KASKO polisē.',
    afterPaid:
      'Īpašuma tiesības pārgāja pircējam dienā, kad pēdējais maksājums saņemts pārdevēja kontā. Pārdevējs nekavējoties piesaka īpašuma tiesību paturēšanas dzēšanu (aflysning) automašīnu grāmatā (Bilbogen); ja transportlīdzekļu reģistrā par īpašnieku (ejer) ierakstīts pārdevējs, pircējs reģistrējas kā īpašnieks 4 darbdienu laikā.',
    terminationHint:
      'Reģistrējiet darījuma izbeigšanos, kad transportlīdzeklis ir atņemts (pircējs to atdeva labprātīgi vai ar fogedretten starpniecību) vai kad esat ar pircēju vienojušies izbeigt darījumu. Pircējs vēl 14 dienas var transportlīdzekli izpirkt, samaksājot norēķinā noteikto prasījumu. Maksājumu rēķini un atgādinājumi tiek pārtraukti. Atzīmi nevar atsaukt.',
    reasonRepossessed: 'Pārdevējs ir atņēmis transportlīdzekli (tilbagetagelse)',
    settlement:
      'RAHTIS neaprēķina un neveic norēķinu. Norēķinu (opgørelse) saskaņā ar līguma 9.6. punktu un kreditaftaleloven §§ 38–40 puses veic savā starpā; ja par vērtību nevienojas, to nosaka fogedretten. Ja transportlīdzekļa vērtība pārsniedz prasījumu, pārdevējs starpību samaksā pircējam vienlaikus ar transportlīdzekļa atņemšanu; ja vērtība ir mazāka, pārdevējs var prasīt starpību. PVN piemērošana atdošanai nav apstiprināta – saskaņojiet to ar grāmatvedi. Pārdevējs piesaka īpašuma tiesību paturēšanas dzēšanu automašīnu grāmatā (Bilbogen).',
    rateHint:
      '0 = procenti netiek aprēķināti. Procentus rēķinā norāda atsevišķā rindā tā, lai to summa būtu redzama katrā maksājumā; tikai tad tie nav iekļauti PVN bāzē (momsloven § 27, stk. 3, nr. 4). Arī bezprocentu pirkumam piemēro kreditaftaleloven.',
  },
  lt: {
    intro:
      'Parduokite savo sunkvežimį išsimokėtinai patikrintam vežėjui arba pirkite sunkvežimį išsimokėtinai. RAHTIS parengia sutartį pagal Danijos teisę (pirkimas kreditu su nuosavybės teisės išlaikymu – køb med ejendomsforbehold, kreditaftaleloven), mokėjimų grafiką ir sąskaitas pardavėjo vardu; pirkėjas moka tiesiai į pardavėjo sąskaitą. Sumos nurodomos Danijos kronomis. Nuosavybės teisės išlaikymas saugo pardavėją nuo pirkėjo kreditorių tik tada, kai jis įregistruotas automobilių knygoje (Bilbogen).',
    introSeller:
      'Parduokite sunkvežimį išsimokėtinai patikrintam vežėjui. Pridėkite parduodamą sunkvežimį; patikrinsime jo duomenis, o jį patvirtinus galėsite paskelbti skelbimą. RAHTIS parengia sutartį pagal Danijos teisę (pirkimas kreditu su nuosavybės teisės išlaikymu – køb med ejendomsforbehold, kreditaftaleloven), mokėjimų grafiką ir sąskaitas pardavėjo vardu; pirkėjas moka tiesiai į jūsų sąskaitą. Sumos nurodomos Danijos kronomis. Nuosavybės teisės išlaikymas saugo jus nuo pirkėjo kreditorių tik tada, kai jis įregistruotas automobilių knygoje (Bilbogen).',
    notAllowed:
      'Techniką išsimokėtinai gali parduoti kiekviena RAHTIS užregistruota ir patikrinta Danijos įmonė; pirkėjas visada yra patikrintas Danijos vežėjas. Sandorį sudaro pagrindinis įmonės naudotojas.',
    contract: 'Pirkimo sutartis su nuosavybės teisės išlaikymu (PDF, danų kalba)',
    nextSteps:
      'Iki perdavimo: sutartį pasirašė abi šalys ir pirkėjas gavo jos egzempliorių (genpart) – po perdavimo sutartas nuosavybės teisės išlaikymas negalioja; pirmoji sąskaita apmokėta; pardavėjas pateikė nuosavybės teisės išlaikymą registruoti (tinglysning) automobilių knygoje (Bilbogen) – mokestis 1 850 kr + 1,5 % užtikrinamos sumos, jį moka pardavėjas, jei sutartyje nesutarta kitaip (šių metų tarifai nepatikrinti). Be registracijos išlyga galioja tik tarp šalių: jei pirkėjas bankrutuoja, transporto priemonė areštuojama arba pirkėjas ją parduoda sąžiningam įgijėjui, pardavėjas transporto priemonę praranda. Saugiausia palaukti, kol registracija bus atlikta; ji nustoja galioti po 10 metų, jei neatnaujinama. Pirkėjas įrašytas į transporto priemonių registrą (Køretøjsregisteret, Motorstyrelsen) kaip naudotojas (bruger), o pirkėjo krovinių vežimo leidimas (godskørselstilladelse) įregistruotas transporto priemonei. Nepatvirtinta, kuri šalis išlaikant nuosavybės teisę įrašoma savininku (ejer) – pagal sutarties 5.3 punktą savininku lieka pardavėjas; prieš perdavimą pasitikrinkite Motorstyrelsen arba su savo teisininku. Privalomasis civilinės atsakomybės draudimas (ansvarsforsikring) galioja nuo perdavimo, o pardavėjo teisė pažymėta KASKO draudime.',
    invoiceNote:
      'Sąskaitos siunčiamos PDF formatu Danijos kronomis (kr.). Platformos tyrimas nepatvirtino, ar Danijoje tarp įmonių privaloma struktūrinė elektroninė sąskaita – pasitikrinkite su savo buhalteriu; RAHTIS e. sąskaitų nerengia. Palūkanos kiekvienoje sąskaitoje nurodomos atskira eilute su suma: tik tada jos neįtraukiamos į PVM bazę (momsloven § 27, stk. 3, nr. 4). Mokėjimo nuoroda yra tarptautinė RF nuoroda: sąskaitose nėra FI mokėjimo eilutės (+71), nes jai reikia paties pardavėjo sutarties su banku – pirkėjas moka į pardavėjo sąskaitą (IBAN) ir nurodo nuorodą.',
    thresholdsText:
      'Pagal Danijos kredito sutarčių įstatymo (kreditaftaleloven) 29 straipsnį pardavėjas gali reikalauti likučio arba atsiimti sunkvežimį tik tada, kai mokėjimas vėluoja 30 dienų ir vėluoja bent {tenth} (viena įmoka) arba bent {twentieth} (kelios įmokos), arba visas likutis. Ribos yra 1/10 ir 1/20 visos mokėtinos sumos: kaina su PVM, įskaitant pradinę įmoką, ir visos palūkanos. Šiame sandoryje tam reikalingas vėluojančių įmokų skaičius: {needed}. Skaičiavimo bazės Danijos teisininkas nepatvirtino.',
    thresholdTitle: 'Pasiekta kredito sutarčių įstatymo riba: {plate}',
    threshold:
      'Vėluojančios įmokos pasiekė kreditaftaleloven § 29 ribą (sutarties 9.1 punktas): vėluojama 30 dienų ir bent 1/10 (kelioms įmokoms – 1/20) visos mokėtinos sumos arba visas likutis. Dabar galite raštu reikalauti viso likučio arba atsiimti transporto priemonę. Jei pirkėjas sumoka vėluojančią sumą su palūkanomis ir jūsų išlaidomis, kol transporto priemonė dar neatsiimta, paprastai negalite daryti nei vieno, nei kito (§ 37). Atsiėmimas (tilbagetagelse) vykdomas tik per vykdymo teismą (fogedretten), jei pirkėjas transporto priemonės neperduoda savanoriškai; teismas gali jį atidėti iki 4 mėnesių, o pirkėjas per 14 dienų po atsiėmimo gali transporto priemonę išpirkti (indløsning, § 43). Neimkite transporto priemonės patys ir jos neblokuokite: fogedretten tada atsisakys toliau vykdyti. Atsiimant atliekamas atsiskaitymas (opgørelse).',
    checkBefore: [
      'Nuosavybės teisės išlaikymas (ejendomsforbehold) iki perdavimo pateiktas registruoti (tinglysning) automobilių knygoje (Bilbogen) – be to pardavėjo teisė negalioja pirkėjo kreditoriams ir sąžiningam įgijėjui.',
    ],
    checkRegister:
      'Pirkėjas įrašytas į transporto priemonių registrą (Køretøjsregisteret) kaip naudotojas (bruger), o pirkėjo krovinių vežimo leidimas įregistruotas transporto priemonei; savininko (ejer) įrašas padarytas pagal sutarties 5.3 punktą (platforma nepatvirtino, kuri šalis įrašoma savininku).',
    checkInsurance:
      'Privalomasis civilinės atsakomybės draudimas (ansvarsforsikring) galioja nuo perdavimo, o draudikas raštu patvirtino, kad pardavėjo nuosavybės teisės išlaikymas pažymėtas KASKO draudime.',
    afterPaid:
      'Nuosavybės teisė perėjo pirkėjui tą dieną, kai paskutinis mokėjimas gautas pardavėjo sąskaitoje. Pardavėjas nedelsdamas pateikia prašymą išregistruoti (aflysning) nuosavybės teisės išlaikymą automobilių knygoje (Bilbogen); jei transporto priemonių registre savininku (ejer) įrašytas pardavėjas, pirkėjas įsiregistruoja savininku per 4 darbo dienas.',
    terminationHint:
      'Pažymėkite sandorio pabaigą, kai transporto priemonė atsiimta (pirkėjas ją perdavė savanoriškai arba per fogedretten) arba kai su pirkėju susitarėte nutraukti sandorį. Pirkėjas dar 14 dienų gali transporto priemonę išpirkti, sumokėjęs pagal atsiskaitymą nustatytą reikalavimą. Įmokų sąskaitos ir priminimai nebesiunčiami. Žymos atšaukti negalima.',
    reasonRepossessed: 'Pardavėjas atsiėmė transporto priemonę (tilbagetagelse)',
    settlement:
      'RAHTIS atsiskaitymo neskaičiuoja ir neatlieka. Atsiskaitymą (opgørelse) pagal sutarties 9.6 punktą ir kreditaftaleloven §§ 38–40 šalys atlieka tarpusavyje; jei dėl vertės nesusitariama, ją nustato fogedretten. Jei transporto priemonės vertė viršija reikalavimą, pardavėjas skirtumą sumoka pirkėjui tuo pat metu, kai atsiima transporto priemonę; jei vertė mažesnė, pardavėjas gali reikalauti skirtumo. PVM taikymas grąžinant nepatvirtintas – susitarkite dėl jo su buhalteriu. Pardavėjas pateikia prašymą išregistruoti nuosavybės teisės išlaikymą automobilių knygoje (Bilbogen).',
    rateHint:
      '0 = be palūkanų. Palūkanos sąskaitoje nurodomos atskira eilute taip, kad jų suma būtų matoma kiekviename mokėjime; tik tada jos neįtraukiamos į PVM bazę (momsloven § 27, stk. 3, nr. 4). Ir pardavimui be palūkanų taikomas kreditaftaleloven.',
  },
  pl: {
    intro:
      'Sprzedaj własny pojazd na raty sprawdzonemu przewoźnikowi albo kup pojazd na raty. RAHTIS przygotowuje umowę według prawa duńskiego (zakup na kredyt z zastrzeżeniem własności – køb med ejendomsforbehold, kreditaftaleloven), harmonogram płatności i faktury w imieniu sprzedawcy; kupujący płaci bezpośrednio na rachunek sprzedawcy. Kwoty są w koronach duńskich. Zastrzeżenie własności chroni sprzedawcę przed wierzycielami kupującego dopiero po wpisie do księgi samochodowej (Bilbogen).',
    introSeller:
      'Sprzedaj pojazd na raty sprawdzonemu przewoźnikowi. Dodaj pojazd, który chcesz sprzedać; sprawdzimy jego dane, a po zatwierdzeniu możesz opublikować ogłoszenie. RAHTIS przygotowuje umowę według prawa duńskiego (zakup na kredyt z zastrzeżeniem własności – køb med ejendomsforbehold, kreditaftaleloven), harmonogram płatności i faktury w imieniu sprzedawcy; kupujący płaci bezpośrednio na Twój rachunek. Kwoty są w koronach duńskich. Zastrzeżenie własności chroni Cię przed wierzycielami kupującego dopiero po wpisie do księgi samochodowej (Bilbogen).',
    notAllowed:
      'Sprzęt na raty może sprzedać każda sprawdzona duńska firma zarejestrowana w RAHTIS; kupującym jest zawsze sprawdzony duński przewoźnik. Transakcję zawiera główny użytkownik firmy.',
    contract: 'Umowa sprzedaży z zastrzeżeniem własności (PDF, po duńsku)',
    nextSteps:
      'Przed wydaniem: umowa jest podpisana przez obie strony, a kupujący otrzymał jej egzemplarz (genpart) – zastrzeżenie własności uzgodnione po wydaniu jest nieważne; pierwsza faktura jest zapłacona; sprzedawca zgłosił zastrzeżenie własności do wpisu (tinglysning) w księdze samochodowej (Bilbogen) – opłata 1 850 kr + 1,5 % zabezpieczonej kwoty, płaci ją sprzedawca, chyba że umowa stanowi inaczej (stawek na bieżący rok nie sprawdzono). Bez wpisu zastrzeżenie działa tylko między stronami: jeśli kupujący upadnie, pojazd zostanie zajęty albo kupujący sprzeda go nabywcy w dobrej wierze, sprzedawca traci pojazd. Najbezpieczniej poczekać, aż wpis zostanie dokonany; wygasa on po 10 latach, jeśli nie zostanie odnowiony. Kupujący jest wpisany do rejestru pojazdów (Køretøjsregisteret, Motorstyrelsen) jako użytkownik (bruger), a jego zezwolenie na przewóz rzeczy (godskørselstilladelse) jest zarejestrowane na pojazd. Nie potwierdzono, którą stronę przy zastrzeżeniu własności wpisuje się jako właściciela (ejer) – według pkt 5.3 umowy właścicielem pozostaje sprzedawca; sprawdź to w Motorstyrelsen albo u swojego prawnika przed wydaniem. Obowiązkowe ubezpieczenie OC (ansvarsforsikring) obowiązuje od wydania, a prawo sprzedawcy jest odnotowane w polisie autocasco.',
    invoiceNote:
      'Faktury są wysyłane w formacie PDF w koronach duńskich (kr.). Ustalenia platformy nie potwierdziły, czy w Danii między firmami wymagana jest ustrukturyzowana e-faktura – sprawdź u swojego księgowego; RAHTIS nie tworzy e-faktur. Odsetki są na każdej fakturze w osobnej pozycji z kwotą: tylko wtedy nie wchodzą do podstawy VAT (momsloven § 27, stk. 3, nr. 4). Tytuł płatności to międzynarodowy numer RF: faktury nie mają linii płatności FI (+71), bo wymaga ona własnej umowy sprzedawcy z bankiem – kupujący płaci na rachunek sprzedawcy (IBAN) i podaje numer.',
    thresholdsText:
      'Zgodnie z § 29 duńskiej ustawy o umowach kredytowych (kreditaftaleloven) sprzedawca może żądać reszty albo odebrać pojazd dopiero wtedy, gdy płatność jest opóźniona o 30 dni, a zaległość wynosi co najmniej {tenth} (jedna rata) albo co najmniej {twentieth} (kilka rat), albo obejmuje całą pozostałą kwotę. Progi to 1/10 i 1/20 całej kwoty do zapłaty: cena z VAT wraz z pierwszą wpłatą i wszystkie odsetki. W tej transakcji oznacza to liczbę zaległych rat: {needed}. Podstawy obliczenia nie potwierdził duński prawnik.',
    thresholdTitle: 'Osiągnięto próg z ustawy o umowach kredytowych: {plate}',
    threshold:
      'Zaległe raty osiągnęły próg z kreditaftaleloven § 29 (pkt 9.1 umowy): 30 dni opóźnienia i co najmniej 1/10 (przy kilku ratach 1/20) całej kwoty do zapłaty albo cała pozostała kwota. Możesz teraz zażądać na piśmie całej pozostałej kwoty albo odebrać pojazd. Jeżeli kupujący zapłaci zaległość z odsetkami i Twoimi kosztami, zanim pojazd zostanie odebrany, co do zasady nie możesz zrobić ani jednego, ani drugiego (§ 37). Odebranie (tilbagetagelse) następuje wyłącznie przez sąd egzekucyjny (fogedretten), chyba że kupujący wyda pojazd dobrowolnie; sąd może je odroczyć do 4 miesięcy, a kupujący może wykupić pojazd w ciągu 14 dni od odebrania (indløsning, § 43). Nie zabieraj pojazdu samodzielnie i nie blokuj go: fogedretten odmówi wtedy dalszej egzekucji. Przy odebraniu sporządza się rozliczenie (opgørelse).',
    checkBefore: [
      'Zastrzeżenie własności (ejendomsforbehold) zostało przed wydaniem zgłoszone do wpisu (tinglysning) w księdze samochodowej (Bilbogen) – bez tego prawo sprzedawcy nie działa wobec wierzycieli kupującego ani nabywcy w dobrej wierze.',
    ],
    checkRegister:
      'Kupujący jest wpisany do rejestru pojazdów (Køretøjsregisteret) jako użytkownik (bruger), a jego zezwolenie na przewóz rzeczy jest zarejestrowane na pojazd; wpis właściciela (ejer) jest zgodny z pkt 5.3 umowy (platforma nie potwierdziła, którą stronę wpisuje się jako właściciela).',
    checkInsurance:
      'Obowiązkowe ubezpieczenie OC (ansvarsforsikring) obowiązuje od wydania, a ubezpieczyciel potwierdził na piśmie, że zastrzeżenie własności sprzedawcy jest odnotowane w polisie autocasco.',
    afterPaid:
      'Własność przeszła na kupującego w dniu wpływu ostatniej płatności na rachunek sprzedawcy. Sprzedawca niezwłocznie zgłasza wykreślenie (aflysning) zastrzeżenia własności z księgi samochodowej (Bilbogen); jeżeli w rejestrze pojazdów właścicielem (ejer) jest sprzedawca, kupujący rejestruje się jako właściciel w ciągu 4 dni roboczych.',
    terminationHint:
      'Odnotuj zakończenie, gdy pojazd został odebrany (kupujący wydał go dobrowolnie albo przez fogedretten) albo gdy uzgodniłeś z kupującym zakończenie sprzedaży. Kupujący może jeszcze przez 14 dni wykupić pojazd, płacąc wierzytelność z rozliczenia. Faktury za raty i przypomnienia przestają być wysyłane. Tej operacji nie można cofnąć.',
    reasonRepossessed: 'Sprzedawca odebrał pojazd (tilbagetagelse)',
    settlement:
      'RAHTIS nie oblicza ani nie przeprowadza rozliczenia. Rozliczenie (opgørelse) według pkt 9.6 umowy i kreditaftaleloven §§ 38–40 strony przeprowadzają między sobą; jeśli nie uzgodnią wartości, ustala ją fogedretten. Jeżeli wartość pojazdu przewyższa wierzytelność, sprzedawca wypłaca różnicę kupującemu jednocześnie z odebraniem pojazdu; jeżeli jest niższa, sprzedawca może żądać różnicy. Sposób ujęcia VAT przy zwrocie nie został potwierdzony – ustal go z księgowym. Sprzedawca zgłasza wykreślenie zastrzeżenia własności z księgi samochodowej (Bilbogen).',
    rateHint:
      '0 = bez odsetek. Odsetki są fakturowane w osobnej pozycji tak, aby ich kwota była widoczna w każdej płatności; tylko wtedy nie wchodzą do podstawy VAT (momsloven § 27, stk. 3, nr. 4). Sprzedaż bez odsetek także podlega kreditaftaleloven.',
  },
  de: {
    intro:
      'Verkaufen Sie Ihren eigenen Lkw auf Raten an ein geprüftes Transportunternehmen oder kaufen Sie einen Lkw auf Raten. RAHTIS erstellt einen Vertrag nach dänischem Recht (Kreditkauf unter Eigentumsvorbehalt – køb med ejendomsforbehold, kreditaftaleloven), den Zahlungsplan und die Rechnungen im Namen des Verkäufers; der Käufer zahlt direkt auf das Konto des Verkäufers. Die Beträge lauten auf dänische Kronen. Der Eigentumsvorbehalt schützt den Verkäufer gegenüber den Gläubigern des Käufers erst, wenn er im Kfz-Pfandregister (Bilbogen) eingetragen ist.',
    introSeller:
      'Verkaufen Sie einen Lkw auf Raten an ein geprüftes Transportunternehmen. Fügen Sie das Fahrzeug hinzu, das Sie verkaufen möchten; wir prüfen die Angaben, und nach der Freigabe können Sie ein Angebot veröffentlichen. RAHTIS erstellt einen Vertrag nach dänischem Recht (Kreditkauf unter Eigentumsvorbehalt – køb med ejendomsforbehold, kreditaftaleloven), den Zahlungsplan und die Rechnungen im Namen des Verkäufers; der Käufer zahlt direkt auf Ihr Konto. Die Beträge lauten auf dänische Kronen. Der Eigentumsvorbehalt schützt Sie gegenüber den Gläubigern des Käufers erst, wenn er im Kfz-Pfandregister (Bilbogen) eingetragen ist.',
    notAllowed:
      'Fahrzeuge auf Raten verkaufen kann jedes geprüfte dänische Unternehmen, das bei RAHTIS registriert ist; Käufer ist immer ein geprüftes dänisches Transportunternehmen. Den Kauf schließt der Hauptnutzer des Unternehmens ab.',
    contract: 'Kaufvertrag mit Eigentumsvorbehalt (PDF, auf Dänisch)',
    nextSteps:
      'Vor der Übergabe: Der Vertrag ist von beiden Parteien unterzeichnet und der Käufer hat eine Ausfertigung (genpart) erhalten – ein nach der Übergabe vereinbarter Eigentumsvorbehalt ist unwirksam; die erste Rechnung ist bezahlt; der Verkäufer hat den Eigentumsvorbehalt zur Eintragung (tinglysning) im Kfz-Pfandregister (Bilbogen) angemeldet – Gebühr 1 850 kr + 1,5 % des gesicherten Betrags, sie trägt der Verkäufer, sofern der Vertrag nichts anderes bestimmt (die Sätze des laufenden Jahres wurden nicht geprüft). Ohne Eintragung gilt der Vorbehalt nur zwischen den Parteien: Wird der Käufer insolvent, wird das Fahrzeug gepfändet oder verkauft der Käufer es an einen gutgläubigen Erwerber, verliert der Verkäufer das Fahrzeug. Am sichersten ist es, den Abschluss der Eintragung abzuwarten; sie erlischt nach 10 Jahren, wenn sie nicht erneuert wird. Der Käufer ist im Fahrzeugregister (Køretøjsregisteret, Motorstyrelsen) als Nutzer (bruger) eingetragen, und seine Güterkraftverkehrserlaubnis (godskørselstilladelse) ist auf das Fahrzeug registriert. Welche Partei bei Eigentumsvorbehalt als Eigentümer (ejer) einzutragen ist, ist nicht bestätigt – nach Ziffer 5.3 des Vertrags bleibt der Verkäufer Eigentümer; klären Sie dies vor der Übergabe mit Motorstyrelsen oder Ihrem Anwalt. Die Kfz-Haftpflichtversicherung (ansvarsforsikring) gilt ab der Übergabe, und das Recht des Verkäufers ist in der Kaskoversicherung vermerkt.',
    invoiceNote:
      'Rechnungen werden als PDF in dänischen Kronen (kr.) versandt. Die Recherchen der Plattform haben nicht bestätigt, ob in Dänemark zwischen Unternehmen eine strukturierte E-Rechnung vorgeschrieben ist – klären Sie dies mit Ihrem Buchhalter; RAHTIS erstellt keine E-Rechnungen. Zinsen stehen auf jeder Rechnung in einer eigenen Zeile mit Betrag: Nur dann liegen sie außerhalb der Bemessungsgrundlage der Umsatzsteuer (momsloven § 27, stk. 3, nr. 4). Der Verwendungszweck ist eine internationale RF-Referenz: Die Rechnungen tragen keine FI-Zahlungszeile (+71), weil dafür ein eigener Bankvertrag des Verkäufers nötig ist – der Käufer zahlt auf das Konto des Verkäufers (IBAN) und gibt die Referenz an.',
    thresholdsText:
      'Nach § 29 des dänischen Kreditvertragsgesetzes (kreditaftaleloven) darf der Verkäufer den Rest erst verlangen oder den Lkw zurücknehmen, wenn eine Zahlung 30 Tage überfällig ist und mindestens {tenth} (eine Rate) oder mindestens {twentieth} (mehrere Raten) im Rückstand sind oder der gesamte Rest. Die Grenzen sind 1/10 und 1/20 des insgesamt zu zahlenden Betrags: Preis mit Umsatzsteuer einschließlich Anzahlung und alle Zinsen. Erforderliche Zahl überfälliger Raten bei diesem Kauf: {needed}. Die Berechnungsgrundlage wurde nicht von einem dänischen Juristen bestätigt.',
    thresholdTitle: 'Schwelle des Kreditvertragsgesetzes erreicht: {plate}',
    threshold:
      'Die überfälligen Raten erreichen die Schwelle des kreditaftaleloven § 29 (Ziffer 9.1 des Vertrags): 30 Tage Verzug und mindestens 1/10 (bei mehreren Raten 1/20) des insgesamt zu zahlenden Betrags oder der gesamte Rest. Sie können jetzt schriftlich den gesamten Rest verlangen oder das Fahrzeug zurücknehmen. Zahlt der Käufer den Rückstand mit Zinsen und Ihren Kosten, bevor das Fahrzeug zurückgenommen ist, dürfen Sie in der Regel beides nicht (§ 37). Die Rücknahme (tilbagetagelse) erfolgt nur über das Vollstreckungsgericht (fogedretten), sofern der Käufer das Fahrzeug nicht freiwillig herausgibt; das Gericht kann sie um bis zu 4 Monate aufschieben, und der Käufer kann das Fahrzeug innerhalb von 14 Tagen nach der Rücknahme auslösen (indløsning, § 43). Nehmen Sie das Fahrzeug nicht selbst an sich und sperren Sie es nicht: Fogedretten lehnt dann die weitere Vollstreckung ab. Bei der Rücknahme wird abgerechnet (opgørelse).',
    checkBefore: [
      'Der Eigentumsvorbehalt (ejendomsforbehold) ist vor der Übergabe zur Eintragung (tinglysning) im Kfz-Pfandregister (Bilbogen) angemeldet – ohne sie gilt das Recht des Verkäufers nicht gegenüber den Gläubigern des Käufers und einem gutgläubigen Erwerber.',
    ],
    checkRegister:
      'Der Käufer ist im Fahrzeugregister (Køretøjsregisteret) als Nutzer (bruger) eingetragen, und seine Güterkraftverkehrserlaubnis ist auf das Fahrzeug registriert; die Eintragung des Eigentümers (ejer) entspricht Ziffer 5.3 des Vertrags (die Plattform hat nicht bestätigt, welche Partei als Eigentümer einzutragen ist).',
    checkInsurance:
      'Die Kfz-Haftpflichtversicherung (ansvarsforsikring) gilt ab der Übergabe, und der Versicherer hat schriftlich bestätigt, dass der Eigentumsvorbehalt des Verkäufers in der Kaskoversicherung vermerkt ist.',
    afterPaid:
      'Das Eigentum ist an dem Tag auf den Käufer übergegangen, an dem die letzte Zahlung auf dem Konto des Verkäufers eingegangen ist. Der Verkäufer beantragt unverzüglich die Löschung (aflysning) des Eigentumsvorbehalts im Kfz-Pfandregister (Bilbogen); ist der Verkäufer im Fahrzeugregister als Eigentümer (ejer) eingetragen, meldet sich der Käufer innerhalb von 4 Werktagen als Eigentümer an.',
    terminationHint:
      'Erfassen Sie dies, wenn das Fahrzeug zurückgenommen wurde (der Käufer hat es freiwillig oder über fogedretten herausgegeben) oder wenn Sie mit dem Käufer die Beendigung des Kaufs vereinbart haben. Der Käufer kann das Fahrzeug noch 14 Tage lang auslösen, indem er die abgerechnete Forderung zahlt. Ratenrechnungen und Erinnerungen enden. Der Eintrag kann nicht rückgängig gemacht werden.',
    reasonRepossessed: 'Der Verkäufer hat das Fahrzeug zurückgenommen (tilbagetagelse)',
    settlement:
      'RAHTIS berechnet die Abrechnung nicht und führt sie nicht durch. Die Abrechnung (opgørelse) nach Ziffer 9.6 des Vertrags und kreditaftaleloven §§ 38–40 erfolgt zwischen den Parteien; einigen sie sich nicht über den Wert, setzt fogedretten ihn fest. Übersteigt der Wert des Fahrzeugs die Forderung, zahlt der Verkäufer die Differenz gleichzeitig mit der Rücknahme an den Käufer; ist er geringer, kann der Verkäufer die Differenz verlangen. Die umsatzsteuerliche Behandlung der Rückgabe ist nicht bestätigt – legen Sie sie mit einem Buchhalter fest. Der Verkäufer beantragt die Löschung des Eigentumsvorbehalts im Kfz-Pfandregister (Bilbogen).',
    rateHint:
      '0 = keine Zinsen. Zinsen werden in einer eigenen Zeile berechnet, sodass ihr Betrag in jeder Zahlung sichtbar ist; nur dann liegen sie außerhalb der Bemessungsgrundlage der Umsatzsteuer (momsloven § 27, stk. 3, nr. 4). Auch ein zinsloser Kauf fällt unter das kreditaftaleloven.',
  },
  ru: {
    intro:
      'Продайте свою машину в рассрочку проверенному перевозчику или купите машину в рассрочку. RAHTIS готовит договор по датскому праву (покупка в кредит с сохранением права собственности — køb med ejendomsforbehold, kreditaftaleloven), график платежей и счета от имени продавца; покупатель платит напрямую на счёт продавца. Суммы — в датских кронах. Оговорка о собственности защищает продавца от кредиторов покупателя, только когда она зарегистрирована в реестре прав на автомобили (Bilbogen).',
    introSeller:
      'Продайте машину в рассрочку проверенному перевозчику. Добавьте машину, которую хотите продать: мы проверим её данные, и после одобрения вы сможете опубликовать объявление. RAHTIS готовит договор по датскому праву (покупка в кредит с сохранением права собственности — køb med ejendomsforbehold, kreditaftaleloven), график платежей и счета от имени продавца; покупатель платит напрямую на ваш счёт. Суммы — в датских кронах. Оговорка о собственности защищает вас от кредиторов покупателя, только когда она зарегистрирована в реестре прав на автомобили (Bilbogen).',
    notAllowed:
      'Продать технику в рассрочку может любая проверенная датская компания, зарегистрированная в RAHTIS; покупатель — всегда проверенный датский перевозчик. Сделку оформляет главный пользователь компании.',
    contract: 'Договор купли-продажи с сохранением права собственности (PDF, на датском)',
    nextSteps:
      'До передачи: договор подписан обеими сторонами, и покупатель получил его экземпляр (genpart) — оговорка о собственности, согласованная после передачи, недействительна; первый счёт оплачен; продавец подал оговорку о собственности на регистрацию (tinglysning) в реестр прав на автомобили (Bilbogen) — сбор 1 850 kr + 1,5 % обеспеченной суммы, его платит продавец, если договор не говорит иного (ставки этого года не сверялись). Без регистрации оговорка действует только между сторонами: если покупатель обанкротится, на машину наложат взыскание или он продаст её добросовестному покупателю, продавец машину теряет. Надёжнее дождаться, пока регистрация состоится; запись гаснет через 10 лет, если её не продлить. Покупатель записан в реестре транспортных средств (Køretøjsregisteret, Motorstyrelsen) пользователем (bruger), и его разрешение на перевозки (godskørselstilladelse) зарегистрировано на машину. Кого при оговорке о собственности записывать собственником (ejer), не подтверждено — по п. 5.3 договора собственником остаётся продавец; уточните это в Motorstyrelsen или у своего юриста до передачи. Обязательная страховка ответственности (ansvarsforsikring) действует с передачи, а право продавца отмечено в полисе каско.',
    invoiceNote:
      'Счета отправляются в PDF в датских кронах (kr.). Исследование платформы не подтвердило, обязателен ли в Дании структурированный электронный счёт между компаниями, — уточните у своего бухгалтера; RAHTIS электронных счетов не делает. Проценты в каждом счёте стоят отдельной строкой с суммой: только так они не входят в базу НДС (momsloven § 27, stk. 3, nr. 4). Ссылка платежа — международная RF: платёжной строки FI (+71) в счетах нет, для неё нужен собственный договор продавца с банком, — покупатель платит на счёт продавца (IBAN) и указывает ссылку.',
    thresholdsText:
      'По § 29 датского закона о кредитных договорах (kreditaftaleloven) продавец может потребовать остаток или забрать машину, только если платёж просрочен 30 дней и просрочено не меньше {tenth} (один платёж) или не меньше {twentieth} (несколько платежей) либо весь остаток. Доли — 1/10 и 1/20 всей суммы к уплате: цена с НДС вместе с первым взносом и все проценты. В этой сделке — просроченных платежей: {needed}. Расчёт базы датский юрист не подтверждал.',
    thresholdTitle: 'Достигнут порог закона о кредитных договорах: {plate}',
    threshold:
      'Просроченные платежи достигли порога kreditaftaleloven § 29 (п. 9.1 договора): просрочка 30 дней и не меньше 1/10 (при нескольких платежах — 1/20) всей суммы к уплате либо весь остаток. Теперь вы можете письменно потребовать весь остаток или забрать машину. Если покупатель оплатит просроченное с процентами и вашими расходами до того, как машина изъята, вы, как правило, не вправе делать ни того, ни другого (§ 37). Изъятие (tilbagetagelse) — только через суд по исполнению (fogedretten), если покупатель не отдаёт машину добровольно; суд может отложить его до 4 месяцев, а покупатель вправе выкупить машину в течение 14 дней после изъятия (indløsning, § 43). Не забирайте машину сами и не блокируйте её: fogedretten тогда откажет в дальнейшем взыскании. При изъятии проводится расчёт (opgørelse).',
    checkBefore: [
      'Оговорка о собственности (ejendomsforbehold) подана на регистрацию (tinglysning) в реестр прав на автомобили (Bilbogen) до передачи — без этого право продавца не действует против кредиторов покупателя и добросовестного приобретателя.',
    ],
    checkRegister:
      'Покупатель записан в реестре транспортных средств (Køretøjsregisteret) пользователем (bruger), и его разрешение на перевозки зарегистрировано на машину; запись о собственнике (ejer) сделана так, как согласовано в п. 5.3 договора (кого записывать собственником, платформа не подтверждала).',
    checkInsurance:
      'Обязательная страховка ответственности (ansvarsforsikring) действует с передачи, и страховщик письменно подтвердил, что оговорка продавца о собственности отмечена в полисе каско.',
    afterPaid:
      'Право собственности перешло к покупателю в день, когда последний платёж поступил на счёт продавца. Продавец без задержки подаёт на снятие (aflysning) оговорки о собственности в реестре прав на автомобили (Bilbogen); если собственником (ejer) в реестре транспортных средств записан продавец, покупатель регистрируется собственником в течение 4 рабочих дней.',
    terminationHint:
      'Отметьте прекращение сделки, когда машина изъята (покупатель отдал её добровольно или через fogedretten) или когда вы договорились с покупателем прекратить продажу. Покупатель ещё 14 дней может выкупить машину, оплатив требование по расчёту. Счета на платежи и напоминания прекратятся. Отменить отметку нельзя.',
    reasonRepossessed: 'Продавец забрал машину (tilbagetagelse)',
    settlement:
      'RAHTIS не считает и не проводит расчёт. Расчёт (opgørelse) по п. 9.6 договора и kreditaftaleloven §§ 38–40 стороны проводят между собой; если они не сойдутся в стоимости, её определяет fogedretten. Если машина стоит больше требования, продавец выплачивает разницу покупателю одновременно с изъятием; если меньше — продавец вправе требовать разницу. Как оформить НДС при возврате, не подтверждено — решите это с бухгалтером. Продавец подаёт на снятие оговорки о собственности в реестре прав на автомобили (Bilbogen).',
    rateHint:
      '0 — без процентов. Проценты выставляются отдельной строкой так, чтобы их сумма была видна в каждом платеже; только тогда они не входят в базу НДС (momsloven § 27, stk. 3, nr. 4). Сделка без процентов тоже подпадает под kreditaftaleloven.',
  },
  ro: {
    intro:
      'Vindeți propriul camion cu plata în rate unui transportator verificat sau cumpărați un camion în rate. RAHTIS întocmește un contract conform dreptului danez (cumpărare pe credit cu rezerva dreptului de proprietate – køb med ejendomsforbehold, kreditaftaleloven), graficul de plăți și facturile în numele vânzătorului; cumpărătorul plătește direct în contul vânzătorului. Sumele sunt în coroane daneze. Rezerva dreptului de proprietate îl protejează pe vânzător față de creditorii cumpărătorului numai după înscrierea în registrul de garanții auto (Bilbogen).',
    introSeller:
      'Vindeți un camion cu plata în rate unui transportator verificat. Adăugați vehiculul pe care doriți să îl vindeți; îi verificăm datele, iar după aprobare puteți publica un anunț. RAHTIS întocmește un contract conform dreptului danez (cumpărare pe credit cu rezerva dreptului de proprietate – køb med ejendomsforbehold, kreditaftaleloven), graficul de plăți și facturile în numele vânzătorului; cumpărătorul plătește direct în contul dumneavoastră. Sumele sunt în coroane daneze. Rezerva dreptului de proprietate vă protejează față de creditorii cumpărătorului numai după înscrierea în registrul de garanții auto (Bilbogen).',
    notAllowed:
      'Orice firmă daneză verificată, înregistrată în RAHTIS, poate vinde echipamente în rate; cumpărătorul este întotdeauna un transportator danez verificat. Vânzarea o încheie utilizatorul principal al firmei.',
    contract: 'Contract de vânzare cu rezerva proprietății (PDF, în daneză)',
    nextSteps:
      'Înainte de predare: contractul este semnat de ambele părți, iar cumpărătorul a primit un exemplar (genpart) – rezerva proprietății convenită după predare nu este valabilă; prima factură este plătită; vânzătorul a depus rezerva proprietății spre înscriere (tinglysning) în registrul de garanții auto (Bilbogen) – taxă 1 850 kr + 1,5 % din suma garantată, plătită de vânzător dacă în contract nu se prevede altfel (cotele pentru anul curent nu au fost verificate). Fără înscriere, rezerva produce efecte doar între părți: dacă cumpărătorul intră în faliment, vehiculul este sechestrat sau cumpărătorul îl vinde unui dobânditor de bună-credință, vânzătorul pierde vehiculul. Cel mai sigur este să așteptați finalizarea înscrierii; aceasta încetează după 10 ani dacă nu este reînnoită. Cumpărătorul este înscris în registrul vehiculelor (Køretøjsregisteret, Motorstyrelsen) ca utilizator (bruger), iar autorizația sa de transport de mărfuri (godskørselstilladelse) este înregistrată pe vehicul. Nu este confirmat care parte se înscrie ca proprietar (ejer) în cazul rezervei proprietății – potrivit punctului 5.3 din contract, proprietar rămâne vânzătorul; verificați la Motorstyrelsen sau cu avocatul dumneavoastră înainte de predare. Asigurarea obligatorie de răspundere civilă (ansvarsforsikring) este valabilă de la predare, iar dreptul vânzătorului este notat în polița casco.',
    invoiceNote:
      'Facturile se trimit în format PDF, în coroane daneze (kr.). Cercetarea platformei nu a confirmat dacă în Danemarca este obligatorie factura electronică structurată între firme – verificați cu contabilul dumneavoastră; RAHTIS nu emite facturi electronice. Dobânda apare pe fiecare factură pe un rând separat, cu suma ei: numai așa rămâne în afara bazei de impozitare a TVA (momsloven § 27, stk. 3, nr. 4). Referința de plată este o referință internațională RF: facturile nu au linie de plată FI (+71), deoarece aceasta necesită un contract propriu al vânzătorului cu banca – cumpărătorul plătește în contul vânzătorului (IBAN) și indică referința.',
    thresholdsText:
      'Potrivit articolului 29 din legea daneză a contractelor de credit (kreditaftaleloven), vânzătorul poate cere restul sau poate relua camionul numai după ce o plată este restantă de 30 de zile și suma restantă este de cel puțin {tenth} (o rată) sau de cel puțin {twentieth} (mai multe rate) ori reprezintă întregul rest. Limitele sunt 1/10 și 1/20 din suma totală de plată: prețul cu TVA, inclusiv avansul, și toate dobânzile. În această tranzacție, numărul de rate restante necesar este {needed}. Baza de calcul nu a fost confirmată de un jurist danez.',
    thresholdTitle: 'Pragul din legea contractelor de credit a fost atins: {plate}',
    threshold:
      'Ratele restante ating pragul din kreditaftaleloven § 29 (punctul 9.1 din contract): 30 de zile de întârziere și cel puțin 1/10 (1/20 la mai multe rate) din suma totală de plată ori întregul rest. Puteți acum cere în scris întregul rest sau puteți relua vehiculul. Dacă cumpărătorul plătește suma restantă cu dobândă și cheltuielile dumneavoastră înainte ca vehiculul să fie reluat, de regulă nu puteți face niciuna dintre acestea (§ 37). Reluarea (tilbagetagelse) se face numai prin instanța de executare (fogedretten), dacă vehiculul nu este predat de bunăvoie; instanța o poate amâna cu până la 4 luni, iar cumpărătorul poate răscumpăra vehiculul în 14 zile de la reluare (indløsning, § 43). Nu luați singur vehiculul și nu îl blocați: fogedretten va refuza atunci executarea ulterioară. La reluare se face decontarea (opgørelse).',
    checkBefore: [
      'Rezerva proprietății (ejendomsforbehold) a fost depusă spre înscriere (tinglysning) în registrul de garanții auto (Bilbogen) înainte de predare – fără aceasta, dreptul vânzătorului nu este opozabil creditorilor cumpărătorului și unui dobânditor de bună-credință.',
    ],
    checkRegister:
      'Cumpărătorul este înscris în registrul vehiculelor (Køretøjsregisteret) ca utilizator (bruger), iar autorizația sa de transport de mărfuri este înregistrată pe vehicul; înscrierea proprietarului (ejer) este făcută potrivit punctului 5.3 din contract (platforma nu a confirmat care parte se înscrie ca proprietar).',
    checkInsurance:
      'Asigurarea obligatorie de răspundere civilă (ansvarsforsikring) este valabilă de la predare, iar asigurătorul a confirmat în scris că rezerva proprietății vânzătorului este notată în polița casco.',
    afterPaid:
      'Proprietatea a trecut la cumpărător în ziua în care ultima plată a intrat în contul vânzătorului. Vânzătorul cere fără întârziere radierea (aflysning) rezervei proprietății din registrul de garanții auto (Bilbogen); dacă în registrul vehiculelor proprietar (ejer) este înscris vânzătorul, cumpărătorul se înscrie ca proprietar în 4 zile lucrătoare.',
    terminationHint:
      'Înregistrați încetarea după ce vehiculul a fost reluat (cumpărătorul l-a predat de bunăvoie sau prin fogedretten) ori după ce ați convenit cu cumpărătorul încetarea vânzării. Cumpărătorul mai poate răscumpăra vehiculul timp de 14 zile, plătind creanța rezultată din decontare. Facturile pentru rate și notificările se opresc. Înregistrarea nu poate fi anulată.',
    reasonRepossessed: 'Vânzătorul a reluat vehiculul (tilbagetagelse)',
    settlement:
      'RAHTIS nu calculează și nu efectuează decontarea. Decontarea (opgørelse) potrivit punctului 9.6 din contract și kreditaftaleloven §§ 38–40 se face între părți; dacă nu se înțeleg asupra valorii, o stabilește fogedretten. Dacă valoarea vehiculului depășește creanța, vânzătorul plătește diferența cumpărătorului odată cu reluarea vehiculului; dacă este mai mică, vânzătorul poate cere diferența. Tratamentul TVA la restituire nu este confirmat – stabiliți-l cu un contabil. Vânzătorul cere radierea rezervei proprietății din registrul de garanții auto (Bilbogen).',
    rateHint:
      '0 = fără dobândă. Dobânda se facturează pe un rând separat, astfel încât suma ei să fie vizibilă la fiecare plată; numai așa rămâne în afara bazei de impozitare a TVA (momsloven § 27, stk. 3, nr. 4). Și vânzarea fără dobândă intră sub incidența kreditaftaleloven.',
  },
};
