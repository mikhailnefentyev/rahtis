-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · Этап 3 · хранилище документов компании
--
-- Бакет приватный. Граница безопасности — первый сегмент пути:
--
--   company-docs/{company_id}/{kind}/{uuid}-{имя файла}
--
-- Политики сравнивают (storage.foldername(name))[1] с компанией
-- вызывающего. Проверяется не то, что клиент попросил, а то, где объект
-- физически лежит, поэтому выйти за свою папку невозможно.
--
-- Файлы наружу отдаются только подписанными ссылками на несколько минут.
-- Ссылка выписывается клиентом пользователя, а не секретным ключом, —
-- тогда политики проверяются ещё раз в момент выдачи.
-- ═══════════════════════════════════════════════════════════════════

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'company-docs',
  'company-docs',
  false,
  10485760, -- 10 МБ
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;


/*
 * Ограничения размера и типа заданы на самом бакете, а не только в форме:
 * их проверяет Storage, и обойти их клиентским кодом нельзя.
 */

-- ── Чтение ─────────────────────────────────────────────────────────

create policy "company docs: компания читает свою папку"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'company-docs'
    and (storage.foldername(name))[1] = (select app.current_company_id())::text
  );

create policy "company docs: оператор читает всё"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'company-docs'
    and (select app.is_admin())
  );

-- ── Загрузка ───────────────────────────────────────────────────────

create policy "company docs: компания пишет в свою папку"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'company-docs'
    and (storage.foldername(name))[1] = (select app.current_company_id())::text
  );

-- ── Изменение и удаление ───────────────────────────────────────────

/*
 * Компании не даётся ни UPDATE, ни DELETE.
 *
 * Лицензия и страховка — основание, по которому оператор выдал допуск
 * машинам. Возможность стереть или подменить файл задним числом обесценила
 * бы весь допуск. Замена делается загрузкой новой версии: прежняя остаётся
 * в хранилище, а в базе перестаёт быть текущей.
 *
 * Оператору удаление нужно для запросов на стирание персональных данных.
 */
create policy "company docs: оператор изменяет"
  on storage.objects for update to authenticated
  using (bucket_id = 'company-docs' and (select app.is_admin()))
  with check (bucket_id = 'company-docs' and (select app.is_admin()));

create policy "company docs: оператор удаляет"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'company-docs'
    and (select app.is_admin())
  );
