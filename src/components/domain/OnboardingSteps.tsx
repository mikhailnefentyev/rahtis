import Link from 'next/link';
import { buttonClass, Card, CardBody } from '@/components/ui';
import { accountPath } from '@/lib/auth/paths';
import { getI18n, type Locale } from '@/lib/i18n';
import { createClient } from '@/lib/supabase/server';
import type { Company } from '@/types/db';

/**
 * Путь от одобрения до первой работы — шагами, с тем, что уже сделано.
 *
 * Замер 29.09.2026: из тринадцати одобренных перевозчиков до стола дошли
 * четыре, девять остановились сразу после одобрения — ни документа, ни
 * машины. Кабинет говорил им одну фразу «заполните реквизиты», а что
 * будет дальше и сколько ещё идти, не видно было нигде. Теперь виден
 * весь путь, текущий шаг и кнопка к нему.
 *
 * Шаги считаются из базы, а не хранятся: сделанное нельзя «забыть
 * отметить». Когда все шаги сделаны, карточки нет.
 */

type Step = {
  key: string;
  title: string;
  text: string;
  state: 'done' | 'now' | 'waiting' | 'later';
  href: string;
  action: string;
};

export async function OnboardingSteps({ locale, company }: { locale: Locale; company: Company }) {
  const { t } = await getI18n(locale);
  const o = t.onboarding;
  const supabase = await createClient();
  const active = company.status === 'ACTIVE';

  let steps: Step[];

  if (company.kind === 'CARRIER') {
    const [{ data: readiness }, { count: vehicles }, { count: drivers }] = await Promise.all([
      supabase.rpc('company_readiness', { p_company_id: company.id }),
      supabase.from('vehicles').select('id', { count: 'exact', head: true }).eq('company_id', company.id),
      supabase
        .from('drivers')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', company.id)
        .eq('status', 'ACTIVE'),
    ]);
    const r = readiness?.[0];
    const docs = Boolean(r?.has_license && r?.has_insurance);
    const approvedVehicles = r?.approved_vehicles ?? 0;
    const desk = Boolean(r?.can_take_orders);

    steps = [
      { key: 'activate', title: o.activate, text: o.activateText, state: active ? 'done' : 'now', href: accountPath(locale), action: o.activateAction },
      {
        key: 'docs',
        title: o.docs,
        text: o.docsText,
        state: docs ? 'done' : 'later',
        href: `/${locale}/carrier/fleet`,
        action: o.docsAction,
      },
      {
        key: 'vehicle',
        title: o.vehicle,
        text: approvedVehicles === 0 && (vehicles ?? 0) > 0 ? o.vehicleWaiting : o.vehicleText,
        state: approvedVehicles > 0 ? 'done' : (vehicles ?? 0) > 0 ? 'waiting' : 'later',
        href: `/${locale}/carrier/fleet`,
        action: o.vehicleAction,
      },
      {
        key: 'driver',
        title: o.driver,
        text: o.driverText,
        state: (drivers ?? 0) > 0 ? 'done' : 'later',
        href: `/${locale}/carrier/drivers`,
        action: o.driverAction,
      },
      {
        key: 'desk',
        title: o.desk,
        text: o.deskText,
        state: desk ? 'done' : 'later',
        href: `/${locale}/carrier/desk`,
        action: o.deskAction,
      },
    ];
  } else if (company.kind === 'SHIPPER') {
    const { count: orders } = await supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('shipper_company_id', company.id);
    steps = [
      { key: 'activate', title: o.activate, text: o.activateTextShipper, state: active ? 'done' : 'now', href: accountPath(locale), action: o.activateAction },
      {
        key: 'order',
        title: o.firstOrder,
        text: o.firstOrderText,
        state: (orders ?? 0) > 0 ? 'done' : 'later',
        href: `/${locale}/shipper/orders`,
        action: o.firstOrderAction,
      },
    ];
  } else {
    return null;
  }

  /* Текущий шаг — первый несделанный, если он не ждёт нашей проверки. */
  const first = steps.find((s) => s.state !== 'done');
  if (!first) return null;
  if (first.state === 'later') first.state = 'now';

  const done = steps.filter((s) => s.state === 'done').length;

  return (
    <Card stripe="warn" className="mt-4">
      <CardBody className="flex flex-col gap-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-[15px] font-semibold tracking-tight">{o.title}</h2>
          <span className="text-[12px] text-ink-muted">
            {o.progress.replace('{done}', String(done)).replace('{total}', String(steps.length))}
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-pill bg-sunken" aria-hidden="true">
          <div className="h-full rounded-pill bg-accent" style={{ width: `${(done / steps.length) * 100}%` }} />
        </div>

        <ol className="flex flex-col gap-2.5">
          {steps.map((step, i) => (
            <li
              key={step.key}
              className={`flex items-start gap-3 rounded-control border p-3 ${
                step.state === 'now' ? 'border-accent-line bg-accent-wash' : 'border-line'
              }`}
            >
              <span
                className={`mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full text-[12px] font-semibold ${
                  step.state === 'done'
                    ? 'bg-ok text-white'
                    : step.state === 'now'
                      ? 'bg-accent text-white'
                      : 'border border-line-strong text-ink-muted'
                }`}
                aria-hidden="true"
              >
                {step.state === 'done' ? '✓' : i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className={`text-[14px] font-semibold ${step.state === 'done' ? 'text-ink-muted line-through' : 'text-ink'}`}>
                  {step.title}
                  {step.state === 'waiting' && <span className="ml-2 text-[12px] font-normal text-warn">{o.waiting}</span>}
                </p>
                {step.state !== 'done' && <p className="mt-0.5 text-[13px] leading-relaxed text-ink-muted">{step.text}</p>}
              </div>
              {step.state === 'now' && (
                <Link href={step.href} className={buttonClass({ variant: 'primary', size: 'sm', className: 'flex-none' })}>
                  {step.action}
                </Link>
              )}
            </li>
          ))}
        </ol>
      </CardBody>
    </Card>
  );
}
