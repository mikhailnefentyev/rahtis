/**
 * Договор Эстонии: «Veoki järelmaksuga müügi leping (omandireservatsiooniga)»
 * (23.11.2026).
 *
 * Текст — шаблон docs/equipment-sale/countries/ee.md, раздел 5, версия 0.1
 * (черновик, эстонским юристом не проверен — об этом сторонам сказано в
 * кабинете). Юридический текст перенесён дословно; подставлены только данные
 * сделки. Чего в RAHTIS нет (VIN, год, KMKR, номер лицензии, контактное
 * лицо, страховые условия), — строки для заполнения от руки; где шаблон
 * даёт выбор, — оба варианта с отметкой «( )», как в финском договоре.
 *
 * Только обычный НДС: кабинет других режимов не создаёт (решение
 * 22.11.2026), а варианты B–D шаблона (маржа, § 16 lg 2 p 9) в исследовании
 * не подтверждены до конца. Сделка с другим режимом договора не получает
 * (contractTemplates.ts).
 *
 * Пороги п. 9.1 — договорные (в эстонском законе их нет): 14 дней и 1/10
 * либо 1/20 цены; затем дополнительный срок не короче 14 дней и отказ от
 * договора. Те же числа считает rules.ts (EE_VOS).
 */
import type { ContractPdfInput } from '../ContractPdf.tsx';
import { bare, BLANK, h, kv, li, LONG_BLANK, p, sub, type ContractBlock, type ContractDocument } from './blocks.ts';

const yesNo = (value: boolean) => (value ? 'jah' : 'ei');

function party(label: string, x: ContractPdfInput['seller'], extra?: string): string[] {
  return [
    label,
    x.name,
    `Registrikood: ${x.businessId}`,
    `Aadress: ${x.address || LONG_BLANK}`,
    `Käibemaksukohustuslane: ${yesNo(x.vatRegistered)}`,
    `KMKR number: ${BLANK}`,
    ...(extra ? [extra] : []),
    `Kontaktisik: ${LONG_BLANK}`,
    `Telefon: ${x.phone || BLANK} · E-post: ${x.email || BLANK}`,
  ];
}

