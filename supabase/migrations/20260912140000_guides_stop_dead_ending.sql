-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · справочник перестаёт советовать то, чего не объясняет
--
-- В каждой карточке площадки стояло «kysy operaattorilta» / «ask the
-- operator». Совет верный по сути и тупиковый на деле: кто такой
-- оператор и как ему написать, там не сказано ни слова, а читает эту
-- строку человек, который спросил именно потому, что не знает, куда
-- обращаться.
--
-- Теперь у помощника есть чем ответить: ask_operator в кабинете, поиск
-- по сайтам портов и эскалация у водителя. Что делать с вопросом —
-- решает наставление, где эти правила и живут.
--
-- Справочнику остаётся факт: часов работы здесь нет. Факт устаревает
-- медленно, а совет — вместе с каждым изменением в поведении помощника,
-- и держать его в тридцати восьми строках данных значит однажды
-- отправить водителя туда, куда мы больше никого не отправляем.
-- ═══════════════════════════════════════════════════════════════════

update public.place_guides
set body = replace(
      body,
      'Aukioloaikoja ja porttiohjeita ei ole kirjattu tähän hakemistoon — kysy operaattorilta.',
      'Aukioloaikoja ja porttiohjeita ei ole kirjattu tähän hakemistoon.'
    )
where body like '%kysy operaattorilta.%';

update public.place_guides
set body = replace(
      body,
      'Opening hours and gate instructions are not recorded in this directory — ask the operator.',
      'Opening hours and gate instructions are not recorded in this directory.'
    )
where body like '%ask the operator.%';
