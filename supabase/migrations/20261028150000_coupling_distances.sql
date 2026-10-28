-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · размеры сцепки: расстояние между крайними осями (28.10.2026)
--
-- В Финляндии сцепка тяжелее 44 т может весить не больше
-- 20 т + 320 кг за каждые 0,10 м, на которые расстояние между первой и
-- последней осью сцепки (äärimmäinen akseliväli) больше 1,80 м
-- (asetus 1257/1992, 23 §; 3+3 оси — 52 т от 11,8 м, 76 т — от 19,3 м).
-- Пользователь 28.10.2026: «в прицепе не маловажна длина и расстояние
-- между осями».
--
-- Расстояние сцепки складывается из двух половин, общая точка — сцепное
-- устройство:
--   vehicles.coupling_distance_m — от передней оси машины до седла
--     (тягач) или до сцепного устройства (грузовик);
--   trailers.coupling_distance_m — от шкворня (полуприцеп) или петли
--     дышла (прицеп) до последней оси.
-- trailers.length_m — длина прицепа, для справки и проверки длины сцепки.
-- Пусто — предел по числу осей остаётся верхней границей, как раньше.
-- ═══════════════════════════════════════════════════════════════════

alter table public.vehicles
  add column coupling_distance_m numeric(4, 2)
    constraint vehicles_coupling_distance_range check (coupling_distance_m between 1 and 15);

alter table public.trailers
  add column coupling_distance_m numeric(4, 2)
    constraint trailers_coupling_distance_range check (coupling_distance_m between 1 and 25),
  add column length_m numeric(4, 2)
    constraint trailers_length_range check (length_m between 2 and 25);

grant update (coupling_distance_m) on public.vehicles to authenticated;
