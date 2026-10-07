/**
 * Сканер документа на телефоне: снимок камеры → лист → PDF.
 *
 * Как сканеры в приложениях перевозчиков (DFDS и др.): водитель снимает
 * накладную, приложение находит лист, выпрямляет его, убирает тени и
 * собирает страницы в один PDF. Всё на телефоне, без сети и без внешних
 * сервисов: накладная уходит в очередь, как любой снимок, и отправляется,
 * когда появится связь.
 *
 * Без OpenCV: библиотека весит мегабайты, а задача узкая — светлый лист
 * на более тёмном фоне. Порог Оцу, самая большая светлая область, четыре
 * крайние точки. Не нашлось — рамка с отступом, и водитель двигает углы
 * сам.
 */

export type Point = { x: number; y: number };
/** Углы листа по часовой стрелке от левого верхнего, в пикселях снимка. */
export type Quad = [Point, Point, Point, Point];

/** Длинная сторона рабочего снимка: больше не нужно для 150 dpi на A4. */
const WORK_SIDE = 2200;
/** Ширина страницы скана: A4 при 150 dpi. */
const PAGE_WIDTH = 1240;

export async function loadPhoto(file: Blob): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const scale = Math.min(1, WORK_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas;
}

function insetQuad(w: number, h: number): Quad {
  const dx = w * 0.06;
  const dy = h * 0.06;
  return [
    { x: dx, y: dy },
    { x: w - dx, y: dy },
    { x: w - dx, y: h - dy },
    { x: dx, y: h - dy },
  ];
}

/** Порог Оцу по гистограмме яркости. */
function otsu(gray: Uint8Array): number {
  const hist = new Array<number>(256).fill(0);
  for (const v of gray) hist[v]!++;
  const total = gray.length;
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i]!;
  let sumB = 0;
  let wB = 0;
  let best = 0;
  let threshold = 128;
  for (let i = 0; i < 256; i++) {
    wB += hist[i]!;
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;
    sumB += i * hist[i]!;
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > best) {
      best = between;
      threshold = i;
    }
  }
  return threshold;
}

/** Где на снимке лист. Не уверен — рамка с отступом для ручной правки. */
export function detectSheet(photo: HTMLCanvasElement): Quad {
  const w = photo.width;
  const h = photo.height;
  try {
    const scale = Math.min(1, 360 / Math.max(w, h));
    const sw = Math.max(1, Math.round(w * scale));
    const sh = Math.max(1, Math.round(h * scale));
    const small = document.createElement('canvas');
    small.width = sw;
    small.height = sh;
    const ctx = small.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(photo, 0, 0, sw, sh);
    const { data } = ctx.getImageData(0, 0, sw, sh);

    const gray = new Uint8Array(sw * sh);
    for (let i = 0; i < gray.length; i++) {
      gray[i] = (data[i * 4]! * 0.299 + data[i * 4 + 1]! * 0.587 + data[i * 4 + 2]! * 0.114) | 0;
    }
    const t = otsu(gray);

    /* Самая большая связная светлая область — лист. */
    const label = new Int32Array(sw * sh).fill(-1);
    let bestId = -1;
    let bestSize = 0;
    const stack: number[] = [];
    let id = 0;
    for (let start = 0; start < gray.length; start++) {
      if (gray[start]! <= t || label[start] !== -1) continue;
      let size = 0;
      stack.push(start);
      label[start] = id;
      while (stack.length) {
        const p = stack.pop()!;
        size++;
        const x = p % sw;
        const y = (p / sw) | 0;
        const next = [x > 0 ? p - 1 : -1, x < sw - 1 ? p + 1 : -1, y > 0 ? p - sw : -1, y < sh - 1 ? p + sw : -1];
        for (const n of next) {
          if (n >= 0 && label[n] === -1 && gray[n]! > t) {
            label[n] = id;
            stack.push(n);
          }
        }
      }
      if (size > bestSize) {
        bestSize = size;
        bestId = id;
      }
      id++;
    }

    /* Лист меньше пятой части кадра или весь кадр — это не лист. */
    const share = bestSize / gray.length;
    if (bestId < 0 || share < 0.2 || share > 0.97) return insetQuad(w, h);

    let tl = { v: Infinity, p: 0 };
    let br = { v: -Infinity, p: 0 };
    let tr = { v: -Infinity, p: 0 };
    let bl = { v: Infinity, p: 0 };
    for (let p = 0; p < label.length; p++) {
      if (label[p] !== bestId) continue;
      const x = p % sw;
      const y = (p / sw) | 0;
      if (x + y < tl.v) tl = { v: x + y, p };
      if (x + y > br.v) br = { v: x + y, p };
      if (x - y > tr.v) tr = { v: x - y, p };
      if (x - y < bl.v) bl = { v: x - y, p };
    }
    const toPoint = (p: number): Point => ({ x: ((p % sw) + 0.5) / scale, y: (((p / sw) | 0) + 0.5) / scale });
    return [toPoint(tl.p), toPoint(tr.p), toPoint(br.p), toPoint(bl.p)];
  } catch {
    return insetQuad(w, h);
  }
}

