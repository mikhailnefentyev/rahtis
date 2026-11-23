/**
 * Договор Дании: «Købekontrakt med ejendomsforbehold (kreditkøb mellem
 * erhvervsdrivende)» (23.11.2026).
 *
 * Текст — шаблон docs/equipment-sale/countries/dk.md, раздел 5 (черновик,
 * датским юристом не проверен — об этом сторонам сказано в кабинете).
 * Юридический текст перенесён дословно; подставлены только данные сделки.
 * Чего в RAHTIS нет (VIN, год, номер разрешения, контактное лицо, страховые
 * условия, сумма сбора за tinglysning), — строки для заполнения от руки; где
 * шаблон даёт выбор (кто платит сбор, кто страхует, сервисный договор), —
 * варианты с отметкой «( )».
 *
 * Чем договор отличается от финского (dk.md, раздел 4):
 *   · оговорка о собственности регистрируется в bilbogen ДО передачи
 *     (п. 3.2 и 5.2): без tinglysning она не действует против кредиторов
 *     покупателя и добросовестного приобретателя;
 *   · порог п. 9.1 — 30 дней и 1/10 (1/20) всей суммы к уплате, включая
 *     первый взнос и проценты (kreditaftaleloven § 29). Те же числа считает
 *     rules.ts (DK_KAL);
 *   · изъятие — только через fogedretten (п. 9.5), у покупателя 14 дней на
 *     выкуп (п. 9.8);
 *   · проценты — отдельно, с суммой в каждом платеже (приложение 1 и счета):
 *     только так они вне базы НДС (momsloven § 27, stk. 3, nr. 4).
 *
 * Только обычный НДС: кабинет других режимов не создаёт, варианты B–D п. 4.2
 * в исследовании не подтверждены. Необязательная фраза п. 4.6 о компенсации
 * продавцу при досрочном погашении не включена: как считать «прямые расходы»
 * продавца, в исследовании не выяснено (открытый вопрос 8), а без неё
 * покупателю не хуже.
 *
 * Кто записан ejer в Køretøjsregisteret, исследование не подтвердило
 * (открытый вопрос 1): п. 5.3 оставлен как в шаблоне (продавец — ejer,
 * покупатель — bruger), а кабинет говорит сторонам, что это надо проверить.
 *
 * Приложение 2 в шаблоне описано одной строкой (пробег, недостатки,
 * принадлежности и надпись о передаче): строки акта составлены здесь по
 * этому перечню и по условиям передачи п. 3.2, надпись — дословно.
 */
import type { ContractPdfInput } from '../ContractPdf.tsx';
import { bareKr, BLANK, h, kv, li, LONG_BLANK, p, sub, type ContractBlock, type ContractDocument } from './blocks.ts';

const yesNo = (value: boolean) => (value ? 'ja' : 'nej');

function party(label: string, x: ContractPdfInput['seller'], extra?: string): string[] {
  return [
    label,
    x.name,
    `CVR-nr.: ${x.businessId}`,
    `Adresse: ${x.address || LONG_BLANK}`,
    `Momsregistreret: ${yesNo(x.vatRegistered)}`,
    ...(extra ? [extra] : []),
    `Kontaktperson: ${LONG_BLANK}`,
    `Telefon: ${x.phone || BLANK} · E-mail: ${x.email || BLANK}`,
  ];
}

