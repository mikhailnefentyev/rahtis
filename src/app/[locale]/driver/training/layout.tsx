import { cn } from '@/lib/cn';
import { getDriver } from '@/lib/driverApp/session';
import { DriverNav } from '../DriverNav';

/**
 * Тренажёр открыт и гостю — водителю, которого ещё не пригласили, или
 * тому, кто хочет повторить правила до работы (п. 5 задания). Водитель
 * видит его внутри приложения с нижней навигацией, гость — одну страницу
 * со ссылкой на вход, а прогресс у него живёт только в телефоне.
 */
export default async function TrainingLayout({ children }: { children: React.ReactNode }) {
  const driver = await getDriver();

  return (
    <>
      <div
        className={cn(
          'mx-auto w-full max-w-lg px-4 pt-[max(env(safe-area-inset-top),16px)]',
          driver ? 'pb-28' : 'pb-[max(env(safe-area-inset-bottom),24px)]',
        )}
      >
        {children}
      </div>
      {driver && <DriverNav unread={driver.unread} />}
    </>
  );
}
