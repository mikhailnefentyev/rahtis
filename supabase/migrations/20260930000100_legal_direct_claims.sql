-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · документы: претензии по прямым рейсам — между сторонами
--
-- Под поведение 20260930000000 (решение пользователя 29.09.2026): если
-- Aivomaa не сторона договора — прямой рейс перевозчика на подписке, —
-- процедура претензий в сервисе не применяется, стороны решают сами.
-- TERMS 12.1 и договор перевозчика 15.2 — в существующие черновики
-- (TERMS v17, CARRIER_AGREEMENT v2). Активация — решение пользователя.
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
  v_carrier uuid := pg_temp.draft_of('CARRIER_AGREEMENT');
begin
  perform pg_temp.put(v_terms, array[12, 1],
    'Keikan tilaaja ja keikan suorittanut kuljetusliike voivat tehdä palvelussa reklamaation käynnissä olevasta tai valmiista keikasta. Reklamaation aihe voi olla lastin tai perävaunun vaurio, vajaus, odotusaika, poikkeama reitistä tai aikataulusta tai muu keikkaan liittyvä poikkeama. Reklamaatio osoitetaan Aivomaa Oy:lle, joka on kummankin osapuolen sopimuskumppani: Aivomaa Oy käsittelee sen keikan toisen osapuolen kanssa ja välittää osapuolten välillä. Reklamaatio ei synnytä suoraa sopimussuhdetta tilaajan ja kuljetusliikkeen välille. Tätä luvun 12 menettelyä ei sovelleta kohdan 6.6 suoraan tilaukseen kuukausimaksua käyttävän kuljetusliikkeen kanssa: siinä kuljetussopimus on tilaajan ja kuljetusliikkeen välinen, ja osapuolet sopivat reklamaatioista keskenään. Keikan asiakirjat ja kuvat ovat tällöinkin molempien osapuolten käytettävissä palvelussa.',
    'The shipper of a job and the carrier that performed it may file a claim in the service about a running or completed job. A claim may concern damage to the cargo or trailer, a shortage, waiting time, a deviation from the route or schedule, or another deviation related to the job. The claim is addressed to Aivomaa Oy, which is each party''s contracting party: Aivomaa Oy handles it with the other party to the job and mediates between the parties. A claim does not create a direct contractual relationship between the shipper and the carrier. The procedure of this section 12 does not apply to a direct order under clause 6.6 with a carrier that uses the service for a monthly fee: there the contract of carriage is between the shipper and the carrier, and the parties settle claims between themselves. The documents and photographs of the job remain available to both parties in the service.');

  perform pg_temp.put(v_carrier, array[15, 2],
    'Reklamaatiot käsitellään RAHTIS-palvelussa käyttöehtojen mukaisesti. Kohdan 2.3 suorissa tilauksissa, joissa Aivomaa Oy ei ole kuljetussopimuksen osapuoli, kuljetusliike ja asiakas sopivat reklamaatioista keskenään; palvelu säilyttää keikan asiakirjat ja kuvat molempien käytettäväksi. Kuljetusliikkeen vastuu kuljetuksesta, tavarasta, viivästyksestä ja vahingoista määräytyy sovellettavan lain ja soveltuvin osin CMR-yleissopimuksen perusteella. Tämä sopimus ei laajenna kuljetusliikkeen vastuuta pakottavien vastuusäännösten yli.',
    'Claims are handled in the RAHTIS service in accordance with the terms of use. In direct orders under section 2.3, where Aivomaa Oy is not a party to the contract of carriage, the carrier and the customer settle claims between themselves; the service keeps the documents and photographs of the assignment available to both. The carrier''s liability for the transport, the goods, delay and damage is determined by the applicable law and, where applicable, the CMR Convention. This agreement does not extend the carrier''s liability beyond mandatory liability rules.');
end;
$$;
