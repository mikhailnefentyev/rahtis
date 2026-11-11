import 'server-only';

import { cache } from 'react';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { GATE_OPEN, gateFromRow, type DocsGate } from './docsGate';

/**
 * Документы экспедитора своей компании (public.forwarder_docs_status).
 * Один запрос на отрисовку: плашка в раскладке и кнопки на странице
 * спрашивают одно и то же. Ошибка или нет функции (до миграции) —
 * открыто: запрет всё равно в базе.
 */
export const loadOwnDocsGate = cache(async (): Promise<DocsGate> => {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('forwarder_docs_status', {});
    if (error) return GATE_OPEN;
    return gateFromRow(data?.[0]);
  } catch {
    return GATE_OPEN;
  }
});

/** Чужие компании — оператору (своим ключом сессии) или серверу. */
export async function loadDocsGates(companyIds: readonly string[], asService = false): Promise<Record<string, DocsGate>> {
  const unique = [...new Set(companyIds.filter(Boolean))];
  if (unique.length === 0) return {};
  try {
    const supabase = asService ? createAdminClient() : await createClient();
    const { data, error } = await supabase.rpc('forwarder_docs_status', { p_company_ids: unique });
    if (error) return {};
    return Object.fromEntries((data ?? []).map((row) => [row.company_id, gateFromRow(row)]));
  } catch {
    return {};
  }
}
