-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · конструктор сцепок: новые кузова — значения (28.10.2026)
--
-- Пользователь 28.10.2026: полуприцепы и прицепы — самосвал, тент,
-- изотерм, реф, трал. Тент (CURTAIN) и самосвал (TIPPER) уже есть.
-- Правила — в 20261028220100_fleet_constructor.
-- ═══════════════════════════════════════════════════════════════════

alter type public.body_type add value if not exists 'REEFER';
alter type public.body_type add value if not exists 'ISOTHERM';
alter type public.body_type add value if not exists 'LOWBED';
