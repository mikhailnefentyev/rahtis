-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · сторона в очереди поддержки берётся у компании
--
-- В agent_ask_operator роль выводилась из аудитории треда: CARRIER —
-- перевозчик, всё остальное — заказчик. Для водителя это неверно. Его
-- тред принадлежит транспортной компании, а он попал бы в очередь
-- заказчиком, и оператор, разбирая очередь по стороне, искал бы его не
-- там.
--
-- Аудитория говорит, из какого окна написали, а не кто написал. Сторона
-- сделки — свойство компании, и лежит она в companies.kind, где её уже
-- держит ограничение «компания не бывает оператором». Оттуда и берём:
-- одно место правды вместо соответствия, которое нужно помнить.
-- ═══════════════════════════════════════════════════════════════════

create or replace function public.agent_ask_operator(
  p_conversation_id uuid,
  p_token uuid,
  p_question text,
  p_subject text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ctx public.conversations;
  v_company public.companies;
  v_email text;
  v_id bigint;
begin
  v_ctx := app.agent_context(p_conversation_id, p_token);

  if v_ctx.audience = 'ADMIN' then
    raise exception 'Оператор и есть адресат этой очереди.' using errcode = '55000';
  end if;

  if v_ctx.company_id is null then
    raise exception 'У треда нет компании.' using errcode = '55000';
  end if;

  if length(btrim(coalesce(p_question, ''))) < 3 then
    raise exception 'Вопрос пуст.' using errcode = '22023';
  end if;

  select * into v_company from public.companies where id = v_ctx.company_id;

  /*
   * Адрес автора, а не компании, если он известен: отвечать оператор
   * будет тому, кто спросил. Тред заведён из кабинета, значит автор
   * есть; у треда из WhatsApp его может не быть.
   */
  select u.email into v_email from auth.users u where u.id = v_ctx.created_by;

  insert into public.support_messages (company_id, user_id, role, from_email, subject, body)
  values (
    v_ctx.company_id,
    v_ctx.created_by,
    /* Сторона сделки — свойство компании, а не окна, из которого пишут. */
    v_company.kind,
    coalesce(v_email, v_company.contact_email, 'tuntematon'),
    left(coalesce(nullif(btrim(coalesce(p_subject, '')), ''), 'Kysymys avustajalta'), 200),
    left(
      btrim(p_question)
        /*
         * Ссылка на тред в теле, а не отдельной графой: оператор читает
         * очередь глазами, и ему нужно знать, где лежит разговор
         * целиком. Заводить под это столбец значит менять таблицу ради
         * строки, которую всё равно читает человек.
         */
        || E'\n\n— ' || coalesce(v_company.name, 'tuntematon yritys')
        || ' · ' || v_ctx.audience::text
        || E'\n' || 'Keskustelu: ' || v_ctx.id::text,
      4000
    )
  )
  returning id into v_id;

  return jsonb_build_object('id', v_id, 'company', v_company.name);
end;
$$;

revoke all on function public.agent_ask_operator(uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.agent_ask_operator(uuid, uuid, text, text) to agent, service_role;
