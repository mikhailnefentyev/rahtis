-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · налог в условиях зависит от страны, как и в расчётах
--
-- §6.1 черновика описывает только обратное начисление: «myyjä laskuttaa
-- alv 0 %, ja ostaja tilittää veron omassa maassaan». Это верно для
-- иностранного контрагента и неверно для финского — тому выставляется
-- обычная внутренняя продажа со ставкой 25,5 %.
--
-- Пока платформа считала ноль всем, текст и код совпадали в своей
-- ошибке. Теперь код различает страну, и условие, оставшееся без
-- различия, обещало бы финской компании счёт без налога.
--
-- Ставка названа числом намеренно. Она меняется решением государства, и
-- в этот день править придётся и текст, и константу; спрятать её за
-- словом «voimassa oleva verokanta» значило бы сделать документ вечным
-- ценой того, что по нему нельзя проверить сумму в счёте.
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
  set body = 'Hinta sovitaan kuljetuskohtaisesti ja ilmoitetaan alustalla ilman arvonlisäveroa. Arvonlisävero määräytyy vastapuolen maan mukaan: suomalaiselle yritykselle lisätään arvonlisävero 25,5 %, ja muun maan yritykselle sovelletaan käännettyä verovelvollisuutta, jolloin myyjä laskuttaa alv 0 % ja ostaja tilittää veron omassa maassaan.'
  where document_id = v_doc and locale = 'fi' and path = array[6, 1];

  update public.legal_clauses
  set body = 'The price is agreed per job and shown on the platform excluding value added tax. Value added tax follows the counterparty''s country: for a Finnish company VAT at 25.5% is added, and for a company in another country the reverse charge applies, so the seller invoices at 0% and the buyer accounts for the tax in its own country.'
  where document_id = v_doc and locale = 'en' and path = array[6, 1];
end;
$$;
