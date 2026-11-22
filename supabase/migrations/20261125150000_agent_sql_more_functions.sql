-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · свободный запрос оператора: ещё функции «выполни текст»
-- (22.11.2026, по замечанию проверки безопасности)
--
-- ts_stat и ts_rewrite принимают текст запроса и выполняют его — через
-- них имя закрытой схемы, склеенное из частей ('ap' || 'p.…'), прошло бы
-- мимо сверки. Закрыты по имени вместе с чтением больших объектов и
-- настроек сеанса.
--
-- Список слов остаётся вторым слоем. Запись уже закрывает сама база
-- (транзакция только для чтения). Чтение закрытых схем по-настоящему
-- закроет только отдельная роль без прав на них: функция, которой владеет
-- роль с select на нужные таблицы public. Это отдельная работа — её надо
-- проверить в чате оператора, прежде чем включать.
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

  /*
   * Кавычки и комментарии — способ спрятать имя от сверки ниже
   * ("auth".users, auth/**/.users). Запросам оператора они не нужны.
   */
  if position('"' in v_sql) > 0 or position('/*' in v_sql) > 0 or position('--' in v_sql) > 0 then
    raise exception 'Кавычки вокруг имён и комментарии в запросе не допускаются.'
      using errcode = '42501';
  end if;

  /*
   * Функции, которые выполняют текст как запрос или меняют настройки:
   * через них запись и чужие схемы прошли бы мимо сверки слов.
   */
  foreach v_word in array array[
    'query_to_xml', 'query_to_xml_and_xmlschema', 'query_to_xmlschema',
    'table_to_xml', 'table_to_xml_and_xmlschema', 'cursor_to_xml',
    'schema_to_xml', 'database_to_xml', 'set_config', 'set_runtime_config',
    'pg_read_server_files', 'pg_stat_file', 'pg_terminate_backend', 'pg_cancel_backend',
    'ts_stat', 'ts_rewrite', 'lo_get', 'lo_open', 'loread', 'lo_from_bytea', 'lo_put',
    'current_setting', 'pg_ls_logdir', 'pg_ls_waldir', 'pg_ls_tmpdir', 'pg_stat_get_activity'
  ] loop
    if v_flat ~ ('(^|[^a-z_])' || v_word || '([^a-z_]|$)') then
      raise exception 'Запрос содержит запрещённую функцию: %.', v_word
        using errcode = '42501';
    end if;
  end loop;

  /*
   * Семейства целиком, а не по одному имени: любая *_to_xml* и
   * *_to_xmlschema* выполняет запрос или читает таблицу по имени из
   * текста; pg_ls_* и pg_read_* смотрят в файлы сервера, pg_stat_* —
   * в чужие сеансы и их запросы.
   */
  if v_flat ~ '(^|[^a-z0-9_])(query|table|cursor|schema|database)_to_xml'
     or v_flat ~ '(^|[^a-z0-9_])pg_(ls|read|stat)_' then
    raise exception 'Запрос содержит запрещённую функцию.' using errcode = '42501';
  end if;

  /*
   * Чужие схемы: там пароли, токены, секрет планировщика (app.runtime_config)
   * и пути к файлам. Сверка по имени с точкой после любых пробелов:
   * «auth . users» закрыт так же, как «auth.users».
   */
  foreach v_word in array array[
    'auth', 'storage', 'vault', 'net', 'cron', 'extensions', 'app',
    'pgsodium', 'realtime', 'supabase_functions', 'supabase_migrations', 'graphql', 'pgbouncer'
  ] loop
    if v_flat ~ ('(^|[^a-z0-9_])' || v_word || '\s*\.') then
      raise exception 'Схема % закрыта даже для чтения.', v_word
        using errcode = '42501';
    end if;
  end loop;

  /*
   * Ограничения ставятся на время вызова, а не на роль: функция
   * security definer, и выставленное здесь действует до конца
   * транзакции, то есть ровно на этот запрос.
   */
  set local statement_timeout = '30s';

  /*
   * Запись запрещает сама база, а не список слов: до конца транзакции
   * (то есть этого вызова) любое изменение данных — ошибка, каким бы
   * путём до него ни добрались.
   */
  set local transaction_read_only = on;

  /* Путь только на чужой текст: свои обращения уже сделаны выше. */
  set local search_path = public;

  execute format(
    /* Предел строк — внутри: снаружи он резал одну строку итога и ничего не ограничивал. */
    'select coalesce(jsonb_agg(row_to_json(t)), ''[]''::jsonb) from (select * from (%s) q limit %s) t',
    v_sql,
    greatest(1, least(coalesce(p_limit, 200), 1000))
  ) into v_rows;

  return v_rows;
end;
$$;

comment on function public.agent_sql(uuid, uuid, text, integer) is
  'Свободный запрос на чтение по базе. Только оператору, только select, одна инструкция, 30 секунд, транзакция только для чтения.';

revoke all on function public.agent_sql(uuid, uuid, text, integer)
  from public, anon, authenticated;
grant execute on function public.agent_sql(uuid, uuid, text, integer) to agent, service_role;
