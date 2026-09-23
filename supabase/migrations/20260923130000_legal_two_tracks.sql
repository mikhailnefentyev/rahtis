-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · документы: две ветки в пункте о плате
--
-- Миграция two_tracks развела подписку и подряд. Пункт 8.5 действующих
-- условий знает только одну схему — 29,90 € за машину и ноль процентов
-- с перевозчика, — и теперь это неверно: у субподрядчика процент есть,
-- а месячного сбора нет.
--
-- Правится черновик TERMS (v11, заведён миграцией legal_desk_city).
-- Договор заказчика не трогаем: для него ничего не изменилось — он
-- по-прежнему платит 3 % за заказ со стола, и его сторона договора
-- по-прежнему Aivomaa Oy.
--
-- Обязанность проверять субподрядчика (tilaajavastuu) и требование
-- действующей страховки записаны прямо: мы на это согласились, значит
-- это обещание, а не намерение. Условия зачёта, регресса и страховых
-- сумм — под маркером юриста.
--
-- Рейсы своего клиента подписчика в документах названы, но раздела о
-- передаче данных его клиента здесь нет: самой возможности завести
-- такой заказ ещё нет в коде. Появится вместе со справочником клиентов
-- перевозчика — тогда же в политику придёт обработка по поручению.
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
  perform pg_temp.put(v_terms, array[8, 5],
    'Palvelua voi käyttää kahdella tavalla, ja kuljetusliike valitsee kumpaa se käyttää. (a) Alusta kuukausimaksulla: kuljetusliike ajaa omia asiakkaitaan ja käyttää palvelua työn ohjaamiseen. Maksu on 29,90 euroa kalenterikuukaudessa jokaisesta ajoneuvosta, jolla on kyseisen kuukauden aikana merkitty valmiiksi vähintään yksi keikka; muista palveluun rekisteröidyistä ajoneuvoista ei makseta. Näissä keikoissa kuljetussopimus on kuljetusliikkeen ja sen oman asiakkaan välinen: Aivomaa Oy ei laskuta asiakasta, ei ota vastaan maksuja eikä vastaa kuljetuksesta, vaan välittää tiedot ja asiakirjat sovitulla tavalla. (b) Alihankinta: kuljetusliike toimii Aivomaa Oy:n alihankkijana, jolloin Aivomaa Oy on tilaajan sopimuskumppani, laskuttaa tilaajaa, vastaanottaa rahtikirjat, toimittaa raportit ja käsittelee reklamaatiot. Maksu on 3 prosenttia keikan hinnasta, ja se vähennetään kuljetusliikkeelle maksettavasta tilityksestä; kuukausimaksua ajoneuvoista ei tällöin peritä. Tarjouspöydältä otettu keikka ajetaan aina alihankintana riippumatta siitä, kumpaa tapaa kuljetusliike muutoin käyttää: tällaisesta keikasta tilaaja maksaa 3 prosentin palvelumaksun ja kuljetusliike 3 prosenttia keikan hinnasta. Alihankkijana toimivalla kuljetusliikkeellä on oltava voimassa oleva vastuuvakuutus, ja Aivomaa Oy tarkistaa tilaajavastuulain tarkoittamat tiedot ennen sopimusta ja sen jälkeen määräajoin. Keikan valmistumishetkellä voimassa olevat maksut kirjataan kyseiselle keikalle, eivätkä myöhemmät muutokset vaikuta jo valmistuneisiin keikkoihin. Yrityksen hyväksymiskuukauden loppuosa ja sitä seuraava kokonainen kalenterikuukausi ovat maksuttomia; jos yritys hyväksytään kuukauden ensimmäisenä päivänä, maksuton on kyseinen kuukausi. Arvonlisävero määräytyy sopimuskumppanin maan mukaan: suomalaiselle yritykselle lisätään 25,5 prosenttia, muun maan yritykselle sovelletaan käännettyä verovelvollisuutta, jolloin myyjä laskuttaa nollalla ja ostaja tilittää veron omassa maassaan. [Kohta täydennetään juristin kanssa: kuittauksen ehdot, alihankkijan vakuutuksen vähimmäismäärä sekä regressin ehdot.]',
    'The service can be used in two ways, and the carrier chooses which one it uses. (a) The platform for a monthly fee: the carrier drives its own clients and uses the service to run the work. The fee is 29.90 euros per calendar month for each vehicle that has at least one job marked complete during that month; no fee is charged for the other vehicles registered in the service. In these jobs the contract of carriage is between the carrier and its own client: Aivomaa Oy does not invoice the client, does not receive payments and is not liable for the transport, but passes on the data and the documents as agreed. (b) Subcontracting: the carrier acts as a subcontractor of Aivomaa Oy, in which case Aivomaa Oy is the shipper''s contracting party, invoices the shipper, receives the consignment notes, delivers the reports and handles the claims. The fee is 3 per cent of the price of the job and is deducted from the settlement paid to the carrier; no monthly vehicle fee is charged in that case. A job taken from the offer table is always performed as subcontracting regardless of which way the carrier otherwise uses: for such a job the shipper pays a 3 per cent service fee and the carrier 3 per cent of the price of the job. A carrier acting as a subcontractor must hold valid liability insurance, and Aivomaa Oy checks the information referred to in the Act on the Contractor''s Obligations before the contract and periodically thereafter. The fees in force at the moment a job is completed are recorded on that job, and later changes do not affect jobs already completed. The remainder of the company''s approval month and the following full calendar month are free of charge; if the company is approved on the first day of a month, that month is free. Value added tax is determined by the country of the contracting party: 25.5 per cent is added for a Finnish company, and the reverse charge applies to a company from another country, whereby the seller invoices at zero and the buyer accounts for the tax in its own country. [This clause is to be completed with counsel: the terms of set-off, the minimum amount of the subcontractor''s insurance and the terms of recourse.]');
end;
$$;
