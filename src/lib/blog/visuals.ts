/**
 * Картинки и подписи блога.
 *
 * HeyCatch присылает статьи без картинок, а голый список заголовков скучен.
 * Обложку рисуем сами: машина RAHTIS по теме статьи (вырезанные картинки
 * сочетаний из public/media/cutout) на фирменном фоне. Тема — по словам в
 * адресе, заголовке и ключевых словах; не нашлось — по адресу, чтобы
 * соседние статьи не были одинаковыми.
 *
 * Подписи («мин чтения», «Содержание»), заголовок и описание блога — на
 * языке страницы: у каждого из девяти языков сайта свой блог (08.11.2026).
 */

export type Vehicle = { file: string; label: string };

const VEHICLES = {
  kippi: { file: 'kippiauto', label: 'Kippiauto' },
  kasetti: { file: 'kasettiyhdistelma', label: 'Kasettiyhdistelmä' },
  kontti: { file: 'kontti', label: 'Konttiyhdistelmä' },
  puoli: { file: 'puolikas', label: 'Puoliperävaunuyhdistelmä' },
  ppv: { file: 'ppv', label: 'Puoliperävaunu, kippi' },
  tays: { file: 'taysperavaunuyhdistelma', label: 'Täysperävaunuyhdistelmä' },
  tral: { file: 'tral', label: 'Lavettikuljetus' },
} satisfies Record<string, Vehicle>;

/*
 * Слово в тексте → машина, только когда тема прямо про неё (земляные работы,
 * контейнеры, спецтехника, перецепы). Остальные статьи (водители, документы,
 * счета…) получают машину по адресу статьи — иначе подряд шли одинаковые.
 */
const TOPICS: [RegExp, keyof typeof VEHICLES][] = [
  [/maansiirt|kippi|massa|sora|murske|maa-aines|työmaa|earthwork|dump/i, 'kippi'],
  [/kontti|container|satama/i, 'kontti'],
  [/lavetti|työkone|erikoiskulj|oversize|excavat/i, 'tral'],
  [/satulast|swap|vaihtokori/i, 'puoli'],
];

const ROTATION: (keyof typeof VEHICLES)[] = ['puoli', 'kasetti', 'tays', 'kontti', 'ppv', 'tral'];

function hash(s: string): number {
  let h = 0;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return Math.abs(h);
}

export function vehicleFor(article: { slug: string; title: string; keywords?: unknown }): Vehicle {
  const text = `${article.slug} ${article.title} ${typeof article.keywords === 'string' ? article.keywords : Array.isArray(article.keywords) ? article.keywords.join(' ') : ''}`;
  const hit = TOPICS.find(([re]) => re.test(text));
  return VEHICLES[hit ? hit[1] : ROTATION[hash(article.slug) % ROTATION.length]];
}

export const vehicleSrc = (v: Vehicle, ext: 'webp' | 'png' = 'webp') =>
  ext === 'png' ? `/media/cutout-png/${v.file}.png` : `/media/cutout/${v.file}.webp`;

