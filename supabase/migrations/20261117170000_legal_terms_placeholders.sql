-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · условия: пункты 3.5 и 4.4 вместо заглушек «täydennetään
-- juristin kanssa» (17.11.2026)
--
-- Черновик TERMS (копия действующей v24), активация — решение
-- пользователя.
--   3.5  Шаблон TES в калькуляторе зарплаты (AKT Kuorma-autoalan TES
--        2025–2028, 20260922250000): Aivomaa обновляет его в разумный
--        срок после публикации изменений, но не гарантирует, что он
--        актуален в каждый момент и подходит конкретному перевозчику;
--        ответственность — в пределах 13.5, кроме умысла и грубой
--        небрежности. Скопированный или изменённый перевозчиком шаблон
--        обновления не получает — за него отвечает перевозчик; расчёт
--        проверяется до выплаты. Заодно из английского текста убрана
--        оставшаяся в скобках финская фраза.
--   4.4  Ключ API: компания отвечает за действия, совершённые её ключом,
--        до его отзыва в сервисе, в том числе после утечки, если утечка
--        не из систем Aivomaa; при подозрении — отозвать сразу и
--        сообщить на admin@rahtis.eu; после отзыва ключ не работает.
--        Aivomaa может сама отозвать ключ или ограничить доступ при
--        признаках злоупотребления; ответственность Aivomaa — по 13.5.
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

/* Замена фразы; новая уже стоит — ничего; нет ни старой, ни новой — ошибка. */
create or replace function pg_temp.swap(p_doc uuid, p_path integer[], p_locale text, p_from text, p_to text)
returns void
language plpgsql
as $$
begin
  if exists (
    select 1 from public.legal_clauses
    where document_id = p_doc and path = p_path and locale = p_locale and position(p_to in body) > 0
  ) then
    return;
  end if;

  update public.legal_clauses
  set body = replace(body, p_from, p_to)
  where document_id = p_doc and path = p_path and locale = p_locale and position(p_from in body) > 0;

  if not found then
    raise exception 'Пункт % (%): фрагмент не найден: %', array_to_string(p_path, '.'), p_locale, left(p_from, 60);
  end if;
end;
$$;

do $$
declare
  v_doc uuid := pg_temp.draft_of('TERMS');
begin
  -- 3.5 — шаблон TES
  perform pg_temp.swap(v_doc, '{3,5}', 'fi',
    $t$[Kohta täydennetään juristin kanssa: vastuu pohjan ajantasaisuudesta.]$t$,
    $t$Aivomaa Oy ylläpitää työehtosopimuspohjaa huolellisesti ja päivittää sen kohtuullisessa ajassa sen jälkeen, kun muutettu työehtosopimus tai sen palkkataulukot on julkaistu. Aivomaa Oy ei takaa, että pohja on kulloinkin ajantasainen tai soveltuu juuri kuljetusliikkeen tilanteeseen, eikä se vastaa pohjan tai laskurin käytöstä aiheutuvista palkkasaatavista, korotuksista, viivästyskoroista, seuraamuksista tai muista vahingoista, ellei vahinko johdu Aivomaa Oy:n tahallisuudesta tai törkeästä huolimattomuudesta; muilta osin Aivomaa Oy:n vastuu määräytyy kohdan 13.5 mukaan. Kun kuljetusliike on kopioinut pohjan itselleen tai muuttanut sitä, Aivomaa Oy:n myöhemmät päivitykset eivät muuta kopiota, ja kopion ajantasaisuudesta vastaa kuljetusliike. Kuljetusliike tarkistaa laskelman ennen palkanmaksua.$t$);
  /* Удаление фразы — не через swap: пустая замена «находится» в любом тексте. Повторный прогон ничего не меняет. */
  update public.legal_clauses
  set body = replace(body, $t$ (Laskuri on suuntaa-antava. Lopullinen palkka määräytyy työnantajan ja työsopimuksen/TES:n mukaan.)$t$, '')
  where document_id = v_doc and path = '{3,5}' and locale = 'en';
  perform pg_temp.swap(v_doc, '{3,5}', 'en',
    $t$[This clause is to be completed with counsel: responsibility for keeping the template up to date.]$t$,
    $t$Aivomaa Oy maintains the collective agreement template with care and updates it within a reasonable time after an amended collective agreement or its wage tables have been published. Aivomaa Oy does not guarantee that the template is up to date at any given time or suited to the carrier's particular situation, and is not liable for wage claims, increases, late-payment interest, sanctions or other damage arising from the use of the template or the calculator, unless the damage results from Aivomaa Oy's intent or gross negligence; otherwise Aivomaa Oy's liability is determined under clause 13.5. Once the carrier has copied the template for itself or modified it, later updates by Aivomaa Oy do not change the copy, and the carrier is responsible for keeping the copy up to date. The carrier checks the calculation before paying wages.$t$);

  -- 4.4 — ключ API
  perform pg_temp.swap(v_doc, '{4,4}', 'fi',
    $t$[Kohta täydennetään juristin kanssa: vastuu avaimen väärinkäytöstä ennen sen poistamista käytöstä.]$t$,
    $t$Yritys vastaa kaikista sen avaimella tehdyistä toimista ja niistä aiheutuneista vahingoista siihen asti, kun avain on poistettu käytöstä palvelussa, myös silloin, kun avain on joutunut sivullisen käyttöön, ellei avain ole joutunut sivulliselle Aivomaa Oy:n järjestelmiin kohdistuneen tietoturvaloukkauksen vuoksi. Jos yritys epäilee avaimen tai salaisuuden joutuneen sivullisen tietoon, sen on poistettava avain käytöstä palvelussa viipymättä ja ilmoitettava asiasta Aivomaa Oy:lle osoitteeseen admin@rahtis.eu. Käytöstä poistetulla avaimella ei voi tehdä toimia, eikä yritys vastaa avaimella sen jälkeen yritetyistä toimista. Aivomaa Oy voi poistaa avaimen käytöstä tai rajoittaa rajapinnan käyttöä heti, jos se havaitsee väärinkäyttöön viittaavaa toimintaa, ja ilmoittaa tästä yritykselle. Aivomaa Oy:n vastuu määräytyy kohdan 13.5 mukaan.$t$);
  perform pg_temp.swap(v_doc, '{4,4}', 'en',
    $t$[This clause is to be completed with counsel: liability for misuse of a key before it is revoked.]$t$,
    $t$The company is responsible for all actions taken with its key and for damage resulting from them until the key has been revoked in the service, also where the key has come into the use of a third party, unless the key reached the third party because of a security breach of Aivomaa Oy's systems. If the company suspects that a key or secret may have come to the knowledge of a third party, it must revoke the key in the service without delay and notify Aivomaa Oy at admin@rahtis.eu. A revoked key cannot be used to take any action, and the company is not responsible for actions attempted with the key after revocation. Aivomaa Oy may revoke a key or restrict use of the interface immediately if it detects activity indicating misuse, and informs the company of this. Aivomaa Oy's liability is determined under clause 13.5.$t$);
end;
$$;

/* В условиях не должно остаться ни одной заглушки для юриста. */
do $$
begin
  if exists (
    select 1 from public.legal_clauses c
    where c.document_id = pg_temp.draft_of('TERMS')
      and (c.body ilike '%juristin kanssa%' or c.body ilike '%completed with counsel%' or c.body ilike '%Laskuri on suuntaa-antava. Lopullinen%' and c.locale = 'en')
  ) then
    raise exception 'В черновике TERMS осталась заглушка для юриста.';
  end if;
end;
$$;