/** Гомография: точка страницы (u, v) → точка снимка. */
function homography(quad: Quad, W: number, H: number): (u: number, v: number) => Point {
  const src: Point[] = [
    { x: 0, y: 0 },
    { x: W, y: 0 },
    { x: W, y: H },
    { x: 0, y: H },
  ];
  /* Решение 8×8 методом Гаусса: a..h в x = (au+bv+c)/(gu+hv+1), y = (du+ev+f)/(gu+hv+1). */
  const A: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const { x: u, y: v } = src[i]!;
    const { x, y } = quad[i]!;
    A.push([u, v, 1, 0, 0, 0, -u * x, -v * x]);
    b.push(x);
    A.push([0, 0, 0, u, v, 1, -u * y, -v * y]);
    b.push(y);
  }
  for (let col = 0; col < 8; col++) {
    let pivot = col;
    for (let r = col + 1; r < 8; r++) if (Math.abs(A[r]![col]!) > Math.abs(A[pivot]![col]!)) pivot = r;
    [A[col], A[pivot]] = [A[pivot]!, A[col]!];
    [b[col], b[pivot]] = [b[pivot]!, b[col]!];
    for (let r = 0; r < 8; r++) {
      if (r === col) continue;
      const f = A[r]![col]! / A[col]![col]!;
      for (let c = col; c < 8; c++) A[r]![c]! -= f * A[col]![c]!;
      b[r]! -= f * b[col]!;
    }
  }
  const k = b.map((v, i) => v / A[i]![i]!);
  return (u, v) => {
    const d = k[6]! * u + k[7]! * v + 1;
    return { x: (k[0]! * u + k[1]! * v + k[2]!) / d, y: (k[3]! * u + k[4]! * v + k[5]!) / d };
  };
}

const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * Лист выпрямлен, тени убраны, контраст как у скана. Возвращает JPEG
 * страницы и её размер в пикселях.
 */
