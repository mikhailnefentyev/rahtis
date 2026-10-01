/** Языки переписки: кабинет (fi, en) и приложение водителя. */
export const CHAT_LANGS = ['fi', 'en', 'sv', 'nb', 'da', 'et', 'lv', 'lt', 'pl', 'ru'] as const;
export type ChatLang = (typeof CHAT_LANGS)[number];

/** Быстрые ответы: код хранится в сообщении, текст — на языке читателя. */
export const DRIVER_QUICK = ['AT_GATE', 'ON_THE_WAY_15', 'LATE_30', 'WAITING', 'LEAVING', 'CALL_ME', 'OK'] as const;
export const CABINET_QUICK = ['CALL_ME', 'OK'] as const;
export type QuickCode = (typeof DRIVER_QUICK)[number];

export type ChatRole = 'SHIPPER' | 'CARRIER' | 'DRIVER' | 'ADMIN';

export type ChatMessage = {
  id: number;
  author_role: Exclude<ChatRole, 'ADMIN'>;
  author_name: string | null;
  body: string;
  quick_code: string | null;
  source_lang: string | null;
  translations: Record<string, string>;
  created_at: string;
  mine: boolean;
};

export type Chat = { ref: string; role: ChatRole; open: boolean; messages: ChatMessage[] };

/**
 * Что показать читателю: быстрый ответ — на его языке, свободный текст —
 * перевод, если язык другой и перевод есть, иначе оригинал.
 */
export function displayText(
  message: Pick<ChatMessage, 'body' | 'quick_code' | 'source_lang' | 'translations'>,
  lang: string,
  quickText: (code: string) => string | undefined,
): { text: string; translated: boolean } {
  if (message.quick_code) {
    const quick = quickText(message.quick_code);
    if (quick) return { text: quick, translated: false };
  }
  const translation = message.translations?.[lang];
  if (message.source_lang && message.source_lang !== lang && translation) {
    return { text: translation, translated: true };
  }
  return { text: message.body, translated: false };
}
