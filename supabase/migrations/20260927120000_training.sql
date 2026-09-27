-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · тренажёр водителя (Koulutus)
--
-- Задание — docs/training/RAHTIS-driver-training.md, прототип —
-- docs/training/rahtis-tacho.html. Короткие тренировки по темам, которые
-- водитель проходит на курсах раз в 3–5 лет и забывает. Первая версия:
-- «Тахограф» и «Крепление груза».
--
-- ВОПРОСЫ — ДАННЫЕ, А НЕ КОД. Одна строка — один вопрос на одном языке.
-- card_key общий для всех переводов вопроса: прогресс водителя хранится
-- по нему, поэтому смена языка в профиле прогресс не теряет (решение
-- пользователя 27.09.2026, отступление от question_id из задания).
--
-- ПРОВЕРКА ИНСТРУКТОРОМ. Водитель и гость видят только вопросы с
-- reviewed_at: правило, которое никто не проверил, в кабину не идёт.
-- Правка текста снимает отметку сама — исправленный вопрос снова ждёт
-- проверки, если в той же правке его не отметили заново.
--
-- ПРОГРЕСС — ПЕРСОНАЛЬНЫЕ ДАННЫЕ РАБОТНИКА (työelämän tietosuojalaki
-- 759/2004, GDPR). Строки training_progress видит и пишет только сам
-- водитель. Политик для перевозчика, заказчика и оператора нет вовсе —
-- решение пользователя 27.09.2026: водитель перестанет открывать модуль,
-- если будет знать, что его ошибки видит работодатель. Любая аналитика
-- для перевозчика — только агрегатом по компании от 5 водителей и после
-- согласования с юристом, отдельным заданием.
-- ═══════════════════════════════════════════════════════════════════


-- ── Вопросы ────────────────────────────────────────────────────────

create table public.training_questions (
  id uuid primary key default gen_random_uuid(),

  /* Модуль: tacho, cargo, code95, adr, tyoturva, ensiapu, tieturva, tech, eco…
     Текстом, а не enum: новый модуль — это вопросы и строка в реестре
     src/lib/training/modules.ts, без миграции. */
  module text not null,

  /* Ключ вопроса, общий для переводов: 'tacho.b2'. */
  card_key text not null,

  locale text not null,

  question text not null,
  options jsonb not null,
  correct_index smallint not null,
  explanation text not null,
  /* Подсказка для режима «Новичок». */
  hint text,
  /* Ссылка на норму: «561/2006, ст. 7». */
  legal_ref text,

  /* С какой даты правило действует: до неё вопрос не показывается. */
  valid_from date,

  /* Кто из инструкторов проверил — имя текстом: инструкторы не пользователи системы. */
  reviewed_by text,
  reviewed_at timestamptz,

  active boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint training_questions_card_locale unique (card_key, locale),
  constraint training_questions_module_format check (module ~ '^[a-z0-9]{2,20}$'),
  constraint training_questions_card_in_module check (card_key like module || '.%'),
  constraint training_questions_locale check (
    locale in ('fi', 'en', 'et', 'ru', 'sv', 'lv', 'lt', 'pl', 'nb', 'da')
  ),
  constraint training_questions_text check (btrim(question) <> '' and btrim(explanation) <> ''),
  constraint training_questions_options check (
    jsonb_typeof(options) = 'array'
    and jsonb_array_length(options) between 2 and 6
  ),
  constraint training_questions_correct check (
    correct_index >= 0 and correct_index < jsonb_array_length(options)
  ),
  constraint training_questions_reviewed check (
    (reviewed_at is null) = (reviewed_by is null)
  )
);

comment on table public.training_questions is
  'Вопросы тренажёра водителя. Одна строка — один вопрос на одном языке; card_key общий для переводов. Водителю видны только проверенные (reviewed_at).';

create index training_questions_module_locale_idx
  on public.training_questions (module, locale)
  where active;

/*
 * Правка текста снимает отметку о проверке. Инструктор проверял
 * конкретную формулировку, а не вопрос вообще: после правки это уже
 * другой текст. Отметить заново можно в той же правке.
 */
create or replace function app.training_question_touch()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();

  if (new.question, new.options, new.correct_index, new.explanation, new.hint, new.legal_ref, new.valid_from)
       is distinct from
     (old.question, old.options, old.correct_index, old.explanation, old.hint, old.legal_ref, old.valid_from)
     and new.reviewed_at is not distinct from old.reviewed_at
  then
    new.reviewed_at := null;
    new.reviewed_by := null;
  end if;

  return new;
end;
$$;

create trigger training_questions_touch
  before update on public.training_questions
  for each row execute function app.training_question_touch();

alter table public.training_questions enable row level security;
revoke all on public.training_questions from anon, authenticated;

