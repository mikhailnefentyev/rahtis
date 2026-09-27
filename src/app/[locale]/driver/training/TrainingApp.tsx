'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useI18n } from '@/lib/i18n/provider';
import { resetTrainingAction, syncTrainingAction } from '@/lib/training/actions';
import {
  answerCard,
  buildRound,
  dueCount,
  freshness,
  freshnessState,
  mergeProgress,
  newCount,
  newerThan,
  type Progress,
} from '@/lib/training/leitner';
import { TRAINING_MODULES, type TrainingCard, type TrainingModuleId } from '@/lib/training/modules';
import {
  readPrefs,
  readProgress,
  takeGuestProgress,
  writePrefs,
  writeProgress,
} from '@/lib/training/store';
import { CargoGame } from './CargoGame';
import { CheatSheet } from './CheatSheet';
import { Quiz } from './Quiz';
import { ShiftPlanner } from './ShiftPlanner';
import { TachoDisplay } from './TachoDisplay';
import { Segmented } from './ui';

export type TrainingTab = 'train' | 'practice' | 'rules';

/**
 * Тренажёр водителя.
 *
 * Прогресс живёт в двух местах. На телефоне — всегда: ответ в кабине без
 * связи не пропадает, гость без входа тоже учится. В базе — у водителя:
 * всё, что на телефоне новее, чем в базе, уходит туда при открытии, после
 * каждого ответа и когда появилась связь. Слияние по карточке — более
 * поздний ответ побеждает (mergeProgress), тем же правилом, что в
 * training_sync.
 */
