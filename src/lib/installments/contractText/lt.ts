/**
 * Договор Литвы: «Transporto priemonės pirkimo–pardavimo išsimokėtinai
 * sutartis» (23.11.2026).
 *
 * Текст — шаблон docs/equipment-sale/countries/lt.md, раздел 5, версия 0.1
 * (черновик, литовским юристом и бухгалтером не проверен — об этом сторонам
 * сказано в кабинете). Юридический текст перенесён дословно; подставлены
 * только данные сделки. Чего в RAHTIS нет (VIN, год первой регистрации, код
 * плательщика НДС, номер лицензии, представитель, номер счёта продавца,
 * условия страховки, место заключения), — строки для заполнения от руки; где
 * шаблон даёт выбор, который платформа не знает (как передаётся машина, кто
 * платит за регистрацию договора, кто страхует, как часто осмотр), — оба
 * варианта с отметкой «( )».
 *
 * Даты — «ГГГГ-ММ-ДД», как просит примечание шаблона (isoDates в
 * contractText/index.ts). Суммы — «12 345,67 Eur».
 *
 * Решения:
 *   · только обычный НДС: кабинет других режимов не создаёт, варианты B–D
 *     п. 4.2 (маржа, ст. 33, не плательщик) и примечание к ним не печатаются;
 *   · до передачи выставляется предварительный счёт (išankstinio mokėjimo
 *     sąskaita), а PVM sąskaita faktūra — в день передачи, уже после
 *     подписания. Поэтому номер счёта-фактуры в п. 4.3 — строка для
 *     заполнения; d.firstInvoiceNumber (это номер предварительного счёта)
 *     здесь не используется;
 *   · п. 4.4: вариант A без процентов, вариант B — со ставкой и суммой;
 *   · пороги п. 9.1 — договорные: больше 30 дней и 1/10 (1/20) цены с НДС;
 *     суммы считает rules.ts;
 *   · плата за пользование в п. 9.5 (b) — строка для заполнения: сумму стороны
 *     вписывают сами, без неё вычитается только износ по оценке;
 *   · п. 9.3 (исключение правила половины цены, CK 6.414 str. 1 d.) оставлен
 *     как в шаблоне; в суде не проверен — так сказано в кабинете;
 *   · территория договора — страны ЕЭЗ и Швейцария; подсудность — по месту
 *     нахождения продавца.
 *
 * Акт приёма-передачи (2 priedas) — строки шаблона; известные данные
 * (номер договора, стороны, машина) подставлены, остальное заполняется при
 * передаче.
 */
import type { ContractPdfInput } from '../ContractPdf.tsx';
import { bare, BLANK, h, kv, li, LONG_BLANK, p, sub, type ContractBlock, type ContractDocument } from './blocks.ts';

const yesNo = (value: boolean) => (value ? 'taip' : 'ne');

function party(label: string, x: ContractPdfInput['seller'], extra?: string): string[] {
  return [
    label,
    x.name,
    `Juridinio asmens kodas: ${x.businessId}`,
    `Buveinės adresas: ${x.address || LONG_BLANK}`,
    `PVM mokėtojas: ${yesNo(x.vatRegistered)}`,
    `PVM mokėtojo kodas: ${BLANK}`,
    ...(extra ? [extra] : []),
    `Atstovaujamas: ${LONG_BLANK}`,
    `Telefonas: ${x.phone || BLANK} · El. paštas: ${x.email || BLANK}`,
  ];
}

const eur = (money: string) => `${bare(money)} Eur`;

