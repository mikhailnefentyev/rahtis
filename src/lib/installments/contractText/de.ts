/**
 * Договор Германии: «Kaufvertrag über ein Nutzfahrzeug mit Ratenzahlung und
 * Eigentumsvorbehalt» (23.11.2026).
 *
 * Текст — шаблон docs/equipment-sale/countries/de.md, раздел 5 (черновик:
 * ни Rechtsanwalt, ни Steuerberater его не проверяли — об этом сторонам
 * сказано в кабинете). Юридический текст перенесён дословно; подставлены
 * только данные сделки. Чего в RAHTIS нет (правовая форма, суд и номер
 * Handelsregister, FIN, год первой регистрации, номер Gemeinschaftslizenz,
 * номер Zulassungsbescheinigung Teil II, представитель, страховые условия),
 * — строки для заполнения от руки; где шаблон даёт выбор (Abholung или
 * Lieferung, осмотр раз в два или три месяца, сервисный договор), —
 * варианты с отметкой «( )». Территория договора — вариант шаблона по
 * умолчанию: государства ЕЭЗ и Швейцария.
 *
 * Указания шаблона для платформы (не часть договора):
 *   · шаблон нельзя применять, если покупатель — потребитель или физлицо,
 *     которое покупает машину, чтобы начать дело, при цене до 75 000 €
 *     (§ 513 BGB): тогда действуют потребительские правила. Покупатель
 *     заверяет обратное в п. 1; одного заверения для полной защиты мало —
 *     это сказано продавцу в кабинете;
 *   · Zulassungsbescheinigung Teil II остаётся у продавца (п. 5.2);
 *   · ежемесячные Ratenanforderungen НДС не показывают (п. 4.3);
 *   · пороги п. 9.1 договорные (по образцу § 498 BGB): 10 % Gesamtbetrag,
 *     при сроке больше трёх лет (больше 36 месяцев) — 5 %. Сумму порога
 *     считает rules.ts и передаёт в price.tenth.
 *
 * Только обычный НДС: кабинет других режимов не создаёт, варианты B–D
 * п. 4.2 (Differenzbesteuerung, § 4 Nr. 28, Kleinunternehmer) не включены.
 * Проценты — вариант A (без процентов) или B (отдельное соглашение о
 * кредите с годовой ставкой, освобождение по § 4 Nr. 8 Buchst. a UStG —
 * условия UStAE 3.11 не подтверждены, открытый вопрос 2) по ставке сделки.
 */
import type { ContractPdfInput } from '../ContractPdf.tsx';
import { bare, BLANK, h, kv, li, LONG_BLANK, p, sub, type ContractBlock, type ContractDocument } from './blocks.ts';

const yesNo = (value: boolean) => (value ? 'ja' : 'nein');

/* Немецкий business_id в RAHTIS — цифры USt-IdNr. без «DE». */
const taxId = (id: string) => (/^\d{9}$/.test(id) ? `DE${id}` : id);

function party(label: string, x: ContractPdfInput['seller'], tax: string, extra?: string): string[] {
  return [
    label,
    x.name,
    `Rechtsform: ${BLANK}`,
    `eingetragen im Handelsregister des Amtsgerichts ${BLANK} unter HRB/HRA ${BLANK}`,
    `USt-IdNr. / Steuernummer: ${taxId(x.businessId)}`,
    `Geschäftsanschrift: ${x.address || LONG_BLANK}`,
    tax,
    ...(extra ? [extra] : []),
    `vertreten durch: ${LONG_BLANK}`,
    `Telefon: ${x.phone || BLANK} · E-Mail: ${x.email || BLANK}`,
  ];
}

