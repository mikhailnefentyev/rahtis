-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · условия и политика: рассрочка, этап 3 (23.11.2026)
--
-- Под поведение 20261123100000_installment_stage3. Черновики (если
-- черновика нет — копия действующей версии), активация — решение
-- пользователя.
--   TERMS, пункт «Kaluston osamaksukauppa» — передача, счета взносов,
--     напоминания; оплату отмечает продавец.
--   PRIVACY, пункт «Kaluston osamaksukauppa» — продавец после передачи
--     видит пробег, дефекты, обслуживание, осмотр, простой и оплаты;
--     местоположения и данных водителей не видит.
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

/* Замена фразы в пункте «Kaluston osamaksukauppa»: уже заменено — ничего; нет ни старой, ни новой — ошибка. */
create or replace function pg_temp.swap(p_doc uuid, p_locale text, p_from text, p_to text)
returns void
language plpgsql
as $$
begin
  if exists (
    select 1 from public.legal_clauses
    where document_id = p_doc and locale = p_locale and position(p_to in body) > 0
  ) then
    return;
  end if;
  update public.legal_clauses set body = replace(body, p_from, p_to)
  where document_id = p_doc and locale = p_locale and position(p_from in body) > 0;
  if not found then
    raise exception 'Фрагмент не найден (%): %', p_locale, left(p_from, 60);
  end if;
end;
$$;

do $$
declare
  v_terms uuid := pg_temp.draft_of('TERMS');
  v_privacy uuid := pg_temp.draft_of('PRIVACY');
begin
  perform pg_temp.swap(v_terms, 'fi',
    'käsiraha ja koko kauppahinnan arvonlisävero. Kauppa ja sopimus syntyvät',
    'käsiraha ja koko kauppahinnan arvonlisävero. Kun ensimmäinen lasku on maksettu, osapuolet vahvistavat palvelussa ajoneuvon luovutuksen; tämän jälkeen ajoneuvo siirtyy ostajan kalustoon luonnoksena, joka hyväksytään kuten muutkin ajoneuvot, ja palvelu muodostaa myyjän nimissä maksuerien laskut ja muistuttaa ostajaa myöhässä olevista eristä. Maksujen kirjaamisesta palveluun vastaa myyjä. Palvelu ei ota ajoneuvoa takaisin eikä estä sen käyttöä. Kauppa ja sopimus syntyvät');
  perform pg_temp.swap(v_terms, 'en',
    'the VAT on the whole price. The sale and the contract',
    'the VAT on the whole price. Once the first invoice is paid, the parties confirm the handover of the vehicle in the service; the vehicle then moves to the buyer''s fleet as a draft that is approved like any other vehicle, and the service produces the instalment invoices in the seller''s name and reminds the buyer of overdue instalments. The seller is responsible for recording payments in the service. The service does not repossess the vehicle or prevent its use. The sale and the contract');

  perform pg_temp.swap(v_privacy, 'fi',
    'Ajoneuvon sijainti- ja käyttötietoja ei tämän toiminnon kautta jaeta myyjälle.',
    'Luovutuksen jälkeen myyjä näkee sopimuksen ajan ostajan kalustoon siirretyn ajoneuvon matkamittarilukeman, avoimien vikojen ja myöhässä olevien huoltojen määrän, viimeisimmän lähtötarkastuksen ajankohdan, merkinnän käytöstä poistosta sekä maksuerien tilan. Ajoneuvon sijaintia ja kuljettajia koskevia tietoja ei näytetä myyjälle.');
  perform pg_temp.swap(v_privacy, 'en',
    'The vehicle''s location and usage data are not shared with the seller through this function.',
    'After the handover, for the term of the contract, the seller sees the odometer reading of the vehicle moved to the buyer''s fleet, the number of open defects and overdue services, the time of the latest pre-trip inspection, an out-of-service marking and the status of the instalments. The vehicle''s location and data on the drivers are not shown to the seller.');
end;
$$;
