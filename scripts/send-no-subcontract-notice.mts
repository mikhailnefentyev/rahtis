/**
 * Разовая рассылка: перевозчикам, которых перевели с подряда на абонемент.
 *
 * Решение 6.11.2026: режима подряда больше нет. Миграция перевела каждого
 * перевозчика с partnership = 'SUBCONTRACTOR' на 'SUBSCRIBER' и поставила
 * ему subscription_fees_from = '2027-01-01' — по этой дате их и находим.
 *
 * По умолчанию ничего не отправляет: печатает получателей и темы и пишет
 * HTML каждого письма (и образец на каждом из девяти языков) во временную
 * папку. Отправляет только с --send, через общий sendEmail — письмо
 * ложится в email_outbox. Повторный запуск пропускает компании, которым
 * письмо этого шаблона уже ушло (SENT) или висит недоотправленным (PENDING).
 *
 * Запуск (условие react-server снимает защиту 'server-only' — скрипт
 * запускают руками на машине, где и так лежит секретный ключ):
 *
 *   npx tsx --conditions=react-server scripts/send-no-subcontract-notice.mts
 *       только посмотреть (по умолчанию)
 *   ... --send                      отправить всем, кому ещё не ушло
 *   ... --only <companyId>          только одной компании (и с --send)
 *   ... --only <companyId> --to a@b.fi --send
 *                                   пробное письмо этой компании на свой адрес;
 *                                   в журнале не числится за компанией
 *   ... --keep-en                   'en' в companies.language не менять на язык страны
 *   ... --out <папка>               куда писать HTML (по умолчанию во временную)
 *
 * Провайдер — EMAIL_PROVIDER, как везде: со stub письмо только ляжет в
 * журнал со статусом SKIPPED и при следующем запуске уйдёт снова.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import type { SupabaseClient } from '@supabase/supabase-js';

const root = process.cwd();

/* Окружение — так же, как в send-test-email.mjs: .env.local, потом .env. */
for (const file of ['.env.local', '.env']) {
  const full = path.join(root, file);
  if (!fs.existsSync(full)) continue;
  for (const line of fs.readFileSync(full, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(name);
const option = (name: string): string | null => {
  const i = args.indexOf(name);
  const value = i >= 0 ? args[i + 1] : undefined;
  return value && !value.startsWith('--') ? value : null;
};

const send = flag('--send');
const only = option('--only');
const testTo = option('--to');
const byCountry = !flag('--keep-en');
const outDir =
  option('--out') ??
  path.join(os.tmpdir(), `rahtis-no-subcontract-${new Date().toISOString().replace(/[:.]/g, '-')}`);

if (testTo && !only) {
  console.error('--to работает только вместе с --only <companyId>: пробное письмо — одно.');
  process.exit(1);
}

/*
 * Модули приложения — после чтения окружения и динамически: так ошибка
 * 'server-only' (запуск без --conditions=react-server) превращается в
 * понятную подсказку, а не в трассу из node_modules.
 */
const load = async () => ({
  email: await import('../src/lib/email'),
  config: await import('../src/lib/email/config'),
  site: await import('../src/lib/config'),
  admin: await import('../src/lib/supabase/admin'),
  template: await import('../src/lib/email/templates/noSubcontract'),
  text: await import('../src/lib/email/templates/noSubcontractText'),
});

const app = await load().catch((cause: unknown) => {
  const message = cause instanceof Error ? cause.message : String(cause);
  console.error('Модули приложения не загрузились:', message);
  if (/server component|server-only/i.test(message)) {
    console.error('Запускайте так: npx tsx --conditions=react-server scripts/send-no-subcontract-notice.mts');
  }
  return process.exit(1);
});

const { sendEmail, operatorInbox } = app.email;
const { emailProviderName } = app.config;
const { siteUrl } = app.site;
const { NO_SUBCONTRACT_TEMPLATE, noSubcontractNoticeEmail } = app.template;
const { NOTICE_LOCALES, noticeLocaleOf } = app.text;
type NoticeLocale = (typeof NOTICE_LOCALES)[number];

const site = siteUrl();
const operator = operatorInbox();
const link = (locale: NoticeLocale) => `${site}/${locale}/carrier/subscription`;

function build(locale: NoticeLocale, to: string, companyName: string, companyId: string | null, template?: string) {
  return noSubcontractNoticeEmail({
    to,
    companyName,
    companyId,
    link: link(locale),
    operatorEmail: operator,
    replyTo: operator,
    locale,
    template,
  });
}

/* Образцы на всех языках — читать глазами до рассылки, независимо от базы. */
fs.mkdirSync(path.join(outDir, 'samples'), { recursive: true });
for (const locale of NOTICE_LOCALES) {
  const m = build(locale, 'kuljetus@example.com', 'Esimerkki Kuljetus Oy', null);
  fs.writeFileSync(path.join(outDir, 'samples', `${locale}.html`), m.html ?? '');
  fs.writeFileSync(path.join(outDir, 'samples', `${locale}.txt`), `${m.subject}\n\n${m.text}`);
}

console.log(`режим     : ${send ? 'ОТПРАВКА' : 'просмотр (без --send ничего не уходит)'}`);
console.log(`провайдер : ${emailProviderName()}`);
console.log(`сайт      : ${site}`);
console.log(`ответ на  : ${operator}`);
console.log(`HTML      : ${outDir}\n`);

/*
 * Узкий тип вместо Database: колонку subscription_fees_from добавляет
 * миграция, и типы базы могут ещё её не знать.
 */
type Carrier = {
  id: string;
  name: string;
  contact_email: string | null;
  language: string | null;
  country: string | null;
  status: string;
  is_test: boolean;
};

/*
 * Дальше — в функции, а не на верхнем уровне: process.exit при открытых
 * fetch-соединениях роняет Node на Windows (assert в libuv), поэтому код
 * возврата ставится через exitCode, и процесс завершается сам.
 */
async function run(): Promise<number> {
  const db = app.admin.createAdminClient() as unknown as SupabaseClient;

  let query = db
    .from('companies')
    .select('id, name, contact_email, language, country, status, is_test')
    .eq('kind', 'CARRIER')
    .is('client_of', null)
    .eq('subscription_fees_from', '2027-01-01')
    .neq('status', 'REJECTED')
    .order('name');
  if (only) query = query.eq('id', only);

  const { data, error } = await query;
  if (error) {
    console.error('Перевозчики не выбрались:', error.message);
    console.error('(Колонка subscription_fees_from появится после миграции и db push.)');
    return 1;
  }
  const carriers = (data ?? []) as Carrier[];

  /* Кому уже ушло: журнал писем — единственная память рассылки. */
  const already = new Map<string, string>();
  if (carriers.length) {
    const { data: log, error: logError } = await db
      .from('email_outbox')
      .select('company_id, status, sent_at, created_at')
      .eq('template', NO_SUBCONTRACT_TEMPLATE)
      .in('status', ['SENT', 'PENDING'])
      .in(
        'company_id',
        carriers.map((c) => c.id),
      );
    if (logError) {
      console.error('Журнал писем не прочитался, отправлять вслепую не будем:', logError.message);
      return 1;
    }
    type LogRow = { company_id: string; status: string; sent_at: string | null; created_at: string };
    for (const row of (log ?? []) as LogRow[]) {
      already.set(row.company_id, `${row.status} ${row.sent_at ?? row.created_at}`);
    }
  }

  const planned: Array<{ name: string; message: ReturnType<typeof build> }> = [];

  for (const c of carriers) {
    const locale = noticeLocaleOf(c.language, c.country, byCountry);
    const line = `${c.name.padEnd(36)} ${(c.country ?? '?').padEnd(3)} ${(c.language ?? '-').padEnd(3)}→ ${locale}  ${c.contact_email ?? '(нет почты)'}`;

    /* Пробное письмо на свой адрес уходит и тем, кому уже отправлено. */
    const why = testTo
      ? ''
      : !c.contact_email?.includes('@')
        ? 'нет почты'
        : c.is_test
          ? 'тестовая компания'
          : already.has(c.id)
            ? `уже: ${already.get(c.id)}`
            : '';

    console.log(`${why ? '  пропуск' : '  ✓      '} ${line}${why ? `  [${why}]` : ''}`);
    if (why) continue;

    const message = testTo
      ? build(locale, testTo, c.name, null, `${NO_SUBCONTRACT_TEMPLATE}.test`)
      : build(locale, c.contact_email!, c.name, c.id);
    fs.writeFileSync(path.join(outDir, `${locale}-${c.id}.html`), message.html ?? '');
    planned.push({ name: c.name, message });
  }

  console.log(`\nвсего ${carriers.length}, к отправке ${planned.length}\n`);
  for (const { message } of planned) console.log(`${message.subject}  →  ${message.to}`);

  if (!send) {
    console.log('\nПросмотр. Чтобы отправить, добавьте --send.');
    return 0;
  }

  if (emailProviderName() !== 'resend') {
    console.warn('\nВНИМАНИЕ: EMAIL_PROVIDER не resend — письма лягут в журнал как SKIPPED и никуда не уйдут.');
  }

  let sent = 0;
  const failed: string[] = [];
  for (const { name, message } of planned) {
    const result = await sendEmail(message);
    if (result.sent) sent += 1;
    else failed.push(`${name}: ${result.error ?? 'не отправлено (stub?)'}`);
    console.log(`${result.sent ? 'отправлено' : 'НЕ ушло   '} ${name} → ${message.to} (outbox ${result.outboxId ?? '—'})`);
    /* Resend по умолчанию — 2 запроса в секунду. */
    await new Promise((resolve) => setTimeout(resolve, 600));
  }

  console.log(`\nотправлено ${sent} из ${planned.length}`);
  if (!failed.length) return 0;
  console.log('не ушло:');
  for (const line of failed) console.log('  ' + line);
  return 1;
}

process.exitCode = await run();
