/**
 * Договор Швеции: «Avtal om avbetalningsköp» (23.11.2026).
 *
 * Текст — шаблон docs/equipment-sale/countries/se.md, раздел 5, версия 0.1
 * (черновик, шведским юристом не проверен — об этом сторонам сказано в
 * кабинете). Юридический текст перенесён дословно; подставлены только данные
 * сделки. Чего в RAHTIS нет (VIN, год, номер НДС, номер лицензии, контактное
 * лицо, страховые условия, дата окончания оговорки в п. 5.2), — строки для
 * заполнения от руки; где шаблон даёт выбор, — оба варианта с отметкой «( )».
 *
 * Чем договор отличается от финского (se.md, раздел 4):
 *   · п. 4.1 называет четыре величины закона — kontantpris, kreditbelopp,
 *     kreditkostnad, kreditfordran: без них договор не годится для
 *     handräckning в Kronofogden (11 § закона 1978:599);
 *   · пороги п. 9.1 считаются от kreditfordran, а не от цены, и нужно «больше»
 *     14 дней и «больше» 1/10 (1/20). Те же числа считает rules.ts (SE_AVBL);
 *   · в реестре владельцем записывается покупатель (п. 5.2), продавец виден
 *     только в отметке о kreditköp; страховку и налог несёт покупатель;
 *   · финского пункта о счёте покупателя при возврате нет: п. 9.6 — машина
 *     оценивается без НДС, покупатель счёта не выставляет.
 *
 * Только обычный НДС (варианты B и C п. 4.2 не подтверждены) и только без
 * процентов: вариант B п. 4.4 по указанию шаблона применяется лишь после
 * ответа бухгалтера продавца, а кабинет процентов в Швеции не предлагает.
 * Сделка с процентами договора не получает (contractText/index.ts, interest).
 *
 * Даты — «ГГГГ-ММ-ДД», суммы — в кронах: в таблицах валюта в шапке («kr»),
 * в тексте — словом «kronor», как в шаблоне.
 */
import type { ContractPdfInput } from '../ContractPdf.tsx';
import { bareKr, BLANK, h, kv, li, LONG_BLANK, p, sub, type ContractBlock, type ContractDocument } from './blocks.ts';

const yesNo = (value: boolean) => (value ? 'ja' : 'nej');

function party(label: string, x: ContractPdfInput['seller'], extra?: string): string[] {
  return [
    label,
    x.name,
    `Organisationsnummer: ${x.businessId}`,
    `Adress: ${x.address || LONG_BLANK}`,
    `Registrerad för mervärdesskatt: ${yesNo(x.vatRegistered)}`,
    `Registreringsnummer för mervärdesskatt: ${BLANK}`,
    ...(extra ? [extra] : []),
    `Kontaktperson: ${LONG_BLANK}`,
    `Telefon: ${x.phone || BLANK} · E-post: ${x.email || BLANK}`,
  ];
}

