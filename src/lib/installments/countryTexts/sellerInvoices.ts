import type { Locale } from '../../i18n/config.ts';

/**
 * Страны, где счёт между компаниями существует только в государственной
 * системе электронных счетов, а RAHTIS к ней не подключён (23.11.2026):
 * Польша (KSeF, обязателен для всех компаний с 01.04.2026) и Румыния
 * (RO e-Factura, обязательна между румынскими компаниями; PDF вне системы —
 * не счёт, штраф 15 % и выставителю, и получателю). Решение владельца: в этих
 * странах платформа даёт расчёт, договор, график, платёжные уведомления и
 * напоминания, а КАЖДЫЙ счёт выставляет продавец в системе сам.
 *
 * Здесь — слова кабинета, которые в основном наборе (copy.ts, i18n/*)
 * говорят о счетах платформы («первый счёт», «отметить счёт оплаченным»,
 * «кредит-нота»), в версии «уведомление о платеже» на десяти языках.
 * {system} — название системы страны (SELLER_INVOICE_SYSTEMS).
 */
export type SellerInvoiceCopy = {
  /** Строка НДС на форме условий. */
  vatFixed: string;
  /** Подпись суммы «к оплате до передачи» в расчёте (вместо «первый счёт»). */
  firstPaymentLabel: string;
  /** Кнопка-ссылка на первый документ. */
  dealInvoice: string;
  /** Документ не составлен: {reason}. */
  invoiceMissing: string;
  /** Причина: документ ещё не отправлен покупателю. */
  unsent: string;
  /** Кнопка-ссылка на документ при передаче. */
  handoverDoc: string;
  /** Уведомление о согласии: {number}, {system}. */
  agreedBody: string;
  /** Напоминание покупателю о просрочке: {date}, {days}. */
  overdueBody: string;
  /** Сигнал продавцу без IBAN: {n}, {plate}. */
  noIbanTitle: string;
  noIbanBody: string;
  /** Уведомление о прекращении. */
  terminatedBody: string;
  /** Продавец подтвердил получение платежа до передачи: {date}. */
  firstPaid: string;
  /** Ждём подтверждения продавца; {system}. */
  firstUnpaid: string;
  /** Кнопка продавца: «платёж получен». */
  markFirstPaid: string;
  /** Отмена до передачи: кнопка, документ отмены, его нет, создать. */
  cancelCredit: string;
  creditNote: string;
  creditMissing: string;
  makeCredit: string;
  /** Столбец графика: документ взноса. */
  colInvoice: string;
  /** Сводка при прекращении. */
  paidFirst: string;
  invoicedUnpaid: string;
  notInvoiced: string;
  stopped: string;
  /** Подтверждение записи о прекращении. */
  terminationConfirm: string;
};

/** Система электронных счетов страны, в которой продавец выставляет счета сам. */
export const SELLER_INVOICE_SYSTEMS = { PL: 'KSeF', RO: 'RO e-Factura' } as const;

export type SellerInvoiceCountry = keyof typeof SELLER_INVOICE_SYSTEMS;