export async function renderPage(
  photo: HTMLCanvasElement,
  quad: Quad,
): Promise<{ jpeg: Blob; width: number; height: number }> {
  const [tl, tr, br, bl] = quad;
  const ratio = (dist(tl, bl) + dist(tr, br)) / Math.max(1, dist(tl, tr) + dist(bl, br));
  const W = PAGE_WIDTH;
  const H = Math.round(W * Math.min(2, Math.max(0.5, ratio)));

  const srcCtx = photo.getContext('2d', { willReadFrequently: true })!;
  const src = srcCtx.getImageData(0, 0, photo.width, photo.height).data;
  const sw = photo.width;
  const sh = photo.height;
  const map = homography(quad, W, H);

  const page = document.createElement('canvas');
  page.width = W;
  page.height = H;
  const ctx = page.getContext('2d', { willReadFrequently: true })!;
  const out = ctx.createImageData(W, H);
  const gray = new Uint8ClampedArray(W * H);

  for (let v = 0; v < H; v++) {
    for (let u = 0; u < W; u++) {
      const { x, y } = map(u + 0.5, v + 0.5);
      const xi = Math.min(sw - 1, Math.max(0, x | 0));
      const yi = Math.min(sh - 1, Math.max(0, y | 0));
      const s = (yi * sw + xi) * 4;
      gray[v * W + u] = src[s]! * 0.299 + src[s + 1]! * 0.587 + src[s + 2]! * 0.114;
    }
  }

  /* Фон — сильно размытая копия: деление на него убирает тени и неровный свет. */
  const tmp = document.createElement('canvas');
  tmp.width = W;
  tmp.height = H;
  const tctx = tmp.getContext('2d', { willReadFrequently: true })!;
  const img = tctx.createImageData(W, H);
  for (let i = 0; i < gray.length; i++) {
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = gray[i]!;
    img.data[i * 4 + 3] = 255;
  }
  tctx.putImageData(img, 0, 0);
  const bw = Math.max(1, Math.round(W / 28));
  const bh = Math.max(1, Math.round(H / 28));
  const blur = document.createElement('canvas');
  blur.width = bw;
  blur.height = bh;
  const bctx = blur.getContext('2d')!;
  bctx.imageSmoothingQuality = 'high';
  bctx.drawImage(tmp, 0, 0, bw, bh);
  tctx.imageSmoothingQuality = 'high';
  tctx.drawImage(blur, 0, 0, W, H);
  const bg = tctx.getImageData(0, 0, W, H).data;

  for (let i = 0; i < gray.length; i++) {
    const norm = (gray[i]! * 255) / Math.max(24, bg[i * 4]!);
    /* Уровни: бумага в белый, текст и штампы — плотнее. */
    const level = Math.min(255, Math.max(0, ((norm - 70) * 255) / (240 - 70)));
    out.data[i * 4] = out.data[i * 4 + 1] = out.data[i * 4 + 2] = level;
    out.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(out, 0, 0);

  const jpeg = await new Promise<Blob | null>((resolve) => page.toBlob(resolve, 'image/jpeg', 0.65));
  if (!jpeg) throw new Error('jpeg');
  return { jpeg, width: W, height: H };
}

/**
 * PDF из страниц-JPEG. Писатель свой и маленький: JPEG ложится в PDF как
 * есть (DCTDecode), без перекодирования, и библиотека ради этого не нужна.
 * Ширина страницы — A4 (595 pt), высота — по пропорции листа.
 */
export async function buildPdf(pages: Array<{ jpeg: Blob; width: number; height: number }>): Promise<Blob> {
  const enc = new TextEncoder();
  const parts: Uint8Array[] = [];
  const offsets: number[] = [];
  let length = 0;
  const push = (chunk: Uint8Array | string) => {
    const bytes = typeof chunk === 'string' ? enc.encode(chunk) : chunk;
    parts.push(bytes);
    length += bytes.length;
  };
  const object = (n: number, body: string) => {
    offsets[n] = length;
    push(`${n} 0 obj\n${body}\nendobj\n`);
  };

  push('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');

  const count = pages.length;
  /* 1 — каталог, 2 — дерево страниц, далее по три объекта на страницу. */
  const kids = pages.map((_, i) => `${3 + i * 3} 0 R`).join(' ');
  object(1, '<< /Type /Catalog /Pages 2 0 R >>');
  object(2, `<< /Type /Pages /Kids [${kids}] /Count ${count} >>`);

  for (let i = 0; i < count; i++) {
    const page = pages[i]!;
    const pageNo = 3 + i * 3;
    const W = 595.28;
    const H = +(W * (page.height / page.width)).toFixed(2);
    object(
      pageNo,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /XObject << /Im${i} ${pageNo + 1} 0 R >> >> /Contents ${pageNo + 2} 0 R >>`,
    );

    const jpeg = new Uint8Array(await page.jpeg.arrayBuffer());
    offsets[pageNo + 1] = length;
    push(
      `${pageNo + 1} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${page.width} /Height ${page.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`,
    );
    push(jpeg);
    push('\nendstream\nendobj\n');

    const content = `q ${W} 0 0 ${H} 0 0 cm /Im${i} Do Q`;
    object(pageNo + 2, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  }

  const total = 3 + count * 3;
  const xref = length;
  push(`xref\n0 ${total}\n0000000000 65535 f \n`);
  for (let n = 1; n < total; n++) push(`${String(offsets[n]).padStart(10, '0')} 00000 n \n`);
  push(`trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);

  return new Blob(parts as BlobPart[], { type: 'application/pdf' });
}
