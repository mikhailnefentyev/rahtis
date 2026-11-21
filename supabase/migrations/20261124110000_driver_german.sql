-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · немецкий язык в приложении водителя (21.11.2026)
--
-- Немецкий — язык платформы с 21.10.2026, перевод экранов водителя
-- лежит в словаре de.ts, но приложение водителя его не предлагало.
-- Здесь то, что живёт в базе: язык приложения может быть 'de', и
-- оператор может завести вопросы тренажёра на немецком. Немецких
-- вопросов пока нет — тренажёр показывает английские (questions.ts).
-- ═══════════════════════════════════════════════════════════════════

alter table public.drivers
  drop constraint drivers_app_language,
  add constraint drivers_app_language check (
    app_language is null
    or app_language in ('fi', 'en', 'et', 'ru', 'sv', 'lv', 'lt', 'pl', 'nb', 'da', 'ro', 'de')
  );

alter table public.training_questions
  drop constraint training_questions_locale,
  add constraint training_questions_locale check (
    locale in ('fi', 'en', 'et', 'ru', 'sv', 'lv', 'lt', 'pl', 'nb', 'da', 'ro', 'de')
  );
