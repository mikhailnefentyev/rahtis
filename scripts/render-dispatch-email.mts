/**
 * Отрисовать письмо-рассылку в консоль, ничего не отправляя.
 *
 * Нужен для того, что не проверяется ни типами, ни базой: как письмо
 * читается. Пропущенное поле, съехавшая подстановка и пустая строка на
 * месте ставки — типы про это молчат, а получатель видит.
 *
 * Запуск: npx tsx scripts/render-dispatch-email.mts [fi|en]
 */
import { orderPublishedEmail } from '../src/lib/email/templates/dispatch';
import type { EmailLocale } from '../src/lib/email/text';

const locale: EmailLocale = process.argv[2] === 'en' ? 'en' : 'fi';

const message = orderPublishedEmail({
  to: 'kuljetus@example.com',
  companyName: 'Aivomaa Oy',
  companyId: '00000000-0000-0000-0000-000000000000',
  ref: 'RS-2026-0045',
  from: 'Hanko',
  to_: 'Helsinki',
  pickup: 'Hangon satama · 11.09.2026 · 08:00',
  /*
   * То, что отдаёт unitLabel при заполненном номере прицепа, — сам
   * номер. Подпись «Perävaunu» встаёт только когда номера нет, а у
   * контейнера строка выглядит как «Kontti 40 ft».
   */
  unit: 'TESTI-01',
  distance: '140 km',
  rate: '480 €',
  link: 'https://rahtis.eu/fi/carrier/desk',
  operatorEmail: 'info@aipoweredsolutions.fi',
  locale,
});

console.log('ЯЗЫК:  ', locale);
console.log('ТЕМА:  ', message.subject);
console.log('КОМУ:  ', message.toName, '<' + message.to + '>');
console.log('ШАБЛОН:', message.template);
console.log('\n--- текстовая часть ---\n');
console.log(message.text);