const LABELS = {
  en: {
    title: 'RAHTIS blog: transport management and freight exchange',
    description: 'Practical articles for hauliers and shippers: consignment notes, working time, return loads, quotes, invoicing and earthworks.',
    intro: 'Practical guides for hauliers and shippers – from consignment notes and working time to invoicing and return loads.',
    heading: 'Guides for the transport trade',
    signIn: 'Sign in',
    read: 'Read',
    all: 'All articles',
    min: 'min read',
    toc: 'Table of contents',
    blog: 'Blog',
    empty: 'No articles yet.',
    chart: 'Chart of the table below',
    join: 'Join RAHTIS',
    privacy: 'Privacy notice',
    takeaways: 'Key takeaways',
    faq: 'FAQ',
  },
  fi: {
    title: 'RAHTIS-blogi: kuljetusten hallinta ja rahtipörssi',
    description: 'Käytännön artikkeleita kuljetusyrityksille ja rahdinantajille: rahtikirjat, työajat, palautuskuormat, tarjoukset, laskutus ja maansiirto.',
    intro: 'Käytännön oppaita kuljetusyrittäjille ja rahdinantajille – rahtikirjoista ja työajoista laskutukseen ja palautuskuormiin.',
    heading: 'Oppaita kuljetusalalle',
    signIn: 'Kirjaudu',
    read: 'Lue',
    all: 'Kaikki artikkelit',
    min: 'min lukuaika',
    toc: 'Sisällys',
    blog: 'Blogi',
    empty: 'Ei vielä artikkeleita.',
    chart: 'Kaavio alla olevasta taulukosta',
    join: 'Hae mukaan',
    privacy: 'Tietosuojaseloste',
    takeaways: 'Tärkeimmät asiat',
    faq: 'Usein kysyttyä',
  },
  sv: {
    title: 'RAHTIS-bloggen: transportledning och fraktbörs',
    description: 'Praktiska artiklar för åkerier och transportköpare: fraktsedlar, arbetstid, returlaster, offerter, fakturering och markarbeten.',
    intro: 'Praktiska guider för åkerier och transportköpare – från fraktsedlar och arbetstid till fakturering och returlaster.',
    heading: 'Guider för transportbranschen',
    signIn: 'Logga in',
    read: 'Läs',
    all: 'Alla artiklar',
    min: 'min läsning',
    toc: 'Innehåll',
    blog: 'Blogg',
    empty: 'Inga artiklar ännu.',
    chart: 'Diagram över tabellen nedan',
    join: 'Ansök',
    privacy: 'Integritetspolicy',
    takeaways: 'Det viktigaste i korthet',
    faq: 'Vanliga frågor',
  },
  et: {
    title: 'RAHTIS blogi: veokorraldus ja veobörs',
    description: 'Praktilised artiklid vedajatele ja veotellijatele: saatelehed, tööaeg, tagasikoormad, hinnapakkumised, arveldus ja pinnasetööd.',
    intro: 'Praktilised juhendid vedajatele ja veotellijatele – saatelehtedest ja tööajast arvelduse ja tagasikoormateni.',
    heading: 'Juhendid veondusele',
    signIn: 'Logi sisse',
    read: 'Loe',
    all: 'Kõik artiklid',
    min: 'min lugemist',
    toc: 'Sisukord',
    blog: 'Blogi',
    empty: 'Artikleid veel pole.',
    chart: 'Allpool oleva tabeli diagramm',
    join: 'Liitu',
    privacy: 'Privaatsusteade',
    takeaways: 'Põhipunktid',
    faq: 'Korduma kippuvad küsimused',
  },
  lv: {
    title: 'RAHTIS blogs: pārvadājumu vadība un kravu birža',
    description: 'Praktiski raksti pārvadātājiem un kravu nosūtītājiem: pavadzīmes, darba laiks, atpakaļkravas, piedāvājumi, rēķini un zemes darbi.',
    intro: 'Praktiski ceļveži pārvadātājiem un kravu nosūtītājiem – no pavadzīmēm un darba laika līdz rēķiniem un atpakaļkravām.',
    heading: 'Ceļveži kravu pārvadājumu nozarei',
    signIn: 'Pieslēgties',
    read: 'Lasīt',
    all: 'Visi raksti',
    min: 'min lasīšanai',
    toc: 'Saturs',
    blog: 'Blogs',
    empty: 'Rakstu vēl nav.',
    chart: 'Zemāk esošās tabulas diagramma',
    join: 'Pieteikties',
    privacy: 'Privātuma politika',
    takeaways: 'Galvenais īsumā',
    faq: 'Biežāk uzdotie jautājumi',
  },
  lt: {
    title: 'RAHTIS tinklaraštis: transporto valdymas ir krovinių birža',
    description: 'Praktiški straipsniai vežėjams ir krovinių siuntėjams: važtaraščiai, darbo laikas, grįžtamieji kroviniai, pasiūlymai, sąskaitos ir žemės darbai.',
    intro: 'Praktiški gidai vežėjams ir krovinių siuntėjams – nuo važtaraščių ir darbo laiko iki sąskaitų ir grįžtamųjų krovinių.',
    heading: 'Gidai krovinių vežimo verslui',
    signIn: 'Prisijungti',
    read: 'Skaityti',
    all: 'Visi straipsniai',
    min: 'min skaitymo',
    toc: 'Turinys',
    blog: 'Tinklaraštis',
    empty: 'Straipsnių dar nėra.',
    chart: 'Žemiau pateiktos lentelės diagrama',
    join: 'Paraiška',
    privacy: 'Privatumo politika',
    takeaways: 'Svarbiausia',
    faq: 'Dažniausiai užduodami klausimai',
  },
  pl: {
    title: 'Blog RAHTIS: zarządzanie transportem i giełda ładunków',
    description: 'Praktyczne artykuły dla przewoźników i zleceniodawców: listy przewozowe, czas pracy, ładunki powrotne, oferty, fakturowanie i roboty ziemne.',
    intro: 'Praktyczne poradniki dla przewoźników i zleceniodawców – od listów przewozowych i czasu pracy po fakturowanie i ładunki powrotne.',
    heading: 'Poradniki dla branży transportowej',
    signIn: 'Zaloguj się',
    read: 'Czytaj',
    all: 'Wszystkie artykuły',
    min: 'min czytania',
    toc: 'Spis treści',
    blog: 'Blog',
    empty: 'Nie ma jeszcze artykułów.',
    chart: 'Wykres do tabeli poniżej',
    join: 'Dołącz',
    privacy: 'Polityka prywatności',
    takeaways: 'Najważniejsze',
    faq: 'Najczęstsze pytania',
  },
  de: {
    title: 'RAHTIS-Blog: Transportmanagement und Frachtenbörse',
    description: 'Praxisartikel für Transportunternehmen und Verlader: Frachtbriefe, Arbeitszeit, Rückladungen, Angebote, Abrechnung und Erdbau.',
    intro: 'Praxisratgeber für Transportunternehmen und Verlader – von Frachtbrief und Arbeitszeit bis zu Abrechnung und Rückladungen.',
    heading: 'Ratgeber für die Transportbranche',
    signIn: 'Anmelden',
    read: 'Lesen',
    all: 'Alle Artikel',
    min: 'Min. Lesezeit',
    toc: 'Inhalt',
    blog: 'Blog',
    empty: 'Noch keine Artikel.',
    chart: 'Diagramm zur Tabelle unten',
    join: 'Registrieren',
    privacy: 'Datenschutzerklärung',
    takeaways: 'Das Wichtigste in Kürze',
    faq: 'Häufige Fragen',
  },
  ru: {
    title: 'Блог RAHTIS: управление перевозками и биржа грузов',
    description: 'Практические статьи для перевозчиков и грузовладельцев: накладные CMR, рабочее время, обратные загрузки, расчёт цены, счета и земляные работы.',
    intro: 'Практические руководства для перевозчиков и грузовладельцев – от накладных и рабочего времени до счетов и обратных загрузок.',
    heading: 'Статьи для перевозчиков',
    signIn: 'Войти',
    read: 'Читать',
    all: 'Все статьи',
    min: 'мин чтения',
    toc: 'Содержание',
    blog: 'Блог',
    empty: 'Статей пока нет.',
    chart: 'График по таблице ниже',
    join: 'Подать заявку',
    privacy: 'Политика конфиденциальности',
    takeaways: 'Главное',
    faq: 'Вопросы и ответы',
  },
} as const;

