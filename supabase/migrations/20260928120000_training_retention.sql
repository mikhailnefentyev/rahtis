-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · сроки хранения: прогресс тренажёра и сертификаты водителя
--
-- Водителей не удаляют, а архивируют (drivers.archived_at), поэтому
-- каскадное удаление по driver_id само ничего не чистит — без этой
-- миграции данные жили бы бессрочно. Решение пользователя 28.09.2026:
--
--   • прогресс тренажёра — 24 месяца после последнего ответа;
--   • прогресс и сертификаты архивированного водителя — 3 месяца после
--     архивации (на случай ошибочной архивации и возврата к тому же
--     перевозчику).
--
-- Раньше удалить может сам человек: водитель сбрасывает прогресс
-- («Nollaa edistyminen»), водитель или перевозчик удаляет сертификат.
--
-- Журнал напоминаний (driver_certificate_reminders) уходит вместе с
-- сертификатом каскадом.
--
-- Тем же заходом — пункт 4.7 черновика PRIVACY: основание и эти сроки.
-- ═══════════════════════════════════════════════════════════════════

create or replace function app.purge_driver_training_and_certificates()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_stale integer;
  v_archived_progress integer;
  v_archived_certs integer;
begin
  delete from public.training_progress
  where last_answered_at < now() - interval '24 months';
  get diagnostics v_stale = row_count;

  delete from public.training_progress p
  using public.drivers d
  where p.driver_id = d.id
    and d.status = 'ARCHIVED'
    and d.archived_at < now() - interval '3 months';
  get diagnostics v_archived_progress = row_count;

  delete from public.driver_certificates c
  using public.drivers d
  where c.driver_id = d.id
    and d.status = 'ARCHIVED'
    and d.archived_at < now() - interval '3 months';
  get diagnostics v_archived_certs = row_count;

  return jsonb_build_object(
    'training_stale', v_stale,
    'training_archived', v_archived_progress,
    'certificates_archived', v_archived_certs
  );
end;
$$;

revoke all on function app.purge_driver_training_and_certificates() from public, anon, authenticated;

/* Раз в сутки в 03:20 UTC — ночью, вне рабочего времени водителей. */
select cron.schedule(
  'rahtis-driver-data-retention',
  '20 3 * * *',
  $$ select app.purge_driver_training_and_certificates(); $$
);


-- ── PRIVACY 4.7: основание и сроки вместо маркера юриста ──────────────
-- Меняется только черновик; действующая редакция не трогается.
-- Активация — решение пользователя.

do $$
declare
  v_draft uuid;
begin
  select d.id into v_draft
  from public.legal_documents d
  where d.kind = 'PRIVACY' and d.status = 'DRAFT'
  order by d.version desc
  limit 1;

  if v_draft is null then
    raise exception 'Нет черновика PRIVACY: пункт 4.7 добавляется миграцией 20260927120300_legal_training.' using errcode = '55007';
  end if;

  update public.legal_clauses
  set body = 'Koulutustietoja käsitellään, jotta kuljettaja voi kerrata ja palata keskeneräiseen koulutukseen eri laitteilla. Pätevyyksien voimassaoloa käsitellään muistutuksia varten ja jotta kuljetusliike voi varmistaa, että kuljettajalla on työssä vaadittavat pätevyydet. '
    || 'Käsittelyn peruste: koulutustietojen osalta Aivomaa Oy:n oikeutettu etu tarjota kuljettajalle hänen itse valitsemansa kertaustoiminto; koulutuksen käyttö on vapaaehtoista. Pätevyystietojen osalta kuljetusliikkeen ja Aivomaa Oy:n oikeutettu etu varmistaa kuljettajan pätevyydet sekä kuljetusliikkeen lakisääteiset velvollisuudet. '
    || 'Säilytysajat: kuljettaja voi poistaa oman koulutusedistymisensä milloin tahansa (Nollaa edistyminen), ja kuljettaja tai kuljetusliike voi poistaa pätevyystiedon palvelussa. Koulutusedistyminen poistetaan automaattisesti 24 kuukauden kuluttua viimeisestä vastauksesta. Koulutusedistyminen ja pätevyystiedot poistetaan automaattisesti kolmen kuukauden kuluttua siitä, kun kuljettaja on arkistoitu kuljetusliikkeen tiedoista. Kirjautumattoman käyttäjän laitteelle tallennettu edistyminen säilyy laitteella, kunnes käyttäjä tyhjentää sen. '
    || 'Koulutustuloksia ei käytetä kuljettajan arviointiin eikä niistä anneta tietoja kuljetusliikkeelle yksilöinä; mahdollinen yhteenveto kuljetusliikkeelle otetaan käyttöön vain juristin kanssa sovitulla tavalla.'
  where document_id = v_draft and locale = 'fi' and path = array[4, 7];

  update public.legal_clauses
  set body = 'Training data is processed so that the driver can review and continue unfinished training on different devices. The validity of qualifications is processed for the reminders and so that the carrier can make sure the driver holds the qualifications the work requires. '
    || 'Legal basis: for training data, Aivomaa Oy''s legitimate interest in offering the driver a review function the driver has chosen to use; using the training is voluntary. For qualification data, the legitimate interest of the carrier and Aivomaa Oy in verifying the driver''s qualifications, and the carrier''s statutory obligations. '
    || 'Retention: the driver can delete their own training progress at any time (Reset progress), and the driver or the carrier can delete a qualification entry in the service. Training progress is deleted automatically 24 months after the last answer. Training progress and qualification data are deleted automatically three months after the driver has been archived in the carrier''s records. Progress stored on the device of a user who is not signed in remains on the device until the user clears it. '
    || 'Training results are not used to assess the driver and are not given to the carrier at an individual level; any summary for the carrier will be introduced only in a way agreed with counsel.'
  where document_id = v_draft and locale = 'en' and path = array[4, 7];

  if not found then
    raise exception 'Пункт 4.7 в черновике PRIVACY не найден.' using errcode = '55007';
  end if;
end;
$$;
