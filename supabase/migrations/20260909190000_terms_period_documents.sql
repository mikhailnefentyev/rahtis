-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · условия узнают про документы расчётного периода
--
-- Поведение денег изменилось: раз в период платформа выпускает заказчику
-- сводку к оплате, а перевозчику сводный отчёт с датой выплаты, и у
-- сводки появился срок — четырнадцать дней. Правило периодов в условиях
-- уже описано (§6.4), документов и срока в них нет.
--
-- Правится ДЕЙСТВУЮЩИЙ ЧЕРНОВИК v3, а не заводится новая редакция: v3
-- ещё не показана юристу, и плодить рядом v4 значит отдать ему на разбор
-- две версии вместо одной.
--
-- Черновик НЕ активируется. Действующей остаётся v2, пока юрист не
-- пройдёт по тексту и оператор не нажмёт активацию в разделе документов.
--
-- Что здесь НЕ написано и написано быть не может: последствия просрочки —
-- пеня, её размер, право приостановить услугу, взыскание. Это правовой
-- выбор, а не описание кода, и он остаётся под маркером. Четырнадцать
-- дней, наоборот, — коммерческое условие, которое оператор назвал, и
-- назвать его в тексте честно.
--
-- «Сводка не является счётом» стоит в пункте намеренно. Документ,
-- который клиент примет за счёт, породит спор о том, с какой даты идёт
-- срок и чем подтверждается сумма; номер счёта по-прежнему рождается в
-- бухгалтерии оператора.
-- ═══════════════════════════════════════════════════════════════════

do $$
declare
  v_doc uuid;
begin
  select id into v_doc
  from public.legal_documents
  where kind = 'TERMS' and status = 'DRAFT'
  order by version desc
  limit 1;

  if v_doc is null then
    raise exception 'Черновика условий нет — дописывать некуда.';
  end if;

  /* Маркер юриста уезжает на 6.6: место 6.5 занимает новый пункт. */
  update public.legal_clauses
  set path = array[6, 6]
  where document_id = v_doc and path = array[6, 5];

  insert into public.legal_clauses (document_id, locale, path, body)
  values
    (
      v_doc, 'fi', array[6, 5],
      'Kauden päätyttyä alusta muodostaa osapuolille kauden asiakirjat: tilaajalle maksuerittelyn kauden kuljetuksista ja kuljetusliikkeelle koontiraportin, josta ilmenevät tilityksen määrä ja maksupäivä. Tilaaja maksaa maksuerittelyn 14 päivän kuluessa sen päiväyksestä. Maksuerittely ei ole lasku: laskun antaa ylläpitäjä kirjanpidostaan, ja laskun numero merkitään kuljetukseen.'
    ),
    (
      v_doc, 'en', array[6, 5],
      'When a period ends, the platform produces the period documents for the parties: a payment summary of the period''s transports for the shipper, and a statement for the carrier showing the payout amount and its payment date. The shipper pays the payment summary within 14 days of its date. The payment summary is not an invoice: the invoice is issued by the operator from its own accounting, and the invoice number is recorded on the transport.'
    );
end;
$$;
