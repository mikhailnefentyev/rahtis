-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · документы догоняют новую схему денег
--
-- С миграции pricing_subscription: перевозчик платит 29,90 € + ALV в
-- месяц за каждую машину, закрывшую в этом месяце рейс, и сбор
-- удерживается из выплаты; процента с рейса нет. Заказчик платит 3 %
-- сверху за выполненный заказ со стола; прямые и отменённые — 0.
-- Первый полный месяц после одобрения бесплатен.
--
-- Правятся черновики: TERMS (8.5, черновик v10 уже заведён) и
-- SHIPPER_AGREEMENT (2.5 — прямой заказ теперь меняет цену; новый 3.4 —
-- плата). Удержание сбора из выплаты — зачёт встречных требований; его
-- порядок оставлен под маркером юриста. Активация — решение пользователя.
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
  v_shipper uuid := pg_temp.draft_of('SHIPPER_AGREEMENT');
begin
  perform pg_temp.put(v_terms, array[8, 5],
    'Kuljetusliike maksaa palvelusta 29,90 euroa ja arvonlisäveron kalenterikuukaudessa jokaisesta ajoneuvosta, jolla on kyseisen kuukauden aikana merkitty valmiiksi vähintään yksi keikka; muista palveluun rekisteröidyistä ajoneuvoista ei makseta. Kuukausimaksu vähennetään kuljetusliikkeelle maksettavasta tilityksestä, ja jos tilitys ei riitä, loppuosa vähennetään seuraavista tilityksistä. [Kohta täydennetään juristin kanssa: vähentämisen eli kuittauksen ehdot.] Kuljetusliikkeen keikkahinnasta ei peritä prosenttiosuutta. Tilaaja maksaa yhteisen pöydän kautta tilatusta ja valmistuneesta kuljetuksesta palvelumaksun, joka on 3 prosenttia kuljetuksen hinnasta ja lisätään laskuun; suorat tilaukset tutulle ajoneuvolle ja peruutetut tilaukset ovat maksuttomia. Yrityksen hyväksymiskuukauden loppuosa ja sitä seuraava kokonainen kalenterikuukausi ovat maksuttomia; jos yritys hyväksytään kuukauden ensimmäisenä päivänä, maksuton on kyseinen kuukausi. Keikan valmistumishetkellä voimassa oleva palvelumaksu kirjataan kyseiselle keikalle, eivätkä myöhemmät muutokset vaikuta jo valmistuneisiin keikkoihin. Arvonlisävero määräytyy sopimuskumppanin maan mukaan: suomalaiselle yritykselle lisätään 25,5 prosenttia, muun maan yritykselle sovelletaan käännettyä verovelvollisuutta, jolloin myyjä laskuttaa nollalla ja ostaja tilittää veron omassa maassaan. Kansainvälinen reitti tai ulkomainen osoite ei sinänsä tarkoita nollaverokantaa.',
    'The carrier pays EUR 29.90 plus VAT per calendar month for each vehicle with which at least one job has been marked complete during that month; no fee is paid for other vehicles registered in the service. The monthly fee is deducted from the settlement paid to the carrier, and if the settlement is not sufficient, the remainder is deducted from subsequent settlements. [This clause is to be completed with counsel: the terms of the deduction, i.e. set-off.] No percentage is taken from the carrier''s job price. The shipper pays a service fee for a transport ordered through the load board and completed, amounting to 3 per cent of the price of the transport and added to the invoice; direct orders to a known vehicle and cancelled orders are free of charge. The remainder of the month in which the company is approved and the following full calendar month are free of charge; if the company is approved on the first day of a month, that month is free. The service fee in force when the job is completed is recorded for that job, and later changes do not affect jobs already completed. VAT is determined by the country of the contracting party: 25.5 per cent is added for a Finnish company, and the reverse charge applies to a company from another country, in which case the seller invoices at zero and the buyer accounts for the tax in its own country. An international route or a foreign address does not in itself mean a zero rate.');

  update public.legal_clauses set body = case locale
    when 'fi' then replace(body, 'eikä suora tilaus muuta hinnoittelua, laskutusta eikä vastuita.',
                           'eikä suora tilaus muuta laskutusta eikä vastuita. Suorasta tilauksesta ei peritä palvelumaksua.')
    else replace(body, 'and a direct order does not change pricing, invoicing or liabilities.',
                 'and a direct order does not change invoicing or liabilities. No service fee is charged for a direct order.')
  end
  where document_id = v_shipper and path = array[2, 5];

  perform pg_temp.put(v_shipper, array[3, 4],
    'Aivomaa Oy lisää laskuun palvelumaksun, joka on 3 prosenttia yhteisen pöydän kautta tilatun ja valmistuneen kuljetuksen hinnasta. Suorasta tilauksesta tutulle ajoneuvolle ja peruutetusta tilauksesta palvelumaksua ei peritä. Hyväksymiskuukauden loppuosa ja sitä seuraava kokonainen kalenterikuukausi ovat maksuttomia käyttöehtojen kohdan 8.5 mukaisesti.',
    'Aivomaa Oy adds to the invoice a service fee of 3 per cent of the price of a transport ordered through the load board and completed. No service fee is charged for a direct order to a known vehicle or for a cancelled order. The remainder of the month of approval and the following full calendar month are free of charge under clause 8.5 of the terms of use.');
end;
$$;
