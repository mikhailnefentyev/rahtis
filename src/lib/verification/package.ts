import 'server-only';

import { daysUntil } from '@/lib/dates';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { itemStatus, parsePackage, type ItemStatus, type PackageDocument, type VerificationPackage } from './items';

export const VERIFICATION_BUCKET = 'verification-docs';

/** Ссылка на файл живёт десять минут: страницу по ссылке открывают и читают, а не хранят. */
const SIGNED_URL_SECONDS = 600;

export type ViewDocument = Omit<PackageDocument, 'storage_path'> & { url: string | null };

export type PackageView = Omit<VerificationPackage, 'documents' | 'items'> & {
  items: Array<VerificationPackage['items'][number] & { status: ItemStatus; daysLeft: number | null }>;
  documents: ViewDocument[];
};

/**
 * Пакет → вид для страницы: состояние пунктов по сегодняшней дате
 * (считается на сервере, часы клиента могут врать) и подписанные ссылки
 * на файлы. Подписывает сервер служебным ключом — но только пути, которые
 * отдала функция базы после проверки доступа (вход или живой токен).
 * Путь файла наружу не уходит.
 */
async function toView(pkg: VerificationPackage, sign: boolean): Promise<PackageView> {
  const items = pkg.items.map((i) => {
    const daysLeft = i.valid_until ? daysUntil(`${i.valid_until}T12:00:00Z`) : null;
    return { ...i, daysLeft, status: itemStatus(daysLeft) };
  });

  let urls: Array<string | null> = pkg.documents.map(() => null);
  if (sign && pkg.documents.length > 0) {
    const { data } = await createAdminClient()
      .storage.from(VERIFICATION_BUCKET)
      .createSignedUrls(
        pkg.documents.map((d) => d.storage_path),
        SIGNED_URL_SECONDS,
      );
    urls = pkg.documents.map((d) => data?.find((s) => s.path === d.storage_path)?.signedUrl ?? null);
  }

  return {
    ...pkg,
    items,
    documents: pkg.documents.map((d, index) => ({
      id: d.id,
      items: d.items,
      source: d.source,
      file_name: d.file_name,
      issued_on: d.issued_on,
      valid_until: d.valid_until,
      url: urls[index],
    })),
  };
}

/** Пакет внутри RAHTIS: сам перевозчик, оператор, заказчик-партнёр. NULL — нет доступа. */
export async function loadPackage(companyId: string, sign = true): Promise<PackageView | null> {
  const supabase = await createClient();
  const { data } = await supabase.rpc('verification_package', { p_company_id: companyId });
  const pkg = parsePackage(data);
  return pkg ? toView(pkg, sign) : null;
}

/** Пакет по ссылке без входа. NULL — ссылки нет, она отозвана или истекла. */
export async function loadSharedPackage(token: string): Promise<PackageView | null> {
  if (!/^[0-9a-f]{64}$/.test(token)) return null;
  const { data } = await createAdminClient().rpc('verification_share_package', { p_token: token });
  const pkg = parsePackage(data);
  return pkg ? toView(pkg, true) : null;
}
