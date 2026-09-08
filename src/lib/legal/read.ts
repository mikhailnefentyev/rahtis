import 'server-only';

import { unstable_cache } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import type { Database } from '@/types/database';

type Kind = Database['public']['Enums']['legal_kind'];

export type LegalClause = {
  id: string;
  path: number[];
  /*
   * Номер — вычисляемая колонка, и типы честно зовут её необязательной.
   * Собирается он из адреса тем же способом, каким это делает база:
   * «5.2» — это path, склеенный точками.
   */
  number: string;
  title: string | null;
  body: string | null;
};

export type LegalDocumentData = {
  version: number;
  effective_from: string;
  clauses: LegalClause[];
};

/** Метка для сброса: снимается при активации редакции. */
export const LEGAL_TAG = 'legal';

/**
 * Действующая редакция документа со всеми пунктами.
 *
 * Читается служебным ключом и кладётся в кэш. Обе вольности объясняются
 * одним и тем же: документ публичный и у всех одинаковый. Условия
 * открыты аниму — их читают до того, как согласятся, — и правило RLS
 * разрешает ровно то же, что фильтр status здесь. Персонального в ответе
 * нет, кэшировать его безопасно.
 *
 * Меняется он в тот единственный момент, когда оператор активирует
 * редакцию, — тогда метка и снимается. До этого каждый заход стоил двух
 * последовательных обращений к базе за текстом, который не менялся
 * неделями.
 *
 * Документ и пункты берутся одним запросом: вложенная выборка PostgREST
 * вместо двух ходов туда-обратно.
 */
export const activeLegalDocument = unstable_cache(
  async (kind: Kind, locale: string): Promise<LegalDocumentData | null> => {
    const admin = createAdminClient();

    const { data } = await admin
      .from('legal_documents')
      .select('version, effective_from, legal_clauses(id, path, number, title, body, locale)')
      .eq('kind', kind)
      .eq('status', 'ACTIVE')
      .maybeSingle();

    if (!data) return null;

    /*
     * Язык отбирается здесь, а не в запросе: вложенная выборка
     * фильтруется отдельным параметром, и держать его в строке селектора
     * труднее для чтения, чем один filter по готовому массиву.
     */
    const clauses = (data.legal_clauses ?? [])
      .filter((clause) => clause.locale === locale)
      .map(({ id, path, number, title, body }) => ({
        id,
        path,
        number: number ?? path.join('.'),
        title,
        body,
      }))
      /* Порядок пунктов — их адрес: {5} перед {5,2}, {5,2} перед {6}. */
      .sort((a, b) => {
        const depth = Math.max(a.path.length, b.path.length);
        for (let i = 0; i < depth; i += 1) {
          const left = a.path[i] ?? -1;
          const right = b.path[i] ?? -1;
          if (left !== right) return left - right;
        }
        return 0;
      });

    return { version: data.version, effective_from: data.effective_from, clauses };
  },
  ['legal-document'],
  { tags: [LEGAL_TAG] },
);