export type BlogLabels = (typeof LABELS)[keyof typeof LABELS];

export const blogLabels = (lang: string | undefined): BlogLabels => LABELS[(lang ?? 'en') as keyof typeof LABELS] ?? LABELS.en;

/** Язык большинства статей — на нём подписи списка. */
export function mainLanguage(articles: { language?: string }[]): string {
  const count = new Map<string, number>();
  for (const a of articles) count.set(a.language || 'en', (count.get(a.language || 'en') ?? 0) + 1);
  return [...count.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'en';
}

/*
 * Финские статьи HeyCatch иногда склоняют марку неверно («RAHTISin») и
 * путают слова. Пока их не поправили в HeyCatch, правим при показе —
 * только известные ошибки, по целым словам.
 */
/* Конец слова: дальше не буква (в том числе не ä/ö/å — \b их не знает). */
const W = '(?![A-Za-zÄÖÅäöå])';
const FI_FIXES: [RegExp, string][] = [
  [new RegExp(`RAHTISin${W}`, 'g'), 'RAHTIKSEN'],
  [new RegExp(`RAHTISissa${W}`, 'g'), 'RAHTIKSESSA'],
  [new RegExp(`RAHTISista${W}`, 'g'), 'RAHTIKSESTA'],
  [new RegExp(`RAHTISiin${W}`, 'g'), 'RAHTIKSEEN'],
  [new RegExp(`RAHTISilla${W}`, 'g'), 'RAHTIKSELLA'],
  [new RegExp(`RAHTISille${W}`, 'g'), 'RAHTIKSELLE'],
  [new RegExp(`RAHTISia${W}`, 'g'), 'RAHTISTA'],
  [/paperyötä/g, 'paperityötä'],
  [/IT-budjettiä/g, 'IT-budjettia'],
  [/keikan tiedot syntyy/g, 'keikan tiedot syntyvät'],
  [/shippaaja/g, 'rahdinantaja'],
];

export function fixText(text: string, lang: string | undefined): string {
  return lang === 'fi' ? FI_FIXES.reduce((t, [re, to]) => t.replace(re, to), text) : text;
}
