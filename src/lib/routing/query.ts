/**
 * Запрос к поиску мест на языке, который понимает поставщик.
 *
 * Интерфейс русский, а места финские: диспетчер пишет «Порт Ханко», а в
 * данных TomTom это «Hanko», «Hangon satama», «Hietanen Port». Кириллицу
 * поставщик по финским адресам не ищет — запрос уходит впустую и, что
 * хуже, платно.
 *
 * Поэтому перед вызовом запрос переводится: сначала пословно по словарю,
 * потом побуквенно тем, что в словарь не попало. Словарь важнее
 * транслитерации и стоит первым: «Ювяскюля» побуквенно даёт «yuvyaskyulya»,
 * и ни один геокодер этого не узнает.
 */

/**
 * Города Финляндии и Скандинавии, как их пишут по-русски.
 *
 * Список неполон намеренно: сюда попадает то, куда действительно ездят —
 * порты, терминалы и промышленные центры. Незнакомый город переводится
 * побуквенно, и для большинства финских названий этого хватает: «Раума»
 * даёт «rauma», «Котка» — «kotka».
 */
const CITIES: Record<string, string> = {
  хельсинки: 'Helsinki',
  вуосаари: 'Vuosaari',
  ханко: 'Hanko',
  раума: 'Rauma',
  котка: 'Kotka',
  хамина: 'Hamina',
  турку: 'Turku',
  наантали: 'Naantali',
  пори: 'Pori',
  вааса: 'Vaasa',
  коккола: 'Kokkola',
  оулу: 'Oulu',
  кеми: 'Kemi',
  торнио: 'Tornio',
  ловииса: 'Loviisa',
  инкоо: 'Inkoo',
  порвоо: 'Porvoo',
  каскинен: 'Kaskinen',
  уусикаупунки: 'Uusikaupunki',
  тампере: 'Tampere',
  лахти: 'Lahti',
  лаппеенранта: 'Lappeenranta',
  иматра: 'Imatra',
  ювяскюля: 'Jyväskylä',
  куопио: 'Kuopio',
  йоэнсуу: 'Joensuu',
  миккели: 'Mikkeli',
  варкаус: 'Varkaus',
  сейняйоки: 'Seinäjoki',
  хямеэнлинна: 'Hämeenlinna',
  рийхимяки: 'Riihimäki',
  хювинкяа: 'Hyvinkää',
  сало: 'Salo',
  форсса: 'Forssa',
  эспоо: 'Espoo',
  вантаа: 'Vantaa',
  стокгольм: 'Stockholm',
  гётеборг: 'Göteborg',
  гетеборг: 'Göteborg',
  мальмё: 'Malmö',
  мальме: 'Malmö',
  умео: 'Umeå',
  евле: 'Gävle',
};

/**
 * Слова, которыми называют место, а не адрес.
 *
 * «Порт» переводится финским satama, а не английским port: названия точек
 * в финских данных местные — «Rauman satama», «Turku Satama». Английское
 * Port встречается тоже (Hietanen Port в Котке), но реже, а нечёткий
 * поиск поставщика подхватывает его и по финскому слову.
 */
const WORDS: Record<string, string> = {
  порт: 'satama',
  порту: 'satama',
  порта: 'satama',
  гавань: 'satama',
  терминал: 'terminaali',
  терминале: 'terminaali',
  склад: 'varasto',
  парковка: 'parkki',
  паркинг: 'parkki',
  причал: 'laituri',
  завод: 'tehdas',
  фабрика: 'tehdas',
};

/** Побуквенно. Последний рубеж для слов, которых нет в словарях. */
const LETTERS: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'o', ж: 'j',
  з: 'z', и: 'i', й: 'i', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o',
  п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts',
  ч: 'ch', ш: 'sh', щ: 'sh', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu',
  я: 'ya',
};

const CYRILLIC = /[а-яё]/i;

export const hasCyrillic = (value: string): boolean => CYRILLIC.test(value);

function transliterate(word: string): string {
  return [...word.toLowerCase()].map((letter) => LETTERS[letter] ?? letter).join('');
}

/**
 * Переводит запрос в вид, понятный поставщику.
 *
 * Латиница возвращается как есть: адрес, набранный по-фински, портить
 * незачем, а «Satamakatu» через словарь не проходит и не должен.
 */
export function normalizeQuery(query: string): string {
  if (!hasCyrillic(query)) return query;

  return query
    .split(/(\s+)/)
    .map((part) => {
      if (!hasCyrillic(part)) return part;

      /* Знаки препинания к слову не относятся, но должны остаться на месте. */
      const match = /^([^\p{L}]*)(.*?)([^\p{L}]*)$/u.exec(part);
      if (!match) return part;

      const [, before, word, after] = match;
      const key = word.toLowerCase();
      const translated = CITIES[key] ?? WORDS[key] ?? transliterate(word);

      return `${before}${translated}${after}`;
    })
    .join('');
}
