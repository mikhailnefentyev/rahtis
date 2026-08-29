/**
 * Тестовое письмо.
 *
 * Отдельный скрипт, а не эндпоинт: маршрут, умеющий слать письма по
 * запросу, живёт на боевом сайте вечно и однажды становится способом
 * рассылать спам с нашего домена. Скрипт запускают руками с машины, где
 * и так лежит ключ.
 *
 * Провайдер выбирается той же переменной, что и везде. С EMAIL_PROVIDER=stub
 * письмо ляжет в журнал и никуда не уйдёт — это тоже осмысленная проверка:
 * видно, что запись в outbox работает.
 *
 *   npm run email:test                 отправить на EMAIL_REPLY_TO
 *   npm run email:test -- a@b.fi       отправить на указанный адрес
 *   npm run email:test -- --preview    только собрать HTML и открыть в браузере
 */
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

for (const file of ['.env.local', '.env']) {
  const full = path.join(root, file);
  if (!fs.existsSync(full)) continue;
  for (const line of fs.readFileSync(full, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const provider = process.env.EMAIL_PROVIDER === 'resend' ? 'resend' : 'stub';
const from = process.env.EMAIL_FROM ?? '(не задан)';
const replyTo = process.env.EMAIL_REPLY_TO ?? '(не задан)';
const args = process.argv.slice(2);
const previewOnly = args.includes('--preview');
const to = args.find((a) => !a.startsWith('--')) ?? process.env.EMAIL_REPLY_TO;

if (!to && !previewOnly) {
  console.error('Некому слать: укажите адрес аргументом или заполните EMAIL_REPLY_TO.');
  process.exit(1);
}

console.log(`провайдер : ${provider}`);
console.log(`от        : ${from}`);
console.log(`ответ на  : ${replyTo}`);
console.log(`кому      : ${to}\n`);

if (!previewOnly && provider === 'stub') {
  console.log('EMAIL_PROVIDER=stub — письмо никуда не уйдёт.');
  console.log('Поставьте EMAIL_PROVIDER=resend и RESEND_API_KEY, чтобы отправить по-настоящему.');
  process.exit(0);
}

const key = process.env.RESEND_API_KEY?.trim();
if (!previewOnly && !key) {
  console.error('RESEND_API_KEY не задан.');
  process.exit(1);
}

/*
 * Вёрстка берётся из того же модуля, что и боевые письма: проверять
 * отдельным шаблоном значит проверять не то, что уйдёт клиентам.
 *
 * Модуль на TypeScript, и Node читает его напрямую — в файле нет ничего,
 * кроме функций и типов, а типы Node снимает сам.
 */
const { renderEmail, renderText } = await import('../src/lib/email/layout.ts');

const heading = 'Sähköposti toimii';
const blocks = [
  { kind: 'text', value: 'Hei,' },
  {
    kind: 'text',
    value:
      'Tämä on RAHTIS-alustan koeviesti. Jos luet tätä, lähetys toimii: ' +
      'kutsut, laskuilmoitukset ja viikkoraportit kulkevat samaa reittiä.',
  },
  {
    kind: 'facts',
    rows: [
      ['Lähettäjä', from],
      ['Vastausosoite', replyTo],
      ['Palvelu', 'Resend · EU (Ireland)'],
      ['Lähetetty', new Date().toLocaleString('fi-FI')],
    ],
  },
  { kind: 'note', value: 'Viestiin ei tarvitse vastata.' },
];

const body = {
  from,
  to: [to],
  reply_to: replyTo,
  subject: 'RAHTIS · koeviesti',
  text: renderText({ heading, blocks, operatorEmail: replyTo }),
  html: renderEmail({ heading, preheader: 'Lähetys toimii.', blocks, operatorEmail: replyTo }),
};

/*
 * Предпросмотр пишет тот же HTML в файл. Смотреть письмо в браузере до
 * отправки дешевле, чем слать себе десяток вариантов: почтовый ящик
 * помнит все неудачные, а файл перезаписывается.
 */
if (previewOnly) {
  const out = path.join(root, 'email-preview.html');
  fs.writeFileSync(out, body.html);
  console.log('собрано:', out);
  console.log('откройте файл в браузере — это ровно то, что уйдёт адресату.');
  process.exit(0);
}

const res = await fetch('https://api.resend.com/emails', {
  method: 'POST',
  headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
  body: JSON.stringify(body),
  signal: AbortSignal.timeout(30_000),
});

const answer = await res.text();

if (!res.ok) {
  console.error(`не ушло — HTTP ${res.status}`);
  console.error(answer.slice(0, 500));
  process.exit(1);
}

console.log('ушло. ответ Resend:', answer);
