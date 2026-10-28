import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Удаление фото рейсов старше срока хранения (24 месяца, политика 8.4).
 *
 * Кого удалять, решает база (retention_photo_candidates): фото погрузки,
 * выгрузки и повреждений закрытых рейсов без открытой претензии. CMR
 * сюда не попадает — это бухгалтерский документ, у него шесть лет.
 *
 * Сначала файлы, потом строки. Если хранилище ответило ошибкой, строки
 * остаются, и следующий запуск попробует снова. Если без ошибки — строки
 * пакета удаляются все: файла, которого уже не было, хранилище в ответе
 * не вернёт, но ссылаться такой строке всё равно не на что.
 */

export type PhotoRetentionResult = { candidates: number; removed: number; errors: string[] };

const BATCH = 500;
/* Не больше двух тысяч за запуск: маршрут должен уложиться в таймаут pg_net. */
const MAX_ROUNDS = 4;

export async function purgeExpiredTripPhotos(): Promise<PhotoRetentionResult> {
  const admin = createAdminClient();
  const result: PhotoRetentionResult = { candidates: 0, removed: 0, errors: [] };

  for (let round = 0; round < MAX_ROUNDS; round += 1) {
    const { data: rows, error } = await admin.rpc('retention_photo_candidates', { p_limit: BATCH });
    if (error) {
      result.errors.push(error.message);
      break;
    }
    if (!rows || rows.length === 0) break;
    result.candidates += rows.length;

    const { error: storageError } = await admin.storage.from('trip-docs').remove(rows.map((row) => row.storage_path));
    if (storageError) {
      result.errors.push(storageError.message);
      break;
    }

    const { error: deleteError } = await admin
      .from('order_documents')
      .delete()
      .in(
        'id',
        rows.map((row) => row.id),
      );
    if (deleteError) {
      result.errors.push(deleteError.message);
      break;
    }
    result.removed += rows.length;

    if (rows.length < BATCH) break;
  }

  return result;
}

/**
 * Заправки и месячные отчёты старше 24 месяцев (политика 8.4): сначала
 * фото чеков и файлы отчётов в fuel-docs, потом строки. Тот же порядок и
 * те же пределы, что у фото рейсов.
 */
export async function purgeExpiredFuel(): Promise<PhotoRetentionResult> {
  const admin = createAdminClient();
  const result: PhotoRetentionResult = { candidates: 0, removed: 0, errors: [] };

  for (let round = 0; round < MAX_ROUNDS; round += 1) {
    const { data: rows, error } = await admin.rpc('retention_fuel_candidates', { p_limit: BATCH });
    if (error) {
      result.errors.push(error.message);
      break;
    }
    if (!rows || rows.length === 0) break;
    result.candidates += rows.length;

    /* Одно фото чека на несколько строк заправки (дизель + AdBlue): путь удаляется один раз. */
    const paths = [...new Set(rows.map((row) => row.storage_path).filter((path): path is string => Boolean(path)))];
    if (paths.length > 0) {
      const { error: storageError } = await admin.storage.from('fuel-docs').remove(paths);
      if (storageError) {
        result.errors.push(storageError.message);
        break;
      }
    }

    const entries = rows.filter((row) => row.kind === 'ENTRY').map((row) => row.id);
    const imports = rows.filter((row) => row.kind === 'IMPORT').map((row) => row.id);
    const [{ error: entriesError }, { error: importsError }] = await Promise.all([
      entries.length ? admin.from('fuel_entries').delete().in('id', entries) : Promise.resolve({ error: null }),
      imports.length ? admin.from('fuel_imports').delete().in('id', imports) : Promise.resolve({ error: null }),
    ]);
    if (entriesError || importsError) {
      result.errors.push((entriesError ?? importsError)!.message);
      break;
    }
    result.removed += rows.length;

    if (rows.length < BATCH) break;
  }

  return result;
}
