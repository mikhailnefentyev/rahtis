import { notFound } from 'next/navigation';
import { driverLocaleOf } from '@/lib/driverApp/i18n';
import { getDriver } from '@/lib/driverApp/session';
import { isLocale } from '@/lib/i18n';
import { isTrainingModule, TRAINING_MODULES } from '@/lib/training/modules';
import { getTrainingCards, getTrainingProgress } from '@/lib/training/questions';
import { TrainingApp, type TrainingTab } from './TrainingApp';

/**
 * Тренажёр водителя (Koulutus): тахограф и крепление груза.
 *
 * Вопросы — на языке приложения водителя, из базы и только проверенные
 * инструктором. Прогресс из базы — только свой: чужого база не отдаст.
 */
export default async function TrainingPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ m?: string; tab?: string }>;
}) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();

  const [driver, driverLocale] = await Promise.all([getDriver(), driverLocaleOf(locale)]);
  const [cards, progress] = await Promise.all([
    getTrainingCards(driverLocale),
    driver ? getTrainingProgress() : Promise.resolve({}),
  ]);

  const tab: TrainingTab = query.tab === 'practice' || query.tab === 'rules' ? query.tab : 'train';

  return (
    <TrainingApp
      cards={cards}
      driverId={driver?.id ?? null}
      serverProgress={progress}
      // eslint-disable-next-line react-hooks/purity -- время запроса, одно на рендер страницы
      serverNow={Date.now()}
      initialModule={isTrainingModule(query.m) ? query.m : TRAINING_MODULES[0].id}
      initialTab={tab}
    />
  );
}
