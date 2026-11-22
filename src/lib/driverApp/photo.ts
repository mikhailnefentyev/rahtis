/**
 * Снимок с камеры телефона перед отправкой.
 *
 * Камера отдаёт 3–6 МБ, а в порту связь медленная и дорогая. Для
 * доказательства хватает 1600 px по длинной стороне — вмятина и номер
 * пломбы читаются, а файл в десять раз легче. Поворот берётся из EXIF
 * (imageOrientation), иначе снимок с телефона ложится боком.
 *
 * Не удалось перекодировать — возвращается исходник: потерять снимок
 * хуже, чем отправить тяжёлый. Но исходник тяжелее 4 МБ сервер не примет
 * вовсе, поэтому экраны и очередь проверяют размер (blobFits в
 * outboxPolicy) и просят снять заново (22.11.2026).
 */
export async function compressPhoto(file: File, maxSide = 1600, quality = 0.8): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
    return blob ?? file;
  } catch {
    return file;
  }
}
