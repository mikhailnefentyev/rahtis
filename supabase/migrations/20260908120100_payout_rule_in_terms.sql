-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · правило оплат попадает в условия
--
-- Правило расчётных периодов заведено в базе и отдаётся агенту. Место,
-- где перевозчик прочитает его сам, — раздел 6 условий, где уже стоят
-- цена, палвелумаксу и налог. Пока правило живёт только в коде, оно
-- держится на памяти оператора, а спрашивают о нём в тот день, когда
-- деньги не пришли.
--
-- Правится черновик, а не действующая редакция: черновик TERMS ждёт
-- юриста, и это ровно тот текст, по которому он пойдёт. Заводить ради
-- одного пункта ещё одну версию значило бы разложить один разговор с
-- юристом на два.
--
-- Прежний пункт 6.4 — пометка «дополняется с юристом» — сдвигается на
-- 6.5. Она про сроки претензий и неустойку, это решение юриста, и
-- вытеснять её нельзя.
-- ═══════════════════════════════════════════════════════════════════

do $$
declare
  v_terms uuid;
begin
  select id into v_terms
  from public.legal_documents
  where kind = 'TERMS' and status = 'DRAFT'
  order by version desc
  limit 1;

  if v_terms is null then
    raise exception 'Черновик условий не найден: правило оплат вносить некуда.';
  end if;

  /* Пометка юриста уступает место, а не исчезает. */
  update public.legal_clauses
  set path = '{6,5}'
  where document_id = v_terms and path = '{6,4}';

  insert into public.legal_clauses (document_id, locale, path, title, body) values
  (v_terms, 'fi', '{6,4}', null,
   'Maksuerä on puoli kuukautta: 1.–15. päivä ja 16. päivä kuukauden viimeiseen päivään. Kuljetus kuuluu siihen erään, jonka aikana se on merkitty valmiiksi. Erä maksetaan seuraavan kuukauden aikana: alkupuolisko 15. päivänä ja loppupuolisko 30. päivänä. Jos kuukaudessa ei ole 30. päivää, maksupäivä on kuukauden viimeinen päivä.'),
  (v_terms, 'en', '{6,4}', null,
   'The settlement period is half a month: the 1st to the 15th, and the 16th to the last day of the month. A transport belongs to the period in which it was marked complete. A period is paid during the following month: the first half on the 15th and the second half on the 30th. Where a month has no 30th day, the payment date is its last day.');
end;
$$;
