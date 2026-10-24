-- Рассылка за пределы Финляндии (24.10.2026): у адресата страна и язык письма.
-- Финским компаниям — по-фински, остальным — по-английски (других языков у писем нет).

alter table public.outreach_targets
  add column country text not null default 'FI'
    constraint outreach_targets_country check (country ~ '^[A-Z]{2}$'),
  add column locale text not null default 'fi'
    constraint outreach_targets_locale check (locale in ('fi', 'en'));

comment on column public.outreach_targets.country is 'Страна компании, ISO 3166-1 alpha-2.';
comment on column public.outreach_targets.locale is 'Язык приглашения и ссылки на заявку: fi или en.';