export function deContractText(d: ContractPdfInput): ContractDocument {
  const n = d.months;
  const first = d.plan[0];
  const last = d.plan[d.plan.length - 1];
  const regular = d.plan.slice(0, -1);
  const equal = regular.every((x) => x.principal === first.principal);
  const invoiceNo = d.firstInvoiceNumber ?? BLANK;
  const interestTotal = d.price.interestTotal ? bare(d.price.interestTotal) : null;
  /* Ziffer 9.1: 10 % Gesamtbetrag, при сроке больше трёх лет — 5 %. */
  const pct = n > 36 ? 5 : 10;
  const threshold = bare(d.price.tenth);

  const regularLine =
    regular.length === 0
      ? null
      : regular.length === 1
        ? `Rate 1: ${bare(first.principal)} Euro, fällig am ${first.due}.`
        : equal
          ? `Raten 1–${n - 1}: jeweils ${bare(first.principal)} Euro, fällig am ${d.dueDay}. eines jeden Monats, erstmals am ${first.due}.`
          : `Raten 1–${n - 1}: nach dem Zahlungsplan (Anlage 1), fällig am ${d.dueDay}. eines jeden Monats, erstmals am ${first.due}.`;

  const main: ContractBlock[] = [
    { kind: 'title', text: 'KAUFVERTRAG ÜBER EIN NUTZFAHRZEUG MIT RATENZAHLUNG UND EIGENTUMSVORBEHALT' },
    { kind: 'notice', text: 'DAS EIGENTUM AM KAUFGEGENSTAND GEHT ERST MIT VOLLSTÄNDIGER ZAHLUNG DES KAUFPREISES AUF DEN KÄUFER ÜBER.' },
    { kind: 'meta', text: `Vertrag Nr. ${d.number} · Datum ${d.date}` },

    h('1. Vertragsparteien'),
    {
      kind: 'parties',
      left: party('Verkäufer', d.seller, `umsatzsteuerlicher Unternehmer mit Regelbesteuerung: ${yesNo(d.seller.vatRegistered)}`),
      right: party('Käufer', d.buyer, `zum Vorsteuerabzug berechtigt: ${yesNo(d.buyer.vatRegistered)}`, `Gemeinschaftslizenz Nr. ${BLANK}`),
    },
    p('Der Verkäufer gewährt dem Käufer den Zahlungsaufschub selbst; ein Dritter ist an der Finanzierung nicht beteiligt.'),
    p('Der Käufer versichert, dass er diesen Vertrag als Unternehmer im Sinne des § 14 BGB in Ausübung seiner bereits ausgeübten gewerblichen Tätigkeit schließt und das Fahrzeug nicht zur Aufnahme einer gewerblichen oder selbständigen beruflichen Tätigkeit im Sinne des § 513 BGB erwirbt.'),

    h('2. Kaufgegenstand'),
    kv('Fahrzeug', d.vehicle.make),
    kv('Amtliches Kennzeichen', d.vehicle.plate),
    kv('Fahrzeug-Identifizierungsnummer (FIN)', LONG_BLANK),
    kv('Erstzulassung', BLANK),
    kv('Kilometerstand bei Vertragsschluss', d.vehicle.odometer),
    kv('Zubehör', `( ) kein Zubehör  ( ) ${LONG_BLANK}`),
    kv('Rechte Dritter', `( ) keine  ( ) Angaben: ${BLANK}`),
    kv('Nummer der Zulassungsbescheinigung Teil II', BLANK),
    p('2.1 Der Verkäufer versichert, dass er Eigentümer des Fahrzeugs und des Zubehörs ist, dass daran keine Rechte Dritter bestehen, insbesondere kein Eigentumsvorbehalt, kein Sicherungseigentum, kein Pfandrecht und keine Leasing- oder Mietkaufbindung, soweit sie nicht vorstehend genannt sind, und dass er berechtigt ist, das Fahrzeug zu den Bedingungen dieses Vertrags zu verkaufen. Der Verkäufer legt dem Käufer vor Unterzeichnung die Zulassungsbescheinigung Teil I und Teil II im Original zur Einsicht vor.'),
    p('2.2 Das Fahrzeug ist gebraucht und wird in dem Zustand verkauft, der im Übergabeprotokoll (Anlage 2) beschrieben ist. Die Rechte des Käufers wegen Sachmängeln sind ausgeschlossen. Dieser Ausschluss gilt nicht für Mängel, die der Verkäufer arglistig verschwiegen hat, nicht für eine übernommene Beschaffenheitsgarantie, nicht für Schäden aus der Verletzung des Lebens, des Körpers oder der Gesundheit und nicht für Schäden, die auf Vorsatz oder grober Fahrlässigkeit des Verkäufers oder seiner Erfüllungsgehilfen beruhen. § 377 HGB bleibt unberührt.'),

    h('3. Übergabe'),
    p(`3.1 Art der Übergabe: ( ) Abholung beim Verkäufer  ( ) Lieferung durch den Verkäufer an die Anschrift ${BLANK}. Übergabetermin: ${d.handover}.`),
    p('3.2 Das Fahrzeug wird erst übergeben, wenn'),
    li('1. dieser Vertrag von beiden Parteien unterzeichnet ist;'),
    li('2. der vor Übergabe fällige Betrag (Ziffer 4.2) auf dem Konto des Verkäufers eingegangen ist;'),
    li('3. der Käufer eine Versicherungsbestätigung (eVB-Nummer) für die Kraftfahrzeug-Haftpflichtversicherung nach Ziffer 7.1 vorgelegt hat und der Nachweis nach Ziffer 7.2 vorliegt; und'),
    li('4. die Zulassung des Fahrzeugs auf den Käufer als Halter nach Ziffer 5.2 erfolgt oder für den Übergabetag verbindlich vorbereitet ist.'),
    p('3.3 Bei der Übergabe besichtigen die Parteien das Fahrzeug gemeinsam und unterzeichnen das Übergabeprotokoll (Anlage 2), in dem Datum und Uhrzeit der Übergabe vermerkt werden. Mit der Übergabe geht die Gefahr des zufälligen Untergangs und der zufälligen Verschlechterung auf den Käufer über.'),

    h('4. Kaufpreis und Zahlung'),
    sub('4.1 Kaufpreis (€)'),
    kv('Kaufpreis Fahrzeug (netto)', bare(d.price.net)),
    kv('Zubehör, einzeln aufgeführt und bepreist (netto)', '–'),
    kv(`Umsatzsteuer ${d.vatPercent} % auf ${bare(d.price.net)}`, bare(d.price.vat)),
    kv('Barzahlungspreis (brutto, einschließlich Umsatzsteuer)', bare(d.price.gross), true),
    kv('Anzahlung, fällig vor Übergabe (enthält die gesamte Umsatzsteuer des Kaufs)', bare(d.price.downGross)),
    kv('Restkaufpreis (enthält keine Umsatzsteuer mehr)', bare(d.price.rest)),
    kv('Kreditkosten: gesondert zu zahlende Zinsen (Ziffer 4.4)', interestTotal ?? 'keine Zinsen'),
    kv(`Gesamtbetrag (Anzahlung und Raten 1–${n} zusammen; ohne die gesondert zu zahlenden Zinsen)`, bare(d.price.gross), true),
    p('In diesem Vertrag bezeichnen „Barzahlungspreis“ und „Gesamtbetrag“ Bruttobeträge einschließlich Umsatzsteuer. Da die Zinsen gesondert gezahlt werden, sind Barzahlungspreis und Gesamtbetrag gleich hoch.'),

    sub('4.2 Rechnung und Umsatzsteuer'),
    p('Der Verkäufer stellt über die Lieferung des Fahrzeugs eine Rechnung über den gesamten Kaufpreis mit gesondertem Ausweis der Umsatzsteuer aus. Die Anzahlung, die die gesamte Umsatzsteuer des Kaufs enthält, ist vor der Übergabe fällig. Die Lieferung wird mit der Übergabe des Fahrzeugs ausgeführt; die Umsatzsteuer entsteht nach § 13 Abs. 1 Nr. 1 Buchst. a UStG mit Ablauf des Voranmeldungszeitraums der Übergabe, für vor der Übergabe vereinnahmte Beträge mit Ablauf des Voranmeldungszeitraums der Vereinnahmung.'),
    p('Der Käufer stimmt zu, dass Rechnungen bis zum Ablauf der Übergangsfristen des § 27 Abs. 38 UStG in einem sonstigen elektronischen Format (PDF) übermittelt werden. Danach werden Rechnungen als elektronische Rechnung im Sinne des § 14 Abs. 1 Satz 3 UStG ausgestellt; der Käufer stellt deren Empfang sicher.'),

    sub('4.3 Raten'),
    p(`Laufzeit ${n} Monate. Anzahl der Raten ${n}.`),
    ...(regularLine ? [p(regularLine)] : []),
    p(`Schlussrate ${n}: ${bare(last.principal)} Euro, fällig am ${last.due}.`),
    p(`Die Raten enthalten keine Umsatzsteuer, da die gesamte Umsatzsteuer des Kaufs mit der Rechnung Nr. ${invoiceNo} berechnet worden ist. Zahlungsaufforderungen zu den einzelnen Raten sind keine Rechnungen im Sinne des § 14 UStG und weisen keine Umsatzsteuer aus.`),
    p('Zahlungsplan: Anlage 1.'),
    p('Die Ratenzahlung ist ausdrücklich vereinbart (§ 271a Abs. 5 Nr. 1 BGB).'),

    sub('4.4 Zinsen'),
    p(
      d.ratePercent
        ? `Die Parteien vereinbaren gesondert von der Lieferung des Fahrzeugs eine Kreditgewährung des Verkäufers: Der Restkaufpreis wird ab dem Tag der Übergabe mit einem festen Jahreszins von ${d.ratePercent} Prozent verzinst. Die Zinsen werden auf den jeweils offenen Restkaufpreis taggenau berechnet (tatsächliche Tage / 365) und mit jeder Rate gesondert abgerechnet und gezahlt. Bei planmäßiger Zahlung betragen die Zinsen insgesamt ${interestTotal ?? BLANK} Euro (Anlage 1). Die Kreditgewährung ist nach § 4 Nr. 8 Buchst. a UStG umsatzsteuerfrei; der Verkäufer verzichtet nicht auf die Steuerbefreiung.`
        : 'Der Restkaufpreis wird nicht verzinst.',
    ),
    p('Weitere Zinsen, Gebühren oder Entgelte als die in diesem Vertrag genannten schuldet der Käufer nicht.'),

    sub('4.5 Verzug und Verzugszinsen'),
    p('Die Fälligkeitstermine sind nach dem Kalender bestimmt; der Käufer kommt ohne Mahnung in Verzug, wenn er zum Fälligkeitstermin nicht zahlt (§ 286 Abs. 2 Nr. 1 BGB). Der rückständige Betrag ist während des Verzugs mit neun Prozentpunkten über dem jeweiligen Basiszinssatz zu verzinsen (§ 288 Abs. 2 BGB). Ist der nach Ziffer 4.4 vereinbarte Zins höher, gilt dieser auch während des Verzugs. Von Zinsen werden keine Verzugszinsen berechnet (§ 289 BGB). Die Geltendmachung eines weiteren Verzugsschadens bleibt vorbehalten.'),

    sub('4.6 Vorzeitige Zahlung'),
    p('Der Käufer ist berechtigt, den Restkaufpreis jederzeit ganz oder teilweise vorzeitig zu zahlen. Zinsen nach Ziffer 4.4 fallen nur bis zum Tag des Zahlungseingangs an. Eine Vorfälligkeitsentschädigung wird nicht erhoben. Teilzahlungen werden auf die zuletzt fälligen Raten angerechnet, soweit der Käufer nichts anderes bestimmt.'),

    sub('4.7 Sonstige Kosten'),
    p('Bei Verzug schuldet der Käufer die Pauschale von 40 Euro nach § 288 Abs. 5 BGB; sie wird auf Rechtsverfolgungskosten angerechnet. Der Käufer trägt ferner die notwendigen Kosten der Rechtsverfolgung sowie die notwendigen Kosten der Rücknahme, des Transports, der Begutachtung und der Verwertung des Fahrzeugs im Fall der Ziffer 9. Die Gebühren der Zulassung trägt der Käufer. Weitere Kosten werden nicht berechnet.'),

    sub('4.8 Tilgungsreihenfolge'),
    p('Zahlungen des Käufers werden ausschließlich auf Forderungen aus diesem Vertrag angerechnet, und zwar zunächst auf fällige Kosten, dann auf fällige Zinsen und sodann auf die Raten, beginnend mit der ältesten.'),

    h('5. Eigentumsvorbehalt, Zulassung und Nutzung'),
    p('5.1 Der Verkäufer behält sich das Eigentum am Fahrzeug und am Zubehör bis zur vollständigen Zahlung des Gesamtbetrags und der Zinsen nach Ziffer 4.4 vor (§ 449 Abs. 1 BGB). Der Eigentumsübergang hängt nicht von der Erfüllung anderer Forderungen als derjenigen aus diesem Vertrag ab.'),
    p('5.2 Das Fahrzeug wird auf den Käufer als Halter zugelassen. Der Käufer beantragt die Zulassung unverzüglich, spätestens am Übergabetag, bei der für seinen Sitz zuständigen Zulassungsbehörde (§ 15 Abs. 5 FZV); der Verkäufer zeigt den Halterwechsel an. Der Verkäufer legt der Zulassungsbehörde die Zulassungsbescheinigung Teil II vor oder übersendet sie ihr unmittelbar; er wird als Verfügungsberechtigter über die Zulassungsbescheinigung Teil II angegeben (§ 6 Abs. 5 Nr. 2 FZV). Die Zulassungsbescheinigung Teil II ist nach der Umschreibung an den Verkäufer zurückzugeben und verbleibt bis zum Eigentumsübergang bei ihm. Die Eintragung des Käufers als Halter ist kein Nachweis seines Eigentums. Die Kraftfahrzeugsteuer trägt der Käufer als Halter (§ 7 Nr. 1 KraftStG).'),
    p('5.3 Der Käufer stellt sicher, dass er für den Einsatz des Fahrzeugs im gewerblichen Güterkraftverkehr über eine gültige Gemeinschaftslizenz und über eine beglaubigte Kopie für dieses Fahrzeug verfügt (§ 3 GüKG), bevor er das Fahrzeug einsetzt, und meldet das Fahrzeug der zuständigen Behörde, soweit dies vorgeschrieben ist. Das Fahrzeug steht ausschließlich dem Käufer zur Verfügung.'),
    p('5.4 Mit Eingang der letzten geschuldeten Zahlung auf dem Konto des Verkäufers geht das Eigentum ohne weitere Erklärung auf den Käufer über. Der Verkäufer übergibt dem Käufer innerhalb von sieben Tagen danach die Zulassungsbescheinigung Teil II und bestätigt den Eigentumsübergang in Textform.'),
    p('5.5 Bis zum Eigentumsübergang darf der Käufer ohne vorherige Zustimmung des Verkäufers in Textform nicht'),
    li('1. das Fahrzeug verkaufen, tauschen, verschenken oder sonst darüber verfügen;'),
    li('2. das Fahrzeug verpfänden oder zur Sicherheit übereignen;'),
    li('3. das Fahrzeug vermieten, verleihen oder sonst einem Dritten zum Besitz oder Gebrauch überlassen;'),
    li('4. das Fahrzeug in einem anderen Staat zulassen oder die Zulassung in Deutschland beenden;'),
    li('5. Änderungen am Fahrzeug vornehmen, die zum Erlöschen der Betriebserlaubnis führen oder eine neue Begutachtung erfordern;'),
    li('6. das Fahrzeug oder sein Zubehör mit anderen Sachen verbinden oder Zubehör entfernen, um es weiterzugeben.'),
    p('Keine Überlassung im Sinne von Nummer 3 ist das Führen des Fahrzeugs im eigenen Verkehr des Käufers durch dessen Arbeitnehmer oder durch ihm überlassene Leiharbeitnehmer.'),
    p('5.6 Der Käufer darf das Fahrzeug im eigenen Verkehr im Vertragsgebiet einsetzen; Vertragsgebiet ist die Staaten des EWR und die Schweiz. Ein Einsatz außerhalb des Vertragsgebiets bedarf der vorherigen Zustimmung des Verkäufers in Textform.'),
    p('5.7 Bei Pfändungen, Beschlagnahmen oder sonstigen Zugriffen Dritter auf das Fahrzeug weist der Käufer auf das Eigentum des Verkäufers hin und benachrichtigt den Verkäufer unverzüglich in Textform unter Übersendung der Unterlagen. Gleiches gilt bei einem Antrag auf Eröffnung eines Insolvenzverfahrens über das Vermögen des Käufers. Die Kosten einer notwendigen Rechtsverteidigung des Verkäufers trägt der Käufer, soweit sie nicht vom Dritten erstattet werden.'),

    h('6. Instandhaltung und Untersuchungen'),
    p(`6.1 Wartung ist im Kaufpreis nicht enthalten. ( ) Die Parteien schließen einen gesonderten Wartungsvertrag (Anlage 4), nach dem der Verkäufer das Fahrzeug zweimal jährlich wartet. Die Wartung umfasst den Wechsel von Motor- und Getriebeöl samt Filtern sowie das Auslesen des Fehlerspeichers. Der Preis beträgt ${BLANK} Euro netto je Wartung; er wird nach Ausführung zuzüglich Umsatzsteuer berechnet.`),
    p('6.2 Alle übrigen Kosten des Betriebs und der Unterhaltung des Fahrzeugs trägt der Käufer, insbesondere Reparaturen, Reifen, Glas, Bremsen, Kraftstoff, AdBlue, Maut und Reinigung.'),
    p('6.3 Der Käufer hält das Fahrzeug in ordnungsgemäßem und verkehrssicherem Zustand, nutzt es bestimmungsgemäß und zeigt dem Verkäufer Schäden und Mängel, die den Wert des Fahrzeugs erheblich mindern können, unverzüglich an.'),
    p('6.4 Der Käufer lässt die gesetzlich vorgeschriebenen Hauptuntersuchungen und Sicherheitsprüfungen fristgerecht durchführen und übermittelt dem Verkäufer den Untersuchungsbericht über den Dienst RAHTIS oder sonst in Textform.'),
    p('6.5 Besichtigungsrecht des Verkäufers: Der Verkäufer ist berechtigt, das Fahrzeug alle ( ) zwei  ( ) drei Monate nach vorheriger Terminabsprache am Betriebssitz des Käufers zu besichtigen. Über die Besichtigung wird ein Protokoll erstellt.'),

    h('7. Versicherungen'),
    p('7.1 Der Käufer schließt als Halter die Kraftfahrzeug-Haftpflichtversicherung ab und hält sie während der gesamten Vertragsdauer aufrecht (§ 1 PflVG).'),
    p(`7.2 Der Käufer schließt auf seine Kosten eine Vollkaskoversicherung ab, die mindestens Unfall-, Brand-, Diebstahl- und Vandalismusschäden deckt, Selbstbeteiligung höchstens ${BLANK} Euro, und hält sie bis zum Eigentumsübergang aufrecht. Die Versicherung wird zugunsten des Verkäufers als Eigentümer genommen. Der Käufer übergibt dem Verkäufer vor der Übergabe einen Sicherungsschein oder eine gleichwertige Bestätigung des Versicherers in Textform, nach der Entschädigungen für das Fahrzeug an den Verkäufer gezahlt werden und der Versicherer den Verkäufer über Prämienverzug und Beendigung des Vertrags unterrichtet.`),
    p('7.3 Der Untergang, der Verlust oder die Beschädigung des Fahrzeugs lassen die Zahlungspflicht des Käufers unberührt. Eine an den Verkäufer gezahlte Versicherungsleistung wird wie eine vorzeitige Zahlung nach Ziffer 4.6 auf die Forderungen aus diesem Vertrag angerechnet. Sie wird nur zur Tilgung von Forderungen aus diesem Vertrag verwendet. Ein Überschuss wird unverzüglich an den Käufer ausgezahlt.'),

    h('8. Ortung'),
    p('8.1 Im Fahrzeug befindet sich während der Vertragsdauer ein vom Verkäufer eingebautes oder gebilligtes Ortungsgerät. Der Käufer darf das Gerät nicht entfernen und seine Funktion nicht beeinträchtigen.'),
    p('8.2 Der Verkäufer sieht nur den Kilometerstand und die Angabe, ob sich das Fahrzeug im Vertragsgebiet (Ziffer 5.6) befindet. Der genaue Standort wird dem Verkäufer nur angezeigt, wenn'),
    li('1. wegen des Diebstahls oder der Unterschlagung des Fahrzeugs Strafanzeige erstattet worden ist;'),
    li('2. sich das Fahrzeug ohne Zustimmung des Verkäufers länger als 24 Stunden außerhalb des Vertragsgebiets befunden hat; oder'),
    li('3. die Voraussetzungen der Ziffer 9.1 vorliegen oder der Verkäufer vom Vertrag zurückgetreten ist.'),
    p('8.3 Verantwortlicher für die Verarbeitung der Ortungsdaten ist der Verkäufer. Die Daten werden zum Schutz des Eigentums des Verkäufers verarbeitet; Rechtsgrundlage ist das berechtigte Interesse des Verkäufers (Art. 6 Abs. 1 Buchst. f der Verordnung (EU) 2016/679). Der Verkäufer verwendet die Ortungsdaten nicht zur Kontrolle der Arbeitszeit, der Fahrweise oder sonst der Leistung oder des Verhaltens der Fahrer. Jeder Abruf des genauen Standorts wird mit seinem Grund protokolliert und dem Käufer spätestens innerhalb von 3 Tagen mitgeteilt, es sei denn, die Mitteilung würde die Aufklärung einer Straftat gefährden. Genaue Standortdaten werden nach 30 Tagen gelöscht oder, wenn sie nach Ziffer 8.2 abgerufen wurden, sobald der Vorgang abgeschlossen ist.'),
    p('8.4 Der Verkäufer erstellt für die Fahrer die Information nach Art. 14 der Verordnung (EU) 2016/679; der Käufer händigt sie seinen Fahrern vor der Übergabe aus. Der Käufer ist als Arbeitgeber dafür verantwortlich, dass die Anforderungen des Beschäftigtendatenschutzes (§ 26 BDSG) eingehalten und bestehende Mitbestimmungsrechte des Betriebsrats (§ 87 Abs. 1 Nr. 6 BetrVG) gewahrt werden.'),
    p('8.5 Im Fahrzeug kann eine Fernwegfahrsperre eingebaut werden. Sie darf nur bei abgestelltem Fahrzeug und nur dann aktiviert werden, wenn (a) die Polizei nach einer Strafanzeige wegen Diebstahls des Fahrzeugs dies verlangt oder dem zustimmt, oder (b) der Käufer im jeweiligen Zeitpunkt in Textform zustimmt. Die Wegfahrsperre wird nicht zur Durchsetzung von Zahlungen und nicht zur Rücknahme des Fahrzeugs eingesetzt; die Rücknahme richtet sich ausschließlich nach Ziffer 9.'),

    h('9. Zahlungsverzug, Vertragsverletzung und Rücknahme'),
    p('9.1 Wegen Zahlungsverzugs kann der Verkäufer nur dann nach Ziffer 9.2 vorgehen, wenn'),
    li(`1. der Käufer mit mindestens zwei aufeinander folgenden Raten ganz oder teilweise in Verzug ist und der rückständige Betrag mindestens ${pct} Prozent des Gesamtbetrags erreicht, oder der Käufer mit der Schlussrate oder dem gesamten noch offenen Restkaufpreis in Verzug ist; und`),
    li('2. der Verkäufer dem Käufer in Textform eine Frist von mindestens 14 Tagen zur Zahlung des rückständigen Betrags gesetzt und dabei erklärt hat, dass er nach fruchtlosem Ablauf der Frist den gesamten Restkaufpreis fällig stellen oder vom Vertrag zurücktreten werde, und diese Frist ohne vollständige Zahlung abgelaufen ist.'),
    p(`${pct} Prozent des Gesamtbetrags dieses Vertrags sind ${threshold} Euro.`),
    p('9.2 Liegen die Voraussetzungen der Ziffer 9.1 vor, kann der Verkäufer durch Erklärung in Textform nach seiner Wahl'),
    li('1. den gesamten noch offenen Restkaufpreis sofort fällig stellen; Zinsen nach Ziffer 4.4 für die Zeit nach der Fälligstellung werden nicht berechnet, an ihre Stelle treten die Verzugszinsen nach Ziffer 4.5; oder'),
    li('2. vom Vertrag zurücktreten (§ 323 BGB) und die Herausgabe des Fahrzeugs verlangen (§ 449 Abs. 2, § 985 BGB).'),
    p('9.3 Der Verkäufer kann ferner vom Vertrag zurücktreten, wenn der Käufer eine der folgenden Pflichten erheblich verletzt und die Verletzung nicht innerhalb von 14 Tagen nach Abmahnung des Verkäufers in Textform beseitigt; einer Fristsetzung bedarf es nicht, wenn die Verletzung ihrer Art nach nicht beseitigt werden kann:'),
    li('1. die Verbote der Ziffer 5.5;'),
    li('2. die Pflichten zur Zulassung und zur Rückgabe der Zulassungsbescheinigung Teil II nach Ziffer 5.2;'),
    li('3. die Pflicht, die Versicherungen nach den Ziffern 7.1 und 7.2 aufrechtzuerhalten, gleich aus welchem Grund der Versicherungsschutz endet oder das Fahrzeug nicht mehr deckt;'),
    li('4. die Pflicht zur fristgerechten Hauptuntersuchung und Sicherheitsprüfung (Ziffer 6.4);'),
    li('5. das Verbot, das Ortungsgerät zu entfernen oder zu beeinträchtigen (Ziffer 8.1);'),
    li('6. die Anzeigepflicht nach Ziffer 5.7.'),
    p('9.4 Nach dem Rücktritt hat der Käufer das Fahrzeug samt Zubehör, Schlüsseln, Zulassungsbescheinigung Teil I und Wartungsunterlagen unverzüglich an den Verkäufer herauszugeben. Der Verkäufer ist nicht berechtigt, das Fahrzeug ohne oder gegen den Willen des Käufers an sich zu nehmen. Gibt der Käufer das Fahrzeug nicht freiwillig heraus, setzt der Verkäufer seinen Herausgabeanspruch gerichtlich durch; die Vollstreckung erfolgt durch den Gerichtsvollzieher (§ 883 ZPO).'),
    p('9.5 Nach Rückgabe des Fahrzeugs rechnen die Parteien wie folgt ab. Der Wert des Fahrzeugs im Zeitpunkt der Rückgabe wird durch das Gutachten eines von beiden Parteien benannten, hilfsweise von der für den Sitz des Verkäufers zuständigen Industrie- und Handelskammer benannten öffentlich bestellten und vereidigten Kraftfahrzeugsachverständigen als gewöhnlicher Verkaufswert (netto) ermittelt, soweit sich die Parteien nicht in Textform auf einen Wert einigen; maßgeblich sind dabei auch der in diesem Vertrag genannte Barzahlungspreis, die Dauer der Nutzung und der Pflegezustand. Dem Verkäufer stehen zu: die bis zum Rücktritt fälligen und unbezahlten Raten, der noch nicht fällige Restkaufpreis, die bis zur Rückgabe angefallenen Zinsen nach den Ziffern 4.4 und 4.5 sowie die Kosten nach Ziffer 4.7. Hierauf wird der ermittelte Wert des Fahrzeugs angerechnet. Übersteigt der Wert des Fahrzeugs die Forderung des Verkäufers, zahlt der Verkäufer den Überschuss innerhalb von 14 Tagen nach Feststellung des Werts an den Käufer aus. Ist der Wert niedriger, schuldet der Käufer den Unterschiedsbetrag als Schadensersatz statt der Leistung, höchstens jedoch diesen Unterschiedsbetrag. Mit dieser Abrechnung sind die wechselseitigen Ansprüche aus den §§ 346 bis 348 BGB abgegolten. Dem Käufer bleibt der Nachweis vorbehalten, dass dem Verkäufer ein geringerer Schaden entstanden ist.'),
    p('9.6 Die umsatzsteuerliche Behandlung der Rückabwicklung richtet sich nach § 17 UStG. Der Verkäufer berichtigt die Rechnung nach Ziffer 4.2, soweit die Lieferung rückgängig gemacht wird; die Parteien berichtigen Umsatzsteuer und Vorsteuerabzug jeweils für den Besteuerungszeitraum der Rückgabe. In der Abrechnung nach Ziffer 9.5 wird die vom Käufer gezahlte und infolge der Berichtigung vom Verkäufer zurückerhaltene Umsatzsteuer dem Käufer gutgebracht.'),
    p('9.7 Der Käufer kann den Rücktritt abwenden, indem er innerhalb der Frist nach Ziffer 9.1 den rückständigen Betrag samt Verzugszinsen und Kosten zahlt. Nach erklärtem Rücktritt kann der Käufer das Fahrzeug bis zum Ablauf von 14 Tagen nach der Rückgabe behalten oder zurückerwerben, wenn er den gesamten dem Verkäufer nach Ziffer 9.5 zustehenden Betrag in einer Summe zahlt; in diesem Fall gilt der Vertrag als fortgesetzt und erfüllt.'),
    p('9.8 Für Streitigkeiten über die Herausgabe und die Abrechnung sind die ordentlichen Gerichte zuständig. Eine Behörde, die die Abrechnung zwischen den Parteien vornimmt, besteht nicht.'),
    p('9.9 Endet der Kauf durch Rücktritt und Rückgabe des Fahrzeugs oder durch einvernehmliche Aufhebung, vermerkt der Verkäufer dies unverzüglich im Dienst RAHTIS. Ab diesem Vermerk werden über den Dienst keine Zahlungsaufforderungen und keine Zahlungserinnerungen mehr erstellt. Der Vermerk ändert die Rechte und Pflichten der Parteien nicht; die Abrechnung nach Ziffer 9.5 nehmen die Parteien untereinander vor.'),

    h('10. Datenaustausch im Dienst RAHTIS'),
    p('10.1 Die Parteien vereinbaren, dass dem Verkäufer im Dienst RAHTIS während der Vertragsdauer der Kilometerstand, die Wartungs-, Mängel-, Besichtigungs- und Untersuchungsdaten des Fahrzeugs, der Zahlungsstand sowie der Standort im Rahmen der Ziffer 8 angezeigt werden. Angaben zu Transportaufträgen und Erlösen des Fahrzeugs werden dem Verkäufer nur als Monatsübersicht und nur dann angezeigt, wenn der Käufer dies im Dienst gesondert freigegeben hat.'),
    p('10.2 Die Aivomaa Oy (RAHTIS) ist nicht Partei dieses Vertrags. Sie stellt den Parteien lediglich die Berechnung, die Vertrags- und Abrechnungsunterlagen sowie Zahlungserinnerungen und Hinweise zur Verfügung. Sie gewährt keine Finanzierung, übernimmt keine Bürgschaft oder Garantie, nimmt keine Zahlungen entgegen, zieht keine Forderungen ein und haftet nicht für die Verpflichtungen der Parteien. Soweit Rechnungen über den Dienst erstellt werden, geschieht dies im Namen und für Rechnung des Verkäufers (§ 14 Abs. 2 Satz 7 UStG). Die Aivomaa Oy erbringt keine Rechts- oder Steuerberatung. Sie verarbeitet personenbezogene Daten im Auftrag der Parteien nach den Nutzungsbedingungen des Dienstes und dem Vertrag über die Auftragsverarbeitung.'),

    h('11. Schlussbestimmungen'),
    p('11.1 Der Verkäufer kann die Forderungen aus diesem Vertrag an ein Kredit- oder Finanzdienstleistungsinstitut abtreten und diesem das vorbehaltene Eigentum übertragen. Die Abtretung wird dem Käufer in Textform angezeigt; nach Zugang der Anzeige kann der Käufer mit befreiender Wirkung nur noch an den neuen Gläubiger zahlen.'),
    p('11.2 Erklärungen und Mitteilungen nach diesem Vertrag bedürfen der Textform und werden an die in Ziffer 1 genannten E-Mail-Adressen gerichtet. Jede Partei teilt der anderen Änderungen ihrer Anschrift und E-Mail-Adresse unverzüglich mit.'),
    p('11.3 Es gilt das Recht der Bundesrepublik Deutschland.'),
    p('11.4 Sind beide Parteien Kaufleute, ist ausschließlicher Gerichtsstand für alle Streitigkeiten aus diesem Vertrag der Sitz des Verkäufers. Der Verkäufer bleibt berechtigt, Maßnahmen des einstweiligen Rechtsschutzes auch bei dem Gericht zu beantragen, in dessen Bezirk sich das Fahrzeug befindet.'),
    p('11.5 Änderungen und Ergänzungen dieses Vertrags bedürfen der Textform; dies gilt auch für die Änderung dieser Klausel. Individuelle Vereinbarungen haben Vorrang.'),
    p('11.6 Sollte eine Bestimmung dieses Vertrags unwirksam sein oder werden, bleibt die Wirksamkeit der übrigen Bestimmungen unberührt.'),
    p('11.7 Der Vertrag wird vor der Übergabe des Fahrzeugs entweder eigenhändig in zwei gleichlautenden Ausfertigungen unterzeichnet, von denen jede Partei eine erhält, oder von beiden Parteien mit einer qualifizierten elektronischen Signatur versehen; in diesem Fall erhält jede Partei das signierte elektronische Dokument.'),

    h('12. Unterschriften'),
    p(`Ort und Datum: ${LONG_BLANK}`),
    { kind: 'sign', left: [`Verkäufer: ${d.seller.name}`, 'Name in Druckschrift, Funktion'], right: [`Käufer: ${d.buyer.name}`, 'Name in Druckschrift, Funktion'] },
    p('Anlagen: 1. Zahlungsplan · 2. Übergabeprotokoll · 3. Rechnung nach Ziffer 4.2 · 4. Wartungsvertrag · 5. Datenschutzinformation für Fahrer'),
  ];

  const annexes: ContractBlock[] = [
    { kind: 'annex', text: 'Anlage 1 – Zahlungsplan' },
    { kind: 'meta', text: `Vertrag Nr. ${d.number} · Fahrzeug ${d.vehicle.make}, FIN ${BLANK}` },
    {
      kind: 'table',
      head: ['Nr.', 'Fälligkeit', 'Rate (Tilgung) €', 'Zinsen € (steuerfrei nach § 4 Nr. 8 Buchst. a UStG)', 'Zahlbetrag €', 'Restkaufpreis nach Zahlung €'],
      rows: [
        ['Anzahlung', 'vor Übergabe', bare(d.price.downGross), '–', bare(d.price.downGross), bare(d.price.rest)],
        ...d.plan.map((r, i) => [
          i === d.plan.length - 1 ? `${r.n} (Schlussrate)` : String(r.n),
          r.due,
          bare(r.principal),
          bare(r.interest),
          bare(r.total),
          bare(r.balance),
        ]),
      ],
      foot: ['Summe', '', bare(d.price.gross), bare(d.planTotals.interest), bare(d.planTotals.all), ''],
    },
    p(`Die Zinsen sind für planmäßige Zahlung berechnet (Jahreszins ${d.ratePercent ?? '0'} %, tatsächliche Tage / 365, ab Übergabe). Bei vorzeitiger oder verspäteter Zahlung ändern sie sich nach den Ziffern 4.4 bis 4.6.`),
    p(`Schwelle nach Ziffer 9.1: ${pct} % des Gesamtbetrags = ${threshold} Euro.`),

    { kind: 'annex', text: 'Anlage 2 – Übergabeprotokoll' },
    { kind: 'meta', text: `Vertrag Nr. ${d.number} · Verkäufer ${d.seller.name} · Käufer ${d.buyer.name}` },
    kv('Fahrzeug', d.vehicle.make),
    kv('Amtliches Kennzeichen', d.vehicle.plate),
    kv('FIN', LONG_BLANK),
    kv('Kilometerstand bei Übergabe', `${BLANK} km`),
    kv('Betriebsstunden (falls vorhanden)', BLANK),
    kv('Nächste Hauptuntersuchung / Sicherheitsprüfung', `${BLANK} / ${BLANK}`),
    kv('Kraftstoff / AdBlue', `${BLANK} / ${BLANK}`),
    kv('Bereifung (Profiltiefe je Achse)', LONG_BLANK),
    kv('Übergebenes Zubehör', LONG_BLANK),
    kv('Anzahl der Schlüssel', BLANK),
    kv('Übergebene Unterlagen', `Zulassungsbescheinigung Teil I, Wartungsnachweise, ${BLANK}`),
    kv('Zulassungsbescheinigung Teil II', `verbleibt beim Verkäufer (Nr. ${BLANK})`),
    kv('Festgestellte Mängel und Schäden', `${LONG_BLANK}, Fotos Nr. ${BLANK}`),
    kv('Ortungsgerät eingebaut und geprüft', '( ) ja  ( ) nein'),
    p(`Das Fahrzeug wurde dem Käufer am ____.____.________ um ____.____ Uhr übergeben, nachdem der Kaufvertrag Nr. ${d.number} von beiden Parteien unterzeichnet und der vor Übergabe fällige Betrag gezahlt worden war. Der Käufer bestätigt, dass ihm bekannt ist, dass das Fahrzeug bis zur vollständigen Zahlung Eigentum des Verkäufers bleibt.`),
    p(`Ort, Datum: ${LONG_BLANK}`),
    { kind: 'sign', left: ['Verkäufer'], right: ['Käufer'] },
  ];

  return {
    title: `Kaufvertrag mit Ratenzahlung und Eigentumsvorbehalt ${d.number}`,
    author: d.seller.name,
    footer: `Kaufvertrag ${d.number} · erstellt im Dienst RAHTIS; die Aivomaa Oy ist nicht Vertragspartei`,
    pages: [main, annexes],
  };
}
