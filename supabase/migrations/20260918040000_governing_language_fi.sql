-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · приоритетный язык — финский
--
-- Русские проекты требовали указать приоритетный язык перед выпуском, и
-- в трёх опубликованных сегодня редакциях на этом месте стояла пометка
-- юриста. Пользователь выбрал финский.
--
-- Новой редакцией, а не правкой на месте. Действующая редакция — это то,
-- с чем компания согласилась, и на неё ссылается каждый заказ колонкой
-- terms_document_id. Переписать её текст значило бы задним числом менять
-- согласованное; журнал принятий и ссылки заказов остались бы прежними,
-- а слова под ними — другими.
--
-- Пункты копируются из действующей редакции: меняется ровно один, и
-- переписывать полсотни абзацев ради него нельзя — при переписывании
-- рождаются расхождения, которых никто не заметит.
--
-- Две другие пометки в политике остаются: механизм передачи за пределы
-- ЕЭЗ и таблица сроков хранения — это по-прежнему выбор юриста, а не
-- факт из кода.
-- ═══════════════════════════════════════════════════════════════════

do $$
declare
  v_kind public.legal_kind;
  v_path integer[];
  v_old uuid;
  v_new uuid;
  v_fi text;
  v_en text;
  v_touched integer;
begin
  foreach v_kind in array array['TERMS', 'SHIPPER_AGREEMENT', 'PRIVACY']::public.legal_kind[] loop

    /* Где в каждом документе лежит пункт о языке. */
    v_path := case v_kind
      when 'TERMS' then array[12, 4]
      when 'SHIPPER_AGREEMENT' then array[11, 3]
      else array[11, 3]
    end;

    /* Политика говорит «seloste», условия — «ehdot»: слово по документу. */
    if v_kind = 'PRIVACY' then
      v_fi := 'Tämä seloste on laadittu suomeksi ja englanniksi. Jos kieliversioiden välillä on ristiriita, suomenkielinen versio ratkaisee.';
      v_en := 'This notice is drawn up in Finnish and in English. If the language versions conflict, the Finnish version prevails.';
    else
      v_fi := 'Nämä ehdot on laadittu suomeksi ja englanniksi. Jos kieliversioiden välillä on ristiriita, suomenkielinen versio ratkaisee.';
      v_en := 'These terms are drawn up in Finnish and in English. If the language versions conflict, the Finnish version prevails.';
    end if;

    v_old := public.active_legal_document(v_kind);

    if v_old is null then
      raise exception 'Нет действующей редакции документа %.', v_kind using errcode = '55007';
    end if;

    insert into public.legal_documents (kind, version, status, effective_from)
    values (
      v_kind,
      (select max(version) + 1 from public.legal_documents where kind = v_kind),
      'DRAFT',
      date '2026-09-18'
    )
    returning id into v_new;

    insert into public.legal_clauses (document_id, locale, path, title, body)
    select v_new, c.locale, c.path, c.title, c.body
    from public.legal_clauses c
    where c.document_id = v_old;

    update public.legal_clauses
    set body = case locale when 'fi' then v_fi else v_en end
    where document_id = v_new
      and path = v_path;

    /*
     * Ровно два пункта — финский и английский. Ноль означал бы, что путь
     * назван неверно: тогда пометка осталась бы на месте, а миграция
     * молча сообщила бы об успехе.
     */
    get diagnostics v_touched = row_count;

    if v_touched <> 2 then
      raise exception 'Пункт о языке в %: ожидались два пункта по пути %, изменено %.',
        v_kind, v_path, v_touched using errcode = '55000';
    end if;

    raise notice '% : редакция % готова к активации', v_kind,
      (select version from public.legal_documents where id = v_new);
  end loop;
end;
$$;
