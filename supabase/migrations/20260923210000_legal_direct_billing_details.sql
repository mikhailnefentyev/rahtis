-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · документы: реквизиты для прямого расчёта
--
-- Заказчику, который платит перевозчику сам, теперь показываются номер
-- счёта и BIC. Документы перечисляют, что о знакомой машине видно, и
-- обязаны назвать и это: банковские данные — те же данные компании, и
-- умолчание в перечне читается как «мы такого не показываем».
--
-- Правится не текст целиком, а одна фраза в нём: так видно, что именно
-- изменилось, и не переписывается пункт, который уже выверен.
--
-- Активация — решение пользователя.
-- ═══════════════════════════════════════════════════════════════════

create or replace function pg_temp.draft_of(p_kind public.legal_kind)
returns uuid
language plpgsql
as $$
declare
  v_active uuid := public.active_legal_document(p_kind);
  v_draft uuid;
begin
  if v_active is null then
    raise exception 'Нет действующей редакции %.', p_kind using errcode = '55007';
  end if;

  select d.id into v_draft
  from public.legal_documents d
  where d.kind = p_kind and d.status = 'DRAFT'
    and d.version > (select version from public.legal_documents where id = v_active)
  order by d.version desc
  limit 1;

  if v_draft is null then
    insert into public.legal_documents (kind, version, status, effective_from)
    values (p_kind, (select max(version) + 1 from public.legal_documents where kind = p_kind),
            'DRAFT', current_date)
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
  v_terms uuid := pg_temp.draft_of('TERMS');
  v_privacy uuid := pg_temp.draft_of('PRIVACY');
  v_hit integer;
begin
  /* TERMS 6.7 — что заказчик видит о знакомой машине. */
  update public.legal_clauses
  set body = replace(
    body,
    'tilaaja näkee lisäksi kuljetusliikkeen nimen ja y-tunnuksen: osapuolet laskuttavat ja maksavat keskenään, eikä laskuttajaa voi jättää tuntemattomaksi.',
    'tilaaja näkee lisäksi kuljetusliikkeen nimen, y-tunnuksen sekä maksamista varten tilinumeron ja BIC-koodin: osapuolet laskuttavat ja maksavat keskenään, eikä laskuttajaa voi jättää tuntemattomaksi.')
  where document_id = v_terms and path = array[6, 7] and locale = 'fi';

  update public.legal_clauses
  set body = replace(
    body,
    'the shipper also sees the carrier''s name and business identity code: the parties invoice and pay each other, and the party issuing the invoice cannot remain unknown.',
    'the shipper also sees the carrier''s name, business identity code and, for payment, its account number and BIC code: the parties invoice and pay each other, and the party issuing the invoice cannot remain unknown.')
  where document_id = v_terms and path = array[6, 7] and locale = 'en';

  /* PRIVACY 10.2 — видимость данных. */
  update public.legal_clauses
  set body = replace(
    body,
    'he näkevät toisensa nimeltä, koska muuten laskua ei voi osoittaa eikä maksaa.',
    'he näkevät toisensa nimeltä, koska muuten laskua ei voi osoittaa eikä maksaa; tilaajalle näytetään tällöin myös kuljetusliikkeen tilinumero ja BIC-koodi.')
  where document_id = v_privacy and path = array[10, 2] and locale = 'fi';

  update public.legal_clauses
  set body = replace(
    body,
    'they see each other by name, because otherwise an invoice can neither be addressed nor paid.',
    'they see each other by name, because otherwise an invoice can neither be addressed nor paid; the shipper is then also shown the carrier''s account number and BIC code.')
  where document_id = v_privacy and path = array[10, 2] and locale = 'en';

  /* Замена молча ничего не заменившая — худший исход: текст разойдётся с кодом. */
  select count(*) into v_hit
  from public.legal_clauses c
  where (c.document_id = v_terms and c.path = array[6, 7]
         and (c.body like '%BIC-koodin%' or c.body like '%BIC code%'))
     or (c.document_id = v_privacy and c.path = array[10, 2]
         and (c.body like '%BIC-koodi%' or c.body like '%BIC code%'));

  if v_hit <> 4 then
    raise exception 'Заменены не все четыре текста (получилось %). Проверь формулировки.', v_hit
      using errcode = '55000';
  end if;
end;
$$;
