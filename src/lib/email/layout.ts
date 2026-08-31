/**
 * Оформление письма.
 *
 * Вёрстка таблицами и стили в атрибутах — не архаика, а требование
 * почтовых клиентов: Outlook рисует движком Word, где нет ни flexbox, ни
 * grid, а Gmail вырезает <style> из <head> при пересылке. Всё, что
 * должно уцелеть, живёт в атрибуте style каждого элемента.
 *
 * Марка набрана текстом, а не картинкой. Две причины, и обе рабочие:
 * половина клиентов не показывает изображения, пока человек не разрешит,
 * а нашего логотипа сейчас нет по публичному адресу — сайт не выложен, и
 * ссылка вела бы в пустоту. Буквы же приходят всегда. Когда домен
 * заработает, картинку можно добавить рядом, но текст должен остаться:
 * письмо обязано читаться с выключенными изображениями.
 *
 * Цвета те же, что на сайте: чернила логотипа, его голубой на акценте,
 * холодный светлый фон. Значения числами — переменные CSS в письме
 * бессмысленны.
 */

const INK = '#0c1626';
const INK_MUTED = '#44546b';
const INK_FAINT = '#5f6f86';
const GROUND = '#eef1f6';
const LINE = '#dae0ea';
const ACCENT = '#0d647f';
const ACCENT_BRIGHT = '#00a8d8';

const FONT =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

/*
 * В подвале письма — юридическое лицо, а не марка. Здесь Y-tunnus, и
 * получатель должен видеть, с кем он имеет дело по договору. В теле
 * письма при этом подписывается RAHTIS: человек переписывается с
 * платформой, а счёт ему выставляет Aivomaa Oy.
 *
 * Значение написано здесь, а не взято из lib/config, и это вынужденно:
 * модуль читает не только приложение, но и scripts/send-test-email.mjs
 * голым Node, который не знает ни про алиас «@/», ни про импорт без
 * расширения. Проверять письмо не тем шаблоном, который уйдёт людям,
 * хуже, чем продублировать одну строку. При смене реквизитов править
 * оба места — в lib/config.ts стоит встречная пометка.
 */
const LEGAL = 'Aivomaa Oy · Y-tunnus 3592993-6';

/** Подпись в теле. Не ставится там, где письмо пришло НАМ, а не от нас. */
const SIGNATURE = 'Rahtis Team';

export type EmailBlock =
  | { kind: 'text'; value: string }
  | { kind: 'note'; value: string }
  | { kind: 'button'; label: string; href: string }
  | { kind: 'facts'; rows: Array<[string, string]> };

function escape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function block(item: EmailBlock): string {
  switch (item.kind) {
    case 'text':
      return `<p style="margin:0 0 14px;font:400 15px/1.55 ${FONT};color:${INK_MUTED};">${escape(item.value)}</p>`;

    /* Мелкая строка под основным текстом: предупреждение, срок, оговорка. */
    case 'note':
      return `<p style="margin:18px 0 0;font:400 13px/1.5 ${FONT};color:${INK_FAINT};">${escape(item.value)}</p>`;

    /*
     * Кнопка таблицей, а не ссылкой с padding: Outlook игнорирует
     * внутренние отступы у <a>, и «кнопка» схлопывается в текст.
     * Адрес продублирован строкой ниже — часть клиентов ломает ссылки
     * при пересылке, и человеку должно остаться что скопировать.
     */
    case 'button':
      return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0 6px;">
  <tr><td align="center" bgcolor="${ACCENT}" style="border-radius:6px;">
    <a href="${escape(item.href)}" style="display:inline-block;padding:12px 26px;font:600 15px/1 ${FONT};color:#ffffff;text-decoration:none;border-radius:6px;">${escape(item.label)}</a>
  </td></tr>
</table>
<p style="margin:8px 0 0;font:400 12px/1.5 ${FONT};color:${INK_FAINT};word-break:break-all;">${escape(item.href)}</p>`;

    /* Пары «поле — значение»: суммы, номера, сроки. Цифры моноширинным. */
    case 'facts':
      return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:18px 0 4px;border-top:1px solid ${LINE};">
${item.rows
  .map(
    ([k, v]) => `  <tr>
    <td style="padding:9px 12px 9px 0;font:400 13px/1.4 ${FONT};color:${INK_FAINT};border-bottom:1px solid ${LINE};">${escape(k)}</td>
    <td align="right" style="padding:9px 0;font:600 13px/1.4 ui-monospace,'SFMono-Regular',Consolas,monospace;color:${INK};border-bottom:1px solid ${LINE};">${escape(v)}</td>
  </tr>`,
  )
  .join('\n')}
</table>`;
  }
}