export function eeContractText(d: ContractPdfInput): ContractDocument {
  const n = d.months;
  const first = d.plan[0];
  const last = d.plan[d.plan.length - 1];
  const regular = d.plan.slice(0, -1);
  const equal = regular.every((x) => x.principal === first.principal);
  const invoiceNo = d.firstInvoiceNumber ?? BLANK;

  /* 4.3: равные взносы — суммой, как в шаблоне; если взносы расходятся на цент, — отсылка к графику. */
  const regularLine =
    regular.length === 0
      ? null
      : regular.length === 1
        ? `Osamakse 1: ${bare(first.principal)} eurot, maksetähtpäev ${first.due}.`
        : equal
          ? `Osamaksed 1–${n - 1}: igaüks ${bare(first.principal)} eurot, maksetähtpäev iga kuu ${d.dueDay}. kuupäev, esimene ${first.due}.`
          : `Osamaksed 1–${n - 1}: maksegraafiku (lisa 1) kohaselt, maksetähtpäev iga kuu ${d.dueDay}. kuupäev, esimene ${first.due}.`;

  const main: ContractBlock[] = [
    { kind: 'title', text: 'VEOKI JÄRELMAKSUGA MÜÜGI LEPING (OMANDIRESERVATSIOONIGA)' },
    { kind: 'notice', text: 'MÜÜGIESEME OMAND EI LÄHE OSTJALE ÜLE ENNE, KUI OSTUHIND ON TÄIELIKULT TASUTUD.' },
    { kind: 'meta', text: `Leping nr ${d.number} · Kuupäev ${d.date}` },

    h('1. Lepingupooled'),
    {
      kind: 'parties',
      left: party('Müüja', d.seller),
      right: party('Ostja', d.buyer, `Ühenduse tegevusluba nr: ${BLANK}`),
    },
    p('Ostuhinna tasumist ajatab müüja.'),
    p('Mõlemad pooled kinnitavad, et sõlmivad lepingu oma majandustegevuses (VÕS § 1 lg 6) ning et ostja ei ole tarbija.'),

    h('2. Müügiese'),
    kv('Sõiduk', d.vehicle.make),
    kv('Registreerimismärk', d.vehicle.plate),
    kv('Tehasetähis (VIN-kood)', LONG_BLANK),
    kv('Esmase registreerimise aasta', '__________'),
    kv('Läbisõidumõõdiku näit lepingu sõlmimisel', d.vehicle.odometer),
    kv('Lisavarustus', `lisavarustus puudub / ${LONG_BLANK}`),
    kv('Kehtivad koormatised (registerpant, keelumärge)', `( ) puuduvad  ( ) andmed: ${BLANK}`),
    p('2.1 Müüja kinnitab, et sõiduk ja selle lisavarustus kuuluvad talle, et need ei ole koormatud kolmanda isiku omandireservatsiooni, pandiõiguse, registerpandi, keelumärke ega muu õigusega, mida ei ole eespool nimetatud, ning et tal on õigus sõiduk käesoleva lepingu tingimustel müüa. Müüja esitab ostjale enne lepingu allkirjastamist liiklusregistri väljavõtte sõiduki kohta.'),
    p('2.2 Sõiduk müüakse seisukorras, mida on kirjeldatud üleandmise-vastuvõtmise aktis (lisa 2). Ostja vaatab sõiduki üleandmisel viivitamata üle (VÕS § 219) ning teatab lepingutingimustele mittevastavusest müüjale kirjalikku taasesitamist võimaldavas vormis mõistliku aja jooksul pärast seda, kui ta mittevastavusest teada sai või pidi teada saama, kirjeldades mittevastavust piisavalt täpselt (VÕS § 220).'),

    h('3. Üleandmine'),
    p(`3.1 Üleandmise viis: ( ) ostja tuleb sõidukile järele müüja juurde  ( ) müüja toimetab sõiduki aadressile ${BLANK}. Üleandmise aeg: ${d.handover}.`),
    p('3.2 Sõiduk antakse üle alles siis, kui'),
    li('1. käesolev leping on allkirjastatud;'),
    li('2. esimene arve (punkt 4.2) on laekunud müüja kontole;'),
    li('3. ostja on kantud liiklusregistrisse sõiduki vastutava kasutajana ja müüja on jätkuvalt kantud sõiduki omanikuna;'),
    li('4. sõidukile on sõlmitud punkti 7.1 kohane liikluskindlustuse leping, mis kehtib üleandmise päevast, ning punktis 7.2 nimetatud kinnitus on müüjale esitatud.'),
    p('3.3 Üleandmisel vaatavad pooled sõiduki üle ja allkirjastavad üleandmise-vastuvõtmise akti (lisa 2), kuhu märgitakse üleandmise aeg. Sõiduki juhusliku hävimise ja kahjustumise riisiko läheb ostjale üle sõiduki üleandmisega (VÕS § 214 lg 2).'),

    h('4. Hind ja tasumine'),
    sub('4.1 Hind (eurodes)'),
    kv('Sõiduki hind (käibemaksuta)', bare(d.price.net)),
    kv('Lisavarustus eraldi loetletuna ja hinnatuna (käibemaksuta)', '–'),
    kv(`Käibemaks ${d.vatPercent} % summalt ${bare(d.price.net)}`, bare(d.price.vat)),
    kv('Ostuhind kokku (koos käibemaksuga)', bare(d.price.gross), true),
    kv('Sissemakse, tasutakse enne üleandmist (sisaldab kogu ostuhinna käibemaksu)', bare(d.price.downGross)),
    kv('Ostuhinna jääk (käibemaksu ei sisalda)', bare(d.price.rest)),
    kv('Ajatamise kulu: eraldi tasutav intress (punkt 4.4)', d.price.interestTotal ? bare(d.price.interestTotal) : 'intressi ei arvestata'),
    kv(`Järelmaksuhind (sissemakse ja osamaksed 1–${n} kokku; ei sisalda eraldi tasutavat intressi)`, bare(d.price.installmentPrice), true),
    p('Käesolevas lepingus tähendavad ostuhind ja järelmaksuhind käibemaksu sisaldavaid summasid. Kuna intress tasutakse eraldi, on ostuhind ja järelmaksuhind võrdsed.'),

    sub('4.2 Esimene arve ja käibemaks'),
    p('Müüja esitab esimese arvega sissemakse, mis sisaldab kogu ostuhinna käibemaksu. Arve kuulub tasumisele enne üleandmist. Käive tekib enne üleandmist laekunud sissemakse osas makse laekumise päeval ja ülejäänud osas sõiduki üleandmise päeval (KMS § 2 lg 5, § 11 lg 1 p 1 ja 2, lg 3).'),
    p('Kui ostja on äriregistris märgitud e-arve vastuvõtjaks ja nõuab e-arvet, esitab müüja arved masintöödeldavana (raamatupidamise seaduse § 7¹ lg 7); muul juhul esitatakse arved PDF-vormingus punktis 1 nimetatud e-posti aadressile.'),

    sub('4.3 Osamaksed'),
    p(`Ajatamise kestus ${n} kuud. Osamaksete arv ${n}.`),
    ...(regularLine ? [p(regularLine)] : []),
    p(`Viimane osamakse ${n}: ${bare(last.principal)} eurot, maksetähtpäev ${last.due}.`),
    p(`Osamaksed ei sisalda käibemaksu, sest kogu ostuhinna käibemaks on esitatud esimesel arvel nr ${invoiceNo}.`),
    p('Maksegraafik: lisa 1. Pooled lepivad maksegraafikus sõnaselgelt kokku, sealhulgas 60 päeva ületavates maksetähtaegades (VÕS § 82¹ lg 2).'),

    sub('4.4 Intress'),
    p(
      d.ratePercent
        ? `Ostuhinna jäägilt arvestatakse alates üleandmise päevast fikseeritud intressi ${d.ratePercent} protsenti aastas. Intress arvutatakse igakordselt tasumata jäägilt tegelike päevade arvu alusel (tegelik päevade arv / 365) ja tasutakse koos iga osamaksega eraldi real. Maksegraafiku kohasel tasumisel on intressi kogusumma ${bare(d.price.interestTotal ?? '')} eurot (lisa 1). Intress näidatakse arvel ostuhinnast eraldi; see ei kuulu sõiduki käibe maksustatava väärtuse hulka (KMS § 12 lg 8) ja on maksuvaba finantsteenuse tasu (KMS § 16 lg 2¹ p 2).`
        : 'Ostuhinna jäägilt intressi ei arvestata.',
    ),
    p('Müüja ei nõua ostjalt intressi ega tasusid, milles ei ole käesolevas lepingus kokku lepitud.'),

    sub('4.5 Viivis'),
    p('Tasumisega viivitamise korral tasub ostja viivitatud summalt viivist alates maksetähtpäevale järgnevast päevast kuni kohase tasumiseni VÕS § 113 lõikes 1 sätestatud määras (VÕS §-s 94 sätestatud intressimäär, millele lisandub kaheksa protsenti aastas). Kui punktis 4.4 kokku lepitud intressimäär on sellest kõrgem, on viivise määraks lepinguga ette nähtud intressimäär. Viivist ei arvestata intressilt ega viiviselt (VÕS § 113 lg 6).'),

    sub('4.6 Ennetähtaegne tasumine'),
    p('Ostjal on õigus tasuda kogu ostuhinna jääk või osa sellest enne maksetähtpäeva, teatades sellest müüjale vähemalt 5 tööpäeva ette. Ennetähtaegsel tasumisel tasub ostja intressi üksnes kuni tegeliku tasumise päevani; VÕS § 84 lõike 4 esimest lauset ei kohaldata. Osalise ennetähtaegse tasumise korral koostatakse uus maksegraafik.'),

    sub('4.7 Muud tasud'),
    p('Meeldetuletuse eest tasub ostja 5 eurot. Viivituse korral on müüjal õigus nõuda sissenõudmiskulude hüvitist 40 eurot (VÕS § 113¹) ning seda ületava kahju hüvitamist. Sõiduki registritoimingutega seotud riigilõivud tasub ostja. Muid tasusid ei nõuta.'),

    sub('4.8 Maksete arvestamise järjekord'),
    p('Ostja makseid kasutatakse üksnes käesolevast lepingust tulenevate nõuete katteks: esmalt sissenõutavaks muutunud kulud, seejärel intress ja viivis ning seejärel osamaksed alates varaseimast.'),

    h('5. Omandireservatsioon, registreerimine ja kasutamine'),
    p('5.1 Sõiduki omand jääb müüjale ja läheb ostjale üle, kui järelmaksuhind ning punkti 4.4 kohane intress on täielikult tasutud (omandireservatsioon, VÕS § 233 lg 1). Omandi ülemineku tingimuseks ei ole muude kui käesolevast lepingust tulenevate võlgade tasumine. Kuni omandi üleminekuni valdab ostja sõidukit käesoleva lepingu alusel.'),
    p('5.2 Müüja esitab Transpordiametile taotluse ostja kandmiseks liiklusregistrisse sõiduki vastutava kasutajana hiljemalt üleandmise päeval; ostja annab selleks kirjaliku või digitaalselt allkirjastatud nõusoleku (liiklusseaduse § 2 p 93, § 77 lg 3; määruse nr 19 § 3¹). Ostja taotleb sõidukile tegevusloa ärakirja enne sõiduki kasutamist tasulisel veoseveol (autoveoseaduse § 9). Teekasutustasu ja muud sõiduki kasutamisega seotud maksud ja tasud tasub ostja.'),
    p('5.3 Kui järelmaksuhind ja intress on täielikult tasutud, läheb omand ostjale üle päeval, mil viimane makse on laekunud müüja kontole. Pooled esitavad viie tööpäeva jooksul sellest päevast Transpordiametile ühise taotluse ostja kandmiseks sõiduki omanikuna või teatab müüja sõiduki võõrandamisest ja ostja esitab taotluse registriandmete muutmiseks (liiklusseaduse § 77 lg 3; määruse nr 19 § 7 lg 5 ja 8). Müüja väljastab ostja nõudmisel kirjaliku kinnituse omandi ülemineku kohta.'),
    p('5.4 Ostja ei või enne omandi üleminekut ilma müüja eelneva kirjaliku nõusolekuta'),
    li('1. sõidukit müüa, vahetada ega kinkida;'),
    li('2. sõidukit pantida ega muul viisil koormata;'),
    li('3. sõidukit üürida, tasuta kasutada anda ega muul viisil kolmanda isiku valdusse või kasutusse anda;'),
    li('4. registreerida sõidukit teises riigis ega taotleda selle kustutamist liiklusregistrist;'),
    li('5. teha sõidukile ümberehitusi, mis nõuavad registriandmete muutmist;'),
    li('6. ühendada sõidukit või selle lisavarustust muu asjaga ega eemaldada lisavarustust selle edasiandmiseks.'),
    p('Punktis 3 nimetatud kasutusse andmiseks ei loeta seda, et sõidukit juhivad ostja enda veotegevuses ostja töötajad või ostjale renditööjõuna töötavad juhid.'),
    p('5.5 Ostja võib sõidukit kasutada oma veotegevuses lepingualal, milleks on Euroopa Majanduspiirkonna riigid ja Šveits. Sõiduki kasutamine väljaspool lepinguala eeldab müüja eelnevat kirjalikku nõusolekut.'),
    p('5.6 Kui sõidukile pööratakse sissenõue ostja kohustuste tõttu või sõiduk arestitakse, teatab ostja sellest müüjale viivitamata ning teavitab kohtutäiturit või muud toimingu tegijat müüja omandist.'),

    h('6. Hooldus ja tehnoülevaatus'),
    p(`6.1 Korraline hooldus ei sisaldu ostuhinnas. Pooled sõlmivad eraldi hoolduslepingu (lisa 4), mille kohaselt müüja hooldab sõidukit kaks korda aastas. Hooldus hõlmab mootori- ja käigukastiõli ning filtrite vahetust ja veakoodide lugemist. Hoolduse hind on ${BLANK} eurot (käibemaksuta) kord; hooldus arvestatakse käibemaksuga pärast hoolduse tegemist.`),
    p('6.2 Ostja kannab kõik muud sõiduki kasutamise ja korrashoiuga seotud kulud, sealhulgas remont, rehvid, klaasid, pidurid, kütus, AdBlue ja pesu.'),
    p('6.3 Ostja hoiab sõiduki heas seisukorras, kasutab seda sihtotstarbeliselt ning teatab müüjale viivitamata kahjustustest ja riketest, mis võivad sõiduki väärtust oluliselt vähendada (liiklusseaduse § 72 lg 1).'),
    p('6.4 Ostja esitab sõiduki õigeaegselt korralisele tehnonõuetele vastavuse kontrollile (tehnoülevaatus) ja edastab kontrolli tulemuse müüjale RAHTIS-teenuse kaudu või muul viisil kirjalikku taasesitamist võimaldavas vormis.'),
    p('6.5 Müüja kontrolliõigus: müüjal on õigus sõiduk üle vaadata iga ( ) kahe kuu  ( ) kolme kuu järel eelnevalt kokku lepitud ajal ostja tegevuskohas. Ülevaatuse kohta koostatakse akt.'),

    h('7. Kindlustus'),
    p('7.1 Sõidukil peab kogu lepingu kehtivuse ajal olema kehtiv kohustusliku liikluskindlustuse leping. Lepingu sõlmib ja kindlustusmakse tasub ostja kui liiklusregistrisse kantud vastutav kasutaja (liikluskindlustuse seaduse § 7 lg 2).'),
    p(`7.2 Ostja sõlmib ja hoiab omal kulul jõus sõiduki kaskokindlustuse, mis katab vähemalt liiklusõnnetuse, tulekahju, varguse ja vandalismi riski, omavastutus kuni ${BLANK} eurot. Kindlustuslepingus märgitakse müüja sõiduki omanikuna soodustatud isikuks. Ostja esitab müüjale enne üleandmist kindlustusandja kirjaliku kinnituse selle kohta, et müüja on märgitud soodustatud isikuks ja et kindlustusandja teatab müüjale kindlustuslepingu lõppemisest.`),
    p('7.3 Sõiduki hävimine või kaotsiminek ei vabasta ostjat maksekohustusest (VÕS § 214 lg 1). Müüjale makstud kindlustushüvitis arvestatakse ostja kasuks ennetähtaegse tasumisena punkti 4.6 kohaselt ja seda kasutatakse üksnes käesolevast lepingust tulenevate nõuete katteks. Ülejääv osa makstakse viivitamata ostjale.'),

    h('8. Asukoha jälgimine'),
    p('8.1 Sõidukis on lepingu kehtivuse ajal müüja paigaldatud või heaks kiidetud asukoha määramise seade. Ostja ei või seadet eemaldada ega selle tööd takistada.'),
    p('8.2 Müüja näeb üksnes läbisõidumõõdiku näitu ja seda, kas sõiduk asub lepingualal (punkt 5.5). Täpset asukohta näidatakse müüjale ainult juhul, kui'),
    li('1. sõiduki varguse või omavolilise kasutamise kohta on esitatud kuriteoteade;'),
    li('2. sõiduk on viibinud väljaspool lepinguala üle 24 tunni ilma müüja nõusolekuta; või'),
    li('3. punkti 9.1 kohased eeldused on täidetud või müüja on lepingust taganenud.'),
    p('8.3 Müüja on asukohaandmete vastutav töötleja. Andmeid töödeldakse müüja omandi kaitseks ning töötlemise õiguslik alus on müüja õigustatud huvi (määruse (EL) 2016/679 artikli 6 lõike 1 punkt f). Müüja ei kasuta asukohaandmeid juhtide tööaja, sõidustiili ega muu töösoorituse jälgimiseks. Iga täpse asukoha vaatamine ja selle alus logitakse ning ostjale teatatakse sellest hiljemalt 3 päeva jooksul, välja arvatud juhul, kui teatamine ohustaks kuriteo avastamist. Täpsed asukohaandmed kustutatakse 30 päeva möödumisel või, kui need avati punkti 8.2 alusel, pärast asja lõplikku lahendamist.'),
    p('8.4 Müüja koostab juhtidele määruse (EL) 2016/679 artikli 14 kohase teabe ja ostja edastab selle oma juhtidele enne üleandmist. Ostja vastutab tööandjana oma töötajate teavitamise eest.'),
    p('8.5 Sõidukisse võib paigaldada kaugjuhitava käivitustõkke. Seda võib kasutada üksnes pargitud sõiduki puhul ja ainult juhul, kui (a) politsei seda pärast sõiduki varguse kohta kuriteoteate esitamist nõuab või sellega nõustub või (b) ostja annab selleks sel hetkel kirjalikku taasesitamist võimaldavas vormis nõusoleku. Käivitustõket ei kasutata võlgnevuse sissenõudmiseks ega sõiduki tagasivõtmiseks; sõiduk tagastatakse punkti 9 kohaselt.'),

    h('9. Makseviivitus, lepingu rikkumine, taganemine ja sõiduki tagastamine'),
    p(`9.1 Ostja makseviivitus on oluline lepingurikkumine, kui tasumata summa on olnud sissenõutav vähemalt neliteist päeva ja on endiselt tasumata ning see summa moodustab vähemalt ühe kümnendiku järelmaksuhinnast või, kui see hõlmab kahte või enamat osamakset, vähemalt ühe kahekümnendiku järelmaksuhinnast või hõlmab kogu müüja jääknõuet. Käesoleva lepingu järelmaksuhinnast on üks kümnendik ${bare(d.price.tenth)} eurot ja üks kahekümnendik ${bare(d.price.twentieth)} eurot. Enne nende eelduste täitumist ei või müüja makseviivituse tõttu lepingust taganeda ega nõuda sissenõutavaks muutumata osamaksete tasumist.`),
    p('9.2 Kui punkti 9.1 eeldused on täidetud, annab müüja ostjale kirjalikku taasesitamist võimaldavas vormis vähemalt neljateistkümnepäevase täiendava tähtaja võlgnevuse tasumiseks (VÕS § 114). Müüja võib teates määrata, et täiendava tähtaja tulemusetul möödumisel loeb ta end lepingust taganenuks (VÕS § 116 lg 5). Kui ostja tasub täiendava tähtaja jooksul kogu sissenõutava võlgnevuse koos viivise ja punkti 4.7 kohaste kuludega, jääb leping kehtima.'),
    p('9.3 Kui ostja ei ole täiendava tähtaja jooksul võlgnevust tasunud, võib müüja omal valikul kas'),
    li('1. nõuda kirjaliku teatega kogu tasumata ostuhinna jäägi kohest tasumist; sel juhul arvestatakse intressi üksnes kuni tegeliku tasumise päevani ja leping jääb kehtima; või'),
    li('2. lepingust taganeda taganemisavaldusega (VÕS § 116 lg 1, lg 2 p 5, § 188 lg 1) ja nõuda sõiduki tagastamist (VÕS § 233 lg 2).'),
    p('9.4 Müüjal on õigus lepingust taganeda ka juhul, kui ostja rikub oluliselt mõnda järgmistest kohustustest ega kõrvalda rikkumist 14 päeva jooksul müüja kirjalikust teatest, välja arvatud juhul, kui rikkumist ei ole selle olemuse tõttu võimalik kõrvaldada:'),
    li('1. punkti 5.4 keelud;'),
    li('2. punkti 5.2 kohased registreerimise ja tegevusloa ärakirjaga seotud kohustused;'),
    li('3. kohustus hoida jõus punktide 7.1 ja 7.2 kohased kindlustuslepingud;'),
    li('4. tehnoülevaatuse kohustus (punkt 6.4);'),
    li('5. keeld eemaldada asukoha määramise seade või takistada selle tööd (punkt 8.1).'),
    p('9.5 Lepingust taganemise korral tagastab ostja sõiduki koos dokumentide, võtmete ja lisavarustusega müüja teatatud kohas 7 päeva jooksul taganemisavalduse kättesaamisest. Tagastamise kohta koostatakse akt, kuhu märgitakse sõiduki seisukord ja läbisõidumõõdiku näit. Müüja ei võta sõidukit ostja valdusest ära ostja nõusolekuta; kui ostja sõidukit vabatahtlikult ei tagasta, nõuab müüja sõiduki välja kohtu kaudu ja kohtulahend täidetakse kohtutäituri vahendusel (AÕS § 40 ja 80; täitemenetluse seadustiku § 178). Ostja taotleb enda kustutamist liiklusregistrist vastutava kasutajana viie tööpäeva jooksul sõiduki tagastamisest.'),
    p('9.6 Taganemise tagajärgedes lepivad pooled kokku järgmiselt (VÕS § 188 lg 3). Poolte vahel tehakse lõpparveldus, milles'),
    li('1. müüja kasuks arvestatakse: taganemise päevaks sissenõutavaks muutunud ja tasumata osamaksed, punkti 4.4 kohane intress kuni sõiduki tagastamise päevani, viivis, sissenõutavaks muutumata osamaksed ilma tulevase perioodi intressita ning sõiduki tagasivõtmise, hindamise ja müügi mõistlikud ja tõendatud kulud;'),
    li('2. ostja kasuks arvestatakse sõiduki väärtus tagastamise päeval. Väärtuseks on summa, mille müüja eeldatavalt saab sõiduki mõistlikul viisil ja vajaduse korral mõistlikult korrastatuna müümisel. Kui pooled ei lepi väärtuses kokku 14 päeva jooksul tagastamisest, määrab selle poolte ühiselt valitud sõltumatu hindaja, kelle tasu kannavad pooled võrdselt.'),
    p('Kui sõiduki väärtus ületab müüja kasuks arvestatava summa, tasub müüja vahe ostjale 14 päeva jooksul väärtuse kindlaksmääramisest. Kui sõiduki väärtus on väiksem, tasub ostja vahe müüjale sama tähtaja jooksul. Lõpparveldus asendab poolte nõuded VÕS § 189 ja § 191 alusel; müüja ei või lisaks nõuda leppetrahvi ega kahju hüvitamist ulatuses, mis on lõpparveldusega kaetud.'),
    p('9.7 Käibemaks sõiduki tagastamisel. Pooled vormistavad sõiduki tagastamise käibemaksuseaduse kohaselt kas müüja kreeditarvega (KMS § 29 lg 7) või sõiduki tagasimüügina ostjalt müüjale. Kui tagastamine vormistatakse tagasimüügina ja ostja on käibemaksukohustuslane, esitab ostja müüjale sõiduki väärtuse kohta käibemaksuga arve ning ostja kasuks arvestatakse punktis 9.6 sõiduki väärtus koos käibemaksuga. Muul juhul arvestatakse sõiduki väärtus ostja kasuks käibemaksuta.'),
    p('9.8 Kuni müüja ei ole sõidukit kolmandale isikule võõrandanud, kuid mitte kauem kui 14 päeva jooksul sõiduki tagastamisest, võib ostja sõiduki tagasi saada, tasudes ühe maksena kogu punkti 9.6 alapunktis 1 nimetatud summa. Sel juhul loetakse leping täidetuks ja omand läheb ostjale üle punkti 5.3 kohaselt.'),
    p('9.9 Kui leping lõpeb müüja taganemise või poolte kokkuleppe tõttu, teeb müüja selle kohta viivitamata märke RAHTIS-teenuses. Alates märke tegemisest ei koostata teenuse kaudu enam osamaksete arveid ega saadeta maksemeeldetuletusi. Märge ei muuda poolte õigusi ega kohustusi; lõpparveldus tehakse poolte vahel punkti 9.6 kohaselt ja vaidluse korral lahendab selle kohus.'),

    h('10. Andmete jagamine RAHTIS-teenuses'),
    p('10.1 Pooled lepivad kokku, et RAHTIS-teenuses näidatakse müüjale lepingu kehtivuse ajal sõiduki läbisõidumõõdiku näitu, hoolduse, rikete, ülevaatuste ja tehnoülevaatuse andmeid, maksete seisu ning asukohta punktis 8 sätestatud piirides. Sõiduki veoülesandeid ja tulusid käsitlevaid andmeid näidatakse müüjale üksnes kuukokkuvõttena ja ainult juhul, kui ostja on selle teenuses eraldi heaks kiitnud.'),
    p('10.2 Aivomaa Oy (RAHTIS) ei ole käesoleva lepingu pool. Aivomaa Oy koostab poolte sisestatud andmete alusel üksnes arvutuse, lepingu ja arvete kavandid, üleandmise-vastuvõtmise akti vormi ning saadab maksemeeldetuletusi ja teateid lepinguliste lävede täitumise kohta. Aivomaa Oy ei finantseeri tehingut, ei anna tagatist ega käendust, ei vahenda ega võta vastu makseid, ei nõua võlgnevusi sisse ega vastuta poolte kohustuste täitmise eest. Arved esitatakse müüja nimel ja müüja vastutusel. Aivomaa Oy töötleb isikuandmeid poolte nimel teenuse kasutustingimuste ja andmetöötluslepingu kohaselt.'),

    h('11. Muud tingimused'),
    p('11.1 Müüja võib käesolevast lepingust tulenevad nõuded loovutada krediidi- või finantseerimisasutusele (VÕS § 164). Loovutamisest teatatakse ostjale kirjalikult; pärast teate saamist saab ostja kohustuse kehtivalt täita üksnes uuele võlausaldajale. Lepingu tervikuna üleandmiseks kolmandale isikule on vajalik teise poole nõusolek (VÕS § 179).'),
    p('11.2 Lepinguga seotud teated esitatakse kirjalikku taasesitamist võimaldavas vormis punktis 1 nimetatud e-posti aadressidele. Teade loetakse kättesaaduks saatmisele järgneval tööpäeval. Taganemisavaldus ja punkti 9.2 kohane teade saadetakse lisaks tähitud kirjaga või allkirjastatakse digitaalselt.'),
    p('11.3 Lepingule kohaldatakse Eesti õigust.'),
    p('11.4 Lepingust tulenevad vaidlused lahendatakse läbirääkimiste teel; kokkuleppe mittesaavutamisel ( ) müüja asukoha järgses maakohtus  ( ) Harju Maakohtus.'),
    p('11.5 Lepingut muudetakse kirjalikult või digitaalselt allkirjastatud kokkuleppega.'),
    p('11.6 Leping allkirjastatakse enne sõiduki üleandmist kas omakäeliselt kahes identses eksemplaris, millest kumbki pool saab ühe, või mõlema poole digitaalallkirjaga (TsÜS § 80), mille korral saab kumbki pool allkirjastatud elektroonilise dokumendi.'),
    p('11.7 Kui lepingu mõni säte osutub tühiseks, ei mõjuta see ülejäänud sätete kehtivust.'),

    h('12. Allkirjad'),
    p(`Koht ja aeg: ${LONG_BLANK}`),
    { kind: 'sign', left: [`Müüja: ${d.seller.name}`, 'Nimi, ametikoht'], right: [`Ostja: ${d.buyer.name}`, 'Nimi, ametikoht'] },
    p('Lisad: 1. Maksegraafik · 2. Üleandmise-vastuvõtmise akt · 3. Esimene arve · 4. Hooldusleping · 5. Juhtidele antav andmekaitseteave'),
  ];

  const annexes: ContractBlock[] = [
    { kind: 'annex', text: 'Lisa 1. Maksegraafik' },
    { kind: 'meta', text: `Leping nr ${d.number} · Sõiduk ${d.vehicle.make}, reg-märk ${d.vehicle.plate}, VIN ${BLANK}` },
    {
      kind: 'table',
      head: ['Nr', 'Maksetähtpäev', 'Osamakse (põhiosa), €', 'Intress, €', 'Kokku, €', 'Ostuhinna jääk pärast makset, €'],
      rows: [
        ['Sissemakse', `enne ${d.handover}`, `${bare(d.down)} + käibemaks ${bare(d.price.vat)}`, '–', bare(d.price.downGross), bare(d.price.rest)],
        ...d.plan.map((r) => [String(r.n), r.due, bare(r.principal), bare(r.interest), bare(r.total), bare(r.balance)]),
      ],
      foot: ['Kokku', '', bare(d.price.installmentPrice), bare(d.planTotals.interest), bare(d.planTotals.all), ''],
    },
    p(`Lepingulised läved (punkt 9.1): 1/10 järelmaksuhinnast = ${bare(d.price.tenth)} eurot; 1/20 järelmaksuhinnast = ${bare(d.price.twentieth)} eurot.`),

    { kind: 'annex', text: 'Lisa 2. Üleandmise-vastuvõtmise akt' },
    { kind: 'meta', text: `Leping nr ${d.number} · Müüja ${d.seller.name} · Ostja ${d.buyer.name}` },
    kv('Sõiduk, reg-märk, VIN', `${d.vehicle.make}, ${d.vehicle.plate}, ${BLANK}`),
    kv('Üleandmise koht ja aeg', `${BLANK}, ____.____.________ kell ____.____`),
    kv('Läbisõidumõõdiku näit', `${BLANK} km`),
    kv('Üleantud võtmed, dokumendid, lisavarustus', LONG_BLANK),
    kv('Rehvide seisukord', LONG_BLANK),
    kv('Nähtavad kahjustused ja puudused (fotod lisatud)', LONG_BLANK),
    kv('Asukoha määramise seade paigaldatud', '( ) jah  ( ) ei'),
    kv('Liiklusregistri kanne: omanik müüja, vastutav kasutaja ostja', '( ) jah  ( ) ei'),
    kv('Liikluskindlustus ja kaskokindlustus kehtivad', '( ) jah  ( ) ei'),
    p(`Sõiduk anti ostjale üle ____.____.________ kell ____.____ pärast seda, kui järelmaksuga müügi leping nr ${d.number} oli allkirjastatud. Ostja on sõiduki üle vaadanud ja võtab selle vastu aktis kirjeldatud seisukorras.`),
    { kind: 'sign', left: ['Müüja'], right: ['Ostja'] },
  ];

  return {
    title: `Järelmaksuga müügi leping ${d.number}`,
    author: d.seller.name,
    footer: `Järelmaksuga müügi leping ${d.number} · koostatud RAHTIS-teenuses; Aivomaa Oy ei ole lepingu pool`,
    pages: [main, annexes],
  };
}
