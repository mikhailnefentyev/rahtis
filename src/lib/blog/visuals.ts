/**
 * Картинки и подписи блога.
 *
 * HeyCatch присылает статьи без картинок, а голый список заголовков скучен.
 * Обложку рисуем сами: машина RAHTIS по теме статьи (вырезанные картинки
 * сочетаний из public/media/cutout) на фирменном фоне. Тема — по словам в
 * адресе, заголовке и ключевых словах; не нашлось — по адресу, чтобы
 * соседние статьи не были одинаковыми.
 *
 * Подписи («мин чтения», «Содержание») — на языке статьи: статьи финские,
 * английская рамка над ними выглядела чужой.
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

/* Слово в тексте → машина. Первое совпадение выигрывает. */
const TOPICS: [RegExp, keyof typeof VEHICLES][] = [
  [/maansiirt|kippi|massa|sora|murske|maa-aines|työmaa|earthwork|dump/i, 'kippi'],
  [/kontti|container|satama|port/i, 'kontti'],
  [/lavetti|kone|erikoiskulj|oversize|excavat/i, 'tral'],
  [/satulast|swap|vaihtokori|perävaunu|trailer/i, 'puoli'],
  [/cmr|rahtikirj|consignment|tarjous|lasku|invoice|quote/i, 'puoli'],
  [/palautus|paluukuorm|tyhjä|return|empty/i, 'tays'],
  [/kuljettaj|palkka|työaika|ajopäiväkirj|driver|working time/i, 'kasetti'],
];

const ROTATION: (keyof typeof VEHICLES)[] = ['puoli', 'kasetti', 'tays', 'kontti', 'ppv', 'kippi', 'tral'];

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
    min: 'min läsning',
    toc: 'Innehåll',
    blog: 'Blogg',
    empty: 'Inga artiklar ännu.',
    chart: 'Diagram över tabellen nedan',
    join: 'Ansök',
    privacy: 'Integritetspolicy',
    takeaways: 'Viktigaste punkterna',
    faq: 'Vanliga frågor',
  },
  et: {
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
  ru: {
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
