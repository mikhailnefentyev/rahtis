import { Badge, Card, CardBody } from '@/components/ui';
import { PresenceMap, type PresencePoint } from '@/components/domain/PresenceMap';
import { getI18n, type Locale } from '@/lib/i18n';
import { createClient } from '@/lib/supabase/server';

/**
 * Где есть транспорт — в кабинете заказчика.
 *
 * Заказчик публикует заказ вслепую: есть ли в его городе хоть один
 * допущенный фургон, он узнаёт только тем, что никто не откликнулся. Для
 * платформы, которая обещает быстро закрывать перевозки при изменениях,
 * это худший способ ответить на вопрос «есть ли кому везти».
 *
 * Карточка отвечает на него до публикации и ровно настолько, насколько
 * это честно: город и число машин по веткам. Ни компании, ни номера, ни
 * адреса базы — их не отдаёт и сама функция.
 *
 * Пустой карты не бывает: пока ни у одной машины нет координаты базы,
 * блока нет вовсе. Карта Финляндии без единой точки читалась бы как
 * «перевозчиков нет», а означала бы «карточки заполнены до того, как у
 * базы появилась подсказка адреса».
 */
export async function CarrierPresence({ locale }: { locale: Locale }) {
  const [{ t, m }, supabase] = await Promise.all([getI18n(locale), createClient()]);

  const { data } = await supabase.rpc('carrier_presence');

  const points: PresencePoint[] = (data ?? [])
    .filter((row) => row.lat !== null && row.lon !== null)
    .map((row) => ({
      city: row.city,
      country: row.country,
      lat: row.lat as number,
      lon: row.lon as number,
      unit: row.unit_vehicles,
      express: row.express_vehicles,
    }));

  if (points.length === 0) return null;

  const unit = points.reduce((sum, p) => sum + p.unit, 0);
  const express = points.reduce((sum, p) => sum + p.express, 0);

  return (
    <section className="mt-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-2">
        <h2 className="text-[13px] font-semibold tracking-tight text-ink-faint">
          {t.presence.title}
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          {unit > 0 && <Badge tone="info">{m('presence.unitCount', { count: unit })}</Badge>}
          {express > 0 && (
            <Badge tone="warn">{m('presence.expressCount', { count: express })}</Badge>
          )}
        </div>
      </div>

      <Card>
        <CardBody className="flex flex-col gap-3">
          <p className="text-[13px] leading-relaxed text-ink-muted">{t.presence.hint}</p>

          <PresenceMap points={points} />

          {/*
            * Список рядом с картой, а не вместо неё.
            *
            * Карта отвечает на вопрос «далеко ли», список — на вопрос
            * «сколько и где именно», и по списку можно искать глазами
            * знакомое название. На телефоне карта к тому же мелкая, а
            * строка читается одинаково везде.
            */}
          <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
            {points.map((point) => (
              <li key={`${point.country}-${point.city}`} className="text-[13px] text-ink">
                {point.city}{' '}
                <span className="font-mono text-xs text-ink-dim">
                  {[
                    point.unit > 0 ? m('presence.unitShort', { count: point.unit }) : null,
                    point.express > 0 ? m('presence.expressShort', { count: point.express }) : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>
    </section>
  );
}
