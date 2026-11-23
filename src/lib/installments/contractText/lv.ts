/**
 * Договор Латвии: «Nomaksas pirkuma līgums» (23.11.2026).
 *
 * Текст — шаблон docs/equipment-sale/countries/lv.md, раздел 5, версия 0.1
 * (черновик, латвийским адвокатом не проверен — об этом сторонам сказано в
 * кабинете). Юридический текст перенесён дословно; подставлены только данные
 * сделки. Чего в RAHTIS нет (VIN, год, номер лицензии, контактное лицо,
 * страховые условия, месячная плата за пользование в п. 9.5), — строки для
 * заполнения от руки. Заполнители шаблона, оставленные там по-фински
 * (способ передачи, территория, кто страхует), записаны по-латышски; где
 * шаблон даёт выбор, — оба варианта с отметкой «( )».
 *
 * Только обычный PVN: кабинет других режимов не создаёт, а режим маржи
 * (138. p.) и освобождение (52. p. 3. d.) в исследовании не подтверждены.
 *
 * Порог п. 9.1 — закон (Civillikums 2070. p., императивно): два пропущенных
 * срока платежа, оба не уплачены; затем письменное предупреждение на 14
 * дней. То же правило считает rules.ts (LV_CL2070).
 */
import type { ContractPdfInput } from '../ContractPdf.tsx';
import { bare, BLANK, h, kv, li, LONG_BLANK, p, sub, type ContractBlock, type ContractDocument } from './blocks.ts';

const yesNo = (value: boolean) => (value ? 'jā' : 'nē');

function party(label: string, x: ContractPdfInput['seller'], extra?: string): string[] {
  return [
    label,
    x.name,
    `Reģistrācijas Nr.: ${x.businessId}`,
    `Juridiskā adrese: ${x.address || LONG_BLANK}`,
    `Reģistrēts PVN maksātājs: ${yesNo(x.vatRegistered)}`,
    `PVN reģistrācijas Nr.: ${BLANK}`,
    ...(extra ? [extra] : []),
    `Kontaktpersona: ${LONG_BLANK}`,
    `Tālrunis: ${x.phone || BLANK} · E-pasts: ${x.email || BLANK}`,
  ];
}

