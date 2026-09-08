-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · остатки ссылок на отчёты
--
-- Прошлый заход искал отчёт по моменту выпуска и не нашёл его у тех
-- уведомлений, чей отчёт позже перевыпустили: generated_at у строки
-- обновился и ушёл из окна.
--
-- Здесь неделя берётся из самого заголовка — «… · Viikko 34». Это
-- единственное место, где она у выпущенного уведомления сохранилась.
-- Год добавлен к сравнению не для красоты: без него тридцать четвёртая
-- неделя следующего года подошла бы так же хорошо.
-- ═══════════════════════════════════════════════════════════════════

update public.notifications n
set link = '/reports/' || r.id
from public.weekly_reports r
where n.kind = 'REPORT'
  and n.link in ('/carrier/done', '/shipper/done')
  and r.company_id = n.company_id
  and r.role = (case when n.link = '/carrier/done' then 'CARRIER' else 'SHIPPER' end)::public.party_role
  and n.title ~ '\d+$'
  and extract(week from r.week)::text = substring(n.title from '(\d+)$')
  and extract(isoyear from r.week) = extract(isoyear from n.created_at at time zone 'Europe/Helsinki');
