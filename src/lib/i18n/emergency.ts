/**
 * Тексты аварийной страницы (src/app/global-error.tsx) на всех языках сайта.
 * Отдельно от словарей: когда падает корневой layout, грузить словарь нельзя —
 * страница обязана нарисоваться из того, что уже в бандле.
 */
export const EMERGENCY_TEXT = {
  fi: ['Palvelu ei juuri nyt vastaa', 'Kuljetusten tiedot ovat tallessa. Yritä hetken kuluttua uudelleen.', 'Yritä uudelleen'],
  en: ['The service is not responding right now', 'Your transport data is safe. Please try again in a moment.', 'Try again'],
  sv: ['Tjänsten svarar inte just nu', 'Uppgifterna om dina transporter är sparade. Försök igen om en stund.', 'Försök igen'],
  et: ['Teenus ei vasta praegu', 'Vedude andmed on alles. Proovi mõne aja pärast uuesti.', 'Proovi uuesti'],
  lv: ['Pakalpojums pašlaik neatbild', 'Pārvadājumu dati ir saglabāti. Lūdzu, mēģiniet vēlreiz pēc brīža.', 'Mēģināt vēlreiz'],
  lt: ['Paslauga šiuo metu neatsako', 'Pervežimų duomenys išsaugoti. Bandykite dar kartą po kelių minučių.', 'Bandyti dar kartą'],
  pl: ['Serwis w tej chwili nie odpowiada', 'Dane przewozów są bezpieczne. Spróbuj ponownie za chwilę.', 'Spróbuj ponownie'],
  de: ['Der Dienst antwortet gerade nicht', 'Ihre Transportdaten sind gesichert. Bitte versuchen Sie es gleich noch einmal.', 'Erneut versuchen'],
  ru: ['Сервис сейчас не отвечает', 'Данные о перевозках сохранены. Попробуйте ещё раз через минуту.', 'Повторить'],
  ro: ['Serviciul nu răspunde momentan', 'Datele transporturilor sunt în siguranță. Încercați din nou peste câteva momente.', 'Încercați din nou'],
} as const;

export type EmergencyLang = keyof typeof EMERGENCY_TEXT;

/** Язык из адреса (/pl/…); без языка в адресе — финский. */
export function emergencyLang(): EmergencyLang {
  const first = typeof window === 'undefined' ? '' : window.location.pathname.split('/')[1];
  return first in EMERGENCY_TEXT ? (first as EmergencyLang) : 'fi';
}
