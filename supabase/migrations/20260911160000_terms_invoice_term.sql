-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · срок оплаты в условиях: пятнадцать дней от конца периода
--
-- §6.5 черновика говорит «14 päivän kuluessa sen päiväyksestä» — две
-- неточности в одной строке. Срок оператор назвал пятнадцать, а не
-- четырнадцать. И считается он не от даты документа, а от конца
-- расчётного периода: у документа своя дата появления, она зависит от
-- того, когда сработало задание, и привязывать к ней обязательство
-- значит сделать срок плавающим.
--
-- От конца периода обе даты считаются одинаково, и зазор между ними
-- виден числом: заказчик платит через пятнадцать дней, перевозчик
-- получает через тридцать. Пятнадцать дней разницы — это и есть то, что
-- отделяет посредника от того, кто платит из своего кармана.
--
-- Черновик по-прежнему не активируется: действующей остаётся v2.
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
    raise exception 'Черновика условий нет — править нечего.';
  end if;

  update public.legal_clauses
  set body = 'Kauden päätyttyä alusta muodostaa osapuolille kauden asiakirjat: tilaajalle maksuerittelyn kauden kuljetuksista ja kuljetusliikkeelle koontiraportin, josta ilmenevät tilityksen määrä ja maksupäivä. Tilaaja maksaa maksuerittelyn 15 päivän kuluessa kauden päättymisestä, ja kuljetusliikkeelle tilitys maksetaan 30 päivän kuluessa kauden päättymisestä. Maksuerittely ei ole lasku: laskun antaa ylläpitäjä kirjanpidostaan, ja laskun numero merkitään kuljetukseen.'
  where document_id = v_doc and locale = 'fi' and path = array[6, 5];

  update public.legal_clauses
  set body = 'When a period ends, the platform produces the period documents for the parties: a payment summary of the period''s transports for the shipper, and a statement for the carrier showing the payout amount and its payment date. The shipper pays the payment summary within 15 days of the end of the period, and the carrier is paid within 30 days of the end of the period. The payment summary is not an invoice: the invoice is issued by the operator from its own accounting, and the invoice number is recorded on the transport.'
  where document_id = v_doc and locale = 'en' and path = array[6, 5];
end;
$$;
