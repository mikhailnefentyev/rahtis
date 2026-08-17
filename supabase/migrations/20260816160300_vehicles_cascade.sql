-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · Этап 3 · согласование удаления компании
--
-- Внешний ключ vehicles → companies был создан без ON DELETE, то есть
-- с поведением NO ACTION: компания с машинами не удалялась вовсе.
--
-- В продукте компании не удаляются — отказ выражается статусом REJECTED,
-- иначе исчезнет история модерации. Но company_documents каскадируется,
-- а vehicles нет, и это расхождение всплывает там, где удаление всё же
-- нужно: запрос на стирание персональных данных или очистка тестового
-- окружения. Приводим к одному поведению.
-- ═══════════════════════════════════════════════════════════════════

alter table public.vehicles
  drop constraint vehicles_company_fk;

alter table public.vehicles
  add constraint vehicles_company_fk
    foreign key (company_id, company_kind)
    references public.companies (id, kind)
    on delete cascade;
