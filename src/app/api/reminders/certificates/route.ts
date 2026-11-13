import { bearerMatches } from '@/lib/auth/bearer';
import { sendCertificateReminders } from '@/lib/drivers/reminders';
import { sendVerificationReminders } from '@/lib/verification/reminders';
import { sendForwarderReminders } from '@/lib/forwarders/reminders';
import { refreshShipperRegistry } from '@/lib/trust/status';
import { deliverSensitiveChanges } from '@/lib/trust/sensitive';
import { sendInvoiceReminders } from '@/lib/invoices/reminders';
import { syncCapacity } from '@/lib/capacity/load';
import { sendMaintenanceReminders } from '@/lib/maintenance/reminders';

/* Перепроверка реестра идёт по одной компании с паузой — нужен запас (pg_net ждёт 60 с). */
export const maxDuration = 60;

/**
 * Напоминания о сроках удостоверений водителей.
 *
 * Зовёт база раз в день (app.run_certificate_reminders через pg_net), а
 * не браузер. Защита — тот же общий секрет планировщика, что у отчётов и
 * push: REPORTS_CRON_SECRET. Нет переменной — маршрут закрыт, а не
 * открыт всем.
 *
 * Под /api, поэтому proxy его не трогает и язык к адресу не приписывает.
 *
 * Тем же запуском — напоминания о сроках пакета tilaajavastuu
 * (src/lib/verification/reminders.ts): отдельное расписание в базе ради
 * одного запроса в день не нужно. Им же — за 30 и 7 дней до конца
 * полиса экспедитора (src/lib/forwarders/reminders.ts). И перепроверка
 * реестра у заказчиков прямого режима раз в неделю (src/lib/trust/status.ts):
 * сведения об оплате для перевозчика не должны стареть с даты заявки.
 * Её ошибки (реестр не ответил) статус ответа не портят — снимок
 * остаётся прежним, попытка повторится завтра.
 *
 * С 6.11.2026 им же — напоминания об оплате счетов перевозчиков
 * (src/lib/invoices/reminders.ts) и письма о смене реквизитов, не
 * ушедшие сразу (src/lib/trust/sensitive.ts): правка мимо формы.
 *
 * И ночной расчёт догрузов (src/lib/capacity/load.ts): истёкшее место
 * снимается, в режиме «автоматически» новое публикуется. Его ошибки
 * статус ответа не портят — расчёт повторится при заходе перевозчика.
 *
 * С 13.11.2026 им же — напоминания о сроках обслуживания машин и
 * прицепов (src/lib/maintenance/reminders.ts): ТО, katsastus, тахограф.
 */
export async function POST(request: Request) {
  const expected = process.env.REPORTS_CRON_SECRET?.trim();

  if (!expected) {
    /* Ответ читает база, а не человек, поэтому по-английски. */
    return Response.json({ error: 'REPORTS_CRON_SECRET is not set' }, { status: 503 });
  }

  if (!bearerMatches(request.headers.get('authorization'), expected)) {
    return Response.json({ error: 'forbidden' }, { status: 401 });
  }

  const [result, verification, forwarder, registry, invoices, sensitive, capacity, maintenance] = await Promise.all([
    sendCertificateReminders(),
    sendVerificationReminders(),
    sendForwarderReminders(),
    refreshShipperRegistry().catch((error: unknown) => ({
      checked: 0,
      updated: 0,
      errors: [error instanceof Error ? error.message : String(error)],
    })),
    sendInvoiceReminders().catch((error: unknown) => ({
      checked: 0,
      emails: 0,
      collections: 0,
      errors: [error instanceof Error ? error.message : String(error)],
    })),
    deliverSensitiveChanges().catch((error: unknown) => ({
      checked: 0,
      sent: 0,
      errors: [error instanceof Error ? error.message : String(error)],
    })),
    syncCapacity().catch((error: unknown) => ({
      published: 0,
      updated: 0,
      closed: 0,
      errors: [error instanceof Error ? error.message : String(error)],
    })),
    sendMaintenanceReminders().catch((error: unknown) => ({
      checked: 0,
      sent: 0,
      companies: 0,
      blocked: 0,
      errors: [error instanceof Error ? error.message : String(error)],
    })),
  ]);
  const failed =
    result.errors.length > 0 ||
    verification.errors.length > 0 ||
    forwarder.errors.length > 0 ||
    invoices.errors.length > 0 ||
    sensitive.errors.length > 0 ||
    maintenance.errors.length > 0;
  return Response.json({ ...result, verification, forwarder, registry, invoices, sensitive, capacity, maintenance }, { status: failed ? 207 : 200 });
}