export function seContractText(d: ContractPdfInput): ContractDocument {
  const n = d.months;
  const first = d.plan[0];
  const last = d.plan[d.plan.length - 1];
  const regular = d.plan.slice(0, -1);
  const equal = regular.every((x) => x.principal === first.principal);
  const invoiceNo = d.firstInvoiceNumber ?? BLANK;

  /* 4.3: равные взносы — суммой, как в шаблоне; если расходятся на эре, — отсылка к графику. */
  const regularLine =
    regular.length === 0
      ? null
      : regular.length === 1
        ? `Avbetalning 1: ${bareKr(first.principal)} kronor, förfallodag ${first.due}.`
        : equal
          ? `Avbetalning 1–${n - 1}: vardera ${bareKr(first.principal)} kronor, förfallodag den ${d.dueDay} i varje månad, första gången ${first.due}.`
          : `Avbetalning 1–${n - 1}: enligt betalningsplanen (bilaga 1), förfallodag den ${d.dueDay} i varje månad, första gången ${first.due}.`;

  const main: ContractBlock[] = [
    { kind: 'title', text: 'AVTAL OM AVBETALNINGSKÖP' },
    {
      kind: 'notice',
      text: 'SÄLJAREN FÖRBEHÅLLER SIG RÄTTEN ATT ÅTERTA FORDONET OM KÖPAREN INTE FULLGÖR SINA SKYLDIGHETER ENLIGT DETTA AVTAL (FÖRBEHÅLL OM ÅTERTAGANDERÄTT). ÄGANDERÄTTEN ÖVERGÅR TILL KÖPAREN FÖRST NÄR HELA KREDITFORDRAN ÄR BETALD.',
    },
    { kind: 'meta', text: `Avtal nr ${d.number} · Datum ${d.date}` },

    h('1. Parter'),
    {
      kind: 'parties',
      left: party('Säljare', d.seller),
      right: party('Köpare', d.buyer, `Tillstånd för yrkesmässig trafik nr: ${BLANK}`),
    },
    p('Säljaren är kreditgivare.'),
    p('Parterna är näringsidkare och ingår detta avtal i sin yrkesmässiga verksamhet. På avtalet tillämpas lagen (1978:599) om avbetalningsköp mellan näringsidkare m.fl. (”avbetalningsköplagen”).'),

    h('2. Köpeobjekt'),
    kv('Fordon', d.vehicle.make),
    kv('Registreringsnummer', d.vehicle.plate),
    kv('Chassinummer (VIN)', LONG_BLANK),
    kv('Första registrering (år)', '__________'),
    kv('Mätarställning vid avtalets ingående', d.vehicle.odometer),
    kv('Extrautrustning', `ingen extrautrustning / ${LONG_BLANK}`),
    kv('Rättigheter som belastar fordonet', `( ) inga  ( ) uppgifter: ${BLANK}`),
    p('2.1 Säljaren försäkrar att säljaren äger fordonet och dess extrautrustning, att de inte belastas av tredje mans äganderättsförbehåll, förbehåll om återtaganderätt, panträtt eller annan säkerhetsrätt utöver vad som anges ovan, och att säljaren har rätt att sälja fordonet på villkoren i detta avtal. Säljaren överlämnar före undertecknandet ett aktuellt utdrag ur vägtrafikregistret till köparen.'),
    p('2.2 Fordonet säljs i det skick som beskrivs i överlämnandeprotokollet (bilaga 2). Köparen ska reklamera fel skriftligen inom skälig tid efter det att köparen märkt eller borde ha märkt felet.'),

    h('3. Leverans'),
    p(`3.1 Leveranssätt: ( ) avhämtning hos säljaren  ( ) säljaren levererar till adress ${BLANK}. Leveransdag: ${d.handover}.`),
    p('3.2 Fordonet lämnas ut först när'),
    li('1. detta avtal har undertecknats;'),
    li('2. den första fakturan (punkt 4.2) har betalats till säljarens konto;'),
    li('3. parterna har undertecknat anmälan om ägarbyte till Transportstyrelsen med uppgift om att fordonet har överlåtits genom kreditköp med förbehåll om återtaganderätt och om slutdatum för förbehållet (punkt 5.2);'),
    li('4. köparen har tecknat trafikförsäkring enligt punkt 7.1 som gäller från leveransdagen och har lämnat bekräftelsen enligt punkt 7.2; och'),
    li('5. köparen har bekräftat att fordonet kommer att anmälas för användning i yrkesmässig trafik innan det används i sådan trafik (punkt 5.2).'),
    p('3.3 Vid utlämnandet besiktigar parterna fordonet gemensamt och undertecknar överlämnandeprotokollet (bilaga 2), där tidpunkten för utlämnandet anges. Risken för fordonet övergår på köparen vid utlämnandet.'),

    h('4. Pris och betalning'),
    sub('4.1 Pris och kredit (kr)'),
    kv('Fordonets pris (exklusive mervärdesskatt)', bareKr(d.price.net)),
    kv('Extrautrustning, specificerad och prissatt (exklusive mervärdesskatt)', '–'),
    kv(`Mervärdesskatt ${d.vatPercent} % på ${bareKr(d.price.net)}`, bareKr(d.price.vat)),
    kv('Kontantpris (inklusive mervärdesskatt)', bareKr(d.price.gross), true),
    kv('Kontantinsats, betalas före utlämnandet (inklusive mervärdesskatten på hela köpet)', bareKr(d.price.downGross)),
    kv('Kreditbelopp (den del av kontantpriset som säljaren lämnar anstånd med; innehåller ingen mervärdesskatt)', bareKr(d.price.rest), true),
    kv('Kreditkostnad (summan av all ränta enligt punkt 4.4; inga andra avgifter)', 'ingen kreditkostnad', true),
    kv('Kreditfordran (kreditbelopp och kreditkostnad)', bareKr(d.price.creditClaim), true),
    kv('Kreditavtalets löptid', `${n} månader`),
    p('Begreppen kontantpris, kreditbelopp, kreditkostnad och kreditfordran har samma innebörd som i 2 § avbetalningsköplagen. Någon uppläggningsavgift tas inte ut.'),

    sub('4.2 Första fakturan och mervärdesskatt'),
    p('Säljaren fakturerar kontantinsatsen, som innehåller mervärdesskatten på hela köpet, med den första fakturan. Fakturan förfaller till betalning före utlämnandet. Köpet är en leverans av vara vid utlämnandet (5 kap. 3 § andra stycket 2 mervärdesskattelagen (2023:200)); skatten på det som betalas dessförinnan uppkommer när betalningen kommer säljaren till godo (7 kap. 7 § samma lag).'),

    sub('4.3 Avbetalningar'),
    p(`Antal avbetalningar: ${n}.`),
    ...(regularLine ? [p(regularLine)] : []),
    p(`Sista avbetalningen ${n}: ${bareKr(last.principal)} kronor, förfallodag ${last.due}.`),
    p(`Avbetalningarna innehåller ingen mervärdesskatt, eftersom mervärdesskatten på hela köpet har fakturerats med den första fakturan nr ${invoiceNo}.`),
    p('Betalningsplan: bilaga 1.'),

    sub('4.4 Ränta'),
    p('Ingen ränta tas ut på kreditbeloppet.'),
    p('Säljaren tar inte ut ränta eller avgifter som inte anges i detta avtal.'),

    sub('4.5 Dröjsmålsränta och förseningsersättning'),
    p('På förfallet belopp utgår dröjsmålsränta från förfallodagen enligt 3 och 6 §§ räntelagen (1975:635), det vill säga efter en räntefot som motsvarar den vid varje tid gällande referensräntan med ett tillägg av åtta procentenheter. Säljaren har därutöver rätt till förseningsersättning enligt 4 a § lagen (1981:739) om ersättning för inkassokostnader m.m.'),

    sub('4.6 Förtidsbetalning'),
    p('Köparen har alltid rätt att betala hela eller en del av sin skuld i förtid. Vid förtidsbetalning minskas den obetalda delen av kreditfordran med den del av kreditkostnaden som belöper på den inte utnyttjade kredittiden (4 och 5 §§ avbetalningsköplagen). Ränta utgår därmed endast till och med betalningsdagen.'),

    sub('4.7 Övriga avgifter'),
    p('För skriftlig betalningspåminnelse betalar köparen 60 kronor. Säljaren har rätt till ersättning för inkassokostnader enligt lagen (1981:739) om ersättning för inkassokostnader m.m. och till ersättning för kostnader för återtagande enligt 9 § avbetalningsköplagen. Avgifter till myndigheter för registrering av fordonet betalas av köparen. Inga andra avgifter tas ut.'),

    sub('4.8 Avräkning av betalningar'),
    p('Köparens betalningar avräknas endast på säljarens fordran enligt detta avtal: först på förfallna kostnader och räntor, därefter på avbetalningarna med den äldsta först. Säljaren får inte först avräkna betalningarna på någon annan fordran (6 § avbetalningsköplagen).'),

    h('5. Förbehåll om återtaganderätt, registrering och användning'),
    p('5.1 Säljaren förbehåller sig rätten att återta fordonet och dess extrautrustning om köparen inte fullgör sina skyldigheter enligt detta avtal. Äganderätten övergår till köparen när hela kreditfordran har betalats. Förbehållet gäller endast för fordringar som grundas på detta avtal.'),
    p(`5.2 Parterna anmäler ägarbytet till Transportstyrelsen senast på leveransdagen, så att anmälan kommer in inom tio dagar från dagen för ägarbytet. I anmälan anges att fordonet har överlåtits genom kreditköp med förbehåll om återtaganderätt och att förbehållets slutdatum är ${BLANK} (5 kap. 1–3 och 8 §§ förordningen (2019:383) om fordons registrering och användning). Köparen registreras därmed som fordonets ägare i vägtrafikregistret och svarar som sådan för fordonsskatt och andra skyldigheter som åvilar den registrerade ägaren. Registreringen påverkar inte säljarens förbehåll enligt punkt 5.1. Köparen anmäler fordonet till Transportstyrelsen för användning i yrkesmässig trafik innan det används i sådan trafik (4 kap. 2 § yrkestrafikförordningen (2012:237)).`),
    p('5.3 Köparen får inte begära att uppgiften om kreditköp tas bort ur vägtrafikregistret innan kreditfordran är betald. Om slutdatumet för förbehållet ändras anmäler säljaren ändringen till Transportstyrelsen.'),
    p('5.4 När hela kreditfordran har betalats övergår äganderätten till köparen den dag då den sista betalningen har bokförts på säljarens konto. Säljaren anmäler då genast till Transportstyrelsen att förbehållet om återtaganderätt har upphört (5 kap. 10 § förordningen (2019:383)) och bekräftar detta skriftligen för köparen.'),
    p('5.5 Köparen får inte innan äganderätten har övergått, utan säljarens skriftliga samtycke,'),
    li('1. sälja, byta bort eller skänka bort fordonet;'),
    li('2. pantsätta fordonet eller på annat sätt ställa det som säkerhet;'),
    li('3. hyra ut, låna ut eller på annat sätt överlåta besittningen eller nyttjandet av fordonet till tredje man;'),
    li('4. anmäla ägarbyte för fordonet eller registrera det i en annan stat;'),
    li('5. göra sådana ändringar av fordonet som kräver registreringsbesiktning;'),
    li('6. sammanfoga fordonet eller dess extrautrustning med annan egendom eller avlägsna extrautrustning från fordonet för att överlåta den.'),
    p('Som överlåtelse enligt 3 anses inte att fordonet i köparens egen trafik körs av förare som är anställda hos köparen eller inhyrda av köparen.'),
    p('5.6 Köparen får använda fordonet i sin egen trafik inom avtalsområdet, som är EES-staterna och Schweiz. Användning utanför avtalsområdet kräver säljarens skriftliga samtycke i förväg.'),
    p('5.7 Skyldigheterna i punkterna 5.3, 5.5, 5.6, 6.3, 6.4, 7.1, 7.2 och 8.1 är sådana förpliktelser som avses i 4 § andra stycket 2 och 7 § 2 avbetalningsköplagen.'),

    h('6. Underhåll och besiktning'),
    p(`6.1 Service ingår inte i priset. Parterna ingår ett särskilt serviceavtal (bilaga 4), enligt vilket säljaren utför service på fordonet två gånger per år. Servicen omfattar byte av motor- och växellådsolja och filter samt avläsning av felkoder. Priset är ${BLANK} kronor (exklusive mervärdesskatt) per tillfälle och faktureras med mervärdesskatt efter utförd service.`),
    p('6.2 Köparen svarar för alla övriga kostnader för fordonets användning och underhåll, såsom reparationer, däck, glas, bromsar, bränsle, AdBlue och tvätt.'),
    p('6.3 Köparen ska hålla fordonet i gott skick, använda det för avsett ändamål och utan dröjsmål underrätta säljaren om skador och fel som väsentligt kan minska fordonets värde.'),
    p('6.4 Köparen ska låta kontrollbesiktiga fordonet inom föreskriven tid och lämna besiktningsprotokollet till säljaren via RAHTIS-tjänsten eller på annat sätt skriftligen.'),
    p('6.5 Säljarens rätt till besiktning: säljaren har rätt att besiktiga fordonet med ( ) två månaders  ( ) tre månaders mellanrum vid en i förväg överenskommen tidpunkt på köparens driftställe. Över besiktningen upprättas ett protokoll.'),

    h('7. Försäkringar'),
    p('7.1 Fordonet ska under hela avtalstiden omfattas av trafikförsäkring. Försäkringsplikten fullgörs av köparen i egenskap av innehavare på grund av kreditköp med förbehåll om återtaganderätt (2 § trafikskadelagen (1975:1410)). Köparen tecknar och betalar försäkringen.'),
    p(`7.2 Köparen tecknar och betalar en vagnskadeförsäkring (helförsäkring) för fordonet som omfattar minst kollision, brand, stöld och skadegörelse, med en självrisk om högst ${BLANK} kronor. Säljarens intresse som innehavare av förbehåll om återtaganderätt ska vara antecknat hos försäkringsgivaren. Köparen lämnar före utlämnandet försäkringsgivarens skriftliga bekräftelse på att försäkringen gäller till förmån för säljaren (9 kap. 1 § försäkringsavtalslagen (2005:104)), att ersättning vid totalskada eller stöld betalas till säljaren intill säljarens fordran och att försäkringsgivaren underrättar säljaren om försäkringen upphör.`),
    p('7.3 Om fordonet förstörs eller förkommer består köparens betalningsskyldighet. Försäkringsersättning som betalas till säljaren räknas köparen till godo som förtidsbetalning enligt punkt 4.6 och används endast för betalning av fordran enligt detta avtal. Överskjutande belopp betalas utan dröjsmål till köparen.'),

    h('8. Positionering'),
    p('8.1 Fordonet är under avtalstiden försett med positioneringsutrustning som säljaren har installerat eller godkänt. Köparen får inte avlägsna utrustningen eller hindra dess funktion.'),
    p('8.2 Säljaren ser endast mätarställningen och uppgift om huruvida fordonet befinner sig inom avtalsområdet (punkt 5.6). Exakt position visas för säljaren endast om'),
    li('1. stöld av fordonet har polisanmälts;'),
    li('2. fordonet har befunnit sig utanför avtalsområdet i mer än 24 timmar utan säljarens samtycke; eller'),
    li('3. förutsättningarna för återtagande enligt punkt 9.1 är uppfyllda eller avtalet har upphört.'),
    p('8.3 Säljaren är personuppgiftsansvarig för positionsuppgifterna. Uppgifterna behandlas för att skydda säljarens säkerhet i fordonet med stöd av säljarens berättigade intresse (artikel 6.1 f i förordning (EU) 2016/679). Säljaren använder inte positionsuppgifterna för att följa förarnas arbetstid, körsätt eller arbetsprestation i övrigt. Varje visning av exakt position och skälet till den loggas, och köparen underrättas senast inom 3 dagar, om inte underrättelsen äventyrar utredningen av ett brott. Exakta positionsuppgifter raderas efter 30 dagar eller, om de har öppnats enligt punkt 8.2, när ärendet är slutbehandlat.'),
    p('8.4 Säljaren upprättar information till förarna enligt artikel 14 i förordning (EU) 2016/679, och köparen lämnar den till sina förare före utlämnandet. Köparen svarar som arbetsgivare för att de skyldigheter mot arbetstagarna och deras organisationer som följer av lag och kollektivavtal fullgörs.'),
    p('8.5 Fordonet får förses med fjärrstyrd startspärr. Den får användas endast när fordonet står parkerat och endast om (a) polisen begär eller samtycker till det efter polisanmälan om stöld av fordonet, eller (b) köparen vid tillfället lämnar sitt skriftliga samtycke. Startspärren används inte för att driva in betalning eller för att återta fordonet; återtagande sker enligt punkt 9.'),

    h('9. Dröjsmål med betalning, avtalsbrott och återtagande'),
    p('9.1 Säljaren får göra gällande förbehållet om återtaganderätt endast om'),
    li('1. köparen sedan mer än fjorton dagar är i dröjsmål med att betala en förfallen del av kreditfordran som uppgår till mer än en tiondel av hela kreditfordran eller, om dröjsmålet avser två eller flera vid olika tidpunkter förfallna poster, till mer än en tjugondel av denna, eller som utgör återstoden av kreditfordran; eller'),
    li('2. köparen genom att åsidosätta en förpliktelse som anges i punkt 5.7 har äventyrat säljarens säkerhet i fordonet'),
    p(`(7 § avbetalningsköplagen). En tiondel av kreditfordran enligt detta avtal är ${bareKr(d.price.tenth)} kronor och en tjugondel ${bareKr(d.price.twentieth)} kronor.`),
    p('9.2 Under de förutsättningar som anges i punkt 9.1 får säljaren genom skriftligt meddelande kräva betalning i förtid av hela den obetalda kreditfordran (4 § andra stycket avbetalningsköplagen). Säljarens fordran beräknas då enligt punkt 4.6, och ränta för tid efter betalningen tas inte ut.'),
    p('9.3 Om köparen i fall som avses i punkt 9.1 första stycket 1 innan fordonet återtas betalar det belopp som inte har betalats i rätt tid jämte dröjsmålsränta och ersättning för säljarens kostnader med anledning av dröjsmålet, får säljaren varken återta fordonet eller kräva betalning i förtid på grund av dröjsmålet (8 § avbetalningsköplagen).'),
    p('9.4 Innan säljaren åberopar punkt 9.1 första stycket 2 ska säljaren skriftligen uppmana köparen att vidta rättelse inom 14 dagar, om inte åsidosättandet är sådant att det inte kan rättas.'),
    p('9.5 Vill säljaren återta fordonet ska avräkning göras mellan parterna (9 § avbetalningsköplagen). Köparen tillgodoräknas fordonets värde vid återtagandet, beräknat efter vad säljaren kan antas få ut genom att på lämpligt sätt sälja fordonet. Säljaren tillgodoräknas den obetalda delen av kreditfordran efter avräkning enligt punkt 4.6, dröjsmålsränta samt de kostnader för återtagandet som anges i 9 § fjärde och femte styckena avbetalningsköplagen. Tillgodoräknas köparen ett större belopp än säljaren, får fordonet återtas endast om säljaren betalar mellanskillnaden till köparen eller, när fordonet har värderats av Kronofogdemyndigheten, sätter ned mellanskillnaden hos myndigheten. Tillgodoräknas säljaren ett större belopp, får säljaren inte kräva mer än mellanskillnaden (restskulden) (10 § avbetalningsköplagen).'),
    p('9.6 Om köparen har haft rätt till avdrag för den ingående skatten på köpet, värderas fordonet vid avräkningen exklusive mervärdesskatt, och köparen utfärdar ingen faktura för återtagandet. I annat fall värderas fordonet inklusive mervärdesskatt. Parterna lämnar varandra de uppgifter som behövs för redovisningen av mervärdesskatt.'),
    p('9.7 Säljaren får inte på egen hand ta fordonet i besittning mot köparens vilja. Lämnar köparen inte ut fordonet frivilligt, ansöker säljaren om handräckning hos Kronofogdemyndigheten (11 och 12 §§ avbetalningsköplagen). Vid handräckning värderar Kronofogdemyndigheten fordonet (15 § samma lag).'),
    p('9.8 Om köpet upphör genom att säljaren återtar fordonet eller genom att parterna kommer överens om att köpet ska gå åter, registrerar säljaren utan dröjsmål i RAHTIS-tjänsten att köpet har upphört. Från registreringen upprättas inga fakturor på avbetalningar och skickas inga betalningspåminnelser via tjänsten. Registreringen ändrar inte parternas rättigheter och skyldigheter: avräkningen enligt punkt 9.5 görs mellan parterna, och om de inte kommer överens gäller punkt 9.7 och punkt 11.4. Säljaren anmäler det nya ägarförhållandet till Transportstyrelsen (5 kap. 4 § första stycket 3 förordningen (2019:383)).'),

    h('10. Uppgifter som delas i RAHTIS-tjänsten'),
    p('10.1 Parterna är överens om att säljaren under avtalstiden i RAHTIS-tjänsten får se fordonets mätarställning, uppgifter om service, fel, besiktningar och kontrollbesiktning, betalningsläget samt position inom de gränser som anges i punkt 8. Uppgifter om fordonets transportuppdrag och intäkter visas för säljaren endast som månadssammanställning och endast om köparen särskilt har godkänt det i tjänsten.'),
    p('10.2 Aivomaa Oy (RAHTIS) är inte part i detta avtal. Aivomaa Oy tillhandahåller endast beräkningen, avtalshandlingarna, fakturaunderlagen i säljarens namn och betalningspåminnelserna. Aivomaa Oy lämnar ingen kredit, ställer ingen säkerhet eller garanti, förmedlar eller driver inte in betalningar och ansvarar inte för parternas förpliktelser. Aivomaa Oy behandlar personuppgifter för parternas räkning enligt tjänstens användarvillkor och personuppgiftsbiträdesavtalet.'),

    h('11. Övriga villkor'),
    p('11.1 Säljaren får överlåta detta avtal med alla rättigheter och skyldigheter, inklusive förbehållet om återtaganderätt, till ett kreditinstitut eller finansbolag. Köparen underrättas skriftligen om överlåtelsen och kan därefter med befriande verkan betala endast till förvärvaren. Säljaren anmäler överlåtelsen av förbehållet till Transportstyrelsen.'),
    p('11.2 Meddelanden enligt detta avtal lämnas skriftligen till de e-postadresser som anges i punkt 1. Ett meddelande anses ha kommit mottagaren till handa vardagen efter avsändandet.'),
    p('11.3 På avtalet tillämpas avbetalningsköplagen och i övrigt svensk rätt. Villkor i detta avtal som inskränker köparens befogenheter eller förmåner enligt avbetalningsköplagen ska inte tillämpas (3 § samma lag).'),
    p('11.4 Tvister avgörs av allmän domstol med tingsrätten på säljarens hemort som första instans. Detta inskränker inte säljarens rätt att ansöka om handräckning hos Kronofogdemyndigheten.'),
    p('11.5 Ändringar av och tillägg till avtalet ska göras skriftligen.'),
    p('11.6 Avtalet undertecknas före utlämnandet av fordonet, antingen för hand i två likalydande exemplar, av vilka parterna tar var sitt, eller av båda parter med avancerad eller kvalificerad elektronisk underskrift enligt förordning (EU) nr 910/2014, varvid vardera parten får den undertecknade elektroniska handlingen.'),

    h('12. Underskrifter'),
    p(`Ort och datum: ${LONG_BLANK}`),
    { kind: 'sign', left: [`Säljare: ${d.seller.name}`, 'Namnförtydligande, befattning'], right: [`Köpare: ${d.buyer.name}`, 'Namnförtydligande, befattning'] },
    p('Bilagor: 1. Betalningsplan · 2. Överlämnandeprotokoll · 3. Första fakturan · 4. Serviceavtal · 5. Information till förare om behandling av personuppgifter'),
  ];

  const annexes: ContractBlock[] = [
    { kind: 'annex', text: 'Bilaga 1. Betalningsplan' },
    { kind: 'meta', text: `Avtal nr ${d.number} · Kreditbelopp ${bareKr(d.price.rest)} kr · Ränta 0 % per år · Löptid ${n} månader` },
    {
      kind: 'table',
      head: ['Nr', 'Förfallodag', 'Avbetalning, kr', 'Ränta, kr', 'Att betala, kr', 'Återstående kreditbelopp, kr'],
      rows: [
        ['Kontantinsats', 'före utlämnandet', bareKr(d.price.downGross), '–', bareKr(d.price.downGross), bareKr(d.price.rest)],
        ...d.plan.map((r) => [String(r.n), r.due, bareKr(r.principal), bareKr(r.interest), bareKr(r.total), bareKr(r.balance)]),
      ],
      /* Итог — по взносам 1–N, как в шаблоне: сумма взносов равна kreditbelopp, к уплате — kreditfordran. */
      foot: ['Summa', '', bareKr(d.price.rest), bareKr(d.planTotals.interest), bareKr(d.price.creditClaim), ''],
    },
    p(`Kreditfordran (kreditbelopp och kreditkostnad): ${bareKr(d.price.creditClaim)} kr. En tiondel: ${bareKr(d.price.tenth)} kr. En tjugondel: ${bareKr(d.price.twentieth)} kr.`),

    { kind: 'annex', text: 'Bilaga 2. Överlämnandeprotokoll' },
    { kind: 'meta', text: `Avtal nr ${d.number} · Fordon ${d.vehicle.make} · Registreringsnummer ${d.vehicle.plate} · VIN ${BLANK}` },
    kv('Tidpunkt och plats för utlämnandet', `________-____-____ kl. ____.____, ${BLANK}`),
    kv('Mätarställning', `${BLANK} km`),
    kv('Antal nycklar', BLANK),
    kv('Överlämnade handlingar', LONG_BLANK),
    kv('Extrautrustning', LONG_BLANK),
    kv('Däck (mönsterdjup, skick)', LONG_BLANK),
    kv('Konstaterade skador och fel', LONG_BLANK),
    kv('Fotografier (antal, hänvisning)', LONG_BLANK),
    p(`”Fordonet lämnades ut till köparen ________-____-____ kl. ____.____ efter det att avtal om avbetalningsköp nr ${d.number} hade undertecknats och den första fakturan nr ${invoiceNo} hade betalats.”`),
    { kind: 'sign', left: ['Säljare'], right: ['Köpare'] },
  ];

  return {
    title: `Avtal om avbetalningsköp ${d.number}`,
    author: d.seller.name,
    footer: `Avtal om avbetalningsköp ${d.number} · upprättat i tjänsten RAHTIS; Aivomaa Oy är inte part i avtalet`,
    pages: [main, annexes],
  };
}
