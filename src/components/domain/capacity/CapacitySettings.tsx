import { Button, Card, CardBody, Plate } from '@/components/ui';
import { setCapacityModeAction } from '@/lib/capacity/actions';
import type { Locale } from '@/lib/i18n';
import { getViewerI18n } from '@/lib/i18n/viewer';
import { createClient } from '@/lib/supabase/server';

/**
 * Догрузы: показывать ли свободное место — на компанию и на машину.
 *
 * «Спрашивать каждый раз» по умолчанию: без согласия маршрут никому не
 * показывается. Автопубликация — с уведомлением и отзывом в любой
 * момент; кто и когда её включил — журнал ниже (пишет база).
 */
export async function CapacitySettings({
  locale,
  vehicles,
}: {
  locale: Locale;
  vehicles: { id: string; plate: string; access: string }[];
}) {
  const [{ t, f }, supabase] = await Promise.all([getViewerI18n(locale), createClient()]);
  const c = t.capacity;

  const [{ data: settings, error }, { data: history }, { data: members }] = await Promise.all([
    supabase.from('capacity_publish_settings').select('vehicle_id, mode, changed_at'),
    supabase
      .from('capacity_publish_history')
      .select('id, plate, old_mode, new_mode, changed_at, changed_by')
      .order('changed_at', { ascending: false })
      .limit(10),
    supabase.rpc('company_members'),
  ]);
  const who = new Map((members ?? []).map((m) => [m.user_id, m.full_name || m.email]));
  /* До миграции таблицы нет — раздел не показываем. */
  if (error) return null;

  const companyMode = settings?.find((s) => s.vehicle_id === null)?.mode ?? 'ASK';
  const vehicleMode = new Map((settings ?? []).filter((s) => s.vehicle_id).map((s) => [s.vehicle_id as string, s.mode]));
  const label = (mode: string | null) => (mode === 'AUTO' ? c.modeAuto : mode === 'NEVER' ? c.modeNever : mode === 'ASK' ? c.modeAsk : c.modeOff);

  const select = (name: string, value: string, withInherit: boolean) => (
    <select name={name} defaultValue={value} className="h-9 rounded-control border border-line bg-surface px-2 text-[13px]">
      {withInherit && <option value="">{c.modeInherit.replace('{mode}', label(companyMode))}</option>}
      <option value="ASK">{c.modeAsk}</option>
      <option value="AUTO">{c.modeAuto}</option>
      <option value="NEVER">{c.modeNever}</option>
    </select>
  );

  return (
    <section id="capacity" className="mb-8 scroll-mt-24">
      <h2 className="mb-4 border-b border-line pb-2 text-[13px] font-semibold tracking-tight text-ink-faint">{c.settingsTitle}</h2>
      <Card>
        <CardBody className="flex flex-col gap-4">
          <p className="max-w-xl text-[13px] leading-relaxed text-ink-muted">{c.settingsLead}</p>

          <form action={setCapacityModeAction} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="locale" value={locale} />
            <label className="flex flex-col gap-1 text-[13px]">
              <span className="label-micro">{c.companyMode}</span>
              {select('mode', companyMode, false)}
            </label>
            <Button type="submit" size="sm">
              {c.save}
            </Button>
          </form>

          {vehicles.length > 0 && (
            <ul className="flex flex-col divide-y divide-line">
              {vehicles.map((v) => (
                <li key={v.id} className="py-2">
                  <form action={setCapacityModeAction} className="flex flex-wrap items-center gap-2">
                    <input type="hidden" name="locale" value={locale} />
                    <input type="hidden" name="vehicle_id" value={v.id} />
                    <Plate>{v.plate}</Plate>
                    {select('mode', vehicleMode.get(v.id) ?? '', true)}
                    <Button type="submit" size="sm" variant="ghost">
                      {c.save}
                    </Button>
                  </form>
                </li>
              ))}
            </ul>
          )}

          {(history ?? []).length > 0 && (
            <details>
              <summary className="cursor-pointer text-[13px] font-semibold text-accent">{c.historyTitle}</summary>
              <ul className="mt-2 flex flex-col gap-1 text-[12.5px] text-ink-muted">
                {(history ?? []).map((h) => (
                  <li key={h.id}>
                    {f.dateTime(h.changed_at)} · {h.plate ?? c.companyMode}: {label(h.old_mode)} → {label(h.new_mode)}
                    {h.changed_by && who.get(h.changed_by) ? ` · ${who.get(h.changed_by)}` : ''}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </CardBody>
      </Card>
    </section>
  );
}
