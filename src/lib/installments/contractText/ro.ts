/**
 * Договор Румынии: «Contract de vânzare cu plata prețului în rate și rezerva
 * proprietății» (23.11.2026).
 *
 * Текст — шаблон docs/equipment-sale/countries/ro.md, раздел 5, версия 0.1
 * (черновик, румынским юристом не проверен; Codul civil прочитан в
 * консолидации 2016 года — об этом сторонам сказано в кабинете). Юридический
 * текст перенесён дословно; подставлены только данные сделки. Плейсхолдеры
 * шаблона, оставшиеся по-фински ([nimi], [kyllä/ei], [merkki, malli],
 * [nouto myyjältä / …], [ostaja / myyjä], [kahden / kolmen kuukauden],
 * [törmäys-, palo-…], [myyjän kotipaikan], [nimenselvennys, asema],
 * [määrä €]), заполнены по-румынски теми же значениями, что в договорах
 * других стран. Чего в RAHTIS нет (VIN, год первой регистрации, номер в
 * registrul comerțului, IBAN, номер лицензии, представитель, номер записи в
 * RNPM, номер счёта продавца в RO e-Factura), — строки для заполнения от руки;
 * где шаблон даёт выбор, который платформа не знает, — варианты с «( )».
 *
 * Даты — «дд.мм.гггг», суммы — «10.000,00» в таблице с «lei» в шапке.
 *
 * Решения:
 *   · только обычный НДС 21 %: варианты B–D п. 4.2 (TVA la încasare, режим
 *     перепродавца, не плательщик) и примечание к ним не печатаются;
 *   · счета: шаблон уже говорит, что счета выставляет продавец через
 *     RO e-Factura, а PDF из RAHTIS — не счета (п. 4.2), и что Aivomaa Oy даёт
 *     только расчёт, документы и уведомления (п. 10.2) — ни один пункт не
 *     говорит, что счёт выставляет платформа, менять текст не пришлось. Номер
 *     счёта на всю цену в п. 4.3 платформе неизвестен — строка для заполнения;
 *   · пороги п. 9.2 — договорные: 30 дней и 1/8 цены с НДС (сумма считается
 *     rules.ts RO_CC1755), срок уведомления — 15 дней (п. 9.3);
 *   · возврат машины — только executor judecătoresc или суд (п. 9.5,
 *     осторожный вариант исследования); п. 9.6 — с оговоркой, что суд может
 *     уменьшить удержанное (art. 1.757 alin. (2));
 *   · зона договора — страны ЕЭЗ и Швейцария; подсудность — по месту продавца.
 */
import type { ContractPdfInput } from '../ContractPdf.tsx';
import { BLANK, h, kv, li, LONG_BLANK, p, sub, type ContractBlock, type ContractDocument } from './blocks.ts';

/** Сумма без «lei»: «70.000 lei» → «70.000»; валюта стоит в шапке таблицы или словом «lei». */
export const bareLei = (money: string) => money.replace(/[\s  ]*lei/g, '').trim();

const lei = (money: string) => `${bareLei(money)} lei`;
const DATE_BLANK = '__.__.____';

function party(label: string, x: ContractPdfInput['seller'], extra?: string): string[] {
  return [
    label,
    x.name,
    `Cod unic de înregistrare (CUI): ${x.businessId}`,
    `Număr de ordine în registrul comerțului: ${BLANK}`,
    `Sediul social: ${x.address || LONG_BLANK}`,
    `Înregistrat în scopuri de TVA: ${x.vatRegistered ? 'da' : 'nu'}`,
    `Cont IBAN: ${LONG_BLANK}`,
    ...(extra ? [extra] : []),
    `Reprezentat prin: ${LONG_BLANK}`,
    `Telefon: ${x.phone || BLANK} · E-mail: ${x.email || BLANK}`,
  ];
}

