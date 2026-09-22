-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · условия догоняют шаблон Kuorma-autoalan TES
--
-- Условия (3.5) говорят, что калькулятор считает только по моделям и
-- ставкам, которые перевозчик ввёл сам. С миграции tes_kuorma_auto
-- оператор даёт готовый шаблон по отраслевому договору — с таблицами
-- ставок и правилами надбавок, — и его можно выбрать напрямую.
--
-- Правится черновик следующей редакции TERMS; действующая не трогается.
-- Кто отвечает за актуальность шаблона — правовой выбор, он оставлен под
-- маркером юриста. Активация — решение пользователя.
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

do $$
declare
  v_terms uuid := pg_temp.draft_of('TERMS');
begin
  insert into public.legal_clauses (document_id, locale, path, body)
  values
    (v_terms, 'fi', array[3, 5],
     'Palvelussa voidaan kirjata kuljettajien työvuorot, tauot ja mittarilukemat. Niitä kirjaa kuljetusliike tai kuljettaja kuljettajasovelluksessa, ja jälkikäteiset muutokset ja poistot tallentuvat muutoslokiin. Palvelun palkkalaskuri laskee kuljetusliikkeen valitsemalla mallilla: kuljetusliikkeen itse syöttämillä hinnoilla tai Aivomaa Oy:n tarjoamalla työehtosopimuspohjalla, joka sisältää työehtosopimuksen palkkataulukot ja lisät. Laskuri on suuntaa-antava. Lopullinen palkka määräytyy työnantajan ja työsopimuksen/TES:n mukaan. Työnantajana kuljetusliike vastaa palkanmaksusta, työaikakirjanpidosta, työaikasäännösten noudattamisesta sekä siitä, että sen käyttämä malli vastaa sitä sitovaa työehtosopimusta; Aivomaa Oy ei ole kuljettajan työnantaja eikä laske tai maksa palkkaa. [Kohta täydennetään juristin kanssa: vastuu pohjan ajantasaisuudesta.]'),
    (v_terms, 'en', array[3, 5],
     'Drivers'' shifts, breaks and odometer readings can be recorded in the service. They are recorded by the carrier or by the driver in the driver app, and later changes and deletions are recorded in a change log. The service''s pay calculator computes with the model the carrier chooses: rates the carrier enters itself, or a collective agreement template provided by Aivomaa Oy that contains the agreement''s wage tables and supplements. The calculator is indicative. The final pay is determined by the employer and the employment contract or collective agreement (Laskuri on suuntaa-antava. Lopullinen palkka määräytyy työnantajan ja työsopimuksen/TES:n mukaan.). As the employer, the carrier is responsible for paying wages, for the record of working hours, for compliance with working time rules and for the model it uses matching the collective agreement that binds it; Aivomaa Oy is not the driver''s employer and neither calculates nor pays wages. [This clause is to be completed with counsel: responsibility for keeping the template up to date.]')
  on conflict (document_id, locale, path) do update set body = excluded.body;
end;
$$;
