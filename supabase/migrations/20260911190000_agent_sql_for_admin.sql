-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · оператор спрашивает базу словами
--
-- До сих пор набор инструментов был закрыт, и в комментарии к нему
-- записано почему: «открывать сюда произвольный запрос значит отдать
-- наружу то, ради чего и заводился отдельный набор функций». Для
-- заказчика и перевозчика это правило остаётся в силе дословно.
--
-- Для оператора оно снимается сознательно. Он не сторона сделки, а
-- владелец платформы: в админке ему и так доступно всё, что здесь лежит,
-- только руками и по одной странице. Помощник, который на любой вопрос
-- отвечает «такого инструмента нет», — это не помощник.
--
-- ЧЕМ ОГРАНИЧЕНО, И ПОЧЕМУ ИМЕННО ЭТИМ.
--
-- Только чтение. Запрос обязан начинаться с select или with, и в нём не
-- должно встречаться ни одного слова, которым что-либо меняют. Проверка
-- по списку слов, а не по разбору грамматики: разбирать SQL регулярками
-- нельзя, но здесь и не нужно — достаточно не пропустить то, чем пишут.
-- Запрет на точку с запятой убирает второй оператор целиком, вместе с
-- фокусами вида «select 1; delete from orders».
--
-- Один оператор. Общие табличные выражения умеют писать
-- (`with x as (delete ... returning *)`), поэтому слова удаления и правки
-- запрещены везде в тексте, а не только в начале.
--
-- Чужие схемы закрыты. auth хранит пароли и токены, storage — пути и
-- владельцев файлов, vault — секреты. Публичная схема и так вся здесь.
--
-- Время и объём. Полминуты и тысяча строк: вопрос оператора — это
-- вопрос, а не выгрузка. Запрос, который не уложился, лучше оборвать —
-- висящий агент держит тред в работе и не даёт задать следующий.
--
-- ЧЕГО ЭТА ЗАЩИТА НЕ ДЕЛАЕТ. Она не мешает прочитать персональные данные:
-- телефоны водителей, адреса, контакты получателей. Оператору они и так
-- доступны в интерфейсе, и ограничивать его здесь значило бы сделать
-- помощника бесполезным. Но это стоит помнить, когда ответ агента
-- копируют куда-то ещё.
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
