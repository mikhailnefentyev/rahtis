-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · WhatsApp-агент водителя удалён
--
-- Агент так и не был запущен: 21.09.2026 решено, что водитель работает
-- в собственном приложении. Его вход — функции, которые узнавали
-- водителя по номеру WhatsApp и работали под служебным ключом шлюза n8n,
-- — больше не зовёт никто: маршруты /api/driver/* удалены вместе с
-- воркфлоу.
--
-- Функции удаляются, а не оставляются «на всякий случай». Каждая из них
-- — definer, который по одному номеру телефона отдавал рейс и отмечал
-- точки. Неиспользуемый вход с такими правами — это дверь, про которую
-- забыли, что она открывается.
--
-- Что остаётся: app.phone_digits (на ней держится уникальность номера
-- водителя) и значение WHATSAPP в enum chat_channel — Postgres значения
-- перечисления не удаляет, и старые треды, если они есть, сохраняют смысл.
-- ═══════════════════════════════════════════════════════════════════

drop function if exists public.driver_active_trips(text);
drop function if exists public.driver_complete_next_stop(text, public.stop_role, text, double precision, double precision, integer);
drop function if exists public.driver_escalate(text, text);
drop function if exists public.driver_next_stop(text);
drop function if exists app.driver_vehicles(text);

/*
 * Вход для фото из шлюза. Приложение регистрирует снимки своей функцией
 * driver_register_photo под сессией водителя.
 */
drop function if exists public.register_trip_photo(
  uuid, text, text, text, integer, public.trip_phase, public.photo_subject,
  uuid, timestamptz, double precision, double precision, text, boolean
);
