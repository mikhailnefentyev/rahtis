-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · договорённость с водителем: модели «на руки» (6.11.2026)
--
-- Отдельный файл: новые значения перечня нельзя использовать в той же
-- транзакции, где они добавлены; ограничения и поля — в следующем файле.
-- ═══════════════════════════════════════════════════════════════════

alter type public.pay_model add value if not exists 'DAY_NET';
alter type public.pay_model add value if not exists 'MONTHLY_NET';
alter type public.pay_model add value if not exists 'PER_TRIP';
