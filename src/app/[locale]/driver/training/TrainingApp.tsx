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
import { AdrGame } from './AdrGame';
import { AxleGame } from './AxleGame';
import { CargoGame } from './CargoGame';
import { InspectionGame } from './InspectionGame';
import { CheatSheet } from './CheatSheet';
import { Quiz } from './Quiz';
import { ShiftPlanner } from './ShiftPlanner';
import { TachoDisplay } from './TachoDisplay';
import { cn } from '@/lib/cn';
import { MODULE_ICONS } from './icons';
import { Segmented, UnderlineTabs } from './ui';

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
  const strip = useRef<HTMLDivElement>(null);
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

  /* Выбранный модуль — в поле зрения ленты, в том числе когда он пришёл из адреса. */
  useEffect(() => {
    const el = strip.current;
    const on = el?.querySelector<HTMLElement>('[data-on]');
    if (el && on) el.scrollLeft = on.offsetLeft - (el.clientWidth - on.clientWidth) / 2;
  }, [topic]);

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
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{texts.title}</h1>
        {/* Уровень — настройка, а не навигация: компактно в шапке, а не полосой во всю ширину. */}
        <div className="w-52 shrink-0">
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
        </div>
      </header>

      {TRAINING_MODULES.length > 1 && (
        /*
         * Модули — лентой в один ряд с прокруткой вбок: при восьми модулях
         * сетка занимала весь первый экран, и до практики приходилось листать.
         */
        <div
          ref={strip}
          className="relative -mx-4 flex snap-x snap-proximity gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]"
          role="group"
          aria-label={texts.moduleLabel}
        >
          {TRAINING_MODULES.map((item) => {
            const on = item.id === topic;
            const Icon = MODULE_ICONS[item.id];
            const itemKeys = cards.filter((card) => card.module === item.id).map((card) => card.key);
            const itemDue = dueCount(itemKeys, progress, now);
            return (
              <button
                key={item.id}
                type="button"
                aria-pressed={on}
                data-on={on ? '' : undefined}
                onClick={() => setTopic(item.id)}
                className={cn(
                  'flex min-h-16 w-44 shrink-0 snap-start items-center gap-2.5 rounded-card border-[1.5px] px-2.5 py-2 text-left',
                  on ? 'border-accent bg-accent-wash' : 'border-line bg-surface',
                )}
              >
                <span
                  className={cn(
                    'flex size-10 shrink-0 items-center justify-center rounded-control',
                    on ? 'bg-accent text-accent-ink' : 'bg-raised text-ink-muted',
                  )}
                >
                  <Icon />
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-[14px] leading-tight font-semibold break-words">{texts.modules[item.id].name}</span>
                  <span className="flex items-center gap-1.5 font-mono text-[12px] text-ink-muted">
                    {freshness(itemKeys, progress, now)}%
                    {itemDue > 0 && <span className="rounded-pill bg-accent px-1.5 text-accent-ink">{itemDue}</span>}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}

      <TachoDisplay
        module={texts.modules[topic].lcd}
        freshness={freshness(keys, progress, now)}
        state={freshnessState(keys, progress, now)}
        due={dueCount(keys, progress, now)}
      />

      {/* Вкладки и их содержимое — одна карточка: видно, чему принадлежит подчёркивание. */}
      <div className="overflow-hidden rounded-card border border-line bg-surface">
        <UnderlineTabs
          label={texts.title}
          items={[
            { key: 'train' as const, label: texts.tabTrain },
            ...(hasPractice ? [{ key: 'practice' as const, label: texts.tabPractice }] : []),
            { key: 'rules' as const, label: texts.tabRules },
          ]}
          active={activeTab}
          onChange={setTab}
        />

        <section className="p-4">
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
          {activeTab === 'practice' && spec.practice === 'axles' && <AxleGame mode={mode} />}
          {activeTab === 'practice' && spec.practice === 'inspection' && <InspectionGame mode={mode} />}
          {activeTab === 'practice' && spec.practice === 'adr' && <AdrGame mode={mode} />}
          {activeTab === 'rules' && <CheatSheet module={topic} />}
        </section>
      </div>

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
        {/* Источники в подвале — только тахографа и крепления; у остальных модулей норма стоит под каждым вопросом. */}
        {(topic === 'tacho' || topic === 'cargo') && <p>{texts.sources}</p>}
      </footer>
    </main>
  );
}
