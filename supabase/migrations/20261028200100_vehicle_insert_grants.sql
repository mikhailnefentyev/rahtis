-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · новые машины снова сохраняются (28.10.2026)
--
-- Вставка в vehicles разрешена по списку колонок. Колонки 26.10
-- (body_type, gross_max_kg, tare_kg — 20261026100000_trailers_and_mass)
-- и 28.10 (coupling_distance_m, body_volume_m3) получили только право
-- правки, и форма автопарка, которая шлёт их всегда, падала на новой
-- машине с 42501 «permission denied for table vehicles» («Jokin meni
-- pieleen», пользователь 28.10.2026 на нуппи).
-- ═══════════════════════════════════════════════════════════════════

grant insert (body_type, gross_max_kg, tare_kg, coupling_distance_m, body_volume_m3)
  on public.vehicles to authenticated;
