-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · документы: тренажёр водителя и сроки сертификатов
--
-- Поведение из миграций 20260927120000_training и
-- 20260927120200_driver_certificates переносится в политику
-- конфиденциальности тем же заходом, что и код.
--
-- PRIVACY 2.8 — прогресс тренажёра: что хранится, кто видит. Главное
-- обещание: индивидуальные результаты не видит работодатель (перевозчик),
-- заказчик и сотрудники Aivomaa. Без входа прогресс живёт только на
-- устройстве.
--
-- PRIVACY 2.9 — сроки сертификатов: вводят водитель и перевозчик, видят
-- оба и оператор, напоминания уходят обоим.
--
-- PRIVACY 4.7 — цели и основание. Основание обработки и сроки хранения
-- — правовой выбор, поэтому маркер юриста, а не описание кода. То же для
-- возможной агрегированной аналитики перевозчику: её нет, и без юриста
-- она не появится.
--
-- Черновик. Активация — решение пользователя.
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

/* Пункт на обоих языках: новый вставляется, существующий переписывается. */
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
  v_privacy uuid := pg_temp.draft_of('PRIVACY');
begin
  perform pg_temp.put(v_privacy, array[2, 8],
    'Koulutustiedot: kuljettajasovelluksen koulutusosiossa (Koulutus) tallennetaan kuljettajan kysymyskohtainen edistyminen: oikeiden ja väärien vastausten määrä, viimeisin vastausaika ja seuraava kertausaika. Tiedot näkyvät vain kuljettajalle itselleen; niitä ei näytetä kuljetusliikkeelle, tilaajalle eikä Aivomaa Oy:n henkilöstölle. Kirjautumattoman käyttäjän edistyminen tallennetaan vain hänen omaan laitteeseensa, ja kirjautuessaan kuljettaja voi siirtää sen palveluun.',
    'Training data: the training section of the driver app (Koulutus) stores the driver''s per-question progress: the number of correct and incorrect answers, the time of the last answer and the next review time. The data is visible only to the driver; it is not shown to the carrier, the shipper or Aivomaa Oy''s staff. The progress of a user who is not signed in is stored only on their own device, and on signing in the driver can transfer it to the service.');

  perform pg_temp.put(v_privacy, array[2, 9],
    'Pätevyyksien voimassaolo: kuljettajan todistusten ja korttien laji (esimerkiksi ammattipätevyys, ADR, työturvallisuuskortti, ensiapu, tieturva, kuljettajakortti), myöntämispäivä ja voimassaolon päättymispäivä. Tiedot syöttää kuljettaja itse tai kuljetusliike, ja ne näkyvät kuljettajalle, hänen kuljetusliikkeelleen ja ylläpitäjälle. Palvelu muistuttaa päättymisestä kuusi, kolme ja yksi kuukausi etukäteen kuljettajasovelluksessa sekä kuljetusliikkeelle kabinetissa ja sähköpostilla.',
    'Validity of qualifications: the type of the driver''s certificates and cards (for example the certificate of professional competence, ADR, occupational safety card, first aid, road safety, driver card), the date of issue and the expiry date. The data is entered by the driver or by the carrier, and it is visible to the driver, their carrier and the operator. The service sends reminders six, three and one month before expiry in the driver app, and to the carrier in the cabinet and by email.');

  perform pg_temp.put(v_privacy, array[4, 7],
    'Koulutustietoja käsitellään, jotta kuljettaja voi kerrata ja palata keskeneräiseen koulutukseen eri laitteilla. Pätevyyksien voimassaoloa käsitellään muistutuksia varten ja jotta kuljetusliike voi varmistaa, että kuljettajalla on työssä vaadittavat pätevyydet. Käsittelyn peruste ja säilytysajat: [Kohta täydennetään juristin kanssa.] Koulutustuloksia ei käytetä kuljettajan arviointiin eikä niistä anneta tietoja kuljetusliikkeelle yksilöinä; mahdollinen yhteenveto kuljetusliikkeelle otetaan käyttöön vain juristin kanssa sovitulla tavalla.',
    'Training data is processed so that the driver can review and continue unfinished training on different devices. The validity of qualifications is processed for the reminders and so that the carrier can make sure the driver holds the qualifications the work requires. Legal basis and retention periods: [This clause is to be completed with counsel.] Training results are not used to assess the driver and are not given to the carrier at an individual level; any summary for the carrier will be introduced only in a way agreed with counsel.');

  raise notice 'Черновик PRIVACY v%', (select version from public.legal_documents where id = v_privacy);
end;
$$;
