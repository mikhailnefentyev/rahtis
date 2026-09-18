-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · условия: вторая сторона claim — почтой
--
-- Действующая редакция (TERMS v5, пункт 12.3) обещает, что переписка по
-- claim видна обеим сторонам рейса. После миграции claims_mirror это
-- не так: подавший пишет оператору в кабинете, а вторая сторона получает
-- claim письмом от имени Aivomaa Oy и ведёт его почтой. Условие,
-- расходящееся с работой сервиса, хуже отсутствующего — поэтому новая
-- редакция, черновиком, с одним изменённым пунктом.
--
-- Соглашение заказчика не меняется: его 10.2 уже говорит, что Aivomaa Oy
-- сама ведёт связь с исполнителем.
-- ═══════════════════════════════════════════════════════════════════

do $$
declare
  v_active uuid := public.active_legal_document('TERMS');
  v_draft uuid;
  v_touched integer;
begin
  if v_active is null then
    raise exception 'Нет действующей редакции TERMS.' using errcode = '55007';
  end if;

  /* Черновик новее действующей — если оператор уже завёл, правим его. */
  select d.id into v_draft
  from public.legal_documents d
  where d.kind = 'TERMS' and d.status = 'DRAFT'
    and d.version > (select version from public.legal_documents where id = v_active)
  order by d.version desc
  limit 1;

  if v_draft is null then
    insert into public.legal_documents (kind, version, status, effective_from)
    values ('TERMS', (select max(version) + 1 from public.legal_documents where kind = 'TERMS'),
            'DRAFT', current_date)
    returning id into v_draft;

    insert into public.legal_clauses (document_id, locale, path, title, body)
    select v_draft, c.locale, c.path, c.title, c.body
    from public.legal_clauses c where c.document_id = v_active;
  end if;

  update public.legal_clauses
  set body = case locale
    when 'fi' then 'Reklamaatioon liitetään keikan asiakirjat ja valokuvat, myös ne, jotka lisätään keikalle reklamaation tekemisen jälkeen. Reklamaation tekijä voi liittää siihen tiedostoja ja kirjoittaa siinä viestejä Aivomaa Oy:lle. Aivomaa Oy välittää reklamaation viipymättä omissa nimissään keikan toiselle osapuolelle sähköpostitse liitteineen; toinen osapuoli näkee reklamaation, sen tilan ja ratkaisun palvelussa, ja asian käsittely sen kanssa jatkuu sähköpostitse Aivomaa Oy:n kanssa. Viestit, liitteet, tilamuutokset ja välittämisen ajankohta tallentuvat aikaleimoin reklamaation tapahtumalokiin, eikä osapuoli voi poistaa niitä jälkikäteen. Kuljetusliikkeen yritystietoja ei näytetä tilaajalle reklamaatiossakaan. Näyttöä arvioidaan kohdan 8 mukaisesti muun näytön kanssa.'
    else 'The documents and photographs of the job are attached to the claim, including those added to the job after the claim was filed. The party that filed the claim may attach files to it and write messages in it to Aivomaa Oy. Aivomaa Oy forwards the claim without delay, in its own name, to the other party to the job by email together with its attachments; the other party sees the claim, its status and the resolution in the service, and the matter is handled with it by email with Aivomaa Oy. Messages, attachments, status changes and the time of forwarding are recorded with timestamps in the claim''s event log and cannot be deleted afterwards by a party. The carrier''s company details are not shown to the shipper in a claim either. Evidence is assessed together with other evidence as set out in section 8.'
  end
  where document_id = v_draft and path = array[12, 3];

  get diagnostics v_touched = row_count;
  if v_touched <> 2 then
    raise exception 'Пункт 12.3: ожидались два языка, изменено %.', v_touched using errcode = '55000';
  end if;

  raise notice 'TERMS v% — черновик с 12.3 о почте готов к активации',
    (select version from public.legal_documents where id = v_draft);
end;
$$;