grant select on public.training_questions to anon, authenticated;
grant insert (module, card_key, locale, question, options, correct_index, explanation, hint, legal_ref,
              valid_from, reviewed_by, reviewed_at, active)
  on public.training_questions to authenticated;
grant update (question, options, correct_index, explanation, hint, legal_ref,
              valid_from, reviewed_by, reviewed_at, active)
  on public.training_questions to authenticated;

/* Гость, водитель и кабинеты — только проверенное, действующее и вступившее в силу. */
create policy training_questions_read_reviewed
  on public.training_questions for select to anon, authenticated
  using (
    active
    and reviewed_at is not null
    and (valid_from is null or valid_from <= current_date)
  );

/* Оператор видит всё: непроверенное он и отдаёт инструктору. */
create policy training_questions_read_admin
  on public.training_questions for select to authenticated
  using ((select app.is_admin()));

create policy training_questions_insert_admin
  on public.training_questions for insert to authenticated
  with check ((select app.is_admin()));

create policy training_questions_update_admin
  on public.training_questions for update to authenticated
  using ((select app.is_admin()))
  with check ((select app.is_admin()));

/* Удаления нет: вопрос деактивируют, чтобы прогресс водителей не повис на пустоте. */


-- ── Прогресс водителя ──────────────────────────────────────────────

create table public.training_progress (
  driver_id uuid not null references public.drivers (id) on delete cascade,
  card_key text not null,

  /* Коробка Лейтнера 1–5: интервалы 0/1/3/7/16/35 дней — в src/lib/training/leitner.ts. */
  box smallint not null,
  due_at timestamptz not null,
  last_answered_at timestamptz not null,
  correct_count integer not null default 0,
  wrong_count integer not null default 0,

  primary key (driver_id, card_key),

  constraint training_progress_box check (box between 1 and 5),
  constraint training_progress_counts check (correct_count >= 0 and wrong_count >= 0)
);

comment on table public.training_progress is
  'Прогресс тренажёра. Персональные данные водителя: видит и пишет только он сам — ни перевозчик, ни заказчик, ни оператор.';

alter table public.training_progress enable row level security;
revoke all on public.training_progress from anon, authenticated;
grant select, delete on public.training_progress to authenticated;

create policy training_progress_select_self
  on public.training_progress for select to authenticated
  using (driver_id = (select app.current_driver_id()));

/* «Сбросить прогресс» в тренажёре. */
create policy training_progress_delete_self
  on public.training_progress for delete to authenticated
  using (driver_id = (select app.current_driver_id()));

/*
 * Записать прогресс с устройства.
 *
 * Одна дорога для всего: ответ в сети, ответы из кабины без связи и
 * гостевой прогресс после входа. Устройство присылает свои карточки,
 * по каждой побеждает более поздний ответ — второй телефон со старым
 * состоянием свежий прогресс не затрёт.
 *
 * p_cards: {"tacho.b2": {"box": 2, "due": <мс>, "last": <мс>, "right": 1, "wrong": 0}, …}
 * Время ответа из будущего обрезается до «сейчас»: часы телефона
 * бывают неверны, а поздняя метка навсегда выиграла бы слияние.
 */
create or replace function public.training_sync(p_cards jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_driver uuid := app.current_driver_id();
  v_count integer;
begin
  if v_driver is null then
    raise exception 'Прогресс сохраняется только у водителя приложения.' using errcode = '42501';
  end if;

  if jsonb_typeof(p_cards) is distinct from 'object' then
    raise exception 'Ожидается объект карточек.' using errcode = '22023';
  end if;

  with incoming as (
    select
      key as card_key,
      least(greatest((value ->> 'box')::int, 1), 5) as box,
      to_timestamp((value ->> 'due')::double precision / 1000) as due_at,
      least(to_timestamp((value ->> 'last')::double precision / 1000), now()) as last_answered_at,
      greatest(coalesce((value ->> 'right')::int, 0), 0) as correct_count,
      greatest(coalesce((value ->> 'wrong')::int, 0), 0) as wrong_count
    from jsonb_each(p_cards)
    where key ~ '^[a-z0-9]{2,20}\.[A-Za-z0-9_-]{1,40}$'
      and jsonb_typeof(value) = 'object'
      and value ? 'box' and value ? 'due' and value ? 'last'
    limit 500
  )
  insert into public.training_progress as p
    (driver_id, card_key, box, due_at, last_answered_at, correct_count, wrong_count)
  select v_driver, card_key, box, due_at, last_answered_at, correct_count, wrong_count
  from incoming
  on conflict (driver_id, card_key) do update
    set box = excluded.box,
        due_at = excluded.due_at,
        last_answered_at = excluded.last_answered_at,
        correct_count = excluded.correct_count,
        wrong_count = excluded.wrong_count
    where excluded.last_answered_at > p.last_answered_at;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.training_sync(jsonb) from public, anon;
grant execute on function public.training_sync(jsonb) to authenticated;
