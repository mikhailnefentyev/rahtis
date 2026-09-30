-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · документы: простой по площадкам
--
-- Под поведение 20260930130000: стол показывает обычный простой
-- площадки, заказчик — свои площадки. TERMS 6.8 — в черновик v18.
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

create or replace function pg_temp.put(p_doc uuid, p_path integer[], p_fi text, p_en text)
returns void
language sql
as $$
  insert into public.legal_clauses (document_id, locale, path, body)
  values (p_doc, 'fi', p_path, p_fi), (p_doc, 'en', p_path, p_en)
  on conflict (document_id, locale, path) do update set body = excluded.body;
$$;

do $$
declare
  v_terms uuid := pg_temp.draft_of('TERMS');
begin
  perform pg_temp.put(v_terms, array[6, 8],
    'Tarjouspöydällä toimeksiannosta näkyvät lastaus- ja purkupaikan kaupunki, aikataulu, matka, kuorma ja kuljetettavan yksikön tiedot. Paikan nimeä, tarkkaa osoitetta, varausnumeroa, huomautuksia, yhteyshenkilöitä eikä tarkkaa reittiviivaa ei näytetä, ja kartalla pisteet esitetään noin kymmenen kilometrin tarkkuudella. Pisteiden täydelliset tiedot avautuvat sille kuljetusliikkeelle ja kuljettajalle, jolle keikka on osoitettu; ilman niitä kuormaa ei voi noutaa. Lisäksi tarjouspöydällä voidaan näyttää pisteen paikan tavallinen odotusaika, joka lasketaan palvelun aiempien keikkojen saapumis- ja kuittausajoista samassa paikassa viimeisen 12 kuukauden ajalta, kun keikkoja on vähintään kolme. Luku on tilastollinen ohje eikä lupaus tämän keikan odotusajasta, eikä siitä käy ilmi, kenen keikoista se on laskettu. Tilaaja näkee samat luvut omista lastaus- ja purkupaikoistaan.',
    'On the offer table, an assignment shows the city of the loading and unloading place, the schedule, the distance, the cargo and the details of the unit to be transported. The name of the place, the exact address, the booking reference, notes, contact persons and the exact route line are not shown, and on the map the points are presented with an accuracy of about ten kilometres. The full details of the points open to the carrier and the driver to whom the job has been assigned; without them the load cannot be collected. In addition, the board may show the typical waiting time at the place of a stop, calculated from the arrival and confirmation times of earlier jobs in the service at the same place over the last 12 months, once there are at least three jobs. The figure is statistical guidance, not a promise about the waiting time of this job, and it does not show whose jobs it was calculated from. The shipper sees the same figures for its own loading and unloading sites.');
end;
$$;
