-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · документы: сбор берётся счётом, когда выплаты нет
--
-- Пункт 8.5 обещал, что месячный сбор удерживается из выплаты. У
-- подписчика, возящего своих клиентов, выплаты от нас нет вовсе, и
-- обещание оказывалось пустым: сбор висел, счёта на него не было.
-- Миграция subscription_invoice дала второй путь — счёт на непокрытый
-- остаток. Документ обязан сказать это словами.
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
  select d.id into v_draft
  from public.legal_documents d
  where d.kind = p_kind and d.status = 'DRAFT'
    and d.version > (select version from public.legal_documents where id = v_active)
  order by d.version desc
  limit 1;

  if v_draft is null then
    raise exception 'Нет черновика % — сначала legal_two_tracks.', p_kind using errcode = '55007';
  end if;

  return v_draft;
end;
$$;

do $$
declare
  v_terms uuid := pg_temp.draft_of('TERMS');
begin
  update public.legal_clauses set body = case locale
    when 'fi' then 'Palvelua voi käyttää kahdella tavalla, ja kuljetusliike valitsee kumpaa se käyttää. (a) Alusta kuukausimaksulla: maksu on 29,90 euroa kalenterikuukaudessa jokaisesta ajoneuvosta, jolla on kyseisen kuukauden aikana merkitty valmiiksi vähintään yksi keikka; muista palveluun rekisteröidyistä ajoneuvoista ei makseta. Näin ajetaan sekä kuljetusliikkeen omat asiakkaat että palvelussa olevan tilaajan suorat tilaukset silloin, kun tilaaja on lisännyt ajoneuvon omiin autoihinsa. Näistä keikoista ei peritä prosenttiosuutta: kuljetussopimus on kuljetusliikkeen ja sen asiakkaan välinen, eikä Aivomaa Oy laskuta asiakasta, ota vastaan maksuja tai vastaa kuljetuksesta, vaan toimittaa palvelussa raportin tehdystä työstä. Kuukausimaksu vähennetään kuljetusliikkeelle maksettavasta tilityksestä, jos tilitystä on; jos tilitystä ei ole tai se ei riitä, kattamaton osa laskutetaan kuukauden päätyttyä tavanomaisin maksuehdoin. (b) Alihankinta: kuljetusliike toimii Aivomaa Oy:n alihankkijana, jolloin Aivomaa Oy on tilaajan sopimuskumppani, laskuttaa tilaajaa, vastaanottaa rahtikirjat, toimittaa raportit ja käsittelee reklamaatiot. Maksu on 3 prosenttia jokaisen keikan hinnasta, ja se vähennetään kuljetusliikkeelle maksettavasta tilityksestä; kuukausimaksua ajoneuvoista ei tällöin peritä. Tarjouspöydältä otettu keikka ajetaan aina alihankintana riippumatta siitä, kumpaa tapaa kuljetusliike muutoin käyttää: tällaisesta keikasta tilaaja maksaa 3 prosentin palvelumaksun ja kuljetusliike 3 prosenttia keikan hinnasta. Alihankkijana toimivalla kuljetusliikkeellä on oltava voimassa oleva vastuuvakuutus, ja Aivomaa Oy tarkistaa tilaajavastuulain tarkoittamat tiedot ennen sopimusta ja sen jälkeen määräajoin. Keikan valmistumishetkellä voimassa olevat maksut kirjataan kyseiselle keikalle, eivätkä myöhemmät muutokset vaikuta jo valmistuneisiin keikkoihin. Yrityksen hyväksymiskuukauden loppuosa ja sitä seuraava kokonainen kalenterikuukausi ovat maksuttomia; jos yritys hyväksytään kuukauden ensimmäisenä päivänä, maksuton on kyseinen kuukausi. Arvonlisävero määräytyy sopimuskumppanin maan mukaan: suomalaiselle yritykselle lisätään 25,5 prosenttia, muun maan yritykselle sovelletaan käännettyä verovelvollisuutta, jolloin myyjä laskuttaa nollalla ja ostaja tilittää veron omassa maassaan. [Kohta täydennetään juristin kanssa: kuittauksen ehdot, alihankkijan vakuutuksen vähimmäismäärä sekä regressin ehdot.]'
    else 'The service can be used in two ways, and the carrier chooses which one it uses. (a) The platform for a monthly fee: the fee is 29.90 euros per calendar month for each vehicle that has at least one job marked complete during that month; no fee is charged for the other vehicles registered in the service. This covers both the carrier''s own clients and the direct orders of a shipper in the service where the shipper has added the vehicle to its own vehicles. No percentage is charged on these jobs: the contract of carriage is between the carrier and its client, and Aivomaa Oy does not invoice the client, receive payments or bear liability for the transport, but delivers a report of the work done in the service. The monthly fee is deducted from the settlement paid to the carrier where there is one; if there is no settlement or it is not sufficient, the uncovered part is invoiced after the end of the month on the usual payment terms. (b) Subcontracting: the carrier acts as a subcontractor of Aivomaa Oy, in which case Aivomaa Oy is the shipper''s contracting party, invoices the shipper, receives the consignment notes, delivers the reports and handles the claims. The fee is 3 per cent of the price of every job and is deducted from the settlement paid to the carrier; no monthly vehicle fee is charged in that case. A job taken from the offer table is always performed as subcontracting regardless of which way the carrier otherwise uses: for such a job the shipper pays a 3 per cent service fee and the carrier 3 per cent of the price of the job. A carrier acting as a subcontractor must hold valid liability insurance, and Aivomaa Oy checks the information referred to in the Act on the Contractor''s Obligations before the contract and periodically thereafter. The fees in force at the moment a job is completed are recorded on that job, and later changes do not affect jobs already completed. The remainder of the company''s approval month and the following full calendar month are free of charge; if the company is approved on the first day of a month, that month is free. Value added tax is determined by the country of the contracting party: 25.5 per cent is added for a Finnish company, and the reverse charge applies to a company from another country, whereby the seller invoices at zero and the buyer accounts for the tax in its own country. [This clause is to be completed with counsel: the terms of set-off, the minimum amount of the subcontractor''s insurance and the terms of recourse.]'
  end
  where document_id = v_terms and path = array[8, 5];
end;
$$;