/**
 * Собирает письмо целиком.
 *
 * preheader — строка, которую почтовый клиент показывает в списке рядом
 * с темой. Без неё туда попадает начало вёрстки, и в ящике письмо
 * выглядит как «RAHTIS RAHTIS Hei,». Прячется нулевым размером и
 * прозрачным цветом — приём общий для всей отрасли.
 */
export function renderEmail(input: {
  heading: string;
  preheader: string;
  blocks: EmailBlock[];
  operatorEmail: string;
  /** Письмо пришло НАМ, а не от нас — тогда подписи быть не должно. */
  incoming?: boolean;
}): string {
  return `<!doctype html>
<html lang="fi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${escape(input.heading)}</title>
</head>
<body style="margin:0;padding:0;background:${GROUND};">
<div style="display:none;font-size:0;line-height:0;max-height:0;opacity:0;overflow:hidden;">${escape(input.preheader)}</div>

<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${GROUND};">
<tr><td align="center" style="padding:28px 16px;">

  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:600px;max-width:100%;background:#ffffff;border:1px solid ${LINE};border-radius:10px;overflow:hidden;">

    <tr><td bgcolor="${INK}" style="padding:20px 28px;">
      <span style="font:700 20px/1 ${FONT};letter-spacing:0.14em;color:#ffffff;">RAHTI<span style="color:${ACCENT_BRIGHT};">S</span></span>
      <span style="display:block;margin-top:7px;font:600 10px/1.2 ${FONT};letter-spacing:0.13em;text-transform:uppercase;color:#8fa3bd;">Kuljetusalusta · Suomi</span>
    </td></tr>

    <tr><td style="padding:28px;">
      <h1 style="margin:0 0 16px;font:600 19px/1.3 ${FONT};color:${INK};">${escape(input.heading)}</h1>
      ${input.blocks.map(block).join('\n      ')}
    </td></tr>

    <tr><td style="padding:18px 28px 22px;border-top:1px solid ${LINE};background:#f6f8fb;">
      <p style="margin:0;font:400 12px/1.6 ${FONT};color:${INK_FAINT};">
        ${LEGAL}<br>
        <a href="mailto:${escape(input.operatorEmail)}" style="color:${ACCENT};text-decoration:none;">${escape(input.operatorEmail)}</a>
      </p>
      <p style="margin:10px 0 0;font:400 11px/1.5 ${FONT};color:#8894a6;">
        Emme koskaan kysy salasanaasi sähköpostitse emmekä puhelimessa.
      </p>
    </td></tr>

  </table>

</td></tr>
</table>
</body>
</html>`;
}

/**
 * Тот же набор блоков простым текстом.
 *
 * Не запасной вариант, а обязательная половина письма: письмо без
 * текстовой части спам-фильтры считают подозрительным, а часть людей
 * читает почту без HTML по собственному выбору.
 */
export function renderText(input: {
  heading: string;
  blocks: EmailBlock[];
  operatorEmail: string;
  incoming?: boolean;
}): string {
  const body = input.blocks
    .map((item) => {
      switch (item.kind) {
        case 'text':
        case 'note':
          return item.value;
        case 'button':
          return `${item.label}:\n${item.href}`;
        case 'facts':
          return item.rows.map(([k, v]) => `${k}: ${v}`).join('\n');
      }
    })
    .join('\n\n');

  return [
    input.heading,
    '',
    body,
    ...(input.incoming ? [] : ['', SIGNATURE]),
    '',
    'Emme koskaan kysy salasanaasi sähköpostitse emmekä puhelimessa.',
    '',
    LEGAL,
    input.operatorEmail,
  ].join('\n');
}
