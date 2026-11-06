-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · документы заказчика: виды (6.11.2026)
--
-- Отдельным файлом: новое значение перечисления нельзя использовать в
-- той же транзакции, где его добавили, а основная миграция
-- (20261106150100_shipper_documents) ссылается на них в ограничениях и
-- функциях.
--
--   REGISTER_EXTRACT — выписка из торгового реестра (Kaupparekisteriote,
--     Handelsregisterauszug / Gewerbeanmeldung, odpis z KRS / CEIDG,
--     registreringsbevis, firmaattest, CVR-udskrift и т. п.);
--   TAX_DEBT_CERTIFICATE — справка об отсутствии налоговой задолженности
--     (verovelkatodistus, Unbedenklichkeitsbescheinigung, zaświadczenie
--     o niezaleganiu w podatkach…);
--   VAT_CERTIFICATE — подтверждение регистрации плательщиком НДС;
--   SIGNATORY_AUTHORITY — право подписи: доверенность или документ, из
--     которого видно, что заявитель действует от имени компании.
-- ═══════════════════════════════════════════════════════════════════

alter type public.document_kind add value if not exists 'REGISTER_EXTRACT';
alter type public.document_kind add value if not exists 'TAX_DEBT_CERTIFICATE';
alter type public.document_kind add value if not exists 'VAT_CERTIFICATE';
alter type public.document_kind add value if not exists 'SIGNATORY_AUTHORITY';

comment on type public.document_kind is
  'Документы компании: лицензия и страховка перевозчика (ТЗ §4); полис экспедитора и польская лицензия посредника; выписка из реестра, налоговые справки и право подписи заказчика (6.11.2026).';
