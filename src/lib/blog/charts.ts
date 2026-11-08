/**
 * Графики к статьям блога из их же таблиц.
 *
 * Если в таблице есть колонка, где у трёх и больше строк число с одной и той
 * же единицей (€/kk, h, km, %…), над таблицей рисуется столбчатая диаграмма
 * этой колонки: подпись — первая ячейка строки. Цифры не придумываются —
 * только то, что уже написано в статье. Текстовые таблицы остаются как есть.
 *
 * Разметка своя и простая (div с шириной в %), её сразу вставляем в уже
 * очищенный HTML: в ней только наши классы, экранированный текст и числа.
 */

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const text = (html: string) =>
  html
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();

/* "2 400 €/kk" → { value: 2400, unit: "€/kk" }; диапазон "2 400–2 700" берёт первое число. */
function parseNumber(cell: string): { value: number; unit: string } | null {
  const m = cell.match(/^[^\d-]{0,3}(-?\d{1,3}(?:[\s  .]\d{3})+|-?\d+)(?:[,.](\d+))?\s*(.*)$/);
  if (!m) return null;
  const value = Number(`${m[1].replace(/[\s  .]/g, '')}${m[2] ? `.${m[2]}` : ''}`);
  if (!Number.isFinite(value)) return null;
  const unit = m[3]
    .replace(/^[–-]\s*[\d\s.,]+/, '')
    .trim()
    .slice(0, 12);
  return { value, unit };
}

type Chart = {
  title: string;
  unit: string;
  rows: { label: string; value: number; shown: string }[];
};

function chartOf(tableHtml: string): Chart | null {
  const rows = [...tableHtml.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map((r) =>
    [...r[1].matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/g)].map((c) => text(c[1])),
  );
  if (rows.length < 4) return null;
  const [head, ...body] = rows;
  for (let col = 1; col < head.length; col++) {
    const parsed = body.map((r) => (r[col] ? parseNumber(r[col]) : null));
    const ok = parsed.filter((p): p is { value: number; unit: string } => p !== null);
    if (ok.length < 3 || ok.length < body.length - 1) continue;
    const unit = ok[0].unit;
    if (!ok.every((p) => p.unit === unit) || ok.every((p) => p.value === ok[0].value) || ok.some((p) => p.value < 0)) continue;
    return {
      title: head[col],
      unit,
      rows: body.flatMap((r, i) => (parsed[i] ? [{ label: r[0], value: parsed[i]!.value, shown: r[col] }] : [])).slice(0, 12),
    };
  }
  return null;
}

function chartHtml(c: Chart, caption: string): string {
  const max = Math.max(...c.rows.map((r) => r.value));
  const bars = c.rows
    .map(
      (r, i) =>
        `<div class="blog-chart-row"><span class="blog-chart-label">${esc(r.label)}</span><span class="blog-chart-track"><span class="blog-chart-bar" style="width:${Math.max(4, Math.round((r.value / max) * 100))}%;animation-delay:${i * 80}ms"></span></span><span class="blog-chart-value">${esc(r.shown)}</span></div>`,
    )
    .join('');
  return `<figure class="blog-chart" aria-label="${esc(caption)}"><figcaption>${esc(c.title)}</figcaption>${bars}</figure>`;
}

/** HTML статьи с диаграммами над подходящими таблицами. */
export function withCharts(html: string, caption: string): string {
  return html.replace(/<table[\s\S]*?<\/table>/g, (table) => {
    const c = chartOf(table);
    return c ? `${chartHtml(c, caption)}${table}` : table;
  });
}
