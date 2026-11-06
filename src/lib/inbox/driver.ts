import 'server-only';

import { cache } from 'react';
import { stopTimeZone } from '@/lib/country';
import { getDriver } from '@/lib/driverApp/session';
import { getDriverTasks } from '@/lib/driverApp/tasks';
import type { Locale } from '@/lib/i18n';
import { createClient } from '@/lib/supabase/server';
import { rankItems, type InboxItem } from './rank';
import type { InboxResult } from './common';

/**
 * «Требует действия» водителя — только то, чего нет на карточках
 * заданий: правки маршрута без «Nähty» и смена, не закрытая со
 * вчерашнего дня. Принять задание и следующая точка — на карточках.
 */
export const loadDriverInbox = cache(async (locale: Locale): Promise<InboxResult> => {
  const [supabase, driver, tasks] = await Promise.all([createClient(), getDriver(), getDriverTasks()]);
  if (!driver) return { items: [], total: 0 };
  const items: InboxItem[] = [];

  /* Заданий в работе у водителя единицы — запрос на каждое, разом. */
  const active = tasks.filter((t) => t.status === 'IN_PROGRESS' || t.status === 'AWAIT_DRIVER');
  const changes = await Promise.all(active.map((t) => supabase.rpc('driver_route_changes', { p_order_id: t.id })));
  active.forEach((task, i) => {
    const rows = changes[i]?.data ?? [];
    if (rows.length === 0) return;
    items.push({
      key: `route:${task.id}:${rows.length}`,
      kind: 'routeChanged',
      urgency: 0,
      at: rows[0]!.created_at,
      ref: task.ref,
      note: String(rows.length),
      href: `/${locale}/driver/task/${task.id}`,
      op: { op: 'driverAckChanges', orderId: task.id },
    });
  });

  /* Смена с прошлого дня (по часовому поясу компании) — закончить день. */
  if (driver.shift) {
    const day = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: stopTimeZone(driver.company_country) }).format(d);
    if (day(new Date(driver.shift.started_at)) < day(new Date())) {
      items.push({ key: `shift:${driver.shift.id}`, kind: 'shiftOpen', urgency: 0, at: driver.shift.started_at, date: driver.shift.started_at, href: '#shift' });
    }
  }

  return rankItems(items, [], new Date(), 20);
});
