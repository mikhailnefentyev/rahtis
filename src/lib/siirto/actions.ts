'use server';

import { revalidatePath } from 'next/cache';
import { getViewer } from '@/lib/auth/viewer';
import { defaultLocale, getDictionary, isLocale, type Locale } from '@/lib/i18n';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { createShippingDocument, deleteShippingDocument, siirtoConfig, SiirtoError, updateShippingDocument } from './client';
import { loadSiirto } from './load';

/*
 * «Отправить в SIIRTO» у рейса объекта (7.11.2026). Рейс читается под
 * правами перевозчика (RLS), отправка — от нашего API-пользователя SYKE,
 * результат пишется сервером (колонки siirto_* перевозчику не открыты).
 * Уже отправленный рейс отправляется правкой (PUT), а не вторым документом.
 */

export type SiirtoState = { error: string | null; sent: boolean };

/*
 * Те же ворота, что у кабинета (requireRole): отклонённая или
 * замороженная компания ничего не отправляет и не правит.
 */
async function activeCarrier() {
  const viewer = await getViewer();
  if (viewer.status !== 'ready' || viewer.role !== 'CARRIER' || !viewer.company) return null;
  if (viewer.company.status === 'REJECTED' || viewer.company.frozen_at) return null;
  return viewer;
}

const toLocale = (value: FormDataEntryValue | null): Locale => {
  const raw = String(value ?? '');
  return isLocale(raw) ? raw : defaultLocale;
};

export async function sendToSiirtoAction(_previous: SiirtoState, formData: FormData): Promise<SiirtoState> {
  const locale = toLocale(formData.get('locale'));
  const t = await getDictionary(locale);
  const viewer = await activeCarrier();
  if (!viewer) return { error: t.error.forbidden, sent: false };

  const config = siirtoConfig();
  if (!config) return { error: t.siirto.off, sent: false };

  const loadId = String(formData.get('load_id') ?? '');
  if (!/^[0-9a-f-]{36}$/i.test(loadId)) return { error: t.error.forbidden, sent: false };
  const data = await loadSiirto(loadId, viewer.company!);
  if (!data) return { error: t.error.forbidden, sent: false };
  if (!data.result.ok) return { error: t.siirto.incomplete, sent: false };

  const admin = createAdminClient();
  const remove = formData.get('intent') === 'delete';
  try {
    if (remove) {
      if (data.documentId) await deleteShippingDocument(config, data.documentId);
      await admin.from('site_loads').update({ siirto_document_id: null, siirto_sent_at: null, siirto_error: null }).eq('id', loadId);
    } else {
      const id = data.documentId
        ? await updateShippingDocument(config, data.documentId, data.result.body)
        : await createShippingDocument(config, data.result.body);
      await admin
        .from('site_loads')
        .update({ siirto_document_id: id || data.documentId, siirto_sent_at: new Date().toISOString(), siirto_error: null })
        .eq('id', loadId);
    }
  } catch (cause) {
    const message = cause instanceof SiirtoError ? cause.message : cause instanceof Error ? cause.message : String(cause);
    console.error('SIIRTO:', message);
    await admin.from('site_loads').update({ siirto_error: message.slice(0, 1000) }).eq('id', loadId);
    revalidatePath(`/${locale}/carrier/sites`, 'layout');
    return { error: t.siirto.failed.replace('{reason}', message.slice(0, 300)), sent: false };
  }

  revalidatePath(`/${locale}/carrier/sites`, 'layout');
  return { error: null, sent: true };
}

export type ReceiverState = { error: string | null; saved: boolean };

/**
 * Данные пункта приёмки как получателя в реестре. Непроверенный пункт
 * дополняет добавившая его компания, проверенный — оператор (база).
 */
export async function saveReceiverAction(_previous: ReceiverState, formData: FormData): Promise<ReceiverState> {
  const locale = toLocale(formData.get('locale'));
  const t = await getDictionary(locale);
  const viewer = await getViewer();
  const allowed = viewer.status === 'ready' && (viewer.role === 'ADMIN' || (await activeCarrier()) !== null);
  if (!allowed) return { error: t.error.forbidden, saved: false };

  const read = (key: string) => String(formData.get(key) ?? '').trim();
  const { error } = await (await createClient()).rpc('update_scale_site_receiver', {
    p_site_id: read('site_id'),
    p_operator_name: read('operator_name').slice(0, 160),
    p_operator_business_id: read('operator_business_id'),
    p_postal_code: read('postal_code'),
    p_contact_name: read('contact_name').slice(0, 120),
    p_contact_phone: read('contact_phone').replace(/[^\d+ ()-]/g, '').slice(0, 24),
    p_treatment_code: read('treatment_code'),
  });
  if (error) {
    console.warn('пункт приёмки не дополнен:', error.code, error.message);
    return { error: error.code === '42501' ? t.siirto.receiverLocked : error.code === '23514' ? t.siirto.receiverInvalid : t.error.generic, saved: false };
  }
  revalidatePath(`/${locale}/carrier/sites`, 'layout');
  return { error: null, saved: true };
}