export function lvContractText(d: ContractPdfInput): ContractDocument {
  const n = d.months;
  const first = d.plan[0];
  const last = d.plan[d.plan.length - 1];
  const regular = d.plan.slice(0, -1);
  const equal = regular.every((x) => x.principal === first.principal);
  const invoiceNo = d.firstInvoiceNumber ?? BLANK;

  /* 4.3: равные платежи — суммой, как в шаблоне; если расходятся на цент, — отсылка к графику. */
  const regularLine =
    regular.length === 0
      ? null
      : regular.length === 1
        ? `Maksājums 1: ${bare(first.principal)} EUR, maksājuma diena ${first.due}.`
        : equal
          ? `Maksājumi 1–${n - 1}: katrs ${bare(first.principal)} EUR, maksājuma diena — katra mēneša ${d.dueDay}. datums, pirmais maksājums ${first.due}.`
          : `Maksājumi 1–${n - 1}: saskaņā ar maksājumu grafiku (1. pielikums), maksājuma diena — katra mēneša ${d.dueDay}. datums, pirmais maksājums ${first.due}.`;

  const main: ContractBlock[] = [
    { kind: 'title', text: 'NOMAKSAS PIRKUMA LĪGUMS' },
    { kind: 'notice', text: 'ĪPAŠUMA TIESĪBAS UZ PIRKUMA PRIEKŠMETU PALIEK PĀRDEVĒJAM, KAMĒR PIRKUMA MAKSA NAV PILNĪBĀ SAMAKSĀTA (CIVILLIKUMA 2069. PANTS).' },
    { kind: 'meta', text: `Līgums Nr. ${d.number} · Datums ${d.date}` },

    h('1. Līguma puses'),
    {
      kind: 'parties',
      left: party('Pārdevējs', d.seller),
      right: party('Pircējs', d.buyer, `Eiropas Kopienas atļauja vai licence komercpārvadājumiem Nr.: ${BLANK}`),
    },
    p('Pārdevējs un Pircējs turpmāk kopā — Puses, katrs atsevišķi — Puse.'),
    p('Pircējs apliecina, ka slēdz šo līgumu savas komercdarbības vajadzībām un nav patērētājs. Šis līgums ir komercdarījums Komerclikuma 388. panta izpratnē.'),

    h('2. Pirkuma priekšmets'),
    kv('Transportlīdzeklis', d.vehicle.make),
    kv('Valsts reģistrācijas numurs', d.vehicle.plate),
    kv('Identifikācijas numurs (VIN)', LONG_BLANK),
    kv('Pirmās reģistrācijas gads', '__________'),
    kv('Odometra rādījums līguma noslēgšanas brīdī', d.vehicle.odometer),
    kv('Papildaprīkojums', `nav papildaprīkojuma / ${LONG_BLANK}`),
    kv('Reģistrētie apgrūtinājumi (komercķīla, aizliegumi)', `( ) nav  ( ) ir: ${BLANK}`),
    p('2.1. Pārdevējs apliecina, ka transportlīdzeklis un tā papildaprīkojums ir Pārdevēja īpašums, ka tas nav atsavināts, ieķīlāts vai citādi apgrūtināts ar trešo personu tiesībām, izņemot iepriekš norādīto, ka Transportlīdzekļu un to vadītāju valsts reģistrā un komercķīlu reģistrā nav reģistrēti aizliegumi vai komercķīlas atzīmes, kas nav norādītas iepriekš, un ka Pārdevējs ir tiesīgs pārdot transportlīdzekli saskaņā ar šo līgumu. Pirms līguma parakstīšanas Pārdevējs iesniedz Pircējam Ceļu satiksmes drošības direkcijas (turpmāk — CSDD) izziņu par transportlīdzekli.'),
    p('2.2. Transportlīdzeklis tiek pārdots tādā stāvoklī, kāds aprakstīts pieņemšanas–nodošanas aktā (2. pielikums). Pircējs iespējami īsā laikā pēc transportlīdzekļa saņemšanas to pārbauda un par konstatētajiem trūkumiem nekavējoties rakstveidā paziņo Pārdevējam, norādot to veidu un apmēru; par apslēptiem trūkumiem Pircējs paziņo nekavējoties pēc to konstatēšanas (Komerclikuma 411. pants).'),

    h('3. Nodošana'),
    p(`3.1. Nodošanas veids: ( ) Pircējs saņem transportlīdzekli pie Pārdevēja  ( ) Pārdevējs piegādā transportlīdzekli uz adresi ${BLANK}. Nodošanas datums: ${d.handover}.`),
    p('3.2. Transportlīdzekli nodod Pircējam tikai pēc tam, kad:'),
    li('1. šis līgums ir parakstīts;'),
    li('2. pirmais rēķins (4.2. punkts) ir samaksāts Pārdevēja kontā;'),
    li('3. Pircējs CSDD ir reģistrēts kā transportlīdzekļa turētājs, bet Pārdevējs joprojām ir reģistrēts kā tā īpašnieks;'),
    li('4. par transportlīdzekli ir noslēgts 7.1. punktā minētais sauszemes transportlīdzekļu īpašnieku civiltiesiskās atbildības obligātās apdrošināšanas (turpmāk — OCTA) līgums, kas ir spēkā no nodošanas dienas, un ir iesniegts 7.2. punktā minētais apliecinājums.'),
    p('3.3. Nododot transportlīdzekli, Puses to kopīgi apskata un paraksta pieņemšanas–nodošanas aktu (2. pielikums), kurā norāda nodošanas datumu un laiku. Ar akta parakstīšanas brīdi uz Pircēju pāriet transportlīdzekļa nejaušas bojāejas un bojājuma risks, kā arī paaugstinātas bīstamības avota valdītāja atbildība.'),

    h('4. Cena un samaksa'),
    sub('4.1. Cena (EUR)'),
    kv('Transportlīdzekļa cena tūlītējas samaksas gadījumā (bez PVN)', bare(d.price.net)),
    kv('Papildaprīkojums, norādot katra cenu (bez PVN)', '–'),
    kv(`Pievienotās vērtības nodoklis ${d.vatPercent} % no summas ${bare(d.price.net)}`, bare(d.price.vat)),
    kv('Cena tūlītējas samaksas gadījumā kopā (ar PVN)', bare(d.price.gross), true),
    kv('Pirmā iemaksa, maksājama pirms nodošanas (ietver PVN par visu pirkumu)', bare(d.price.downGross)),
    kv('Pirkuma maksas atlikums (bez PVN)', bare(d.price.rest)),
    kv('Kredīta izmaksas: atsevišķi maksājamie procenti (4.4. punkts)', d.price.interestTotal ? bare(d.price.interestTotal) : 'procenti netiek aprēķināti'),
    kv(`Nomaksas cena (pirmā iemaksa un maksājumi 1–${n} kopā; neietver atsevišķi maksājamos procentus)`, bare(d.price.installmentPrice), true),
    p('Šajā līgumā cena tūlītējas samaksas gadījumā un nomaksas cena ir norādītas ar PVN. Tā kā procenti tiek maksāti atsevišķi, abas cenas ir vienādas.'),

    sub('4.2. Pirmais rēķins un pievienotās vērtības nodoklis'),
    p('Šis darījums ir nomaksas pirkums Pievienotās vērtības nodokļa likuma 1. panta 13. punkta izpratnē, un tā ar nodokli apliekamā vērtība ir visa līgumā noteiktā atlīdzība, izņemot kredītprocentus (minētā likuma 34. panta astotā daļa). Pārdevējs pirmajā nodokļa rēķinā iekļauj pirmo iemaksu, kas ietver PVN par visu pirkuma maksu. Rēķins apmaksājams pirms transportlīdzekļa nodošanas.'),

    sub('4.3. Maksājumi'),
    p(`Nomaksas termiņš: ${n} mēneši. Maksājumu skaits: ${n}.`),
    ...(regularLine ? [p(regularLine)] : []),
    p(`Pēdējais maksājums ${n}: ${bare(last.principal)} EUR, maksājuma diena ${last.due}.`),
    p(`Maksājumi neietver PVN, jo PVN par visu pirkumu ir iekļauts pirmajā rēķinā Nr. ${invoiceNo}.`),
    p('Maksājumu grafiks: 1. pielikums.'),
    p('Par katru maksājumu Pārdevējs izraksta rēķinu. Rēķina nesaņemšana neatbrīvo Pircēju no pienākuma veikt maksājumu grafikā noteiktajā dienā.'),

    sub('4.4. Procenti'),
    p(
      d.ratePercent
        ? `Par pirkuma maksas atlikumu no nodošanas dienas tiek aprēķināti nemainīgi kredītprocenti ${d.ratePercent} procentu apmērā gadā. Procentus aprēķina par faktiski nesamaksāto atlikumu pēc faktiskā dienu skaita (faktiskās dienas / 365) un maksā atsevišķi kopā ar katru maksājumu. Ja maksājumi tiek veikti saskaņā ar grafiku, procentu kopsumma ir ${bare(d.price.interestTotal ?? '')} EUR (1. pielikums). Kredītprocenti nav iekļauti ar nodokli apliekamajā vērtībā (Pievienotās vērtības nodokļa likuma 34. panta astotā daļa un 52. panta pirmās daļas 21. punkta “a” apakšpunkts).`
        : 'Par pirkuma maksas atlikumu procenti netiek aprēķināti.',
    ),
    p('Pārdevējs nepieprasa no Pircēja procentus vai maksājumus, par kuriem Puses nav vienojušās šajā līgumā.'),

    sub('4.5. Nokavējuma procenti'),
    p('Par laikā nesamaksātu summu Pircējs bez atgādinājuma, sākot ar nākamo dienu pēc maksājuma dienas, maksā nokavējuma procentus Civillikuma 1765. pantā noteiktajā apmērā, tas ir, astoņus procentpunktus virs procentu pamatlikmes gadā. Nokavējuma procentus aprēķina tikai no nesamaksātā kapitāla; to pieaugums apstājas, kad nesamaksāto procentu summa sasniegusi kapitāla lielumu (Civillikuma 1763. pants). Līgumsods par maksājumu kavējumu netiek piemērots.'),

    sub('4.6. Pirmstermiņa samaksa'),
    p('Pircējam ir tiesības jebkurā laikā samaksāt visu pirkuma maksas atlikumu vai tā daļu pirms termiņa, par to paziņojot Pārdevējam vismaz 5 darbdienas iepriekš. Šādā gadījumā 4.4. punktā noteiktie procenti maksājami tikai līdz faktiskās samaksas dienai; Puses vienojas, ka Civillikuma 1831. pants netiek piemērots. Pēc daļējas pirmstermiņa samaksas Pārdevējs sagatavo jaunu maksājumu grafiku.'),

    sub('4.7. Citi maksājumi'),
    p('Par katru nokavētu maksājumu Pircējs maksā Pārdevējam parāda atgūšanas izmaksas 40 EUR apmērā (Civillikuma 1668.9 pants). Ar transportlīdzekļa reģistrāciju CSDD saistītās valsts nodevas un maksu par pakalpojumiem sedz Pircējs. Citi maksājumi netiek piemēroti.'),

    sub('4.8. Maksājumu ieskaitīšana'),
    p('Pircēja maksājumi ieskaitāmi tikai no šā līguma izrietošo prasījumu dzēšanai: vispirms procentos un izmaksās, kam iestājies termiņš, pēc tam — maksājumos, sākot ar vecāko (Civillikuma 1843. pants).'),

    h('5. Īpašuma tiesību paturēšana, reģistrācija un lietošana'),
    p('5.1. Pārdevējs patur īpašuma tiesības uz transportlīdzekli līdz brīdim, kad ir pilnībā samaksāta nomaksas cena un 4.4. punktā noteiktie procenti (Civillikuma 2069. pants). Īpašuma tiesību pāreja nav atkarīga no tādu parādu samaksas, kas neizriet no šā līguma.'),
    p('5.2. Pārdevējs ne vēlāk kā nodošanas dienā iesniedz CSDD iesniegumu par Pircēja reģistrāciju transportlīdzekļa turētāja statusā; Pircējs šim nolūkam ierodas CSDD vai izsniedz rakstveida pilnvaru. Pircējs pirms transportlīdzekļa izmantošanas komercpārvadājumos saņem tam Eiropas Kopienas atļaujas kopiju vai licences kartīti. Transportlīdzeklis ir Pircēja turējumā un vienīgi viņa lietošanā. Transportlīdzekļa ekspluatācijas nodokli, autoceļu lietošanas nodevu un citus ar transportlīdzekļa lietošanu saistītos obligātos maksājumus sedz Pircējs; ja saskaņā ar likumu tie jāmaksā Pārdevējam kā īpašniekam, Pircējs tos atlīdzina 10 dienu laikā pēc Pārdevēja rēķina saņemšanas.'),
    p('5.3. Kad nomaksas cena un procenti ir samaksāti pilnībā, īpašuma tiesības pāriet Pircējam dienā, kad pēdējais maksājums ieskaitīts Pārdevēja kontā. Pārdevējs piecu dienu laikā no šīs dienas izsniedz Pircējam rakstveida apliecinājumu par īpašuma tiesību pāreju un veic visas no viņa atkarīgās darbības, lai CSDD reģistrētu īpašnieka maiņu (Ceļu satiksmes likuma 10. panta 1.3 daļa).'),
    p('5.4. Līdz īpašuma tiesību pārejai Pircējs bez Pārdevēja iepriekšējas rakstveida piekrišanas nedrīkst:'),
    li('1. transportlīdzekli pārdot, mainīt, dāvināt vai citādi atsavināt;'),
    li('2. transportlīdzekli ieķīlāt vai citādi apgrūtināt (Civillikuma 2071. pants);'),
    li('3. transportlīdzekli iznomāt, patapināt vai citādi nodot trešās personas turējumā vai lietošanā;'),
    li('4. reģistrēt transportlīdzekli citā valstī;'),
    li('5. veikt transportlīdzekļa pārbūvi, kurai nepieciešama saskaņošana vai atkārtota reģistrācija;'),
    li('6. savienot transportlīdzekli vai tā papildaprīkojumu ar citu mantu vai noņemt papildaprīkojumu, lai to atsavinātu.'),
    p('Par nodošanu 3. apakšpunkta izpratnē nav uzskatāms tas, ka transportlīdzekli Pircēja pārvadājumos vada Pircēja darbinieki.'),
    p('Pircējs ir informēts, ka par šā punkta 1. un 2. apakšpunkta pārkāpumu Civillikuma 2071. pants paredz atbildību saskaņā ar Krimināllikumu.'),
    p('5.5. Pircējs drīkst lietot transportlīdzekli savos pārvadājumos līguma teritorijā, kas ir Eiropas Ekonomikas zonas valstis un Šveice. Transportlīdzekļa lietošanai ārpus līguma teritorijas nepieciešama Pārdevēja iepriekšēja rakstveida piekrišana.'),
    p('5.6. Ja uz transportlīdzekli tiek vērsta piedziņa par Pircēja parādiem vai tiek pasludināts Pircēja maksātnespējas process, Pircējs nekavējoties paziņo par to Pārdevējam un informē tiesu izpildītāju vai administratoru, ka transportlīdzeklis ir Pārdevēja īpašums (Maksātnespējas likuma 94. pants).'),

    h('6. Uzturēšana un tehniskā apskate'),
    p(`6.1. Regulārā tehniskā apkope nav iekļauta pirkuma maksā. ( ) Puses noslēdz atsevišķu apkopes līgumu (4. pielikums), saskaņā ar kuru Pārdevējs veic transportlīdzekļa apkopi divas reizes gadā. Apkopes cena ir ${BLANK} EUR (bez PVN) par reizi, un par to izraksta rēķinu ar PVN pēc apkopes veikšanas.`),
    p('6.2. Pircējs sedz visus pārējos ar transportlīdzekļa lietošanu un uzturēšanu saistītos izdevumus, tostarp remontu, riepas, stiklus, bremzes, degvielu, AdBlue un mazgāšanu.'),
    p('6.3. Pircējs uztur transportlīdzekli labā stāvoklī ar krietna un kārtīga komersanta rūpību, lieto to atbilstoši paredzētajam mērķim un nekavējoties paziņo Pārdevējam par bojājumiem un defektiem, kas var būtiski samazināt transportlīdzekļa vērtību.'),
    p('6.4. Pircējs normatīvajos aktos noteiktajos termiņos nodrošina transportlīdzekļa valsts tehnisko apskati un iesniedz Pārdevējam tās rezultātu, izmantojot pakalpojumu RAHTIS vai citādi rakstveidā.'),
    p('6.5. Pārdevēja tiesības apskatīt transportlīdzekli: Pārdevējam ir tiesības ne biežāk kā reizi ( ) divos mēnešos  ( ) trijos mēnešos apskatīt transportlīdzekli iepriekš saskaņotā laikā Pircēja darbības vietā. Par apskati sastāda aktu.'),

    h('7. Apdrošināšana'),
    p(`7.1. Visā līguma darbības laikā par transportlīdzekli jābūt spēkā OCTA līgumam (Sauszemes transportlīdzekļu īpašnieku civiltiesiskās atbildības obligātās apdrošināšanas likuma 3. pants). OCTA līgumu slēdz un apdrošināšanas prēmiju maksā ( ) Pircējs  ( ) Pārdevējs. Ja OCTA līgumu slēdz Pārdevējs, Pircējs atlīdzina Pārdevējam apdrošināšanas prēmiju ${BLANK} atsevišķi kopā ar katru maksājumu. Ja Pircējs OCTA līgumu nav noslēdzis vai tas ir izbeidzies, Pārdevējs ir tiesīgs to noslēgt uz Pircēja rēķina.`),
    p(`7.2. Pircējs uz sava rēķina apdrošina transportlīdzekli (KASKO) vismaz pret sadursmes, ugunsgrēka, zādzības un vandalisma riskiem, ar pašrisku ne lielāku par ${BLANK} EUR. Apdrošināšanas polisē Pārdevēju norāda kā transportlīdzekļa īpašnieku un apdrošināšanas atlīdzības saņēmēju. Pirms nodošanas Pircējs iesniedz Pārdevējam apdrošinātāja rakstveida apliecinājumu, ka Pārdevējs ir norādīts kā atlīdzības saņēmējs un ka apdrošinātājs paziņos Pārdevējam par apdrošināšanas līguma izbeigšanos.`),
    p('7.3. Ja transportlīdzeklis iet bojā vai tiek nozaudēts, Pircēja maksāšanas pienākums saglabājas. Pārdevējam izmaksāto apdrošināšanas atlīdzību ieskaita Pircēja labā kā pirmstermiņa samaksu saskaņā ar 4.6. punktu. Atlīdzību izmanto tikai no šā līguma izrietošo prasījumu dzēšanai, un pārpalikumu Pārdevējs nekavējoties izmaksā Pircējam.'),

    h('8. Atrašanās vietas noteikšana'),
    p('8.1. Līguma darbības laikā transportlīdzeklī ir Pārdevēja uzstādīta vai apstiprināta atrašanās vietas noteikšanas ierīce. Pircējs nedrīkst ierīci noņemt vai traucēt tās darbību.'),
    p('8.2. Pārdevējs redz tikai odometra rādījumu un to, vai transportlīdzeklis atrodas līguma teritorijā (5.5. punkts). Precīza atrašanās vieta Pārdevējam tiek parādīta tikai tad, ja:'),
    li('1. par transportlīdzekļa zādzību ir iesniegts iesniegums policijā;'),
    li('2. transportlīdzeklis bez Pārdevēja piekrišanas ilgāk par 24 stundām atrodas ārpus līguma teritorijas; vai'),
    li('3. ir iestājušies 9.1. punktā minētie priekšnoteikumi vai līgums ir atcelts.'),
    p('8.3. Pārdevējs ir atrašanās vietas datu pārzinis. Datus apstrādā Pārdevēja īpašuma tiesību aizsardzībai, pamatojoties uz Pārdevēja leģitīmajām interesēm (Regulas (ES) 2016/679 6. panta 1. punkta f) apakšpunkts). Pārdevējs neizmanto atrašanās vietas datus vadītāju darba laika, braukšanas veida vai cita darba izpildes uzraudzībai. Katru precīzas atrašanās vietas skatīšanas gadījumu un tā pamatu reģistrē, un par to paziņo Pircējam ne vēlāk kā 3 dienu laikā, ja vien paziņošana neapdraud noziedzīga nodarījuma izmeklēšanu. Precīzus atrašanās vietas datus dzēš pēc 30 dienām vai, ja tie skatīti saskaņā ar 8.2. punktu, — pēc attiecīgā jautājuma galīgas izskatīšanas.'),
    p('8.4. Pārdevējs sagatavo vadītājiem paredzētu informāciju saskaņā ar Regulas (ES) 2016/679 14. pantu, un Pircējs to izsniedz saviem vadītājiem pirms transportlīdzekļa nodošanas. Pircējs kā darba devējs atbild par darba tiesību normās noteikto darbinieku informēšanas pienākumu izpildi.'),
    p('8.5. Transportlīdzeklī var būt uzstādīta ierīce attālinātai iedarbināšanas bloķēšanai. To drīkst izmantot tikai tad, kad transportlīdzeklis ir novietots stāvēšanai, un tikai tad, ja (a) pēc iesnieguma par transportlīdzekļa zādzību to lūdz policija vai tā tam piekrīt, vai (b) Pircējs attiecīgajā brīdī dod rakstveida piekrišanu. Bloķēšanu neizmanto maksājumu piedziņai vai transportlīdzekļa atgūšanai; transportlīdzekļa atdošana notiek tikai saskaņā ar 9. punktu.'),

    h('9. Maksājumu kavējums, līguma pārkāpums un transportlīdzekļa atdošana'),
    p('9.1. Pārdevējs ir tiesīgs prasīt šā līguma atcelšanu un transportlīdzekļa atdošanu, ja (Civillikuma 2070. pants):'),
    li('1. Pircējs ir palaidis garām divus maksājumu termiņus un abi maksājumi joprojām nav samaksāti;'),
    li('2. Pircējs transportlīdzekli ir atsavinājis;'),
    li('3. Pircējs transportlīdzekli ir nozaudējis; vai'),
    li('4. Pircējs transportlīdzekli ir tā sabojājis, ka tā vērtība vairs nesedz nenokārtotos maksājumus.'),
    p('Šā punkta 1. apakšpunktā minētajā gadījumā Pārdevējs pirms līguma atcelšanas nosūta Pircējam rakstveida brīdinājumu, nosakot vismaz 14 dienu termiņu parāda samaksai. Ja parāds šajā termiņā ir samaksāts pilnībā kopā ar nokavējuma procentiem un 4.7. punktā minētajām izmaksām, tiesības atcelt līgumu šā kavējuma dēļ izbeidzas.'),
    p('9.2. Kamēr Pārdevējs nav paziņojis par līguma atcelšanu, viņš var aprobežoties ar nokavēto maksājumu, nokavējuma procentu un izmaksu piedziņu. Pārdevējs nevar vienlaikus prasīt līguma atcelšanu un vēl nenokavēto maksājumu samaksu.'),
    p('9.3. Ja Pircējs būtiski pārkāpj kādu no turpmāk minētajiem pienākumiem un nenovērš pārkāpumu 14 dienu laikā pēc Pārdevēja rakstveida brīdinājuma saņemšanas, Pārdevējs ir tiesīgs prasīt pārkāpuma novēršanu un zaudējumu atlīdzību, kā arī pats uz Pircēja rēķina veikt darbības, kas nepieciešamas transportlīdzekļa saglabāšanai (tostarp noslēgt apdrošināšanas līgumu):'),
    li('1. 5.4. punkta aizliegumi;'),
    li('2. 5.2. punktā noteiktie reģistrācijas un komercpārvadājumu atļaujas pienākumi;'),
    li('3. pienākums uzturēt spēkā 7.1. un 7.2. punktā minēto apdrošināšanu;'),
    li('4. valsts tehniskā apskate (6.4. punkts);'),
    li('5. aizliegums noņemt atrašanās vietas noteikšanas ierīci vai traucēt tās darbību (8.1. punkts).'),
    p('Šādi pārkāpumi dod tiesības prasīt līguma atcelšanu un transportlīdzekļa atdošanu tikai tad, ja vienlaikus ir iestājies kāds no 9.1. punktā minētajiem pamatiem vai ja to pieļauj likums.'),
    p(`9.4. Ja līgums tiek atcelts, Pircējs 5 darbdienu laikā pēc Pārdevēja paziņojuma saņemšanas nodod transportlīdzekli Pārdevējam ${BLANK} (vieta), par ko Puses sastāda pieņemšanas–nodošanas aktu, kurā norāda odometra rādījumu un transportlīdzekļa stāvokli. Pārdevējs nav tiesīgs pārņemt transportlīdzekli patvaļīgi, pret Pircēja gribu (Civillikuma 1732. pants). Ja Pircējs transportlīdzekli labprātīgi nenodod, Pārdevējs ceļ prasību tiesā, un tiesas nolēmumu izpilda zvērināts tiesu izpildītājs.`),
    p('9.5. Atceļot līgumu, Puses veic savstarpējo norēķinu saskaņā ar Civillikuma 2070. pantu. Pārdevējam pienākas:'),
    li('1. atlīdzība par transportlīdzekļa lietošanu laikā no nodošanas Pircējam līdz atdošanai Pārdevējam;'),
    li('2. atlīdzība par Pārdevējam nodarītajiem zaudējumiem, tostarp par transportlīdzekļa vērtības samazinājumu, kas pārsniedz parasto nolietojumu, par atgūšanas, glabāšanas un tiesāšanās izdevumiem, kā arī nesamaksātie nokavējuma procenti un 4.7. punktā minētās izmaksas.'),
    p('Šajā summā ieskaita visus Pircēja izdarītos maksājumus (pirmo iemaksu bez PVN daļas, ciktāl PVN tiek koriģēts saskaņā ar 9.6. punktu, un visus samaksātos maksājumus). Ja Pircēja maksājumi pārsniedz Pārdevējam pienākošos summu, Pārdevējs atlikumu atmaksā Pircējam 30 dienu laikā pēc transportlīdzekļa atdošanas; ja tie ir mazāki, Pircējs tajā pašā termiņā samaksā starpību.'),
    p(`Puses vienojas, ka atlīdzību par lietošanu aprēķina kā ${BLANK} EUR (bez PVN) par katru pilnu lietošanas mēnesi, kas atbilst līdzvērtīga transportlīdzekļa nomas maksai tirgū līguma noslēgšanas dienā. Ja kāda Puse uzskata, ka šī summa neatbilst faktiskajai lietošanas vērtībai, vai Puses nevienojas par zaudējumu apmēru, to nosaka tiesa.`),
    p('Noteikumi, kas paredz, ka Pircēja izdarītie maksājumi neatkarīgi no šā aprēķina paliek Pārdevējam, šim līgumam netiek piemēroti.'),
    p('9.6. Nodokļa rēķinu korekciju un PVN piemērošanu atlīdzībai par lietošanu līguma atcelšanas gadījumā Puses veic saskaņā ar Pievienotās vērtības nodokļa likumu un, ja nepieciešams, saskaņā ar Valsts ieņēmumu dienesta uzziņu. Pārdevējs izraksta kredītrēķinu un jaunu nodokļa rēķinu tādā apmērā, kādā to prasa likums.'),
    p('9.7. Līdz brīdim, kad transportlīdzeklis faktiski nodots Pārdevējam, Pircējs var saglabāt transportlīdzekli un līgumu, vienā maksājumā samaksājot visus nokavētos maksājumus, nokavējuma procentus, 4.7. punktā minētās izmaksas un Pārdevēja pamatotos atgūšanas izdevumus. Šādā gadījumā līgums paliek spēkā ar sākotnējo maksājumu grafiku.'),
    p('9.8. Strīdus par transportlīdzekļa atdošanu un savstarpējo norēķinu izskata tiesa (11.4. punkts). Tiesas nolēmumu par transportlīdzekļa nodošanu Pārdevējam izpilda zvērināts tiesu izpildītājs Civilprocesa likumā noteiktajā kārtībā.'),
    p('9.9. Ja pirkums izbeidzas, transportlīdzekli atdodot Pārdevējam vai Pusēm vienojoties par līguma atcelšanu, Pārdevējs nekavējoties reģistrē pirkuma izbeigšanos pakalpojumā RAHTIS. No reģistrēšanas brīža pakalpojumā vairs netiek sagatavoti maksājumu rēķini un netiek sūtīti maksājumu atgādinājumi. Reģistrēšana nemaina Pušu tiesības un pienākumus: savstarpējo norēķinu saskaņā ar Civillikuma 2070. pantu Puses veic savā starpā, bet, ja vienošanās netiek panākta, — tiesas ceļā. Pēc transportlīdzekļa atdošanas Pārdevējs iesniedz CSDD iesniegumu par turētāja dzēšanu.'),

    h('10. Datu kopīgošana pakalpojumā RAHTIS'),
    p('10.1. Puses vienojas, ka pakalpojumā RAHTIS Pārdevējam līguma darbības laikā tiek rādīts transportlīdzekļa odometra rādījums, ziņas par apkopēm, defektiem, apskatēm un valsts tehnisko apskati, maksājumu stāvoklis, kā arī atrašanās vieta 8. punktā noteiktajās robežās. Ziņas par transportlīdzekļa pārvadājumu uzdevumiem un ieņēmumiem Pārdevējam rāda tikai mēneša kopsavilkuma veidā un tikai tad, ja Pircējs pakalpojumā tam ir atsevišķi piekritis.'),
    p('10.2. Aivomaa Oy (RAHTIS) nav šā līguma puse. Aivomaa Oy vienīgi sagatavo aprēķinu, līguma un citu dokumentu projektus, rēķinus Pārdevēja vārdā un maksājumu atgādinājumus, kā arī paziņo, ka iestājušies likumā vai līgumā noteiktie kavējuma sliekšņi. Aivomaa Oy nefinansē pirkumu, neizsniedz kredītu, negalvo par Pušu saistībām, nepieņem un nepārskaita maksājumus, neveic parādu piedziņu un neatbild par Pušu saistību izpildi. Aivomaa Oy apstrādā personas datus Pušu uzdevumā saskaņā ar pakalpojuma lietošanas noteikumiem un datu apstrādes līgumu.'),

    h('11. Citi noteikumi'),
    p('11.1. Pārdevējs var cedēt no šā līguma izrietošos prasījumus un nodot īpašuma tiesības uz transportlīdzekli kredītiestādei vai citam finansētājam. Par cesiju Pircējam paziņo rakstveidā, un pēc paziņojuma saņemšanas Pircējs var veikt maksājumus ar atbrīvojošu spēku tikai cesionāram.'),
    p('11.2. Paziņojumus saskaņā ar šo līgumu sniedz rakstveidā uz 1. punktā norādītajām e-pasta adresēm. Paziņojums uzskatāms par saņemtu nākamajā darbdienā pēc tā nosūtīšanas. Paziņojumu par līguma atcelšanu un 9.1. punktā minēto brīdinājumu papildus nosūta ierakstītā pasta sūtījumā uz Puses juridisko adresi vai uz tās oficiālo elektronisko adresi.'),
    p('11.3. Līgumam piemērojami Latvijas Republikas normatīvie akti, tostarp Civillikuma 2069.–2071. pants un Komerclikuma noteikumi par komercdarījumiem.'),
    p('11.4. Strīdus izskata Latvijas Republikas tiesa pēc Pārdevēja juridiskās adreses piekritības.'),
    p('11.5. Līguma grozījumi ir spēkā tikai tad, ja tie izdarīti rakstveidā un tos parakstījušas abas Puses.'),
    p('11.6. No šā līguma izrietošie prasījumi noilgst triju gadu laikā (Komerclikuma 406. pants).'),
    p('11.7. Līgumu paraksta pirms transportlīdzekļa nodošanas vai nu pašrocīgi divos vienāda satura eksemplāros, no kuriem katra Puse saņem vienu, vai ar abu Pušu drošu elektronisko parakstu, kas satur laika zīmogu; šādā gadījumā līguma parakstīšanas datums ir pēdējā pievienotā paraksta laika zīmoga datums, un katra Puse saņem parakstīto elektronisko dokumentu.'),

    h('12. Paraksti'),
    p(`Vieta un datums: ${LONG_BLANK}`),
    { kind: 'sign', left: [`Pārdevējs: ${d.seller.name}`, 'Vārds, uzvārds, amats'], right: [`Pircējs: ${d.buyer.name}`, 'Vārds, uzvārds, amats'] },
    p('Pielikumi: 1. Maksājumu grafiks · 2. Pieņemšanas–nodošanas akts · 3. Pirmais rēķins · 4. Apkopes līgums · 5. Vadītājiem paredzētā informācija par personas datu apstrādi'),
  ];

  const annexes: ContractBlock[] = [
    { kind: 'annex', text: '1. pielikums. Maksājumu grafiks' },
    { kind: 'meta', text: `Līgums Nr. ${d.number} · Pārdevējs ${d.seller.name} · Pircējs ${d.buyer.name}` },
    {
      kind: 'table',
      head: ['Nr.', 'Maksājuma diena', 'Pirkuma maksas daļa, EUR', 'Procenti, EUR', 'Kopā maksājams, EUR', 'Atlikums pēc maksājuma, EUR'],
      rows: [
        ['0 (pirmā iemaksa ar PVN)', `pirms ${d.handover}`, bare(d.price.downGross), '—', bare(d.price.downGross), bare(d.price.rest)],
        ...d.plan.map((r, i) => [
          i === d.plan.length - 1 ? `${r.n} (pēdējais maksājums)` : String(r.n),
          r.due,
          bare(r.principal),
          r.interest === '–' ? '—' : bare(r.interest),
          bare(r.total),
          bare(r.balance),
        ]),
      ],
      foot: ['Kopā', '', bare(d.price.installmentPrice), d.planTotals.interest === '–' ? '—' : bare(d.planTotals.interest), bare(d.planTotals.all), ''],
    },
    p(
      d.ratePercent
        ? `Procenti aprēķināti pēc likmes ${d.ratePercent} % gadā, faktiskās dienas / 365. Maksājumi 1–${n} neietver PVN.`
        : `Maksājumi 1–${n} neietver PVN.`,
    ),

    { kind: 'annex', text: '2. pielikums. Pieņemšanas–nodošanas akts' },
    { kind: 'meta', text: `Līgums Nr. ${d.number} · Vieta ${BLANK} · Datums un laiks ____.____.________ plkst. ____.____` },
    kv('Transportlīdzeklis', d.vehicle.make),
    kv('Valsts reģistrācijas numurs', d.vehicle.plate),
    kv('Identifikācijas numurs (VIN)', LONG_BLANK),
    kv('Odometra rādījums', `${BLANK} km`),
    kv('Nodotie dokumenti', `reģistrācijas apliecība (turētājs — Pircējs), ${BLANK}`),
    kv('Atslēgu skaits', BLANK),
    kv('Papildaprīkojums', LONG_BLANK),
    kv('Riepu stāvoklis', LONG_BLANK),
    kv('Konstatētie bojājumi un trūkumi', LONG_BLANK),
    kv('Fotofiksācija', '______ attēli, pievienoti pakalpojumā RAHTIS'),
    kv('OCTA polises Nr., KASKO polises Nr.', LONG_BLANK),
    p(`Transportlīdzeklis nodots Pircējam ____.____.________ plkst. ____.____ pēc nomaksas pirkuma līguma Nr. ${d.number} parakstīšanas un pirmā rēķina Nr. ${invoiceNo} samaksas. Īpašuma tiesības uz transportlīdzekli paliek Pārdevējam līdz pilnīgai pirkuma maksas samaksai. Pircējam ir pienākums iespējami īsā laikā pārbaudīt transportlīdzekli un nekavējoties paziņot par trūkumiem (Komerclikuma 411. pants).`),
    { kind: 'sign', left: ['Pārdevējs'], right: ['Pircējs'] },
  ];

  return {
    title: `Nomaksas pirkuma līgums ${d.number}`,
    author: d.seller.name,
    footer: `Nomaksas pirkuma līgums ${d.number} · sagatavots pakalpojumā RAHTIS; Aivomaa Oy nav līguma puse`,
    pages: [main, annexes],
  };
}
