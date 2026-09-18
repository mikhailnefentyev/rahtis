-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · заказчик принимает и свои условия
--
-- Новые условия использования говорят в пункте 2.1: «Kuljetuksen
-- tilaamiseen hyväksytään lisäksi tilaajan ehdot». Пока accept_legal
-- знала два вида документов, это было обещанием без исполнения:
-- заказчик ставил галочку, а в журнал принятия ложились только условия
-- использования и политика.
--
-- Теперь набор зависит от роли компании:
--
--   заказчик     — TERMS, PRIVACY, SHIPPER_AGREEMENT
--   перевозчик   — TERMS, PRIVACY, CARRIER_AGREEMENT
--
-- Договора перевозчика ещё нет ни одной редакцией, и в этом вся
-- осторожность здесь: вид без действующей редакции пропускается, а не
-- роняет активацию компании. Когда юрист доведёт договор перевозчика и
-- оператор его активирует, перевозчики начнут принимать и его — без
-- новой миграции.
--
-- TERMS и PRIVACY остаются обязательными: если действующей редакции нет,
-- активация по-прежнему падает с понятной ошибкой.
-- ═══════════════════════════════════════════════════════════════════

/* Какие документы обязана принять компания этого вида. */
create or replace function app.required_legal_kinds(p_kind public.party_role)
returns public.legal_kind[]
language sql
immutable
set search_path = ''
as $$
  select case p_kind
    when 'SHIPPER' then array['TERMS', 'PRIVACY', 'SHIPPER_AGREEMENT']::public.legal_kind[]
    when 'CARRIER' then array['TERMS', 'PRIVACY', 'CARRIER_AGREEMENT']::public.legal_kind[]
    else array['TERMS', 'PRIVACY']::public.legal_kind[]
  end;
$$;

comment on function app.required_legal_kinds(public.party_role) is
  'Документы, обязательные для вида компании. Вид без действующей редакции пропускается при приёме.';


create or replace function public.accept_legal(p_source text default 'ACTIVATION')
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company uuid;
  v_kind public.legal_kind;
  v_doc uuid;
  v_count integer := 0;
begin
  v_company := (select app.current_company_id());

  if v_company is null then
    raise exception 'Принять условия может только сотрудник компании.' using errcode = '42501';
  end if;

  foreach v_kind in array app.required_legal_kinds(
    (select kind from public.companies where id = v_company)
  ) loop
    v_doc := public.active_legal_document(v_kind);

    if v_doc is null then
      /*
       * Условия и политика обязаны существовать: без них принимать
       * нечего, и молчать об этом нельзя. Договор стороны — документ
       * будущего: пока редакции нет, его просто не принимают.
       */
      if v_kind in ('TERMS', 'PRIVACY') then
        raise exception 'Нет действующей редакции документа %.', v_kind using errcode = '55007';
      end if;

      continue;
    end if;

    insert into public.legal_acceptances (company_id, document_id, accepted_by, source)
    values (v_company, v_doc, (select auth.uid()), coalesce(nullif(p_source, ''), 'ACTIVATION'))
    on conflict (company_id, document_id) do nothing;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.accept_legal(text) from public, anon;
grant execute on function public.accept_legal(text) to authenticated, service_role;


/* Приняты ли компанией все обязательные для её вида редакции. */
create or replace function app.legal_accepted(p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (
    select 1
    from unnest(
      app.required_legal_kinds((select kind from public.companies where id = p_company_id))
    ) as kind
    where public.active_legal_document(kind) is not null
      and not exists (
        select 1 from public.legal_acceptances a
        where a.company_id = p_company_id
          and a.document_id = public.active_legal_document(kind)
      )
  );
$$;

revoke all on function app.legal_accepted(uuid) from public, anon;
grant execute on function app.legal_accepted(uuid) to authenticated, service_role;
