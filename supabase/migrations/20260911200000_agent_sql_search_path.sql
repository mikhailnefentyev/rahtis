-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · свободный запрос находит таблицы
--
-- agent_sql объявлена с `set search_path = ''` — как все функции
-- security definer в проекте: пустой путь не даёт подсунуть свою схему
-- вместо public. Для собственных обращений функции это верно и остаётся.
--
-- Но текст запроса пишет оператор словами, и пишет он «from orders», а не
-- «from public.orders». С пустым путём каждый разрешённый запрос падал с
-- «relation orders does not exist» — то есть защита работала, а польза
-- нет.
--
-- Путь выставляется только на выполнение чужого текста и только на эту
-- транзакцию. Своё собственное обращение к app.agent_context уже
-- произошло выше, при пустом пути, и подменить схему ему нечем.
--
-- Схемы auth, storage и остальные закрыты отдельной проверкой по тексту и
-- от пути не зависят: их запрещают имена, а не видимость.
-- ═══════════════════════════════════════════════════════════════════

create or replace function public.agent_sql(
  p_conversation_id uuid,
  p_token uuid,
  p_query text,
  p_limit integer default 200
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ctx public.conversations;
  v_sql text;
  v_flat text;
  v_word text;
  v_rows jsonb;
begin
  v_ctx := app.agent_context(p_conversation_id, p_token);

  if v_ctx.audience <> 'ADMIN' then
    raise exception 'Свободный запрос к базе доступен только оператору.' using errcode = '42501';
  end if;

  v_sql := btrim(coalesce(p_query, ''));

  /* Единственная точка с запятой в конце допускается и снимается. */
  v_sql := btrim(regexp_replace(v_sql, ';\s*$', ''));

  if v_sql = '' then
    raise exception 'Запрос пустой.' using errcode = '22023';
  end if;

  if position(';' in v_sql) > 0 then
    raise exception 'Только один запрос за раз.' using errcode = '42601';
  end if;

  if lower(v_sql) !~ '^(select|with)\s' then
    raise exception 'Разрешено только чтение: запрос начинается с select или with.'
      using errcode = '42601';
  end if;

  /*
   * Слова, которыми что-либо меняют или дотягиваются наружу. Сверка по
   * границе слова: «updated_at» не должен ловиться на «update».
   */
  v_flat := lower(v_sql);

  foreach v_word in array array[
    'insert', 'update', 'delete', 'merge', 'truncate', 'drop', 'alter', 'create',
    'grant', 'revoke', 'comment', 'copy', 'call', 'do', 'execute', 'prepare',
    'vacuum', 'analyze', 'reindex', 'refresh', 'listen', 'notify', 'lock',
    'set', 'reset', 'begin', 'commit', 'rollback', 'savepoint', 'security',
    'dblink', 'pg_read_file', 'pg_read_binary_file', 'pg_ls_dir', 'pg_sleep',
    'lo_import', 'lo_export', 'pg_authid', 'pg_shadow', 'pg_user_mapping'
  ] loop
    if v_flat ~ ('(^|[^a-z_])' || v_word || '([^a-z_]|$)') then
      raise exception 'Запрос содержит запрещённое слово: %. Доступно только чтение.', v_word
        using errcode = '42501';
    end if;
  end loop;

  /* Чужие схемы: там пароли, токены и пути к файлам. */
  foreach v_word in array array['auth.', 'storage.', 'vault.', 'net.', 'cron.', 'extensions.'] loop
    if position(v_word in v_flat) > 0 then
      raise exception 'Схема % закрыта даже для чтения.', rtrim(v_word, '.')
        using errcode = '42501';
    end if;
  end loop;

  /*
   * Ограничения ставятся на время вызова, а не на роль: функция
   * security definer, и выставленное здесь действует до конца
   * транзакции, то есть ровно на этот запрос.
   */
  set local statement_timeout = '30s';

  /* Путь только на чужой текст: свои обращения уже сделаны выше. */
  set local search_path = public;

  execute format(
    'select coalesce(jsonb_agg(row_to_json(t)), ''[]''::jsonb) from (%s) t limit %s',
    v_sql,
    greatest(1, least(coalesce(p_limit, 200), 1000))
  ) into v_rows;

  return v_rows;
end;
$$;

comment on function public.agent_sql(uuid, uuid, text, integer) is
  'Свободный запрос на чтение по базе. Только оператору, только select, одна инструкция, 30 секунд.';

revoke all on function public.agent_sql(uuid, uuid, text, integer)
  from public, anon, authenticated;
grant execute on function public.agent_sql(uuid, uuid, text, integer) to agent, service_role;