export function ltContractText(d: ContractPdfInput): ContractDocument {
  const n = d.months;
  const first = d.plan[0];
  const last = d.plan[d.plan.length - 1];
  const regular = d.plan.slice(0, -1);
  const equal = regular.every((x) => x.principal === first.principal);
  const interestTotal = d.price.interestTotal ? eur(d.price.interestTotal) : null;

  /* 4.3: равные взносы — суммой, как в шаблоне; если расходятся на цент, — отсылка к графику. */
  const regularLine =
    regular.length === 0
      ? null
      : regular.length === 1
        ? `Įmoka 1: ${eur(first.principal)}, mokėjimo terminas – ${first.due}.`
        : equal
          ? `Įmokos 1–${n - 1}: kiekviena po ${eur(first.principal)}, mokėjimo terminas – kiekvieno mėnesio ${d.dueDay} diena, pirmoji įmoka mokama iki ${first.due}.`
          : `Įmokos 1–${n - 1}: pagal mokėjimo grafiką (1 priedas), mokėjimo terminas – kiekvieno mėnesio ${d.dueDay} diena, pirmoji įmoka mokama iki ${first.due}.`;

  const main: ContractBlock[] = [
    { kind: 'title', text: 'TRANSPORTO PRIEMONĖS PIRKIMO–PARDAVIMO IŠSIMOKĖTINAI SUTARTIS' },
    { kind: 'notice', text: 'NUOSAVYBĖS TEISĖ Į TRANSPORTO PRIEMONĘ PIRKĖJUI PEREINA TIK VISIŠKAI SUMOKĖJUS KAINĄ.' },
    { kind: 'meta', text: `Sutartis Nr. ${d.number} · Data ${d.date} · Sudarymo vieta ${LONG_BLANK}` },

    h('1. Sutarties šalys'),
    {
      kind: 'parties',
      left: party('Pardavėjas', d.seller),
      right: party('Pirkėjas', d.buyer, `Licencijos verstis krovinių vežimu keliais Nr.: ${BLANK}`),
    },
    p('Toliau Pardavėjas ir Pirkėjas kartu vadinami Šalimis, o kiekvienas atskirai – Šalimi.'),
    p('Pirkėjas patvirtina, kad šią sutartį sudaro savo ūkinės komercinės veiklos tikslais ir nėra vartotojas.'),

    h('2. Sutarties dalykas'),
    kv('Transporto priemonė', d.vehicle.make),
    kv('Valstybinis numeris', d.vehicle.plate),
    kv('Identifikavimo numeris (VIN)', LONG_BLANK),
    kv('Pirmosios registracijos metai', '__________'),
    kv('Ridos rodmuo sutarties sudarymo dieną', d.vehicle.odometer),
    kv('Papildoma įranga', `( ) papildomos įrangos nėra  ( ) ${LONG_BLANK}`),
    kv('Galiojantys įkeitimai ir kiti suvaržymai', `( ) nėra  ( ) duomenys: ${BLANK}`),
    p('2.1. Pagal šią sutartį Pardavėjas įsipareigoja perduoti Pirkėjui valdyti ir naudoti 2 skyriuje nurodytą transporto priemonę su papildoma įranga (toliau – Transporto priemonė), o Pirkėjas įsipareigoja ją priimti ir sumokėti kainą dalimis šioje sutartyje nustatyta tvarka ir terminais.'),
    p('2.2. Pardavėjas patvirtina, kad Transporto priemonė jam priklauso nuosavybės teise, kad ji neįkeista, neareštuota, nėra teisminio ginčo objektas, kad tretieji asmenys į ją neturi jokių teisių ar pretenzijų, išskyrus nurodytas šiame skyriuje, ir kad Pardavėjo teisė ja disponuoti neapribota (Civilinio kodekso 6.321 straipsnis). Iki sutarties pasirašymo Pardavėjas pateikia Pirkėjui Lietuvos Respublikos kelių transporto priemonių registro išrašą.'),
    p('2.3. Transporto priemonė parduodama tokios būklės, kokia aprašyta perdavimo–priėmimo akte (2 priedas). Apie Transporto priemonės trūkumus Pirkėjas privalo raštu pranešti Pardavėjui per protingą terminą nuo tos dienos, kurią trūkumą pastebėjo ar turėjo pastebėti, ir nurodyti, kokių reikalavimų Transporto priemonė neatitinka.'),

    h('3. Perdavimas'),
    p(`3.1. Perdavimo būdas: ( ) Pirkėjas atsiima iš Pardavėjo  ( ) Pardavėjas pristato adresu ${BLANK}. Perdavimo terminas: ${d.handover}.`),
    p('3.2. Transporto priemonė perduodama tik tada, kai:'),
    li('1. ši sutartis pasirašyta;'),
    li('2. Pirkėjas į Pardavėjo sąskaitą sumokėjo 4.2 punkte nurodytą pradinę įmoką;'),
    li('3. Lietuvos Respublikos kelių transporto priemonių registre Pirkėjas nurodytas Transporto priemonės valdytoju, o Pardavėjas lieka nurodytas jos savininku, arba Šalys atliko visus tam būtinus veiksmus VĮ „Regitra“;'),
    li('4. Transporto priemonė apdrausta 7.1 punkte nurodytu privalomuoju draudimu, galiojančiu nuo perdavimo dienos, ir pateiktas 7.2 punkte nurodytas draudiko patvirtinimas.'),
    p('3.3. Perduodamos Transporto priemonės būklę Šalys apžiūri kartu ir pasirašo perdavimo–priėmimo aktą (2 priedas), kuriame nurodoma perdavimo data ir laikas. Transporto priemonės atsitiktinio žuvimo ar sugedimo rizika Pirkėjui pereina nuo perdavimo momento (Civilinio kodekso 6.412 straipsnis).'),

    h('4. Kaina ir atsiskaitymo tvarka'),
    sub('4.1. Kaina (Eur)'),
    kv('Transporto priemonės kaina be PVM', bare(d.price.net)),
    kv('Papildoma įranga, išvardyta ir įkainota atskirai, be PVM', '–'),
    kv(`PVM ${d.vatPercent} % nuo sumos ${bare(d.price.net)}`, bare(d.price.vat)),
    kv('Kaina iš viso su PVM (toliau – Kaina)', bare(d.price.gross), true),
    kv('Pradinė įmoka, mokama iki perdavimo (apima visos Kainos PVM sumą)', bare(d.price.downGross)),
    kv('Likusi Kainos dalis, mokama periodinėmis įmokomis', bare(d.price.rest)),
    kv('Kredito kaina: atskirai mokamos palūkanos (4.4 punktas)', interestTotal ?? 'palūkanos neskaičiuojamos'),
    p('Šioje sutartyje Kaina, pradinė įmoka ir nuo Kainos skaičiuojamos dalys nurodomos su PVM. Palūkanos į Kainą neįskaičiuojamos ir mokamos atskirai.'),

    sub('4.2. Pradinė įmoka ir PVM'),
    p('Pradinę įmoką Pirkėjas sumoka iki Transporto priemonės perdavimo pagal Pardavėjo pateiktą išankstinio mokėjimo sąskaitą. Transporto priemonės perdavimo dieną Pardavėjas išrašo PVM sąskaitą faktūrą visai Kainai; joje nurodoma visa PVM suma ir įskaitoma gauta pradinė įmoka. Prievolė apskaičiuoti PVM atsiranda perduodant Transporto priemonę (Pridėtinės vertės mokesčio įstatymo 4 straipsnio 2 dalis ir 14 straipsnio 5 dalis).'),

    sub('4.3. Periodinės įmokos'),
    p(`Išsimokėjimo terminas – ${n} mėnesių. Periodinių įmokų skaičius – ${n}.`),
    ...(regularLine ? [p(regularLine)] : []),
    p(`Paskutinė įmoka ${n}: ${eur(last.principal)}, mokėjimo terminas ${last.due}.`),
    p(`PVM į periodines įmokas neįskaičiuotas, nes visa Kainos PVM suma nurodyta PVM sąskaitoje faktūroje Nr. ${BLANK}, išrašytoje perdavimo dieną.`),
    p(`Įmokos mokamos mokėjimo pavedimu į Pardavėjo sąskaitą Nr. ${LONG_BLANK}. Įmoka laikoma sumokėta tą dieną, kurią lėšos įskaitomos į Pardavėjo sąskaitą.`),
    p('Mokėjimo grafikas pateiktas 1 priede.'),

    sub('4.4. Palūkanos už išsimokėjimą'),
    p(
      d.ratePercent
        ? `Už likusią Kainos dalį nuo Transporto priemonės perdavimo dienos skaičiuojamos fiksuotos ${d.ratePercent} procentų metinės palūkanos. Palūkanos skaičiuojamos nuo tuo metu nesumokėtos likusios Kainos dalies pagal faktinį dienų skaičių (faktinės dienos / 365) ir mokamos atskirai kartu su kiekviena periodine įmoka. Mokant pagal mokėjimo grafiką, bendra palūkanų suma yra ${interestTotal ?? BLANK} (1 priedas). Palūkanos yra atlygis už PVM neapmokestinamą finansinę paslaugą (Pridėtinės vertės mokesčio įstatymo 28 straipsnio 1 dalis).`
        : 'Už likusią Kainos dalį palūkanos neskaičiuojamos.',
    ),
    p('Pardavėjas neturi teisės reikalauti iš Pirkėjo palūkanų ar mokesčių, dėl kurių šioje sutartyje nesusitarta.'),

    sub('4.5. Palūkanos už pavėluotą mokėjimą'),
    p('Praleidęs įmokos mokėjimo terminą, Pirkėjas nuo laiku nesumokėtos sumos už kiekvieną pavėluotą dieną moka Mokėjimų, atliekamų pagal komercines sutartis, vėlavimo prevencijos įstatymo 2 straipsnio 5 dalyje nustatyto dydžio palūkanas, apskaičiuojamas šio įstatymo 3 straipsnio 2 dalyje nustatyta tvarka. Palūkanos skaičiuojamos nuo mokėjimo termino pabaigos dienos iki įmokos sumokėjimo (Civilinio kodekso 6.415 straipsnis). Palūkanos už priskaičiuotas palūkanas neskaičiuojamos.'),

    sub('4.6. Mokėjimas prieš terminą'),
    p('Pirkėjas turi teisę bet kada sumokėti visą likusią Kainos dalį ar jos dalį prieš terminą, apie tai raštu pranešęs Pardavėjui ne vėliau kaip prieš 5 darbo dienas. Šiuo atveju 4.4 punkte nurodytos palūkanos mokamos tik už laikotarpį iki faktinio sumokėjimo dienos; jokie papildomi mokesčiai už mokėjimą prieš terminą netaikomi.'),

    sub('4.7. Kitos sumos'),
    p('Už kiekvieną laiku nesumokėtą įmoką Pardavėjas turi teisę gauti 40 Eur išieškojimo išlaidų kompensaciją ir reikalauti atlyginti šią sumą viršijančias pagrįstas išieškojimo išlaidas (Mokėjimų, atliekamų pagal komercines sutartis, vėlavimo prevencijos įstatymo 7 ir 8 straipsniai). Transporto priemonės registravimo, valdytojo ir savininko duomenų keitimo įmokas ir rinkliavas moka Pirkėjas. Kitų mokesčių Pardavėjas netaiko.'),

    sub('4.8. Įmokų paskirstymas'),
    p('Pirkėjo įmokos skiriamos tik šioje sutartyje numatytoms prievolėms įvykdyti tokia eile: pirma – Pardavėjo išlaidoms, susijusioms su reikalavimo įvykdyti prievolę pareiškimu, atlyginti; antra – palūkanoms pagal jų mokėjimo terminų eiliškumą; trečia – periodinėms įmokoms, pradedant seniausia (Civilinio kodekso 6.54 straipsnis).'),

    h('5. Nuosavybės teisės išlaikymas, registravimas ir naudojimas'),
    p('5.1. Nuosavybės teisė į Transporto priemonę išlieka Pardavėjui ir Pirkėjui pereina tą dieną, kurią į Pardavėjo sąskaitą įskaitoma paskutinė suma, kuria visiškai sumokama Kaina ir 4.4 punkte nurodytos palūkanos (Civilinio kodekso 4.49 straipsnio 3 dalis ir 6.411 straipsnio 1 dalis). Nuosavybės teisės perėjimas nepriklauso nuo kitų, ne iš šios sutarties kylančių, Pirkėjo skolų sumokėjimo.'),
    p('5.2. Sutarties galiojimo laikotarpiu Lietuvos Respublikos kelių transporto priemonių registre Pardavėjas nurodomas Transporto priemonės savininku, o Pirkėjas – valdytoju. Šalys įsipareigoja laiku atlikti visus tam būtinus veiksmus VĮ „Regitra“ ir bendradarbiauti tarpusavyje. Pirkėjas pasirūpina, kad Transporto priemonė būtų įtraukta į jo licencijos verstis krovinių vežimu keliais duomenis ir kad jai būtų išduota licencijos kopija, prieš pradėdamas ją naudoti vežimams už atlygį.'),
    p('5.3. Pardavėjas per 5 darbo dienas nuo sutarties pasirašymo pateikia šią sutartį registruoti Sutarčių ir teisių suvaržymų registre, jeigu registro tvarkytojas tokią sutartį registruoja. Registravimo išlaidas apmoka ( ) Pirkėjas  ( ) Pardavėjas. Pirkėjas pateikia tam reikalingus duomenis ir sutikimus. Pasibaigus sutarčiai, Pardavėjas per dvidešimt dienų kreipiasi dėl registravimo panaikinimo (Civilinio kodekso 6.414 straipsnio 4 dalis).'),
    p('5.4. Visiškai sumokėjus Kainą ir palūkanas, Pardavėjas per 3 darbo dienas pateikia Pirkėjui raštišką patvirtinimą apie nuosavybės teisės perėjimą ir savininko deklaravimo kodą. Pirkėjas duomenis apie įgytą nuosavybės teisę deklaruoja per 5 darbo dienas nuo nuosavybės teisės įgijimo, o Pardavėjas duomenis apie perleistą nuosavybės teisę deklaruoja per 5 darbo dienas nuo Pirkėjo deklaravimo (Saugaus eismo automobilių keliais įstatymo 20 straipsnio 1 dalis).'),
    p('5.5. Iki nuosavybės teisės perėjimo Pirkėjas be išankstinio rašytinio Pardavėjo sutikimo neturi teisės:'),
    li('1. parduoti, mainyti, dovanoti Transporto priemonę ar kitaip ja disponuoti (Civilinio kodekso 6.349 straipsnio 1 dalis);'),
    li('2. įkeisti Transporto priemonę ar kitaip suvaržyti teises į ją;'),
    li('3. išnuomoti, perduoti panaudai ar kitaip perduoti Transporto priemonę valdyti ar naudoti trečiajam asmeniui;'),
    li('4. registruoti Transporto priemonę kitoje valstybėje ar išregistruoti ją Lietuvos Respublikoje;'),
    li('5. keisti Transporto priemonės konstrukciją taip, kad dėl to reikėtų techninės ekspertizės;'),
    li('6. sujungti Transporto priemonę ar jos papildomą įrangą su kitu turtu arba atskirti papildomą įrangą, ketindamas ją perleisti.'),
    p('Perdavimu trečiajam asmeniui pagal 3 papunktį nelaikomas atvejis, kai Transporto priemonę Pirkėjo vykdomiems vežimams vairuoja Pirkėjo darbuotojai ar jam laikinojo įdarbinimo pagrindu dirbantys vairuotojai.'),
    p('5.6. Pirkėjas turi teisę naudoti Transporto priemonę savo vykdomiems vežimams sutarties teritorijoje, kuri yra Europos ekonominės erdvės valstybės ir Šveicarija. Naudoti Transporto priemonę už sutarties teritorijos ribų galima tik gavus išankstinį rašytinį Pardavėjo sutikimą.'),
    p('5.7. Jeigu Transporto priemonė areštuojama, į ją nukreipiamas išieškojimas ar Pirkėjui iškeliama nemokumo byla, Pirkėjas privalo nedelsdamas, ne vėliau kaip kitą darbo dieną, raštu pranešti apie tai Pardavėjui, o antstoliui ar nemokumo administratoriui – apie Pardavėjo nuosavybės teisę.'),

    h('6. Priežiūra ir techninė apžiūra'),
    p(`6.1. Periodinė techninė priežiūra į Kainą neįskaičiuota. Šalys sudaro atskirą techninės priežiūros sutartį (4 priedas), pagal kurią Pardavėjas du kartus per metus atlieka Transporto priemonės techninę priežiūrą. Priežiūrą sudaro variklio ir pavarų dėžės alyvos bei filtrų keitimas ir gedimų kodų nuskaitymas. Vienos priežiūros kaina – ${BLANK} Eur be PVM; PVM sąskaita faktūra išrašoma atlikus priežiūrą.`),
    p('6.2. Visas kitas Transporto priemonės naudojimo ir išlaikymo išlaidas, tokias kaip remontas, padangos, stiklai, stabdžiai, degalai, „AdBlue“, plovimas, kelių naudotojo mokesčiai ir rinkliavos, apmoka Pirkėjas.'),
    p('6.3. Pirkėjas privalo prižiūrėti Transporto priemonę, kad ji būtų geros būklės, naudoti ją pagal paskirtį ir nedelsdamas pranešti Pardavėjui apie žalą ir gedimus, galinčius iš esmės sumažinti Transporto priemonės vertę.'),
    p('6.4. Pirkėjas nustatytu laiku pateikia Transporto priemonę privalomajai techninei apžiūrai ir jos rezultatus patvirtinantį dokumentą perduoda Pardavėjui per RAHTIS paslaugą arba kitu rašytiniu būdu.'),
    p('6.5. Pardavėjo teisė apžiūrėti Transporto priemonę: Pardavėjas turi teisę kas ( ) du mėnesius  ( ) tris mėnesius iš anksto suderintu laiku Pirkėjo veiklos vietoje apžiūrėti Transporto priemonę. Apžiūros rezultatai įforminami aktu.'),

    h('7. Draudimas'),
    p(`7.1. Visą sutarties galiojimo laikotarpį Transporto priemonė privalo būti apdrausta transporto priemonių valdytojų civilinės atsakomybės privalomuoju draudimu. Draudimo sutartį sudaro ir draudimo įmokas moka ( ) Pirkėjas  ( ) Pardavėjas. ( ) Pirkėjas sudaro draudimo sutartį Pardavėjo, kaip registre nurodyto savininko, pavedimu ir ne vėliau kaip prieš 10 dienų iki draudimo apsaugos pabaigos pateikia Pardavėjui naujo laikotarpio draudimo liudijimą. ( ) Pirkėjas atlygina Pardavėjui draudimo įmoką ${LONG_BLANK} atskirai kartu su kiekviena periodine įmoka.`),
    p(`7.2. Pirkėjas savo lėšomis apdraudžia Transporto priemonę transporto priemonių (kasko) draudimu, apimančiu bent eismo įvykių, gaisro, vagystės ir trečiųjų asmenų tyčinės veikos rizikas; besąlyginė išskaita – ne didesnė kaip ${BLANK} Eur. Draudimo liudijime Pardavėjas nurodomas Transporto priemonės savininku ir naudos gavėju. Iki perdavimo Pirkėjas pateikia Pardavėjui rašytinį draudiko patvirtinimą, kad Pardavėjas nurodytas naudos gavėju ir kad draudikas praneš Pardavėjui apie draudimo apsaugos pabaigą ar sustabdymą.`),
    p('7.3. Jeigu Pirkėjas nevykdo pareigos apdrausti Transporto priemonę, Pardavėjas turi teisę apdrausti ją pats ir pareikalauti atlyginti draudimo išlaidas (Civilinio kodekso 6.316 straipsnio 2 dalis).'),
    p('7.4. Transporto priemonei žuvus ar ją praradus, Pirkėjo pareiga mokėti įmokas išlieka. Pardavėjui išmokėta draudimo išmoka įskaitoma kaip Pirkėjo mokėjimas prieš terminą pagal 4.6 punktą ir naudojama tik iš šios sutarties kylančioms Pirkėjo prievolėms padengti. Šias prievoles viršijančią išmokos dalį Pardavėjas nedelsdamas perveda Pirkėjui.'),

    h('8. Buvimo vietos nustatymas'),
    p('8.1. Sutarties galiojimo laikotarpiu Transporto priemonėje veikia Pardavėjo įrengtas ar jo patvirtintas buvimo vietos nustatymo įrenginys. Pirkėjas neturi teisės jo pašalinti ar trikdyti jo veikimą.'),
    p('8.2. Pardavėjas mato tik ridos rodmenį ir tai, ar Transporto priemonė yra sutarties teritorijoje (5.6 punktas). Tiksli buvimo vieta Pardavėjui rodoma tik tuo atveju, jeigu:'),
    li('1. policijai pateiktas pareiškimas dėl Transporto priemonės pagrobimo;'),
    li('2. Transporto priemonė be Pardavėjo sutikimo ilgiau kaip 24 valandas yra už sutarties teritorijos ribų; arba'),
    li('3. įvykdytos 9.1 punkte nurodytos sąlygos arba sutartis nutraukta.'),
    p('8.3. Buvimo vietos duomenų valdytojas yra Pardavėjas. Duomenys tvarkomi siekiant apsaugoti Pardavėjo nuosavybės teisę, o tvarkymo teisinis pagrindas – teisėtas Pardavėjo interesas (Reglamento (ES) 2016/679 6 straipsnio 1 dalies f punktas). Pardavėjas nenaudoja buvimo vietos duomenų vairuotojų darbo laikui, vairavimo būdui ar kitam darbo atlikimui stebėti. Kiekviena tikslios buvimo vietos peržiūra ir jos pagrindas registruojami, o Pirkėjui apie ją pranešama ne vėliau kaip per 3 dienas, išskyrus atvejus, kai pranešimas pakenktų nusikalstamos veikos tyrimui. Tikslios buvimo vietos duomenys ištrinami po 30 dienų, o jeigu jie buvo atverti 8.2 punkto pagrindu, – išnagrinėjus atitinkamą atvejį.'),
    p('8.4. Pardavėjas parengia vairuotojams skirtą informaciją pagal Reglamento (ES) 2016/679 14 straipsnį, o Pirkėjas iki perdavimo pateikia ją savo vairuotojams. Pirkėjas, kaip darbdavys, atsako už darbo teisės aktuose nustatytų darbuotojų informavimo ir konsultavimo pareigų įvykdymą.'),
    p('8.5. Transporto priemonėje gali būti įrengtas nuotolinis variklio užvedimo blokavimo įrenginys. Jį leidžiama naudoti tik Transporto priemonei stovint ir tik tuo atveju, jeigu (a) to reikalauja arba su tuo sutinka policija po pareiškimo dėl Transporto priemonės pagrobimo arba (b) Pirkėjas tuo metu duoda rašytinį sutikimą. Blokavimas nenaudojamas įmokoms išieškoti ar Transporto priemonei atsiimti; Transporto priemonė atsiimama 9 skyriuje nustatyta tvarka.'),

    h('9. Įmokų mokėjimo terminų praleidimas, sutarties pažeidimas ir Transporto priemonės atsiėmimas'),
    p(`9.1. Pardavėjas turi teisę pareikalauti sumokėti visą likusią Kainos dalį iš karto arba nutraukti sutartį ir atsiimti Transporto priemonę (Civilinio kodekso 6.414 straipsnio 1 dalis) tik tuo atveju, jeigu Pirkėjas praleido įmokos mokėjimo terminą daugiau kaip 30 dienų, pradelsta suma tebėra nesumokėta ir ji sudaro ne mažiau kaip vieną dešimtąją Kainos arba, kai pradelstos dvi ar daugiau periodinių įmokų, – ne mažiau kaip vieną dvidešimtąją Kainos, arba apima visą likusią Pardavėjo reikalavimo dalį. Viena dešimtoji šios sutarties Kainos yra ${eur(d.price.tenth)}, viena dvidešimtoji – ${eur(d.price.twentieth)}.`),
    p('9.2. Prieš pasinaudodamas 9.1 punkte nurodytomis teisėmis, Pardavėjas raštu pareikalauja, kad Pirkėjas sumokėtų pradelstą sumą per papildomą ne trumpesnį kaip 14 dienų terminą. Jeigu Pirkėjas per šį terminą pradelstos sumos nesumoka, Pardavėjas turi teisę rašytiniu pranešimu:'),
    li('1. pareikalauti sumokėti visą likusią Kainos dalį iš karto; šiuo atveju 4.4 punkte nurodytos palūkanos už laikotarpį po pareikalavimo dienos neskaičiuojamos, o nuo pareikalautos sumos skaičiuojamos 4.5 punkte nurodytos palūkanos; arba'),
    li('2. vienašališkai, nesikreipdamas į teismą, nutraukti sutartį ir pareikalauti grąžinti Transporto priemonę. Sutartis laikoma nutraukta pranešime nurodytą dieną, bet ne anksčiau kaip po 7 dienų nuo pranešimo įteikimo (Civilinio kodekso 6.217 straipsnio 5 dalis ir 6.218 straipsnio 1 dalis).'),
    p('9.3. Šalys aiškiai susitaria, kad Pardavėjas turi teisę atsiimti Transporto priemonę 9 skyriuje nustatytomis sąlygomis ir tuo atveju, kai Pirkėjas yra sumokėjęs daugiau kaip pusę Kainos (Civilinio kodekso 6.414 straipsnio 1 dalis).'),
    p('9.4. Pardavėjas turi teisę 9.2 punkte nustatyta tvarka nutraukti sutartį ir atsiimti Transporto priemonę arba pareikalauti sumokėti visą likusią Kainos dalį iš karto ir tuo atveju, jeigu Pirkėjas iš esmės pažeidžia kurią nors iš toliau nurodytų pareigų ir pažeidimo nepašalina per 14 dienų nuo rašytinio Pardavėjo įspėjimo, išskyrus atvejus, kai pažeidimo pašalinti neįmanoma:'),
    li('1. 5.5 punkte nustatytus draudimus;'),
    li('2. 5.2 punkte nustatytas registravimo ir licencijos pareigas;'),
    li('3. pareigą užtikrinti, kad galiotų 7.1 ir 7.2 punktuose nurodytas draudimas, kai draudimo apsauga dėl bet kokios priežasties pasibaigė ar nebegalioja Transporto priemonei;'),
    li('4. pareigą atlikti privalomąją techninę apžiūrą (6.4 punktas);'),
    li('5. draudimą pašalinti buvimo vietos nustatymo įrenginį ar trikdyti jo veikimą (8.1 punktas).'),
    p('Jeigu Pirkėjas be Pardavėjo sutikimo perleidžia Transporto priemonę kitam asmeniui arba ji dėl neteisėtų Pirkėjo veiksmų areštuojama, Pardavėjas turi teisę reikalauti, kad Pirkėjas likusią Kainos dalį sumokėtų nedelsdamas (Civilinio kodekso 6.414 straipsnio 3 dalis).'),
    p('9.5. Nutraukus sutartį, Pirkėjas per 5 dienas grąžina Transporto priemonę Pardavėjui jo nurodytoje vietoje Lietuvos Respublikoje; grąžinimas įforminamas perdavimo–priėmimo aktu, kuriame nurodoma rida ir būklė. Šalys atsiskaito taip:'),
    li(`1. Pardavėjas grąžina Pirkėjui jo sumokėtas pradinę ir periodines įmokas, iš jų atskaitęs: (a) Transporto priemonės nusidėvėjimą, lygų Kainos ir Transporto priemonės rinkos vertės grąžinimo dieną skirtumui; (b) naudojimosi Transporto priemone išlaidas – ${BLANK} Eur už kiekvieną naudojimosi mėnesį, jeigu Šalys tokią sumą nustatė; (c) iki grąžinimo dienos priskaičiuotas ir nesumokėtas 4.4 ir 4.5 punktuose nurodytas palūkanas bei 4.7 punkte nurodytas sumas; (d) pagrįstas Transporto priemonės atsiėmimo, pargabenimo ir vertinimo išlaidas (Civilinio kodekso 6.414 straipsnio 1 dalis);`),
    li('2. Transporto priemonės rinkos vertę grąžinimo dieną Šalys nustato susitarimu, o nesusitarus per 10 dienų – pagal Šalių bendrai parinkto nepriklausomo turto vertintojo išvadą; vertinimo išlaidas Šalys apmoka lygiomis dalimis. Nustatant vertę, atsižvelgiama į Kainą, naudojimosi trukmę ir tai, kaip Transporto priemonė buvo prižiūrima;'),
    li('3. jeigu atskaitomos sumos viršija Pirkėjo sumokėtas įmokas, Pirkėjas atlygina Pardavėjui skirtumą kaip nuostolius;'),
    li('4. atsiskaičius Pardavėjas iš viso negali gauti daugiau, negu būtų gavęs, jeigu Pirkėjas sutartį būtų tinkamai įvykdęs.'),
    p('9.6. Grąžinus Transporto priemonę, Pardavėjas išrašo kreditinį dokumentą Pridėtinės vertės mokesčio įstatymo 83 straipsnyje nustatyta tvarka. PVM sumos tarp Šalių įskaitomos pagal šį dokumentą.'),
    p('9.7. Iki Transporto priemonės grąžinimo Pirkėjas gali išsaugoti sutartį, vienu mokėjimu sumokėjęs visas pradelstas įmokas, priskaičiuotas palūkanas ir 4.7 punkte nurodytas sumas. Jeigu Pardavėjas Transporto priemonę jau atsiėmė, Pirkėjas per 14 dienų nuo atsiėmimo gali ją išpirkti, sumokėjęs visą likusią Kainos dalį, iki sumokėjimo dienos priskaičiuotas palūkanas ir pagrįstas atsiėmimo išlaidas.'),
    p('9.8. Pardavėjas neturi teisės paimti Transporto priemonės be Pirkėjo sutikimo savo veiksmais. Jeigu Pirkėjas Transporto priemonės negrąžina geruoju, Pardavėjas kreipiasi į teismą dėl jos išreikalavimo ir laikinųjų apsaugos priemonių taikymo, o teismo sprendimą vykdo antstolis Civilinio proceso kodekso nustatyta tvarka.'),
    p('9.9. Jeigu sutartis pasibaigia Pardavėjui atsiėmus Transporto priemonę arba Šalims susitarus sutartį nutraukti, Pardavėjas nedelsdamas pažymi sutarties pabaigą RAHTIS paslaugoje. Nuo šio pažymėjimo per paslaugą nebeteikiamos periodinių įmokų sąskaitos ir nebesiunčiami mokėjimo priminimai. Pažymėjimas nekeičia Šalių teisių ir pareigų: Šalys atsiskaito tarpusavyje 9.5 punkte nustatyta tvarka, o nesusitarus ginčą sprendžia teismas.'),

    h('10. Dalijimasis duomenimis RAHTIS paslaugoje'),
    p('10.1. Šalys susitaria, kad sutarties galiojimo laikotarpiu RAHTIS paslaugoje Pardavėjui rodomi Transporto priemonės ridos rodmuo, techninės priežiūros, gedimų, apžiūrų ir privalomosios techninės apžiūros duomenys, mokėjimų būklė ir buvimo vieta, kiek tai leidžia 8 skyrius. Duomenys apie Transporto priemone vykdomus vežimus ir gaunamas pajamas Pardavėjui rodomi tik kaip mėnesio suvestinė ir tik tuo atveju, jeigu Pirkėjas tai atskirai patvirtino paslaugoje.'),
    p('10.2. Aivomaa Oy (RAHTIS) nėra šios sutarties šalis. Aivomaa Oy teikia Šalims tik skaičiavimus, dokumentų projektus, sąskaitų Pardavėjo vardu rengimą ir mokėjimo priminimus. Aivomaa Oy nefinansuoja pirkimo, neteikia kredito, laidavimo ar garantijos, nepriima ir neperveda Šalių mokėjimų, neišieško skolų ir neatsako už Šalių prievolių įvykdymą. Aivomaa Oy tvarko asmens duomenis Šalių pavedimu pagal paslaugos naudojimo sąlygas ir duomenų tvarkymo sutartį.'),

    h('11. Kitos sąlygos'),
    p('11.1. Pardavėjas turi teisę perleisti šią sutartį su visomis iš jos kylančiomis teisėmis ir pareigomis kredito ar finansų įstaigai. Apie perleidimą Pirkėjui pranešama raštu; gavęs pranešimą, Pirkėjas tinkamai įvykdyti mokėjimo prievoles gali tik naujajam kreditoriui.'),
    p('11.2. Visi pranešimai pagal šią sutartį teikiami raštu 1 skyriuje nurodytais el. pašto adresais. Laikoma, kad pranešimas gautas kitą darbo dieną po jo išsiuntimo. Pranešimai apie sutarties nutraukimą ir reikalavimai sumokėti visą likusią Kainos dalį papildomai siunčiami registruotu laišku Šalies buveinės adresu arba pasirašomi kvalifikuotu elektroniniu parašu.'),
    p('11.3. Šiai sutarčiai taikoma Lietuvos Respublikos teisė.'),
    p('11.4. Iš šios sutarties kylantys ginčai sprendžiami derybomis, o nesusitarus – Lietuvos Respublikos teisme pagal Pardavėjo buveinės vietą.'),
    p('11.5. Sutarties pakeitimai ir papildymai galioja tik sudaryti raštu ir pasirašyti abiejų Šalių.'),
    p('11.6. Sutartis pasirašoma iki Transporto priemonės perdavimo: ranka dviem vienodą teisinę galią turinčiais egzemplioriais, po vieną kiekvienai Šaliai, arba abiejų Šalių kvalifikuotais elektroniniais parašais; šiuo atveju kiekviena Šalis gauna pasirašytą elektroninį dokumentą.'),
    p('11.7. Jeigu kuri nors sutarties sąlyga yra ar tampa negaliojanti, tai neturi įtakos kitų sąlygų galiojimui.'),

    h('12. Šalių parašai'),
    p(`Vieta ir data: ${LONG_BLANK}`),
    { kind: 'sign', left: [`Pardavėjas: ${d.seller.name}`, 'Vardas, pavardė, pareigos'], right: [`Pirkėjas: ${d.buyer.name}`, 'Vardas, pavardė, pareigos'] },
    p(`Priedai: 1. Mokėjimo grafikas · 2. Transporto priemonės perdavimo–priėmimo aktas (su įrašu: „Transporto priemonė perduota Pirkėjui ____-__-__ __:__ val., pasirašius pirkimo–pardavimo išsimokėtinai sutartį Nr. ${d.number}.“) · 3. Išankstinio mokėjimo sąskaita ir PVM sąskaita faktūra · 4. Techninės priežiūros sutartis · 5. Vairuotojams teikiama informacija apie asmens duomenų tvarkymą`),
  ];

  const annexes: ContractBlock[] = [
    { kind: 'annex', text: '1 priedas. Mokėjimo grafikas' },
    {
      kind: 'meta',
      text: `Sutartis Nr. ${d.number} · Kaina su PVM ${eur(d.price.gross)} · Pradinė įmoka ${eur(d.price.downGross)} · Likusi Kainos dalis ${eur(d.price.rest)} · Metinė palūkanų norma ${d.ratePercent ?? '0'} %`,
    },
    {
      kind: 'table',
      head: ['Įmokos Nr.', 'Mokėjimo terminas', 'Periodinė įmoka, Eur', 'Palūkanos, Eur', 'Iš viso mokėti, Eur', 'Likusi Kainos dalis po įmokos, Eur'],
      rows: [
        ['Pradinė įmoka', 'iki perdavimo', bare(d.price.downGross), '–', bare(d.price.downGross), bare(d.price.rest)],
        ...d.plan.map((r) => [String(r.n), r.due, bare(r.principal), bare(r.interest), bare(r.total), bare(r.balance)]),
      ],
      /* Итог — как в шаблоне: взносы 1–N и проценты, без строки первоначального взноса. */
      foot: ['Iš viso', '', bare(d.planTotals.principal), bare(d.planTotals.interest), bare(d.planTotals.instalments), ''],
    },
    p(`Slenksčiai pagal sutarties 9.1 punktą: viena dešimtoji Kainos – ${eur(d.price.tenth)}; viena dvidešimtoji Kainos – ${eur(d.price.twentieth)}.`),

    { kind: 'annex', text: '2 priedas. Transporto priemonės perdavimo–priėmimo aktas' },
    { kind: 'meta', text: `Sutartis Nr. ${d.number} · Akto data ____-__-__ · Vieta ${LONG_BLANK}` },
    p(`Pardavėjas ${d.seller.name}, juridinio asmens kodas ${d.seller.businessId}, perduoda, o Pirkėjas ${d.buyer.name}, juridinio asmens kodas ${d.buyer.businessId}, priima valdyti ir naudoti šią Transporto priemonę:`),
    kv('Transporto priemonė', d.vehicle.make),
    kv('Valstybinis numeris', d.vehicle.plate),
    kv('Identifikavimo numeris (VIN)', LONG_BLANK),
    kv('Ridos rodmuo perdavimo metu', `${BLANK} km`),
    kv('Degalų kiekis', BLANK),
    kv('Perduoti rakteliai, vnt.', BLANK),
    kv('Perduoti dokumentai', `( ) registracijos liudijimas  ( ) techninės apžiūros dokumentas  ( ) priežiūros knygelė  ( ) ${BLANK}`),
    kv('Papildoma įranga', LONG_BLANK),
    kv('Padangų būklė', LONG_BLANK),
    kv('Pastebėti trūkumai ir pažeidimai', `( ) nėra  ( ) ${LONG_BLANK}`),
    kv('Nuotraukos', LONG_BLANK),
    p(`Transporto priemonė perduota Pirkėjui ____-__-__ __:__ val., pasirašius pirkimo–pardavimo išsimokėtinai sutartį Nr. ${d.number}.`),
    p('Nuosavybės teisė į Transporto priemonę išlieka Pardavėjui, kol bus visiškai sumokėta Kaina. Transporto priemonės atsitiktinio žuvimo ar sugedimo rizika Pirkėjui pereina nuo šio akto pasirašymo.'),
    { kind: 'sign', left: [`Pardavėjas: ${d.seller.name}`, 'Vardas, pavardė, pareigos'], right: [`Pirkėjas: ${d.buyer.name}`, 'Vardas, pavardė, pareigos'] },
  ];

  return {
    title: `Pirkimo–pardavimo išsimokėtinai sutartis ${d.number}`,
    author: d.seller.name,
    footer: `Sutartis ${d.number} · parengta RAHTIS paslaugoje; Aivomaa Oy nėra sutarties šalis`,
    pages: [main, annexes],
  };
}