export function dkContractText(d: ContractPdfInput): ContractDocument {
  const n = d.months;
  const first = d.plan[0];
  const last = d.plan[d.plan.length - 1];
  const regular = d.plan.slice(0, -1);
  const equal = regular.every((x) => x.principal === first.principal);
  const invoiceNo = d.firstInvoiceNumber ?? BLANK;
  const interestTotal = d.price.interestTotal ? bareKr(d.price.interestTotal) : null;

  /* 4.3: равные взносы — суммой, как в шаблоне; если расходятся на эре, — отсылка к графику. */
  const regularLine =
    regular.length === 0
      ? null
      : regular.length === 1
        ? `Afdrag 1: ${bareKr(first.principal)} kr., forfalder ${first.due}.`
        : equal
          ? `Afdrag 1–${n - 1}: hver ${bareKr(first.principal)} kr., forfalder den ${d.dueDay}. i hver måned, første gang ${first.due}.`
          : `Afdrag 1–${n - 1}: efter betalingsplanen (bilag 1), forfalder den ${d.dueDay}. i hver måned, første gang ${first.due}.`;

  const main: ContractBlock[] = [
    { kind: 'title', text: 'KØBEKONTRAKT MED EJENDOMSFORBEHOLD' },
    { kind: 'meta', text: '(kreditkøb mellem erhvervsdrivende)' },
    { kind: 'notice', text: 'SÆLGER FORBEHOLDER SIG EJENDOMSRETTEN TIL DET SOLGTE, INDTIL HELE KØBESUMMEN MED RENTER OG OMKOSTNINGER ER BETALT.' },
    { kind: 'meta', text: `Kontrakt nr. ${d.number} · Dato ${d.date}` },

    h('1. Parterne'),
    {
      kind: 'parties',
      left: party('Sælger', d.seller),
      right: party('Køber', d.buyer, `Tilladelse til godskørsel for fremmed regning nr.: ${BLANK}`),
    },
    p('Sælger er kreditgiver.'),
    p('Køber erklærer at indgå købet som led i sit erhverv og til brug i egen virksomhed. Køber erklærer, at køretøjet ikke købes med henblik på videresalg.'),

    h('2. Købsgenstanden'),
    kv('Køretøj', d.vehicle.make),
    kv('Registreringsnummer', d.vehicle.plate),
    kv('Stelnummer (VIN)', LONG_BLANK),
    kv('Første registreringsår', '__________'),
    kv('Kilometerstand ved kontraktens indgåelse', d.vehicle.odometer),
    kv('Ekstraudstyr', `intet ekstraudstyr / ${LONG_BLANK}`),
    kv('Tinglyste hæftelser i bilbogen', `( ) ingen  ( ) oplysninger: ${BLANK}`),
    p('2.1 Sælger indestår for, at sælger ejer køretøjet og ekstraudstyret, at der ikke påhviler dem ejendomsforbehold, pant, udlæg eller anden rettighed for tredjemand ud over det ovenfor anførte, og at sælger er berettiget til at sælge køretøjet på vilkårene i denne kontrakt. Sælger udleverer inden underskrivelsen en aktuel udskrift fra bilbogen og oplysning om køretøjets registreringsforhold i Køretøjsregisteret.'),
    p('2.2 Køretøjet sælges i den stand, som er beskrevet i overdragelsesprotokollen (bilag 2). Køber skal reklamere skriftligt over for sælger inden rimelig tid efter, at køber har eller burde have opdaget en mangel.'),

    h('3. Levering'),
    p(`3.1 Leveringsmåde: ( ) afhentning hos sælger  ( ) sælger leverer til adressen ${BLANK}. Leveringsdato: ${d.handover}.`),
    p('3.2 Køretøjet overgives først til køber, når'),
    li('1. denne kontrakt er underskrevet af begge parter, og køber har modtaget en genpart;'),
    li('2. den første faktura (punkt 4.2) er betalt til sælgers konto;'),
    li('3. ejendomsforbeholdet er anmeldt til tinglysning i bilbogen (punkt 5.2);'),
    li('4. køber er registreret som bruger af køretøjet i Køretøjsregisteret, og købers tilladelse til godskørsel er registreret på køretøjet;'),
    li('5. der er tegnet ansvarsforsikring efter punkt 7.1 med virkning fra overgivelsen, og bekræftelsen efter punkt 7.2 er modtaget.'),
    p('3.3 Ved overgivelsen gennemgår parterne køretøjet og underskriver overdragelsesprotokollen (bilag 2) med angivelse af tidspunktet for overgivelsen. Risikoen for køretøjet overgår til køber ved overgivelsen.'),

    h('4. Pris og betaling'),
    sub('4.1 Pris (kr.)'),
    kv('Køretøjets kontantpris (ekskl. moms)', bareKr(d.price.net)),
    kv('Ekstraudstyr, specificeret og prissat (ekskl. moms)', '–'),
    kv(`Moms ${d.vatPercent} % af ${bareKr(d.price.net)}`, bareKr(d.price.vat)),
    kv('Kontantpris i alt (inkl. moms)', bareKr(d.price.gross), true),
    kv('Udbetaling, betales før overgivelsen (indeholder momsen af hele købesummen)', bareKr(d.price.downGross)),
    kv('Restkøbesum (kreditbeløb, uden moms)', bareKr(d.price.rest)),
    kv('Kreditomkostninger: rente efter punkt 4.4 ved betaling efter betalingsplanen', interestTotal ?? 'ingen rente'),
    kv(`Samlet beløb, der skal betales (udbetaling, afdrag 1–${n} og rente)`, bareKr(d.price.totalPayable), true),

    sub('4.2 Første faktura og moms'),
    p('Sælger fakturerer med den første faktura udbetalingen, som indeholder momsen af hele købesummen. Fakturaen forfalder før overgivelsen. Salget er et salg på kredit med ejendomsforbehold, og levering anses for sket ved den faktiske overgivelse (momslovens § 4, stk. 3, nr. 2, og § 23).'),

    sub('4.3 Afdrag'),
    p(`Kredittid ${n} måneder. Antal afdrag ${n}.`),
    ...(regularLine ? [p(regularLine)] : []),
    p(`Sidste afdrag ${n}: ${bareKr(last.principal)} kr., forfalder ${last.due}.`),
    p(`Afdragene indeholder ikke moms, da momsen af hele købesummen er faktureret med første faktura nr. ${invoiceNo}.`),
    p('Betalingsplan: bilag 1. Betalingsplanen er udtrykkeligt godkendt af sælger (rentelovens § 3 c).'),

    sub('4.4 Rente'),
    p(
      d.ratePercent
        ? `Restkøbesummen forrentes fra overgivelsesdagen med en fast årlig rente på ${d.ratePercent} procent. Renten beregnes af den til enhver tid skyldige del af købesummen efter faktiske dage (faktiske dage / 365) og betales særskilt sammen med hvert afdrag. Rentebeløbet for hver enkelt betaling fremgår af betalingsplanen (bilag 1) og af fakturaerne. Ved betaling efter betalingsplanen udgør renten i alt ${interestTotal ?? ''} kr. Renten indgår ikke i momsgrundlaget (momslovens § 27, stk. 3, nr. 4).`
        : 'Restkøbesummen forrentes ikke.',
    ),
    p('Sælger opkræver ikke andre kreditomkostninger end dem, der er aftalt i denne kontrakt.'),

    sub('4.5 Morarente'),
    p('Af forfaldne beløb betales fra forfaldsdagen morarente efter rentelovens § 5, det vil sige Nationalbankens officielle udlånsrente pr. henholdsvis 1. januar og 1. juli det pågældende år med et tillæg på 8 procentpoint. Er renten efter punkt 4.4 højere, betales denne rente også efter forfaldsdagen.'),

    sub('4.6 Førtidig indfrielse'),
    p('Køber kan til enhver tid indfri restgælden helt eller delvist. Der betales ikke rente for den ubenyttede del af kredittiden (kreditaftalelovens § 26 og § 28, stk. 2, jf. § 49).'),

    sub('4.7 Øvrige beløb'),
    p(`For rykkerskrivelser betaler køber et rykkergebyr på 100 kr. pr. skrivelse, dog højst for tre skrivelser vedrørende samme ydelse og med mindst 10 dages mellemrum (rentelovens § 9 b). Sælger kan desuden kræve det til enhver tid fastsatte kompensationsbeløb efter rentelovens § 9 a, stk. 3, rimelige og relevante omkostninger ved udenretlig inddrivelse efter rentelovens § 9 a, stk. 1, og nødvendige omkostninger ved tilbagetagelse efter kreditaftalelovens § 38, nr. 3. Tinglysningsafgiften for ejendomsforbeholdet, ${BLANK} kr., og gebyrer for registrering i Køretøjsregisteret betales af ( ) køber  ( ) sælger. Andre beløb opkræves ikke.`),

    sub('4.8 Afskrivning af betalinger'),
    p('Købers betalinger anvendes alene til dækning af krav efter denne kontrakt: først forfaldne omkostninger og renter, derefter afdrag med det ældste først.'),

    h('5. Ejendomsforbehold, registrering og brug'),
    p('5.1 Sælger forbeholder sig ejendomsretten til køretøjet og ekstraudstyret, indtil det samlede beløb efter punkt 4.1 samt renter og omkostninger, som sælger kan medregne efter kreditaftalelovens § 38, er betalt fuldt ud. Sælger kan tage køretøjet tilbage, hvis køber ikke opfylder sine forpligtelser, jf. punkt 9. Ejendomsforbeholdet sikrer ikke krav, der ikke udspringer af denne kontrakt (kreditaftalelovens § 34, stk. 3).'),
    p('5.2 Ejendomsforbeholdet anmeldes af sælger til tinglysning i bilbogen før overgivelsen (tinglysningslovens § 42 d). Køber medvirker straks til tinglysningen, herunder ved digital underskrift, hvis det kræves. Sælger sørger for fornyet tinglysning inden 10 år efter tinglysningen, hvis kontrakten da fortsat løber (tinglysningslovens § 42 g, stk. 2).'),
    p('5.3 Sælger forbliver registreret som ejer i Køretøjsregisteret, og køber registreres som bruger senest ved overgivelsen (bekendtgørelse om registrering af køretøjer §§ 42 og 62). Køber sørger for, at købers tilladelse til godskørsel for fremmed regning er registreret på køretøjet, og at køretøjet er mærket efter reglerne i bekendtgørelse om godskørsel, før det anvendes til godskørsel for fremmed regning. Køber har den fulde rådighed over køretøjet og bærer alle afgifter, der vedrører køretøjet i kontraktperioden.'),
    p('5.4 Når alle beløb efter punkt 5.1 er betalt, overgår ejendomsretten til køber den dag, hvor den sidste betaling er indgået på sælgers konto. Sælger anmelder uden ophold aflysning af ejendomsforbeholdet i bilbogen, og køber anmelder sig som ejer i Køretøjsregisteret senest 4 hverdage efter ejerskiftet. Sælger medvirker hertil.'),
    p('5.5 Indtil ejendomsretten er overgået, må køber ikke uden sælgers skriftlige samtykke'),
    li('1. sælge, bytte eller bortgive køretøjet;'),
    li('2. pantsætte køretøjet eller i øvrigt stifte rettigheder over det;'),
    li('3. udleje, udlåne eller på anden måde overlade køretøjet til tredjemands besiddelse eller brug;'),
    li('4. registrere køretøjet i et andet land;'),
    li('5. foretage ændringer, der kræver ny godkendelse eller syn af køretøjet;'),
    li('6. sammenføje køretøjet eller ekstraudstyret med andre ting eller afmontere ekstraudstyr med henblik på overdragelse.'),
    p('Det anses ikke som overladelse efter nr. 3, at køretøjet i købers egen virksomhed føres af chauffører, der er ansat hos køber eller lovligt lejet af køber.'),
    p('Foretages der udlæg eller anden retsforfølgning i køretøjet, eller tages køber under konkurs eller rekonstruktionsbehandling, skal køber straks oplyse om sælgers ejendomsforbehold og underrette sælger.'),
    p('5.6 Køber må anvende køretøjet i sin egen virksomhed inden for kontraktområdet, som er EØS-landene og Schweiz. Brug uden for kontraktområdet kræver sælgers forudgående skriftlige samtykke.'),

    h('6. Vedligeholdelse og syn'),
    p(`6.1 Service er ikke indeholdt i købesummen. ( ) Parterne indgår en særskilt serviceaftale (bilag 4), hvorefter sælger udfører service på køretøjet to gange om året. Servicen omfatter skift af motor- og gearolie og filtre samt udlæsning af fejlkoder. Prisen er ${BLANK} kr. (ekskl. moms) pr. gang og faktureres med moms efter udførelsen.`),
    p('6.2 Køber afholder alle øvrige udgifter til køretøjets drift og vedligeholdelse, herunder reparationer, dæk, ruder, bremser, brændstof, AdBlue og vask.'),
    p('6.3 Køber skal holde køretøjet i god stand, anvende det efter dets bestemmelse og uden ophold underrette sælger om skader og fejl, der kan forringe køretøjets værdi væsentligt.'),
    p('6.4 Køber sørger for rettidigt periodisk syn af køretøjet og sender synsrapporten til sælger via RAHTIS eller på anden skriftlig måde.'),
    p('6.5 Sælgers ret til eftersyn: sælger kan efter forudgående aftale om tidspunktet besigtige køretøjet hver ( ) anden  ( ) tredje måned på købers forretningssted. Der udarbejdes et notat om besigtigelsen.'),

    h('7. Forsikring'),
    p(`7.1 Køretøjet skal i hele kontraktperioden være dækket af lovpligtig ansvarsforsikring (færdselslovens §§ 105 og 106). Forsikringen tegnes og betales af ( ) køber  ( ) sælger. Hvis sælger: Køber refunderer sælger præmien ${BLANK} særskilt sammen med hvert afdrag.`),
    p(`7.2 Køber tegner og betaler kaskoforsikring for køretøjet, som mindst dækker kollision, brand, tyveri og hærværk, med en selvrisiko på højst ${BLANK} kr. Sælgers ejendomsforbehold noteres hos forsikringsselskabet ved panthaverdeklaration eller tilsvarende. Køber afleverer før overgivelsen forsikringsselskabets skriftlige bekræftelse på, at sælgers ret er noteret, og at selskabet underretter sælger, hvis forsikringen ophører.`),
    p('7.3 Går køretøjet til grunde eller bortkommer det, består købers betalingspligt fortsat. Forsikringserstatning, der udbetales til sælger, afskrives på købers gæld som førtidig indfrielse efter punkt 4.6 og anvendes alene til dækning af krav efter denne kontrakt. Et overskydende beløb udbetales uden ophold til køber.'),

    h('8. Positionsbestemmelse'),
    p('8.1 Køretøjet er i kontraktperioden forsynet med en sporingsenhed, som sælger har monteret eller godkendt. Køber må ikke fjerne enheden eller hindre dens funktion.'),
    p('8.2 Sælger ser alene kilometerstanden og oplysning om, hvorvidt køretøjet befinder sig inden for kontraktområdet (punkt 5.6). Den nøjagtige position vises kun for sælger, hvis'),
    li('1. tyveri af køretøjet er anmeldt til politiet;'),
    li('2. køretøjet har befundet sig uden for kontraktområdet i mere end 24 timer uden sælgers samtykke; eller'),
    li('3. betingelserne for tilbagetagelse efter punkt 9.1 er opfyldt, eller kontrakten er ophævet.'),
    p('8.3 Sælger er dataansvarlig for positionsoplysningerne. Oplysningerne behandles for at beskytte sælgers ejendomsret, og behandlingen sker på grundlag af sælgers legitime interesse (databeskyttelsesforordningen (EU) 2016/679, artikel 6, stk. 1, litra f). Sælger anvender ikke positionsoplysningerne til kontrol af chaufførernes arbejdstid, kørestil eller arbejdsindsats i øvrigt. Hvert opslag på den nøjagtige position og grundlaget herfor logges, og køber underrettes senest 3 dage efter, medmindre underretningen kan skade efterforskningen af en forbrydelse. Nøjagtige positionsoplysninger slettes efter 30 dage eller, hvis de er åbnet efter punkt 8.2, når sagen er afsluttet.'),
    p('8.4 Sælger udarbejder til chaufførerne oplysning efter databeskyttelsesforordningens artikel 14, og køber udleverer den til sine chauffører før overgivelsen. Køber er som arbejdsgiver ansvarlig for at iagttage de regler og aftaler om kontrolforanstaltninger, der gælder for købers ansatte.'),
    p('8.5 Køretøjet kan forsynes med fjernbetjent startspærre. Den må kun aktiveres, når køretøjet holder parkeret, og kun hvis (a) politiet anmoder om det eller samtykker efter anmeldelse af tyveri af køretøjet, eller (b) køber på det pågældende tidspunkt giver skriftligt samtykke. Startspærren anvendes ikke til inddrivelse af betalinger eller til tilbagetagelse af køretøjet; tilbagetagelse sker efter punkt 9.'),

    h('9. Misligholdelse og tilbagetagelse'),
    p(`9.1 Undlader køber at betale, kan sælger ikke af den grund forlange betaling af beløb, som ellers ikke ville være forfaldne, tage køretøjet tilbage eller gøre anden aftalt særlig retsvirkning gældende, medmindre køber er udeblevet med et beløb 30 dage efter dets forfaldstid, og det forfaldne beløb udgør mindst en tiendedel af det samlede beløb, der skal betales, inklusive udbetalingen, eller, hvis der i det forfaldne beløb indgår flere afdrag, mindst en tyvendedel af dette beløb, eller udgør hele restfordringen (kreditaftalelovens § 29, jf. § 49). En tiendedel af det samlede beløb efter denne kontrakt er ${bareKr(d.price.tenth)} kr., og en tyvendedel er ${bareKr(d.price.twentieth)} kr.`),
    p('9.2 Er betingelserne i punkt 9.1 opfyldt, kan sælger ved skriftlig meddelelse forlange hele restgælden betalt straks. Sælgers krav opgøres da efter kreditaftalelovens § 28, og der betales ikke rente for den ubenyttede del af kredittiden.'),
    p('9.3 Betaler køber, inden køretøjet er taget tilbage, det beløb, som ikke blev betalt i rette tid, med tillæg af renter og sælgers omkostninger, kan sælger ikke tage køretøjet tilbage eller forlange restgælden betalt straks, medmindre dette på grund af særlige omstændigheder ved misligholdelsen må anses for påkrævet (kreditaftalelovens § 37).'),
    p('9.4 Sælger kan endvidere hæve købet og tage køretøjet tilbage, hvis køber væsentligt misligholder en af følgende forpligtelser og ikke afhjælper forholdet inden 14 dage efter sælgers skriftlige påkrav, medmindre forholdet efter sin art ikke kan afhjælpes:'),
    li('1. forbuddene i punkt 5.5;'),
    li('2. forpligtelserne vedrørende tinglysning, registrering og godskørselstilladelse i punkt 5.2 og 5.3;'),
    li('3. pligten til at opretholde forsikringerne efter punkt 7.1 og 7.2, uanset af hvilken grund forsikringen er ophørt eller ikke længere dækker køretøjet;'),
    li('4. periodisk syn (punkt 6.4);'),
    li('5. forbuddet mod at fjerne sporingsenheden eller hindre dens funktion (punkt 8.1).'),
    p('9.5 Tilbagetagelse sker ved fogedrettens hjælp på grundlag af denne kontrakt (kreditaftalelovens §§ 36, 45 og 52), medmindre køber på tidspunktet for tilbageleveringen frivilligt udleverer køretøjet. Sælger tager ikke køretøjet tilbage uden fogedrettens medvirken mod købers vilje.'),
    p('9.6 Ved tilbagetagelse opgøres parternes mellemværende. Sælger kan kun medregne den ubetalte del af fordringen med fradrag efter kreditaftalelovens § 28, rente af forfaldne ydelser og nødvendige omkostninger ved tilbagetagelsen, herunder inkassoomkostninger (§ 38). Køretøjets værdi ved tilbagetagelsen indgår til fordel for køber; værdien er det beløb, som sælger kan opnå ved at sælge køretøjet på hensigtsmæssig måde, eventuelt efter en rimelig istandsættelse (§ 39). Overstiger værdien sælgers tilgodehavende, kan sælger kun tage køretøjet tilbage, hvis det overskydende beløb samtidig betales til køber (§ 40). Er værdien mindre end sælgers tilgodehavende, har sælger krav på betaling af forskellen (§ 51, stk. 3). Kan parterne ikke enes om værdien, ansættes den af fogedretten (§ 47).'),
    p('9.7 Den momsmæssige behandling af opgørelsen følger momsloven og Skatteforvaltningens praksis på tilbagetagelsestidspunktet. Parterne udsteder de fakturaer og kreditnotaer, som herefter kræves, og køretøjets værdi godskrives køber med eller uden moms i overensstemmelse hermed.'),
    p('9.8 Har sælger fået køretøjet tilbage, kan køber i 14 dage derefter indløse det mod at betale sælgers tilgodehavende opgjort efter kreditaftalelovens § 38 (§ 43).'),
    p('9.9 Ophører købet ved, at sælger tager køretøjet tilbage, eller ved parternes aftale, registrerer sælger uden ophold købets ophør i RAHTIS. Fra registreringen udstedes der ikke længere afdragsfakturaer eller rykkere gennem tjenesten. Registreringen ændrer ikke parternes rettigheder og forpligtelser; opgørelsen efter punkt 9.6 foretages mellem parterne og, hvis de ikke kan enes, af fogedretten.'),

    h('10. Deling af oplysninger i RAHTIS'),
    p('10.1 Parterne aftaler, at sælger i kontraktperioden i RAHTIS får vist køretøjets kilometerstand, oplysninger om service, fejl, besigtigelser og syn, betalingsstatus samt position inden for rammerne af punkt 8. Oplysninger om køretøjets transportopgaver og indtjening vises kun for sælger som månedlig sammentælling og kun, hvis køber særskilt har godkendt det i tjenesten.'),
    p('10.2 Aivomaa Oy (RAHTIS) er ikke part i denne kontrakt. Aivomaa Oy stiller alene beregning, dokumenter, fakturagrundlag og påmindelser til rådighed for parterne og yder ikke kredit eller finansiering, stiller ingen garanti, formidler eller modtager ikke betalinger, foretager ikke inddrivelse og hæfter ikke for parternes forpligtelser. Aivomaa Oy behandler personoplysninger på parternes vegne efter tjenestens vilkår og databehandleraftalen.'),

    h('11. Øvrige vilkår'),
    p('11.1 Sælger kan overdrage sine rettigheder efter denne kontrakt, herunder ejendomsforbeholdet, til et finansieringsselskab. Køber underrettes skriftligt, bevarer over for erhververen enhver indsigelse efter kontrakten og kan efter underretningen kun betale med frigørende virkning til erhververen. Overdragelsen af ejendomsforbeholdet tinglyses i bilbogen (tinglysningslovens § 42 d, stk. 7).'),
    p('11.2 Meddelelser efter denne kontrakt gives skriftligt til de e-mailadresser, der er anført i punkt 1. En meddelelse anses for kommet frem den første hverdag efter afsendelsen.'),
    p('11.3 Kontrakten er undergivet dansk ret, herunder lov om kreditaftaler kapitel 10 og 11. Kontraktens vilkår kan ikke påberåbes i det omfang, de stiller køber ringere end kreditaftalelovens ufravigelige regler (§ 7, stk. 2).'),
    p('11.4 Tvister afgøres af byretten ved sælgers hjemting. Dette begrænser ikke adgangen til tilbagetagelse ved fogedretten efter kreditaftalelovens § 52.'),
    p('11.5 Ændringer af kontrakten skal aftales skriftligt.'),
    p('11.6 Kontrakten underskrives før overgivelsen af køretøjet enten i hånden i to enslydende eksemplarer, hvoraf hver part modtager ét, eller digitalt af begge parter med kvalificeret elektronisk signatur, således at hver part modtager det underskrevne elektroniske dokument. Køber bekræfter ved sin underskrift at have modtaget en genpart af kontrakten.'),

    h('12. Underskrifter'),
    p(`Sted og dato: ${LONG_BLANK}`),
    { kind: 'sign', left: [`Sælger: ${d.seller.name}`, 'Navn, stilling'], right: [`Køber: ${d.buyer.name}`, 'Navn, stilling'] },
    p('Bilag: 1. Betalingsplan (med angivelse af afdrag og rentebeløb for hver betaling) · 2. Overdragelsesprotokol · 3. Første faktura · 4. Serviceaftale · 5. Oplysning til chauffører om behandling af positionsoplysninger'),
  ];

  const annexes: ContractBlock[] = [
    { kind: 'annex', text: 'Bilag 1. Betalingsplan' },
    {
      kind: 'meta',
      text: `Kontrakt nr. ${d.number} · Restkøbesum ${bareKr(d.price.rest)} kr. · Rente ${d.ratePercent ?? '0'} % om året · Kredittid ${n} måneder`,
    },
    {
      kind: 'table',
      head: ['Nr.', 'Forfaldsdag', 'Afdrag, kr.', 'Rente, kr.', 'Ydelse i alt, kr.', 'Restkøbesum efter betaling, kr.'],
      rows: [
        ['Udbetaling', 'før overgivelsen', bareKr(d.price.downGross), '–', bareKr(d.price.downGross), bareKr(d.price.rest)],
        ...d.plan.map((r) => [String(r.n), r.due, bareKr(r.principal), bareKr(r.interest), bareKr(r.total), bareKr(r.balance)]),
      ],
      /* Итог — всё, что платит покупатель: первый взнос, взносы и проценты, то есть «samlet beløb» п. 4.1. */
      foot: ['I alt', '', bareKr(d.price.gross), bareKr(d.planTotals.interest), bareKr(d.price.totalPayable), ''],
    },
    p(`Samlet beløb, der skal betales (punkt 4.1): ${bareKr(d.price.totalPayable)} kr. En tiendedel: ${bareKr(d.price.tenth)} kr. En tyvendedel: ${bareKr(d.price.twentieth)} kr.`),

    { kind: 'annex', text: 'Bilag 2. Overdragelsesprotokol' },
    { kind: 'meta', text: `Kontrakt nr. ${d.number} · Sælger ${d.seller.name} · Køber ${d.buyer.name}` },
    kv('Køretøj, registreringsnummer, stelnummer (VIN)', `${d.vehicle.make}, ${d.vehicle.plate}, ${BLANK}`),
    kv('Sted og tidspunkt for overgivelsen', `${BLANK}, ____.____.________ kl. ____.____`),
    kv('Kilometerstand', `${BLANK} km`),
    kv('Udleverede nøgler, dokumenter og tilbehør', LONG_BLANK),
    kv('Mangler og skader (fotos vedlagt)', LONG_BLANK),
    kv('Ejendomsforbeholdet anmeldt til tinglysning i bilbogen (dato)', `( ) ja, ____.____.________  ( ) nej`),
    kv('Køber registreret som bruger i Køretøjsregisteret', '( ) ja  ( ) nej'),
    kv('Ansvarsforsikring og kaskoforsikring i kraft', '( ) ja  ( ) nej'),
    p(`»Køretøjet blev overgivet til køber ____.____.________ kl. ____.____, efter at købekontrakt nr. ${d.number} var underskrevet, og ejendomsforbeholdet var anmeldt til tinglysning.«`),
    { kind: 'sign', left: ['Sælger'], right: ['Køber'] },
  ];

  return {
    title: `Købekontrakt med ejendomsforbehold ${d.number}`,
    author: d.seller.name,
    footer: `Købekontrakt ${d.number} · udarbejdet i tjenesten RAHTIS; Aivomaa Oy er ikke part i kontrakten`,
    pages: [main, annexes],
  };
}
