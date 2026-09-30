-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · документы: карточка перевозчика
--
-- Под поведение 20260930140000: показатели считаются автоматически,
-- компания и оператор видят все, заказчик в откликах — рейсы и приезд
-- вовремя без имени. TERMS 6.9 (новый) в черновик v18, PRIVACY 2.12
-- (новый) в черновик v16. Активация — решение пользователя.
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
  v_privacy uuid := pg_temp.draft_of('PRIVACY');
begin
  perform pg_temp.put(v_terms, array[6, 9], 'Palvelu laskee kuljetusliikkeelle automaattisesti tunnusluvut viimeisen 12 kuukauden valmiista keikoista: keikkojen määrä, ajallaan saapumisen osuus (saapuminen enintään 15 minuuttia sovitun ajan jälkeen), rahtikirjan lataamisen osuus, luovutetut keikat, tilaajien reklamaatiot ja hyväksyttyjen suorien tilausten osuus. Prosenttiosuus näytetään vasta, kun havaintoja on vähintään viisi. Kuljetusliike ja ylläpitäjä näkevät kaikki luvut; tilaaja näkee tarjouksissa keikkojen määrän ja ajallaan saapumisen osuuden ilman kuljetusliikkeen nimeä. Luvut ovat tietoa tilaajan valintaa varten, eivätkä ne yksin estä kuljetusliikettä käyttämästä palvelua.', 'The service automatically calculates key figures for a carrier from its completed jobs over the last 12 months: the number of jobs, the share of on-time arrivals (arrival no later than 15 minutes after the agreed time), the share of jobs with an uploaded consignment note, jobs given up, claims by shippers and the share of direct orders accepted. A percentage is shown only once there are at least five observations. The carrier and the administrator see all figures; in offers the shipper sees the number of jobs and the on-time share without the carrier''s name. The figures inform the shipper''s choice and do not by themselves prevent the carrier from using the service.');
  perform pg_temp.put(v_privacy, array[2, 12], 'Kuljetusliikkeen tunnusluvut: käyttöehtojen kohdan 6.9 luvut lasketaan tilausten, reittipisteiden, rahtikirjojen, reklamaatioiden ja suorien tilausten tiedoista eikä niitä tallenneta erikseen. Ne koskevat yritystä; toiminimellä toimivan elinkeinonharjoittajan kohdalla ne voivat olla henkilötietoja. Tarjouksissa tilaaja näkee keikkojen määrän ja ajallaan saapumisen osuuden ilman yrityksen nimeä. Yksittäisen kuljettajan tunnuslukuja ei lasketa. [Kohta täydennetään juristin kanssa: käsittelyperuste toiminimen tunnusluvuille ja oikeus vastustaa.]', 'Carrier key figures: the figures of clause 6.9 of the terms of use are calculated from the data of orders, route stops, consignment notes, claims and direct orders and are not stored separately. They concern the company; for a sole trader they may be personal data. In offers the shipper sees the number of jobs and the on-time share without the company name. Key figures for individual drivers are not calculated. [To be completed with a lawyer: the legal basis for the key figures of sole traders and the right to object.]');
end;
$$;
