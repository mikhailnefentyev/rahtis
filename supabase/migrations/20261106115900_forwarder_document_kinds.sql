-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · экспедитор без парка: виды документов (6.11.2026)
--
-- Отдельным файлом: новое значение перечисления нельзя использовать в
-- той же транзакции, где его добавили, а основная миграция
-- (20261106120000_forwarder_insurance) ссылается на оба значения в
-- ограничениях и функциях.
--
--   FORWARDER_INSURANCE — полис ответственности экспедитора (huolitsijan
--     vastuuvakuutus, OC spedytora, Verkehrshaftungsversicherung);
--   FORWARDER_LICENSE — польская лицензия на посредничество при перевозке
--     грузов (art. 5b ust. 2 pkt 1 ustawy o transporcie drogowym), нужна
--     только польскому экспедитору в режиме «напрямую с перевозчиком».
-- ═══════════════════════════════════════════════════════════════════

alter type public.document_kind add value if not exists 'FORWARDER_INSURANCE';
alter type public.document_kind add value if not exists 'FORWARDER_LICENSE';

comment on type public.document_kind is
  'Документы компании: лицензия и страховка перевозчика (ТЗ §4); полис экспедитора и польская лицензия посредника (6.11.2026).';
