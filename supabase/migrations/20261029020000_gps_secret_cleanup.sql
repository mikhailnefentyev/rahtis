-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · GPS: ключ уходит из Vault при любом удалении (29.10.2026)
--
-- Проверка cbdf5d5: gps_connection_delete удалял секрет сам, но
-- подключение удаляется и каскадом — вместе с компанией. Тогда ключ
-- оставался в vault.secrets. Теперь секрет удаляет триггер после
-- удаления строки, на любом пути; функция удаляет только строку.
-- ═══════════════════════════════════════════════════════════════════

create or replace function app.gps_connection_secret_cleanup()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from vault.secrets where id = old.secret_id;
  return old;
end;
$$;

revoke all on function app.gps_connection_secret_cleanup() from public, anon, authenticated;

create trigger gps_connections_secret_cleanup
after delete on public.gps_connections
for each row execute function app.gps_connection_secret_cleanup();

create or replace function public.gps_connection_delete(p_id uuid, p_company_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.gps_connections where id = p_id and company_id = p_company_id;
$$;

revoke all on function public.gps_connection_delete(uuid, uuid) from public, anon, authenticated;
grant execute on function public.gps_connection_delete(uuid, uuid) to service_role;

/* Секреты, уже осиротевшие до этой миграции. */
delete from vault.secrets s
where s.name like 'gps:%'
  and not exists (select 1 from public.gps_connections c where c.secret_id = s.id);
