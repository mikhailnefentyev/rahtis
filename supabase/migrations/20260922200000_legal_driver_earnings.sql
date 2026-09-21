-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · черновик политики: водитель видит свой заработок
--
-- Политика (v7, пункты 2.7 и 4.6) обещает, что модель оплаты и суммы
-- видны только перевозчику и водителю не показываются. С экрана «Ansiot»
-- (20260922190000) водитель видит свою ставку и посчитанные суммы. Выплату
-- перевозчику за рейс он по-прежнему не видит — только свою долю.
--
-- Правится черновик следующей редакции: заводится копией действующей
-- или берётся уже заведённый. Действующая не трогается. Активация —
-- решение пользователя.
-- ═══════════════════════════════════════════════════════════════════

do $$
declare
  v_draft uuid;
begin
  select d.id into v_draft
  from public.legal_documents d
  where d.kind = 'PRIVACY' and d.status = 'DRAFT'
    and d.version > (select version from public.legal_documents
                     where id = public.active_legal_document('PRIVACY'))
  order by d.version desc
  limit 1;

  if v_draft is null then
    insert into public.legal_documents (kind, version, status, effective_from)
    values ('PRIVACY', (select max(version) + 1 from public.legal_documents where kind = 'PRIVACY'),
            'DRAFT', current_date)
    returning id into v_draft;

    insert into public.legal_clauses (document_id, locale, path, title, body)
    select v_draft, c.locale, c.path, c.title, c.body
    from public.legal_clauses c where c.document_id = public.active_legal_document('PRIVACY');
  end if;

  update public.legal_clauses set body = case locale
    when 'fi' then 'Työaikatiedot: työvuorojen alku ja loppu, tauot, käytetty ajoneuvo, mittarilukemat, huomiot sekä näiden merkintöjen muutosloki tekijöineen ja aikoineen. Niitä kirjaa kuljetusliike tai kuljettaja kuljettajasovelluksessa. Kuljetusliikkeen kuljettajalle asettama palkkamalli ja hinnat sekä niistä lasketut suuntaa-antavat summat näkyvät tälle kuljetusliikkeelle ja kuljettajalle itselleen kuljettajasovelluksessa. Kuljettaja ei näe, mitä kuljetusliike saa keikasta, vaan ainoastaan oman osuutensa. Tilaaja ja muut kuljetusliikkeet eivät näe näitä tietoja.'
    else 'Working time data: the start and end of shifts, breaks, the vehicle used, odometer readings, notes and the change log of these entries with authors and times. They are recorded by the carrier or by the driver in the driver app. The pay model and rates the carrier sets for a driver, and the indicative sums computed from them, are visible to that carrier and to the driver in the driver app. The driver does not see what the carrier receives for a job, only their own share. The shipper and other carriers do not see this data.'
  end
  where document_id = v_draft and path = array[2, 7];

  update public.legal_clauses set body = case locale
    when 'fi' then 'Työaikatietoja ja palkkamalleja käsitellään, jotta kuljetusliike saa kuljettajiensa työaikakirjanpidon ja suuntaa-antavan palkkalaskelman palvelusta ja kuljettaja näkee omat tuntinsa ja ansionsa. Aivomaa Oy:n rooli tässä käsittelyssä, käsittelyn peruste ja tietojen säilytysaika: [Kohta täydennetään juristin kanssa.]'
    else 'Working time data and pay models are processed so that the carrier gets a record of its drivers'' working hours and an indicative pay calculation from the service, and the driver sees their own hours and earnings. The role of Aivomaa Oy in this processing, its legal basis and the retention period: [This clause is to be completed with counsel.]'
  end
  where document_id = v_draft and path = array[4, 6];
end;
$$;
