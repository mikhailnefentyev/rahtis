-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · договоры: лей среди валют (16.11.2026)
--
-- Под поведение 20261116100000_romania: компания может выбрать румынский
-- лей своей валютой, заказчик — валютой цены. Пункты о валютах в TERMS
-- (разд. 8) и SHIPPER_AGREEMENT (разд. 2) перечисляют валюты поимённо —
-- дополняются леем. CARRIER_AGREEMENT валют не перечисляет (ссылается на
-- условия использования) — его не трогаем. Черновики; активация —
-- решение пользователя.
-- ═══════════════════════════════════════════════════════════════════

create or replace function pg_temp.draft_of(p_kind public.legal_kind)
returns uuid
language plpgsql
as $$
declare
  v_active uuid := public.active_legal_document(p_kind);
  v_draft uuid;
begin
  select d.id into v_draft
  from public.legal_documents d
  where d.kind = p_kind and d.status = 'DRAFT'
    and d.version > coalesce((select version from public.legal_documents where id = v_active), 0)
  order by d.version desc
  limit 1;

  if v_draft is null then
    insert into public.legal_documents (kind, version, status, effective_from)
    values (p_kind, (select coalesce(max(version), 0) + 1 from public.legal_documents where kind = p_kind), 'DRAFT', current_date)
    returning id into v_draft;

    insert into public.legal_clauses (document_id, locale, path, title, body)
    select v_draft, c.locale, c.path, c.title, c.body
    from public.legal_clauses c where c.document_id = v_active;
  end if;

  return v_draft;
end;
$$;

do $$
declare
  v_kind public.legal_kind;
  v_doc uuid;
begin
  foreach v_kind in array array['TERMS', 'SHIPPER_AGREEMENT']::public.legal_kind[] loop
    v_doc := pg_temp.draft_of(v_kind);

    update public.legal_clauses
    set body = replace(replace(replace(replace(body,
        '(euro, Ruotsin, Norjan tai Tanskan kruunu tai Puolan złoty)',
        '(euro, Ruotsin, Norjan tai Tanskan kruunu, Puolan złoty tai Romanian leu)'),
        'euron, Ruotsin, Norjan tai Tanskan kruunun tai Puolan złotyn',
        'euron, Ruotsin, Norjan tai Tanskan kruunun, Puolan złotyn tai Romanian leun'),
        '(euro, Swedish, Norwegian or Danish krone, or Polish złoty)',
        '(euro, Swedish, Norwegian or Danish krone, Polish złoty or Romanian leu)'),
        'the euro, the Swedish, Norwegian or Danish krone or the Polish złoty',
        'the euro, the Swedish, Norwegian or Danish krone, the Polish złoty or the Romanian leu')
    where document_id = v_doc;

    /* Перечень валют без лея в черновике не остался — иначе упасть, а не молча оставить договор отставшим. */
    if exists (
      select 1 from public.legal_clauses
      where document_id = v_doc
        and (body like '%tai Puolan złoty)%' or body like '%tai Puolan złotyn%'
             or body like '%or Polish złoty)%' or body like '%or the Polish złoty%')
    ) then
      raise exception '%: перечень валют без лея остался', v_kind;
    end if;
    if not exists (
      select 1 from public.legal_clauses
      where document_id = v_doc and (body like '%Romanian leu%' or body like '%Romanian leun%')
    ) then
      raise exception '%: пункт о валютах не найден', v_kind;
    end if;
  end loop;
end;
$$;
