-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · чтение новых колонок заказа (28.10.2026)
--
-- SELECT на orders выдан по списку колонок. Колонки 28.10 — пометки
-- фуры, поля стройки, кузов и загрузка, прицеп рейса — в список не
-- попали, и запрос, который их называет (список заказов заказчика с
-- fa8a0a4, прицепы рейсов у перевозчика), падал с 42501 «permission
-- denied for table orders». Строки по-прежнему режет RLS — видно только
-- то, что видно и сейчас.
-- ═══════════════════════════════════════════════════════════════════

grant select (
  semi_features,
  tipper_config, site_pricing, site_rate_cents, planned_qty, material_code, planned_volume_m3,
  required_body, required_loading,
  assigned_trailer_id
) on public.orders to authenticated;
