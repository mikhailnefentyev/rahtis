-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · фура: погрузочные метры разрешены и у SEMI (28.10.2026)
--
-- orders_ldm_only_for_express допускала метры только у VAN и TRUCK, и
-- заказ SEMI (20261028170100_semi_ftl) падал на сохранении с 23514.
-- ═══════════════════════════════════════════════════════════════════

alter table public.orders drop constraint orders_ldm_only_for_express;
alter table public.orders
  add constraint orders_ldm_only_for_express
    check ((haul_kind in ('VAN', 'TRUCK', 'SEMI')) = (ldm is not null));