export function TrainingApp({
  cards,
  driverId,
  serverProgress,
  serverNow,
  initialModule,
  initialTab,
}: {
  cards: TrainingCard[];
  driverId: string | null;
  serverProgress: Progress;
  serverNow: number;
  initialModule: TrainingModuleId;
  initialTab: TrainingTab;
}) {
  const { t, locale } = useI18n();
  const [topic, setTopic] = useState<TrainingModuleId>(initialModule);
  const [tab, setTab] = useState<TrainingTab>(initialTab);
  const [mode, setMode] = useState<'pro' | 'new'>('pro');
  const [progress, setProgress] = useState<Progress>(serverProgress);
  /* Время первого рендера — с сервера, чтобы проценты совпали при гидратации. */
  const [now, setNow] = useState(serverNow);

  const progressRef = useRef(progress);
  const synced = useRef<Progress>(serverProgress);

  const flush = useCallback(async () => {
    if (!driverId) return;
    const pending = newerThan(progressRef.current, synced.current);
    if (Object.keys(pending).length === 0) return;
    const result = await syncTrainingAction(pending).catch(() => ({ ok: false }));
    if (result.ok) synced.current = { ...synced.current, ...pending };
  }, [driverId]);

  const commit = useCallback(
    (next: Progress) => {
      progressRef.current = next;
      setProgress(next);
      writeProgress(driverId, next);
    },
    [driverId],
  );

  /* Телефон + база + гостевой прогресс, если водитель только что вошёл. */
  useEffect(() => {
    let local = readProgress(driverId);
    if (driverId) local = mergeProgress(local, takeGuestProgress());
    /*
     * Хранилище телефона сервер прочитать не может, поэтому первое
     * состояние — серверное, а телефонное подмешивается после гидратации.
     */
    // eslint-disable-next-line react-hooks/set-state-in-effect
    commit(mergeProgress(serverProgress, local));
    setMode(readPrefs().mode);
    setNow(Date.now());
    void flush();

    const online = () => void flush();
    window.addEventListener('online', online);
    return () => window.removeEventListener('online', online);
    // Один раз при открытии: сервер отдал прогресс на момент загрузки страницы.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Модуль и вкладка — в адресе: «назад» и обновление страницы не сбрасывают экран. */
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set('m', topic);
    url.searchParams.set('tab', tab);
    window.history.replaceState(null, '', url);
  }, [topic, tab]);

  const spec = TRAINING_MODULES.find((item) => item.id === topic) ?? TRAINING_MODULES[0];
  const moduleCards = useMemo(() => cards.filter((card) => card.module === topic), [cards, topic]);
  const keys = useMemo(() => moduleCards.map((card) => card.key), [moduleCards]);
  const hasPractice = spec.practice !== null;
  const activeTab: TrainingTab = tab === 'practice' && !hasPractice ? 'train' : tab;

  function answer(key: string, correct: boolean) {
    const at = Date.now();
    setNow(at);
    commit({ ...progressRef.current, [key]: answerCard(progressRef.current[key], correct, at) });
    void flush();
  }

  async function reset() {
    const next = Object.fromEntries(
      Object.entries(progressRef.current).filter(([key]) => !key.startsWith(`${topic}.`)),
    );
    commit(next);
    synced.current = Object.fromEntries(
      Object.entries(synced.current).filter(([key]) => !key.startsWith(`${topic}.`)),
    );
    if (driverId) await resetTrainingAction(topic).catch(() => null);
  }

  function round(): TrainingCard[] {
    const byKey = new Map(moduleCards.map((card) => [card.key, card]));
    return buildRound(keys, progressRef.current, Date.now()).flatMap((key) => byKey.get(key) ?? []);
  }

  const texts = t.training;

  return (
    <main className="flex flex-col gap-4">
      <header className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{texts.title}</h1>
        <Segmented
          label={texts.modeLabel}
          size="md"
          items={[
            { key: 'pro', label: texts.modePro },
            { key: 'new', label: texts.modeNew },
          ]}
          active={mode}
          onChange={(next) => {
            setMode(next);
            writePrefs({ mode: next });
          }}
        />
      </header>

      <TachoDisplay
        module={texts.modules[topic].lcd}
        freshness={freshness(keys, progress, now)}
        state={freshnessState(keys, progress, now)}
        due={dueCount(keys, progress, now)}
      />

      {TRAINING_MODULES.length > 1 && (
        <Segmented
          label={texts.moduleLabel}
          items={TRAINING_MODULES.map((item) => ({ key: item.id, label: texts.modules[item.id].name }))}
          active={topic}
          onChange={setTopic}
        />
      )}

      <Segmented
        label={texts.title}
        size="md"
        items={[
          { key: 'train' as const, label: texts.tabTrain },
          ...(hasPractice ? [{ key: 'practice' as const, label: texts.tabPractice }] : []),
          { key: 'rules' as const, label: texts.tabRules },
        ]}
        active={activeTab}
        onChange={setTab}
      />

      <section className="rounded-card border border-line bg-surface p-4">
        {activeTab === 'train' &&
          (moduleCards.length === 0 ? (
            <p className="py-6 text-center text-[16px] text-ink-muted">{texts.empty}</p>
          ) : (
            <Quiz
              key={topic}
              moduleIntro={texts.modules[topic].intro}
              due={dueCount(keys, progress, now)}
              fresh={newCount(keys, progress)}
              mode={mode}
              buildRound={round}
              onAnswer={answer}
              onReset={() => void reset()}
              onFinish={() => setNow(Date.now())}
              freshness={freshness(keys, progress, now)}
              hasPractice={hasPractice}
              onPractice={() => setTab('practice')}
            />
          ))}
        {activeTab === 'practice' && spec.practice === 'shift' && <ShiftPlanner mode={mode} />}
        {activeTab === 'practice' && spec.practice === 'cargo' && <CargoGame mode={mode} />}
        {activeTab === 'rules' && <CheatSheet module={topic} />}
      </section>

      <footer className="flex flex-col gap-1.5 px-1 text-[13px] text-ink-muted">
        {driverId ? (
          <p>{texts.privacy}</p>
        ) : (
          <p>
            {texts.guest}{' '}
            <Link href={`/${locale}/driver`} className="font-semibold text-accent underline">
              {texts.signIn}
            </Link>
          </p>
        )}
        <p>{texts.notOfficial}</p>
        <p>{texts.sources}</p>
      </footer>
    </main>
  );
}
