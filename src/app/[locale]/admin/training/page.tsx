import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Button, Card, CardBody, EmptyState, Input, Select } from '@/components/ui';
import { requireRole } from '@/lib/auth/guard';
import { getI18n, isLocale } from '@/lib/i18n';
import { DRIVER_LOCALES, DRIVER_LOCALE_NAMES } from '@/lib/i18n/driverLocale';
import { createClient } from '@/lib/supabase/server';
import { reviewShownQuestionsAction } from '@/lib/training/admin';
import { TRAINING_MODULES } from '@/lib/training/modules';
import { QuestionCard } from './QuestionCard';
import { QuestionForm } from './QuestionForm';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const { t } = await getI18n(locale);
  return { title: t.adminTraining.title };
}

const STATES = ['unreviewed', 'reviewed', 'inactive'] as const;
type StateFilter = (typeof STATES)[number] | 'all';

/**
 * Вопросы тренажёра водителя.
 *
 * Здесь оператор отдаёт вопросы инструктору и отмечает проверку: без
 * отметки вопрос в кабину не попадает. Фильтр — формой GET, чтобы
 * ссылку на «непроверенные по-эстонски» можно было переслать.
 */
export default async function TrainingAdminPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ module?: string; lang?: string; state?: string }>;
}) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();

  await requireRole(locale, 'ADMIN');

  const [{ t }, supabase] = await Promise.all([getI18n(locale), createClient()]);
  const texts = t.adminTraining;

  const topic = TRAINING_MODULES.find((m) => m.id === query.module)?.id ?? 'all';
  const lang = (DRIVER_LOCALES as readonly string[]).includes(query.lang ?? '') ? query.lang! : 'fi';
  const state: StateFilter = (STATES as readonly string[]).includes(query.state ?? '')
    ? (query.state as StateFilter)
    : query.state === 'all'
      ? 'all'
      : 'unreviewed';

  let request = supabase
    .from('training_questions')
    .select(
      'id, card_key, locale, question, options, correct_index, explanation, hint, legal_ref, valid_from, active, reviewed_by, reviewed_at',
    )
    .eq('locale', lang)
    .order('card_key');
  if (topic !== 'all') request = request.eq('module', topic);
  if (state === 'unreviewed') request = request.eq('active', true).is('reviewed_at', null);
  if (state === 'reviewed') request = request.eq('active', true).not('reviewed_at', 'is', null);
  if (state === 'inactive') request = request.eq('active', false);

  const { data } = await request;
  const questions = (data ?? []).map((row) => ({
    ...row,
    options: Array.isArray(row.options) ? row.options.map(String) : [],
  }));

  return (
    <main className="mx-auto w-full max-w-4xl px-5 py-8">
      <h1 className="text-xl font-semibold tracking-tight">{texts.title}</h1>
      <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-ink-muted">{texts.lede}</p>

      <form method="get" className="mt-6 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-[12px] text-ink-muted">
          {texts.module}
          <Select name="module" defaultValue={topic}>
            <option value="all">{texts.all}</option>
            {TRAINING_MODULES.map((m) => (
              <option key={m.id} value={m.id}>
                {t.training.modules[m.id].name}
              </option>
            ))}
          </Select>
        </label>
        <label className="flex flex-col gap-1 text-[12px] text-ink-muted">
          {texts.locale}
          <Select name="lang" defaultValue={lang}>
            {DRIVER_LOCALES.map((code) => (
              <option key={code} value={code}>
                {DRIVER_LOCALE_NAMES[code]}
              </option>
            ))}
          </Select>
        </label>
        <label className="flex flex-col gap-1 text-[12px] text-ink-muted">
          {texts.state}
          <Select name="state" defaultValue={state}>
            <option value="all">{texts.all}</option>
            {STATES.map((s) => (
              <option key={s} value={s}>
                {texts.states[s]}
              </option>
            ))}
          </Select>
        </label>
        <Button type="submit">{texts.filter}</Button>
      </form>

      <details className="mt-6">
        <summary className="cursor-pointer text-[13px] font-semibold text-accent">{texts.add}</summary>
        <Card className="mt-3">
          <CardBody>
            <QuestionForm />
          </CardBody>
        </Card>
      </details>

      {state === 'unreviewed' && questions.length > 0 && (
        <Card className="mt-6">
          <CardBody>
            <form action={reviewShownQuestionsAction} className="flex flex-col gap-3">
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="module" value={topic} />
              <input type="hidden" name="lang" value={lang} />
              <div>
                <p className="text-[14px] font-semibold">{texts.bulkTitle}</p>
                <p className="mt-0.5 text-[13px] text-ink-muted">{texts.bulkHint}</p>
              </div>
              <div className="flex flex-wrap items-end gap-3">
                <label className="flex flex-col gap-1 text-[12px] text-ink-muted">
                  {texts.reviewer}
                  <Input name="reviewer" required placeholder={texts.reviewerHint} />
                </label>
                <Button type="submit">{texts.bulkButton.replace('{count}', String(questions.length))}</Button>
              </div>
            </form>
          </CardBody>
        </Card>
      )}

      <div className="mt-6 flex flex-col gap-3">
        {questions.length === 0 ? (
          <EmptyState title={texts.empty} />
        ) : (
          questions.map((question) => <QuestionCard key={question.id} question={question} />)
        )}
      </div>
    </main>
  );
}
