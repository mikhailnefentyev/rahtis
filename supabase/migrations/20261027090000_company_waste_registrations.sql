-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · регистрации перевозчика отходов по странам (27.10.2026)
--
-- Возить чужие (а где-то и свои) отходы можно только после регистрации
-- в стране: PL — номер BDO, LT — ATVR, LV — разрешение VVD, EE —
-- Keskkonnaamet, DE — Anzeige § 53 KrWG (Beförderernummer), SE —
-- länsstyrelsen, DK — Affaldsregistret, FI — jätehuoltorekisteri,
-- NO — «avfallstransport» в Enhetsregisteret. Номер печатается в
-- документах на отходы (Приложение VII, документ рейса объекта).
--
-- Объект «страна → номер»; правит сама компания (как реквизиты).
-- ═══════════════════════════════════════════════════════════════════

alter table public.companies
  add column if not exists waste_registrations jsonb not null default '{}'::jsonb
    constraint companies_waste_registrations_object check (jsonb_typeof(waste_registrations) = 'object');

grant update (waste_registrations) on public.companies to authenticated;