export function roContractText(d: ContractPdfInput): ContractDocument {
  const n = d.months;
  const first = d.plan[0];
  const last = d.plan[d.plan.length - 1];
  const regular = d.plan.slice(0, -1);
  const equal = regular.every((x) => x.principal === first.principal);
  const interestTotal = d.price.interestTotal ? lei(d.price.interestTotal) : null;

  /* 4.3: равные взносы — суммой, как в шаблоне; если расходятся на бань, — отсылка к графику. */
  const regularLine =
    regular.length === 0
      ? null
      : regular.length === 1
        ? `Rata 1: ${lei(first.principal)}, scadentă la ${first.due}.`
        : equal
          ? `Ratele 1–${n - 1}: fiecare ${lei(first.principal)}, scadente în ziua de ${d.dueDay} a fiecărei luni, prima la ${first.due}.`
          : `Ratele 1–${n - 1}: în sumele din graficul de plăți (anexa 1), scadente în ziua de ${d.dueDay} a fiecărei luni, prima la ${first.due}.`;

  const main: ContractBlock[] = [
    { kind: 'title', text: 'CONTRACT DE VÂNZARE CU PLATA PREȚULUI ÎN RATE ȘI REZERVA PROPRIETĂȚII' },
    { kind: 'notice', text: 'DREPTUL DE PROPRIETATE ASUPRA VEHICULULUI NU SE TRANSFERĂ CUMPĂRĂTORULUI PÂNĂ LA PLATA INTEGRALĂ A PREȚULUI.' },
    { kind: 'meta', text: `Contract nr. ${d.number} · Data ${d.date}` },

    h('1. Părțile contractante'),
    {
      kind: 'parties',
      left: party('Vânzător', d.seller),
      right: party('Cumpărător', d.buyer, `Licență de transport nr.: ${BLANK}`),
    },
    p('Vânzătorul acordă cumpărătorului eșalonarea plății prețului.'),
    p('Părțile declară că sunt profesioniști în sensul art. 3 din Codul civil și că încheie prezentul contract în exercițiul activității întreprinderii lor.'),

    h('2. Obiectul contractului'),
    kv('Vehicul', d.vehicle.make),
    kv('Număr de înmatriculare', d.vehicle.plate),
    kv('Număr de identificare (VIN)', LONG_BLANK),
    kv('Anul primei înmatriculări', '__________'),
    kv('Kilometraj la data încheierii contractului', d.vehicle.odometer),
    kv('Echipamente suplimentare', `( ) fără echipamente suplimentare  ( ) ${LONG_BLANK}`),
    kv('Sarcini existente', `( ) nu există  ( ) date: ${BLANK}`),
    p('2.1 Vânzătorul declară că este proprietarul vehiculului și al echipamentelor suplimentare, că asupra acestora nu există ipoteci, gajuri, rezerve ale proprietății în favoarea unui terț, sechestre sau alte sarcini care nu sunt menționate mai sus și că are dreptul de a vinde vehiculul în condițiile prezentului contract. Înainte de semnare, vânzătorul pune la dispoziția cumpărătorului copia certificatului de înmatriculare și a cărții de identitate a vehiculului, precum și rezultatul unei căutări în Registrul Național de Publicitate Mobiliară cu privire la vehicul.'),
    p('2.2 Vehiculul se vinde în starea descrisă în procesul-verbal de predare-primire (anexa 2). Cumpărătorul denunță vânzătorului, în scris, viciile ascunse în termenul prevăzut la art. 1.709 din Codul civil.'),

    h('3. Predarea'),
    p(`3.1 Modul de predare: ( ) ridicare de la vânzător  ( ) vânzătorul livrează la adresa ${BLANK}. Data predării: ${d.handover}.`),
    p('3.2 Vehiculul se predă numai după ce'),
    li('1. prezentul contract a fost semnat;'),
    li('2. prima factură (pct. 4.2) a fost plătită în contul vânzătorului;'),
    li('3. rezerva proprietății a fost înscrisă în Registrul Național de Publicitate Mobiliară (pct. 5.2);'),
    li('4. pentru vehicul există asigurarea RCA prevăzută la pct. 7.1, valabilă de la data predării, și a fost prezentată confirmarea prevăzută la pct. 7.2; și'),
    li('5. vânzătorul a solicitat în scris autorității competente înscrierea cumpărătorului în certificatul de înmatriculare (pct. 5.3).'),
    p('3.3 La predare părțile verifică vehiculul și semnează procesul-verbal de predare-primire (anexa 2), în care se consemnează data și ora predării. Riscul pieirii sau deteriorării vehiculului trece la cumpărător la momentul predării (art. 1.755 din Codul civil).'),

    h('4. Prețul și plata'),
    sub('4.1 Prețul (lei)'),
    kv('Prețul vehiculului (fără TVA)', bareLei(d.price.net)),
    kv('Echipamente suplimentare, detaliate și evaluate (fără TVA)', '–'),
    kv(`TVA ${d.vatPercent} % aplicată la ${bareLei(d.price.net)}`, bareLei(d.price.vat)),
    kv('Preț total (cu TVA)', bareLei(d.price.gross), true),
    kv('Avans, plătit înainte de predare (include TVA aferentă întregului preț)', bareLei(d.price.downGross)),
    kv('Rest de preț (nu include TVA)', bareLei(d.price.rest)),
    kv('Costul eșalonării: dobândă remuneratorie plătită separat (pct. 4.4)', interestTotal ?? 'fără dobândă'),
    kv(`Total de plată (avansul și ratele 1–${n}; nu include dobânda plătită separat)`, bareLei(d.price.gross), true),
    p('Toate sumele se exprimă și se plătesc în lei. În prezentul contract, „preț total” înseamnă prețul cu TVA.'),

    sub('4.2 Prima factură și TVA'),
    p('Vânzătorul facturează, înainte de predare, prețul total. Factura cuprinde TVA aferentă întregului preț; din aceasta, cumpărătorul plătește înainte de predare avansul prevăzut la pct. 4.1, iar restul de preț se plătește în ratele prevăzute la pct. 4.3. Predarea vehiculului în temeiul prezentului contract constituie livrare de bunuri, iar exigibilitatea taxei intervine la data emiterii facturii, dacă aceasta este anterioară predării, respectiv la data predării (art. 270 alin. (3) lit. a), art. 281 alin. (6) și art. 282 alin. (1) și (2) din Legea nr. 227/2015 privind Codul fiscal).'),
    p('Facturile emise în temeiul prezentului contract sunt numai cele transmise de vânzător prin sistemul național RO e-Factura (Ordonanța de urgență a Guvernului nr. 120/2021; art. 319 alin. (1^1) din Codul fiscal). Documentele în format PDF puse la dispoziție prin serviciul RAHTIS au caracter informativ și nu sunt facturi.'),

    sub('4.3 Ratele'),
    p(`Durata eșalonării: ${n} luni. Numărul ratelor: ${n}.`),
    ...(regularLine ? [p(regularLine)] : []),
    p(`Ultima rată ${n}: ${lei(last.principal)}, scadentă la ${last.due}.`),
    p(`Ratele nu cuprind TVA, deoarece TVA aferentă întregului preț a fost facturată prin factura nr. ${BLANK}. Pentru rate nu se emit facturi; cumpărătorul primește o înștiințare de plată.`),
    p('Graficul de plăți: anexa 1.'),

    sub('4.4 Dobânda remuneratorie'),
    p(
      d.ratePercent
        ? `Pentru restul de preț se percepe, de la data predării, o dobândă remuneratorie fixă de ${d.ratePercent} % pe an. Dobânda se calculează la soldul neachitat, pe zile efective (zile efective / 365), și se plătește separat, odată cu fiecare rată. La plata conform graficului, dobânda totală este de ${interestTotal ?? BLANK} (anexa 1). Dobânda percepută pentru amânarea plății după data livrării este scutită de TVA (art. 292 alin. (2) lit. a) pct. 1 din Codul fiscal) și se facturează lunar.`
        : 'Pentru restul de preț nu se percepe dobândă.',
    ),
    p('Vânzătorul nu percepe de la cumpărător dobânzi, comisioane sau alte sume care nu sunt prevăzute în prezentul contract.'),

    sub('4.5 Dobânda penalizatoare'),
    p('Pentru orice sumă neplătită la scadență, cumpărătorul datorează, de la scadență până la data plății, dobânda legală penalizatoare aplicabilă în raporturile dintre profesioniști, respectiv rata dobânzii de referință a Băncii Naționale a României plus 8 puncte procentuale (art. 3 alin. (2^1) din Ordonanța Guvernului nr. 13/2011). Dacă dobânda prevăzută la pct. 4.4 este mai mare, dobânda penalizatoare se datorează la acest nivel (art. 1.535 alin. (2) din Codul civil). Cumpărătorul este de drept în întârziere la împlinirea scadenței (art. 1.523 din Codul civil).'),

    sub('4.6 Plata anticipată'),
    p('Cumpărătorul are dreptul să plătească anticipat, integral sau parțial, restul de preț (art. 1.496 din Codul civil). În acest caz, dobânda remuneratorie se datorează numai până la data plății, fără comision de rambursare anticipată.'),

    sub('4.7 Alte sume'),
    p('Pentru fiecare notificare de întârziere cumpărătorul plătește 5 lei. Cumpărătorul suportă cheltuielile rezonabile și dovedite de recuperare a creanței și de preluare a vehiculului, taxele de înscriere și de radiere în Registrul Național de Publicitate Mobiliară, precum și taxele de înmatriculare și de transcriere. Alte sume nu se percep.'),

    sub('4.8 Imputația plăților'),
    p('Plățile cumpărătorului se impută numai asupra creanțelor născute din prezentul contract: mai întâi asupra cheltuielilor și dobânzilor scadente, apoi asupra ratelor, începând cu cea mai veche.'),

    h('5. Rezerva proprietății, publicitate, înmatriculare și folosință'),
    p('5.1 Vânzătorul își rezervă dreptul de proprietate asupra vehiculului până la plata integrală a prețului total și a dobânzii prevăzute la pct. 4.4 (art. 1.684 și art. 1.755 din Codul civil). Transferul proprietății nu este condiționat de plata altor datorii decât cele născute din prezentul contract.'),
    p('5.2 Vânzătorul înscrie rezerva proprietății în Registrul Național de Publicitate Mobiliară, prin aviz de înscriere depus la un operator sau agent autorizat, înainte de predarea vehiculului (art. 2.347 din Codul civil; Legea nr. 297/2018 privind publicitatea mobiliară, republicată). Cumpărătorul își dă acordul pentru înscriere și pentru reînnoirea acesteia pe durata contractului.'),
    p('5.3 Pe durata contractului, vehiculul rămâne înmatriculat pe numele vânzătorului. Vânzătorul solicită în scris autorității competente înscrierea cumpărătorului în certificatul de înmatriculare ca persoană care utilizează vehiculul (art. 15 alin. (1^1) din Ordonanța de urgență a Guvernului nr. 195/2002). Cumpărătorul obține, pe cheltuiala sa, documentele necesare pentru utilizarea vehiculului în transportul rutier de mărfuri în baza licenței sale și nu utilizează vehiculul în acest scop înainte de obținerea lor. Vehiculul se află în folosința exclusivă a cumpărătorului.'),
    p('5.4 Impozitul pe mijloacele de transport și celelalte taxe datorate de proprietar pe durata contractului se suportă de cumpărător, care le restituie vânzătorului în termen de 14 zile de la prezentarea dovezii plății.'),
    p('5.5 La data la care ultima sumă datorată este creditată în contul vânzătorului, dreptul de proprietate trece la cumpărător. În termen de 5 zile lucrătoare, vânzătorul eliberează cumpărătorului o declarație de achitare integrală, semnează documentele necesare transcrierii și solicită radierea înscrierii din Registrul Național de Publicitate Mobiliară. Cumpărătorul solicită transcrierea transmiterii dreptului de proprietate în termenul de 90 de zile prevăzut la art. 11 alin. (4) din Ordonanța de urgență a Guvernului nr. 195/2002 și încheie, în nume propriu, asigurarea RCA.'),
    p('5.6 Până la transferul proprietății, cumpărătorul nu poate, fără acordul scris al vânzătorului:'),
    li('1. să vândă, să schimbe sau să doneze vehiculul;'),
    li('2. să constituie ipotecă, gaj sau altă garanție asupra vehiculului;'),
    li('3. să închirieze, să dea în comodat sau să predea în alt mod vehiculul în posesia ori folosința unui terț;'),
    li('4. să înmatriculeze vehiculul în alt stat;'),
    li('5. să aducă vehiculului modificări care impun o nouă omologare sau modificarea cărții de identitate a vehiculului;'),
    li('6. să unească vehiculul ori echipamentele sale cu alte bunuri sau să demonteze echipamente pentru a le înstrăina.'),
    p('Nu constituie predare în sensul pct. 3 conducerea vehiculului, în activitatea proprie a cumpărătorului, de către conducătorii auto angajați ai acestuia sau puși la dispoziția sa de un agent de muncă temporară.'),
    p('5.7 Cumpărătorul poate utiliza vehiculul în activitatea proprie în zona contractuală, care este teritoriul statelor din Spațiul Economic European și al Elveției. Utilizarea vehiculului în afara zonei contractuale necesită acordul scris prealabil al vânzătorului.'),
    p('5.8 Cumpărătorul îl informează de îndată pe vânzător despre orice sechestru, poprire sau altă măsură de executare ori despre deschiderea unei proceduri de insolvență care privește vehiculul sau pe cumpărător și îi comunică terțului existența rezervei proprietății.'),

    h('6. Întreținere și inspecția tehnică'),
    p(`6.1 Reviziile periodice nu sunt incluse în preț. Părțile încheie un contract de service separat (anexa 4), potrivit căruia vânzătorul efectuează revizia vehiculului de două ori pe an. Revizia cuprinde schimbul uleiurilor și al filtrelor de motor și de cutie de viteze și citirea codurilor de eroare. Prețul reviziei este de ${BLANK} lei (fără TVA) pe intervenție și se facturează cu TVA după efectuare.`),
    p('6.2 Cumpărătorul suportă toate celelalte cheltuieli de exploatare și întreținere a vehiculului, cum sunt reparațiile, anvelopele, geamurile, frânele, combustibilul, AdBlue și spălarea.'),
    p('6.3 Cumpărătorul păstrează vehiculul în stare bună, îl folosește potrivit destinației și îl informează de îndată pe vânzător despre daunele și defecțiunile care pot reduce semnificativ valoarea vehiculului.'),
    p('6.4 Cumpărătorul prezintă vehiculul la inspecția tehnică periodică (ITP) înainte de expirarea termenului și transmite vânzătorului dovada inspecției prin serviciul RAHTIS sau în alt mod scris.'),
    p('6.5 Dreptul de verificare al vânzătorului: vânzătorul are dreptul să verifice vehiculul la fiecare ( ) două luni ( ) trei luni, la o dată convenită în prealabil, la punctul de lucru al cumpărătorului. Despre verificare se întocmește un proces-verbal.'),

    h('7. Asigurări'),
    p(`7.1 Pe toată durata contractului, pentru vehicul trebuie să existe o asigurare obligatorie de răspundere civilă auto (RCA) valabilă (Legea nr. 132/2017). Contractul RCA se încheie de ( ) cumpărător ( ) vânzător; prima de asigurare se suportă de cumpărător. ( ) Dacă vânzătorul încheie contractul: cumpărătorul restituie vânzătorului prima de asigurare ${LONG_BLANK}, separat, odată cu fiecare rată.`),
    p(`7.2 Cumpărătorul încheie și plătește o asigurare facultativă (CASCO) care acoperă cel puțin daunele produse prin coliziune, incendiu, furt și vandalism, cu o franșiză de cel mult ${BLANK} lei. Vânzătorul este menționat în poliță ca proprietar al vehiculului și beneficiar al despăgubirii. Înainte de predare, cumpărătorul transmite vânzătorului confirmarea scrisă a asigurătorului că vânzătorul este menționat în poliță și că asigurătorul îl va informa despre încetarea asigurării.`),
    p('7.3 Dacă vehiculul este distrus sau dispare, obligația de plată a cumpărătorului subzistă. Despăgubirea încasată de vânzător se impută, ca plată anticipată, numai asupra creanțelor născute din prezentul contract. Suma care depășește aceste creanțe se plătește de îndată cumpărătorului.'),

    h('8. Localizare'),
    p('8.1 Pe durata contractului, vehiculul este echipat cu un dispozitiv de localizare instalat sau acceptat de vânzător. Cumpărătorul nu îndepărtează dispozitivul și nu îi împiedică funcționarea.'),
    p('8.2 Vânzătorul vede numai kilometrajul și faptul că vehiculul se află sau nu în zona contractuală (pct. 5.7). Poziția exactă i se afișează vânzătorului numai dacă'),
    li('1. s-a depus plângere penală pentru furtul vehiculului;'),
    li('2. vehiculul s-a aflat în afara zonei contractuale mai mult de 24 de ore fără acordul vânzătorului; sau'),
    li('3. sunt îndeplinite condițiile prevăzute la pct. 9.2 ori contractul a încetat prin rezoluțiune.'),
    p('8.3 Vânzătorul este operatorul datelor de localizare. Datele se prelucrează pentru protejarea dreptului de proprietate al vânzătorului, în temeiul interesului său legitim (art. 6 alin. (1) lit. f) din Regulamentul (UE) 2016/679). Vânzătorul nu folosește datele de localizare pentru monitorizarea timpului de lucru, a stilului de conducere sau a altei activități a conducătorilor auto. Fiecare accesare a poziției exacte și temeiul ei se înregistrează, iar cumpărătorul este informat în cel mult 3 zile, cu excepția cazului în care informarea ar periclita cercetarea unei infracțiuni. Datele de poziție exactă se șterg după 30 de zile sau, dacă au fost accesate în temeiul pct. 8.2, după soluționarea situației.'),
    p('8.4 Vânzătorul întocmește pentru conducătorii auto informarea prevăzută la art. 14 din Regulamentul (UE) 2016/679, iar cumpărătorul o comunică acestora înainte de predare. Cumpărătorul răspunde, în calitate de angajator, de îndeplinirea obligațiilor care îi revin potrivit legislației muncii și a protecției datelor cu privire la monitorizarea salariaților.'),
    p('8.5 ( ) Pe vehicul poate fi instalat un sistem de blocare a pornirii de la distanță. Acesta poate fi utilizat numai când vehiculul este parcat și numai dacă (a) poliția o solicită sau o aprobă după depunerea unei plângeri penale pentru furtul vehiculului ori (b) cumpărătorul își dă acordul scris la acel moment. Sistemul nu se utilizează pentru încasarea ratelor și nici pentru preluarea vehiculului; preluarea se face potrivit pct. 9.'),

    h('9. Întârzierea la plată, neexecutarea și restituirea vehiculului'),
    p('9.1 Neplata unei singure rate care nu depășește o optime din prețul total nu dă vânzătorului dreptul la rezoluțiunea contractului, iar cumpărătorul păstrează beneficiul termenului pentru ratele următoare (art. 1.756 din Codul civil), sub rezerva pct. 9.2.'),
    p('9.2 Vânzătorul poate exercita drepturile prevăzute la pct. 9.3 și 9.4 numai dacă suma restantă nu a fost plătită și este îndeplinită una dintre următoarele condiții:'),
    li(`1. o rată este restantă de cel puțin 30 de zile, iar suma restantă este de cel puțin o optime din prețul total, respectiv ${lei(d.price.tenth)};`),
    li('2. cel puțin două rate sunt restante, iar cea mai veche este restantă de cel puțin 30 de zile; sau'),
    li('3. suma restantă reprezintă întregul rest de plată.'),
    p('9.3 Dacă sunt îndeplinite condițiile de la pct. 9.2, vânzătorul îi comunică cumpărătorului o notificare scrisă prin care îi acordă un termen de 15 zile pentru plata sumelor restante și indică în mod expres că, în lipsa plății, poate declara exigibil întregul rest de plată ori poate declara rezoluțiunea contractului (art. 1.522 și art. 1.553 din Codul civil). Dacă plata nu se face în acest termen, vânzătorul poate, la alegerea sa:'),
    li('1. să declare exigibil întregul rest de plată; în acest caz, dobânda remuneratorie pentru perioada ulterioară declarației nu se mai datorează, iar pentru suma exigibilă se datorează dobânda prevăzută la pct. 4.5; sau'),
    li('2. să declare rezoluțiunea contractului prin notificare scrisă (art. 1.552 din Codul civil) și să ceară restituirea vehiculului.'),
    p('9.4 Vânzătorul poate declara rezoluțiunea, în condițiile pct. 9.3, și dacă cumpărătorul încalcă în mod grav una dintre următoarele obligații și nu remediază încălcarea în termen de 14 zile de la notificarea scrisă a vânzătorului, cu excepția cazului în care încălcarea nu poate fi remediată:'),
    li('1. interdicțiile de la pct. 5.6;'),
    li('2. obligațiile privind înmatricularea și documentele de transport de la pct. 5.3;'),
    li('3. obligația de a menține asigurările prevăzute la pct. 7.1 și 7.2;'),
    li('4. inspecția tehnică periodică (pct. 6.4);'),
    li('5. interdicția de a îndepărta dispozitivul de localizare sau de a-i împiedica funcționarea (pct. 8.1).'),
    p('9.5 În caz de rezoluțiune, cumpărătorul predă vânzătorului vehiculul, cu toate documentele și cheile, în termen de 5 zile de la primirea declarației de rezoluțiune, pe bază de proces-verbal. Dacă cumpărătorul nu predă vehiculul de bunăvoie, vânzătorul îl preia numai cu concursul executorului judecătoresc ori în temeiul unei hotărâri judecătorești, potrivit legii. Vânzătorul nu recurge la constrângere și nu tulbură liniștea și ordinea publică.'),
    p('9.6 După rezoluțiune se întocmește un decont între părți. Vânzătorul restituie cumpărătorului sumele primite cu titlu de preț, din care reține (art. 1.757 alin. (1) din Codul civil):'),
    li(`1. o compensație echitabilă pentru folosirea vehiculului, egală cu diferența dintre prețul vehiculului la încheierea contractului și valoarea de piață a vehiculului la data restituirii, stabilită de un evaluator autorizat ales de părți de comun acord sau, în lipsa acordului, desemnat de ${BLANK};`),
    li('2. dobânzile și dobânzile penalizatoare scadente până la data restituirii;'),
    li('3. cheltuielile rezonabile și dovedite de preluare, evaluare și recuperare.'),
    p('Dacă sumele reținute depășesc sumele primite, cumpărătorul plătește diferența. Părțile iau cunoștință că instanța poate reduce sumele reținute de vânzător (art. 1.757 alin. (2) din Codul civil).'),
    p('9.7 Părțile regularizează taxa pe valoarea adăugată aferentă livrării desființate potrivit art. 287 și art. 330 din Codul fiscal. În acest scop, părțile semnează, la cererea oricăreia dintre ele, un acord scris privind desființarea contractului.'),
    p('9.8 Până la predarea vehiculului către vânzător, cumpărătorul poate păstra vehiculul plătind integral restul de plată, dobânzile scadente și cheltuielile rezonabile făcute de vânzător. În acest caz, declarația de rezoluțiune rămâne fără efect prin acordul părților, iar proprietatea se transferă potrivit pct. 5.5.'),
    p('9.9 Dacă vânzarea încetează prin restituirea vehiculului sau prin acordul părților, vânzătorul înregistrează de îndată încetarea în serviciul RAHTIS. De la această înregistrare, prin serviciu nu se mai emit înștiințări de plată și nu se mai trimit notificări de întârziere. Înregistrarea nu modifică drepturile și obligațiile părților: decontul prevăzut la pct. 9.6 se face între părți, iar în lipsa unui acord, de către instanța competentă.'),

    h('10. Schimbul de date în serviciul RAHTIS'),
    p('10.1 Părțile convin ca, pe durata contractului, vânzătorului să i se afișeze în serviciul RAHTIS kilometrajul vehiculului, datele privind reviziile, defecțiunile, verificările și inspecțiile tehnice, situația plăților, precum și poziția, în limitele pct. 8. Datele privind transporturile efectuate și veniturile obținute cu vehiculul i se afișează vânzătorului numai sub forma unui rezumat lunar și numai dacă cumpărătorul a acceptat aceasta în mod expres în serviciu.'),
    p('10.2 Aivomaa Oy (RAHTIS) nu este parte la prezentul contract. Aivomaa Oy pune la dispoziția părților numai calculul, documentele și notificările de plată; nu finanțează vânzarea, nu garantează obligațiile niciuneia dintre părți, nu încasează și nu transferă plăți, nu recuperează creanțe și nu efectuează înscrieri în registre publice. Aivomaa Oy prelucrează date cu caracter personal în numele părților, potrivit condițiilor de utilizare a serviciului și acordului de prelucrare a datelor.'),

    h('11. Alte clauze'),
    p('11.1 Vânzătorul poate cesiona prezentul contract, cu toate drepturile și obligațiile, unei instituții de credit sau unei instituții financiare nebancare. Cesiunea se notifică în scris cumpărătorului; după primirea notificării, cumpărătorul plătește valabil numai cesionarului.'),
    p('11.2 Notificările prevăzute de prezentul contract se fac în scris, la adresele de e-mail menționate la pct. 1. Notificarea se consideră primită în ziua lucrătoare următoare trimiterii. Notificările prevăzute la pct. 9.3–9.5 se comunică și prin executor judecătoresc sau prin scrisoare recomandată cu conținut declarat și confirmare de primire.'),
    p('11.3 Prezentul contract este guvernat de legea română, în special de art. 1.650 și următoarele și art. 1.755–1.757 din Codul civil.'),
    p('11.4 Litigiile se soluționează de instanța competentă de la sediul vânzătorului.'),
    p('11.5 Modificările contractului se fac numai în scris, prin act adițional.'),
    p('11.6 Contractul se semnează înainte de predarea vehiculului, fie olograf, în două exemplare originale, câte unul pentru fiecare parte, fie cu semnătura electronică calificată a ambelor părți, caz în care fiecare parte primește documentul electronic semnat.'),

    h('12. Semnături'),
    p(`Locul și data: ${LONG_BLANK}`),
    { kind: 'sign', left: [`Vânzător: ${d.seller.name}`, 'numele în clar, funcția'], right: [`Cumpărător: ${d.buyer.name}`, 'numele în clar, funcția'] },
    p(`Anexe: 1. Graficul de plăți · 2. Proces-verbal de predare-primire (cuprinde mențiunea: „Vehiculul a fost predat cumpărătorului la ${DATE_BLANK}, ora __:__, după semnarea contractului de vânzare cu plata prețului în rate nr. ${d.number} și după înscrierea rezervei proprietății în Registrul Național de Publicitate Mobiliară sub nr. ${BLANK}.”) · 3. Prima factură · 4. Contract de service · 5. Informarea conducătorilor auto privind prelucrarea datelor`),
  ];

  const annexes: ContractBlock[] = [
    { kind: 'annex', text: 'Anexa 1. Graficul de plăți' },
    {
      kind: 'meta',
      text: `Contract nr. ${d.number} · Preț total ${lei(d.price.gross)} · Avans ${lei(d.price.downGross)} · Rest de preț ${lei(d.price.rest)} · Dobândă remuneratorie ${d.ratePercent ?? '0'} % pe an`,
    },
    {
      kind: 'table',
      head: ['Rata nr.', 'Scadența', 'Rata din preț, lei', 'Dobândă (pct. 4.4), lei', 'Total de plată, lei', 'Rest de preț după plată, lei'],
      rows: [
        ['Avans', 'înainte de predare', bareLei(d.price.downGross), '–', bareLei(d.price.downGross), bareLei(d.price.rest)],
        ...d.plan.map((r) => [String(r.n), r.due, bareLei(r.principal), bareLei(r.interest), bareLei(r.total), bareLei(r.balance)]),
      ],
      foot: ['Total', '', bareLei(d.planTotals.principal), bareLei(d.planTotals.interest), bareLei(d.planTotals.instalments), ''],
    },
    p(`Pragul de la pct. 9.2 din contract: o optime din prețul total – ${lei(d.price.tenth)}. Dobânzile sunt calculate pentru predarea la ${d.handover} și plata la scadență.`),

    { kind: 'annex', text: 'Anexa 2. Proces-verbal de predare-primire' },
    { kind: 'meta', text: `Contract nr. ${d.number} · Data ${DATE_BLANK} · Locul ${LONG_BLANK}` },
    p(`Vânzătorul ${d.seller.name}, CUI ${d.seller.businessId}, predă, iar cumpărătorul ${d.buyer.name}, CUI ${d.buyer.businessId}, primește în folosință următorul vehicul:`),
    kv('Vehicul', d.vehicle.make),
    kv('Număr de înmatriculare', d.vehicle.plate),
    kv('Număr de identificare (VIN)', LONG_BLANK),
    kv('Kilometraj la predare', `${BLANK} km`),
    kv('Nivel combustibil / AdBlue', `${BLANK} / ${BLANK}`),
    kv('Chei predate, buc.', BLANK),
    kv('Documente predate', `( ) certificat de înmatriculare  ( ) carte de identitate a vehiculului  ( ) ${BLANK}`),
    kv('Echipamente suplimentare', LONG_BLANK),
    kv('Anvelope', LONG_BLANK),
    kv('Defecte și deteriorări constatate', `( ) nu există  ( ) ${LONG_BLANK}`),
    kv('Asigurare RCA / CASCO', `polița nr. ${BLANK} / polița nr. ${BLANK}`),
    p(`Vehiculul a fost predat cumpărătorului la ${DATE_BLANK}, ora __:__, după semnarea contractului de vânzare cu plata prețului în rate nr. ${d.number} și după înscrierea rezervei proprietății în Registrul Național de Publicitate Mobiliară sub nr. ${BLANK}.`),
    p('Dreptul de proprietate asupra vehiculului rămâne al vânzătorului până la plata integrală a prețului. Riscul pieirii sau deteriorării vehiculului trece la cumpărător la data semnării prezentului proces-verbal.'),
    { kind: 'sign', left: [`Vânzător: ${d.seller.name}`, 'numele în clar, funcția'], right: [`Cumpărător: ${d.buyer.name}`, 'numele în clar, funcția'] },
  ];

  return {
    title: `Contract de vânzare cu plata prețului în rate ${d.number}`,
    author: d.seller.name,
    footer: `Contract ${d.number} · întocmit în serviciul RAHTIS; Aivomaa Oy nu este parte la contract`,
    pages: [main, annexes],
  };
}