export const SELLER_INVOICE_TEXTS: Record<Locale, SellerInvoiceCopy> = {
  fi: {
    vatFixed: 'Osamaksukauppa tehdään aina arvonlisäverollisena. Myyjä laatii laskut itse {system}-järjestelmässä; RAHTIS laatii vain maksuilmoitukset.',
    firstPaymentLabel: 'Maksu ennen luovutusta',
    dealInvoice: 'Maksuilmoitus (PDF)',
    invoiceMissing: 'Maksuilmoitusta ei voitu muodostaa: {reason}',
    unsent: 'maksuilmoitusta ei ole vielä lähetetty ostajalle.',
    handoverDoc: 'Luovutuspöytäkirja (PDF)',
    agreedBody: 'Sopimus {number} ja maksuilmoitus ovat valmiina. Laskut laatii myyjä {system}-järjestelmässä.',
    overdueBody: 'Erä erääntyi {date}. Myöhässä: {days} pv. Maksa suoraan myyjälle maksuilmoituksen tiedoilla.',
    noIbanTitle: 'Maksuerän {n} maksuilmoitusta ei voitu muodostaa: {plate}',
    noIbanBody: 'Tilinumerosi (IBAN) puuttuu. Lisää se kohdassa Pankkiyhteys – sen jälkeen maksuilmoitus lähtee ostajalle automaattisesti.',
    terminatedBody: 'Myyjä on kirjannut kaupan päättyneeksi. Maksuilmoitukset RAHTIKSEN kautta ovat loppuneet, ja tilitys tehdään osapuolten kesken. Syy ja yhteenveto maksuista näkyvät kaupan sivulla.',
    firstPaid: 'Myyjä vahvisti {date}, että maksu ennen luovutusta on saatu.',
    firstUnpaid: 'Odotetaan, että myyjä vahvistaa saaneensa maksun ennen luovutusta (käsiraha ja arvonlisäveron suuruinen summa). Auto luovutetaan vasta sen jälkeen. Myyjä laatii maksusta laskun itse {system}-järjestelmässä.',
    markFirstPaid: 'Vahvista maksu saaduksi',
    cancelCredit: 'Peru kauppa ja maksuilmoitus',
    creditNote: 'Maksuilmoituksen peruutus (PDF)',
    creditMissing: 'Maksuilmoituksen peruutusta ei ole vielä tehty.',
    makeCredit: 'Tee peruutus',
    colInvoice: 'Ilmoitus',
    paidFirst: 'Maksettu ennen luovutusta (käsiraha ja arvonlisäveron suuruinen summa)',
    invoicedUnpaid: 'Ilmoitettu, maksamatta',
    notInvoiced: 'Maksuerät, joista ei vielä ole lähetetty maksuilmoitusta',
    stopped: 'Uusia maksuilmoituksia ja muistutuksia ei enää lähetetä. Sopimus ja jo laaditut asiakirjat ovat edelleen saatavilla.',
    terminationConfirm: 'Kirjataanko kauppa päättyneeksi? Maksuilmoitukset ja muistutukset loppuvat, eikä tätä voi perua.',
  },
  en: {
    vatFixed: 'Instalment sales are always made with VAT. The seller issues the invoices himself in {system}; RAHTIS prepares the payment notices only.',
    firstPaymentLabel: 'Payment before handover',
    dealInvoice: 'Payment notice (PDF)',
    invoiceMissing: 'The payment notice could not be created: {reason}',
    unsent: 'the payment notice has not been sent to the buyer yet.',
    handoverDoc: 'Handover statement (PDF)',
    agreedBody: 'Contract {number} and the payment notice are ready. The invoices are issued by the seller in {system}.',
    overdueBody: 'The instalment was due on {date}. Days late: {days}. Pay the seller directly using the payment notice details.',
    noIbanTitle: 'Payment notice for instalment {n} could not be created: {plate}',
    noIbanBody: 'Your bank account (IBAN) is missing. Add it under Bank details – the payment notice will then be sent to the buyer automatically.',
    terminatedBody: 'The seller has recorded the sale as ended. Payment notices through RAHTIS have stopped, and the settlement is made between the parties. The reason and a payment summary are on the deal page.',
    firstPaid: 'On {date} the seller confirmed that the payment before handover was received.',
    firstUnpaid: 'Waiting for the seller to confirm that the payment before handover (down payment and an amount equal to the VAT) has been received. The vehicle is handed over only after that. The seller documents the payment with an invoice in {system} himself.',
    markFirstPaid: 'Confirm payment received',
    cancelCredit: 'Cancel the sale and the payment notice',
    creditNote: 'Cancellation of the payment notice (PDF)',
    creditMissing: 'The cancellation of the payment notice has not been created yet.',
    makeCredit: 'Create the cancellation',
    colInvoice: 'Notice',
    paidFirst: 'Paid before handover (down payment and an amount equal to VAT)',
    invoicedUnpaid: 'Notified, unpaid',
    notInvoiced: 'Instalments not yet notified',
    stopped: 'No more payment notices or reminders are sent. The contract and the documents already issued remain available.',
    terminationConfirm: 'Record the sale as ended? Payment notices and reminders stop, and this cannot be undone.',
  },
  sv: {
    vatFixed: 'Avbetalningsköp görs alltid med moms. Säljaren utfärdar fakturorna själv i {system}; RAHTIS tar bara fram betalningsavierna.',
    firstPaymentLabel: 'Betalning före överlämnandet',
    dealInvoice: 'Betalningsavi (PDF)',
    invoiceMissing: 'Betalningsavin kunde inte skapas: {reason}',
    unsent: 'betalningsavin har ännu inte skickats till köparen.',
    handoverDoc: 'Överlämningsprotokoll (PDF)',
    agreedBody: 'Avtal {number} och betalningsavin är klara. Fakturorna utfärdas av säljaren i {system}.',
    overdueBody: 'Delbetalningen förföll {date} (dagar försenad: {days}). Betala direkt till säljaren enligt uppgifterna på betalningsavin.',
    noIbanTitle: 'Betalningsavin för delbetalning {n} kunde inte skapas: {plate}',
    noIbanBody: 'Ditt kontonummer (IBAN) saknas. Lägg till det under Bankuppgifter – därefter skickas betalningsavin automatiskt till köparen.',
    terminatedBody: 'Säljaren har registrerat köpet som avslutat. Betalningsavierna via RAHTIS har upphört, och uppgörelsen görs mellan parterna. Orsaken och en sammanställning av betalningarna finns på köpets sida.',
    firstPaid: 'Säljaren bekräftade {date} att betalningen före överlämnandet har tagits emot.',
    firstUnpaid: 'Väntar på att säljaren bekräftar att betalningen före överlämnandet (kontantinsats och ett belopp motsvarande momsen) har tagits emot. Fordonet överlämnas först därefter. Säljaren fakturerar betalningen själv i {system}.',
    markFirstPaid: 'Bekräfta mottagen betalning',
    cancelCredit: 'Häv köpet och makulera betalningsavin',
    creditNote: 'Makulering av betalningsavi (PDF)',
    creditMissing: 'Betalningsavin har inte makulerats ännu.',
    makeCredit: 'Skapa makulering',
    colInvoice: 'Avi',
    paidFirst: 'Betalt före överlämnandet (kontantinsats och ett belopp motsvarande momsen)',
    invoicedUnpaid: 'Aviserat, obetalt',
    notInvoiced: 'Ej aviserade delbetalningar',
    stopped: 'Inga fler betalningsavier eller påminnelser skickas. Avtalet och de dokument som redan har utfärdats finns kvar.',
    terminationConfirm: 'Registrera köpet som avslutat? Betalningsavier och påminnelser upphör, och det går inte att ångra.',
  },
  et: {
    vatFixed: 'Järelmaksumüük tehakse alati käibemaksuga. Arved koostab müüja ise süsteemis {system}; RAHTIS koostab ainult makseteatised.',
    firstPaymentLabel: 'Makse enne üleandmist',
    dealInvoice: 'Makseteatis (PDF)',
    invoiceMissing: 'Makseteatist ei õnnestunud koostada: {reason}',
    unsent: 'makseteatist pole ostjale veel saadetud.',
    handoverDoc: 'Üleandmise-vastuvõtmise akt (PDF)',
    agreedBody: 'Leping {number} ja makseteatis on valmis. Arved koostab müüja süsteemis {system}.',
    overdueBody: 'Osamakse tähtpäev oli {date}. Hilinenud päevi: {days}. Tasuge otse müüjale makseteatise andmete alusel.',
    noIbanTitle: 'Osamakse {n} makseteatist ei saanud koostada: {plate}',
    noIbanBody: 'Teie arvelduskonto (IBAN) puudub. Lisage see jaotises Pangaandmed – seejärel saadetakse makseteatis ostjale automaatselt.',
    terminatedBody: 'Müüja on märkinud tehingu lõpetatuks. RAHTIS selle tehingu makseteatisi enam ei saada; lõpparveldus tehakse poolte vahel. Põhjus ja maksete kokkuvõte on tehingu lehel.',
    firstPaid: 'Müüja kinnitas {date}, et makse enne üleandmist on laekunud.',
    firstUnpaid: 'Ootame müüja kinnitust, et makse enne üleandmist (sissemakse ja käibemaksuga võrdne summa) on laekunud. Auto antakse üle alles pärast seda. Makse kohta koostab müüja ise arve süsteemis {system}.',
    markFirstPaid: 'Kinnita makse laekumine',
    cancelCredit: 'Tühista tehing ja makseteatis',
    creditNote: 'Makseteatise tühistamine (PDF)',
    creditMissing: 'Makseteatise tühistamist pole veel koostatud.',
    makeCredit: 'Koosta tühistamine',
    colInvoice: 'Teatis',
    paidFirst: 'Tasutud enne üleandmist (sissemakse ja käibemaksuga võrdne summa)',
    invoicedUnpaid: 'Teatis saadetud, tasumata',
    notInvoiced: 'Osamaksed, mille kohta teatist pole veel saadetud',
    stopped: 'Uusi makseteatisi ega meeldetuletusi enam ei saadeta. Leping ja juba koostatud dokumendid on endiselt kättesaadavad.',
    terminationConfirm: 'Kas märkida tehing lõpetatuks? Makseteatised ja meeldetuletused lõpevad ning seda ei saa tagasi võtta.',
  },
  lv: {
    vatFixed: 'Nomaksas pirkums vienmēr tiek noformēts ar PVN. Rēķinus pārdevējs izraksta pats sistēmā {system}; RAHTIS sagatavo tikai maksājuma paziņojumus.',
    firstPaymentLabel: 'Maksājums pirms nodošanas',
    dealInvoice: 'Maksājuma paziņojums (PDF)',
    invoiceMissing: 'Maksājuma paziņojumu neizdevās sagatavot: {reason}',
    unsent: 'maksājuma paziņojums vēl nav nosūtīts pircējam.',
    handoverDoc: 'Pieņemšanas–nodošanas akts (PDF)',
    agreedBody: 'Līgums {number} un maksājuma paziņojums ir gatavi. Rēķinus pārdevējs izraksta sistēmā {system}.',
    overdueBody: 'Maksājuma termiņš bija {date}, kavējums – {days} d. Maksājiet tieši pārdevējam pēc maksājuma paziņojuma rekvizītiem.',
    noIbanTitle: 'Maksājuma {n} paziņojumu neizdevās sagatavot: {plate}',
    noIbanBody: 'Nav norādīts jūsu bankas konts (IBAN). Pievienojiet to sadaļā Bankas rekvizīti – pēc tam maksājuma paziņojums pircējam tiks nosūtīts automātiski.',
    terminatedBody: 'Pārdevējs ir reģistrējis darījuma izbeigšanu. RAHTIS šim darījumam maksājuma paziņojumus vairs nesūta; norēķinu puses veic savā starpā. Iemesls un maksājumu kopsavilkums ir darījuma lapā.',
    firstPaid: 'Pārdevējs {date} apstiprināja, ka maksājums pirms nodošanas ir saņemts.',
    firstUnpaid: 'Gaidām pārdevēja apstiprinājumu, ka maksājums pirms nodošanas (pirmā iemaksa un summa PVN apmērā) ir saņemts. Automašīnu nodod tikai pēc tam. Maksājumu pārdevējs pats noformē ar rēķinu sistēmā {system}.',
    markFirstPaid: 'Apstiprināt maksājuma saņemšanu',
    cancelCredit: 'Atcelt darījumu un maksājuma paziņojumu',
    creditNote: 'Maksājuma paziņojuma atcelšana (PDF)',
    creditMissing: 'Maksājuma paziņojuma atcelšana vēl nav sagatavota.',
    makeCredit: 'Sagatavot atcelšanu',
    colInvoice: 'Paziņojums',
    paidFirst: 'Samaksāts pirms nodošanas (pirmā iemaksa un summa PVN apmērā)',
    invoicedUnpaid: 'Paziņots, nav samaksāts',
    notInvoiced: 'Maksājumi, par kuriem paziņojums vēl nav nosūtīts',
    stopped: 'Jauni maksājuma paziņojumi un atgādinājumi vairs netiek sūtīti. Līgums un jau sagatavotie dokumenti joprojām ir pieejami.',
    terminationConfirm: 'Reģistrēt darījuma izbeigšanu? Maksājuma paziņojumi un atgādinājumi tiks pārtraukti, un to nevar atsaukt.',
  },
  lt: {
    vatFixed: 'Pardavimas išsimokėtinai visada įforminamas su PVM. Sąskaitas faktūras pardavėjas išrašo pats sistemoje {system}; RAHTIS rengia tik mokėjimo pranešimus.',
    firstPaymentLabel: 'Mokėjimas iki perdavimo',
    dealInvoice: 'Mokėjimo pranešimas (PDF)',
    invoiceMissing: 'Mokėjimo pranešimo parengti nepavyko: {reason}',
    unsent: 'mokėjimo pranešimas pirkėjui dar neišsiųstas.',
    handoverDoc: 'Perdavimo–priėmimo aktas (PDF)',
    agreedBody: 'Sutartis {number} ir mokėjimo pranešimas parengti. Sąskaitas faktūras pardavėjas išrašo sistemoje {system}.',
    overdueBody: 'Įmokos terminas buvo {date}, vėluojama {days} d. Mokėkite tiesiai pardavėjui pagal mokėjimo pranešimo rekvizitus.',
    noIbanTitle: 'Įmokos {n} mokėjimo pranešimo parengti nepavyko: {plate}',
    noIbanBody: 'Nenurodyta jūsų banko sąskaita (IBAN). Įrašykite ją skiltyje „Banko rekvizitai“ – tada mokėjimo pranešimas pirkėjui bus išsiųstas automatiškai.',
    terminatedBody: 'Pardavėjas užregistravo sandorio nutraukimą. RAHTIS šio sandorio mokėjimo pranešimų nebesiunčia; atsiskaitymą šalys atlieka tarpusavyje. Priežastis ir mokėjimų suvestinė pateiktos sandorio puslapyje.',
    firstPaid: '{date} pardavėjas patvirtino, kad mokėjimas iki perdavimo gautas.',
    firstUnpaid: 'Laukiama, kol pardavėjas patvirtins, kad mokėjimas iki perdavimo (pradinė įmoka ir PVM dydžio suma) gautas. Automobilis perduodamas tik po to. Šiam mokėjimui pardavėjas pats išrašo sąskaitą faktūrą sistemoje {system}.',
    markFirstPaid: 'Patvirtinti, kad mokėjimas gautas',
    cancelCredit: 'Atšaukti sandorį ir mokėjimo pranešimą',
    creditNote: 'Mokėjimo pranešimo atšaukimas (PDF)',
    creditMissing: 'Mokėjimo pranešimo atšaukimas dar neparengtas.',
    makeCredit: 'Parengti atšaukimą',
    colInvoice: 'Pranešimas',
    paidFirst: 'Sumokėta iki perdavimo (pradinė įmoka ir PVM dydžio suma)',
    invoicedUnpaid: 'Pranešta, neapmokėta',
    notInvoiced: 'Įmokos, apie kurias dar nepranešta',
    stopped: 'Nauji mokėjimo pranešimai ir priminimai nebesiunčiami. Sutartis ir jau parengti dokumentai lieka prieinami.',
    terminationConfirm: 'Užregistruoti sandorio nutraukimą? Mokėjimo pranešimai ir priminimai bus sustabdyti, o šio veiksmo atšaukti negalima.',
  },
  pl: {
    vatFixed: 'Sprzedaż ratalna jest zawsze z VAT. Faktury sprzedawca wystawia sam w {system}; RAHTIS przygotowuje wyłącznie informacje o płatności.',
    firstPaymentLabel: 'Płatność przed wydaniem',
    dealInvoice: 'Informacja o płatności (PDF)',
    invoiceMissing: 'Nie udało się przygotować informacji o płatności: {reason}',
    unsent: 'informacja o płatności nie została jeszcze wysłana kupującemu.',
    handoverDoc: 'Protokół zdawczo-odbiorczy (PDF)',
    agreedBody: 'Umowa {number} i informacja o płatności są gotowe. Faktury wystawia sprzedawca w {system}.',
    overdueBody: 'Termin płatności raty minął {date}; dni opóźnienia: {days}. Zapłać bezpośrednio sprzedawcy według danych z informacji o płatności.',
    noIbanTitle: 'Nie udało się przygotować informacji o płatności za ratę {n}: {plate}',
    noIbanBody: 'Brak Twojego numeru konta (IBAN). Dodaj go w sekcji Dane bankowe – informacja o płatności zostanie wtedy automatycznie wysłana do kupującego.',
    terminatedBody: 'Sprzedawca odnotował zakończenie sprzedaży. RAHTIS nie wysyła już informacji o płatności do tej umowy; rozliczenie strony przeprowadzają między sobą. Przyczynę i podsumowanie płatności znajdziesz na stronie transakcji.',
    firstPaid: 'Sprzedawca potwierdził {date} otrzymanie płatności przed wydaniem.',
    firstUnpaid: 'Czekamy, aż sprzedawca potwierdzi otrzymanie płatności przed wydaniem (wpłata własna i kwota równa VAT). Pojazd zostanie wydany dopiero potem. Sprzedawca sam dokumentuje tę płatność fakturą w {system}.',
    markFirstPaid: 'Potwierdź otrzymanie płatności',
    cancelCredit: 'Anuluj sprzedaż i informację o płatności',
    creditNote: 'Anulowanie informacji o płatności (PDF)',
    creditMissing: 'Anulowanie informacji o płatności nie zostało jeszcze przygotowane.',
    makeCredit: 'Przygotuj anulowanie',
    colInvoice: 'Informacja',
    paidFirst: 'Zapłacono przed wydaniem (wpłata własna i kwota równa VAT)',
    invoicedUnpaid: 'Wysłano informację, niezapłacone',
    notInvoiced: 'Raty bez wysłanej informacji o płatności',
    stopped: 'Nowe informacje o płatności i przypomnienia nie są już wysyłane. Umowa i wystawione dokumenty pozostają dostępne.',
    terminationConfirm: 'Odnotować zakończenie sprzedaży? Informacje o płatności i przypomnienia zostaną wstrzymane. Tej operacji nie można cofnąć.',
  },
  de: {
    vatFixed: 'Der Ratenkauf erfolgt immer mit Umsatzsteuer. Die Rechnungen stellt der Verkäufer selbst in {system} aus; RAHTIS erstellt nur die Zahlungsinformationen.',
    firstPaymentLabel: 'Zahlung vor Übergabe',
    dealInvoice: 'Zahlungsinformation (PDF)',
    invoiceMissing: 'Die Zahlungsinformation konnte nicht erstellt werden: {reason}',
    unsent: 'die Zahlungsinformation wurde dem Käufer noch nicht gesendet.',
    handoverDoc: 'Übergabeprotokoll (PDF)',
    agreedBody: 'Vertrag {number} und die Zahlungsinformation liegen bereit. Die Rechnungen stellt der Verkäufer in {system} aus.',
    overdueBody: 'Die Rate war am {date} fällig (Tage überfällig: {days}). Zahlen Sie direkt an den Verkäufer – mit den Zahlungsdaten aus der Zahlungsinformation.',
    noIbanTitle: 'Zahlungsinformation für Rate {n} konnte nicht erstellt werden: {plate}',
    noIbanBody: 'Ihre Kontonummer (IBAN) fehlt. Tragen Sie sie unter Bankverbindung ein – die Zahlungsinformation wird dann automatisch an den Käufer gesendet.',
    terminatedBody: 'Der Verkäufer hat den Kauf als beendet erfasst. Über RAHTIS werden keine Zahlungsinformationen mehr versendet; die Abrechnung erfolgt zwischen den Parteien. Grund und Zahlungsübersicht finden Sie auf der Seite des Kaufs.',
    firstPaid: 'Der Verkäufer hat am {date} den Eingang der Zahlung vor Übergabe bestätigt.',
    firstUnpaid: 'Warten auf die Bestätigung des Verkäufers, dass die Zahlung vor Übergabe (Anzahlung und ein Betrag in Höhe der Umsatzsteuer) eingegangen ist. Erst danach wird das Fahrzeug übergeben. Über die Zahlung stellt der Verkäufer selbst eine Rechnung in {system} aus.',
    markFirstPaid: 'Zahlungseingang bestätigen',
    cancelCredit: 'Kauf und Zahlungsinformation stornieren',
    creditNote: 'Stornierung der Zahlungsinformation (PDF)',
    creditMissing: 'Die Stornierung der Zahlungsinformation wurde noch nicht erstellt.',
    makeCredit: 'Stornierung erstellen',
    colInvoice: 'Zahlungsinfo',
    paidFirst: 'Vor Übergabe bezahlt (Anzahlung und ein Betrag in Höhe der Umsatzsteuer)',
    invoicedUnpaid: 'Mitgeteilt, noch offen',
    notInvoiced: 'Raten ohne Zahlungsinformation',
    stopped: 'Es werden keine weiteren Zahlungsinformationen und Erinnerungen versendet. Der Vertrag und die bereits erstellten Dokumente bleiben abrufbar.',
    terminationConfirm: 'Kauf als beendet erfassen? Zahlungsinformationen und Erinnerungen werden eingestellt; dies kann nicht rückgängig gemacht werden.',
  },
  ru: {
    vatFixed: 'Продажа в рассрочку всегда оформляется с НДС. Счета продавец выставляет сам в {system}; RAHTIS готовит только уведомления о платеже.',
    firstPaymentLabel: 'Платёж до передачи',
    dealInvoice: 'Уведомление о платеже (PDF)',
    invoiceMissing: 'Не удалось сформировать уведомление о платеже: {reason}',
    unsent: 'уведомление о платеже ещё не отправлено покупателю.',
    handoverDoc: 'Акт приёма-передачи (PDF)',
    agreedBody: 'Договор {number} и уведомление о платеже готовы. Счета выставляет продавец в {system}.',
    overdueBody: 'Срок платежа был {date}, просрочка — {days} дн. Оплатите напрямую продавцу по реквизитам из уведомления о платеже.',
    noIbanTitle: 'Не удалось сформировать уведомление о платеже {n}: {plate}',
    noIbanBody: 'Не указан ваш банковский счёт (IBAN). Добавьте его в разделе «Банковские реквизиты» — после этого уведомление о платеже уйдёт покупателю автоматически.',
    terminatedBody: 'Продавец отметил, что сделка прекращена. Уведомления о платеже через RAHTIS больше не отправляются; взаиморасчёт стороны проводят между собой. Причина и сводка платежей — на странице сделки.',
    firstPaid: '{date} продавец подтвердил получение платежа до передачи.',
    firstUnpaid: 'Ждём, когда продавец подтвердит получение платежа до передачи (первоначальный взнос и сумма, равная НДС). Машина передаётся только после этого. Продавец сам оформляет этот платёж счётом в {system}.',
    markFirstPaid: 'Подтвердить получение платежа',
    cancelCredit: 'Отменить сделку и уведомление о платеже',
    creditNote: 'Отмена уведомления о платеже (PDF)',
    creditMissing: 'Отмена уведомления о платеже ещё не оформлена.',
    makeCredit: 'Оформить отмену',
    colInvoice: 'Уведомление',
    paidFirst: 'Оплачено до передачи (первоначальный взнос и сумма, равная НДС)',
    invoicedUnpaid: 'Уведомление отправлено, не оплачено',
    notInvoiced: 'Платежи, по которым уведомление ещё не отправлено',
    stopped: 'Новые уведомления о платеже и напоминания больше не отправляются. Договор и уже оформленные документы остаются доступны.',
    terminationConfirm: 'Отметить сделку как прекращённую? Уведомления о платеже и напоминания прекратятся, отменить это действие нельзя.',
  },
  ro: {
    vatFixed: 'Vânzarea cu plata în rate se face întotdeauna cu TVA. Facturile le emite vânzătorul în {system}; RAHTIS pregătește doar notificările de plată.',
    firstPaymentLabel: 'Plată înainte de predare',
    dealInvoice: 'Notificare de plată (PDF)',
    invoiceMissing: 'Notificarea de plată nu a putut fi creată: {reason}',
    unsent: 'notificarea de plată nu a fost încă trimisă cumpărătorului.',
    handoverDoc: 'Proces-verbal de predare-primire (PDF)',
    agreedBody: 'Contractul {number} și notificarea de plată sunt gata. Facturile sunt emise de vânzător în {system}.',
    overdueBody: 'Rata era scadentă la {date}; zile de întârziere: {days}. Plătiți direct vânzătorului, cu datele din notificarea de plată.',
    noIbanTitle: 'Notificarea de plată pentru rata {n} nu a putut fi creată: {plate}',
    noIbanBody: 'Lipsește contul dumneavoastră bancar (IBAN). Adăugați-l la Date bancare – notificarea de plată va fi apoi trimisă automat cumpărătorului.',
    terminatedBody: 'Vânzătorul a înregistrat încetarea vânzării. RAHTIS nu mai trimite notificări de plată pentru această vânzare; regularizarea se face între părți. Motivul și situația plăților se află pe pagina vânzării.',
    firstPaid: 'La {date}, vânzătorul a confirmat primirea plății înainte de predare.',
    firstUnpaid: 'Se așteaptă confirmarea vânzătorului că plata înainte de predare (avansul și o sumă egală cu TVA-ul) a fost primită. Vehiculul se predă doar după aceea. Vânzătorul emite el însuși factura pentru această plată în {system}.',
    markFirstPaid: 'Confirmați primirea plății',
    cancelCredit: 'Anulați vânzarea și notificarea de plată',
    creditNote: 'Anularea notificării de plată (PDF)',
    creditMissing: 'Anularea notificării de plată nu a fost încă creată.',
    makeCredit: 'Creați anularea',
    colInvoice: 'Notificare',
    paidFirst: 'Plătit înainte de predare (avans și o sumă egală cu TVA-ul)',
    invoicedUnpaid: 'Notificat, neachitat',
    notInvoiced: 'Rate încă nenotificate',
    stopped: 'Nu se mai trimit notificări de plată și nici mementouri. Contractul și documentele deja emise rămân disponibile.',
    terminationConfirm: 'Înregistrați încetarea vânzării? Notificările de plată și mementourile se opresc, iar acțiunea nu poate fi anulată.',
  },
};
