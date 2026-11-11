-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · рассылка заказчикам → только экспедиторам (решение 11.11.2026)
--
-- Позиционирование с 6.11: для экспедиторов RAHTIS — поиск перевозчиков и
-- продажа грузов. Приглашения стороны заказчика (kind SHIPPER) уходят
-- только экспедиторам: ещё не отправленные строки других заказчиков
-- (паромные линии, 3PL, терминалы, промышленность) пропускаются, а
-- экспедиторы из таблицы 24.10.2026 (колонка «да», FI/SE/NO/EE/LV/LT —
-- страны, где письма компаниям на общий адрес разрешены) встают в очередь.
-- Уже отправленные строки не трогаются. Повтор безопасен.
-- ═══════════════════════════════════════════════════════════════════

update public.outreach_targets
set status = 'SKIPPED', note = '11.11.2026: рассылка заказчикам только экспедиторам'
where kind = 'SHIPPER'
  and status = 'QUEUED'
  and email not in (
    'info@ee.dsv.com',
    'sales@spedman.ee',
    'info@ursus.lv',
    'sales@rewico.lv',
    'info@tlclogistics.lt',
    'vilnius@lt.dsv.com',
    'alpifinland@alpifinland.fi',
    'info@ls-cargo.com',
    'info@passionlogistics.com',
    'info@vasaspedition.fi',
    'sales@x-wk.com',
    'ocean.finland@hecksher.com',
    'asiakaspalvelu@auto-uuttera.fi',
    'ncs@ncs.fi',
    'sales@collicare.fi',
    'sales.fi@isanordic.com',
    'oslo@scangl.com',
    'quotes.norway@pentagonfreight.com',
    'export.gcc.no@greencarrier.com',
    'seanorway@holship.com',
    'kontakt.no@leman.com',
    'norway@tschudilogistics.com',
    'booking@biversen.no',
    'post@nnsped.no',
    'info@ntex.se',
    'export.gcc.se@greencarrier.com',
    'sales@spedman.se',
    'gothenburg@bws.net',
    'scanlink@scanlink.se',
    'sales.sweden@freja.com',
    'sales@nordicfreight.se',
    'info@trilog.se',
    'salessweden@leman.com',
    'info@interfreight.se',
    'sales@tsg.se'
  );

insert into public.outreach_targets (kind, company_name, business_id, email, website, source, priority, approved, country, locale)
values
  ('SHIPPER', 'DSV Estonia (incl. former DB Schenker)', null, 'info@ee.dsv.com', 'https://www.dsv.com/et-ee', 'xlsx 24.10.2026 (forwarder)', 10, true, 'EE', 'en'),
  ('SHIPPER', 'Spedman (Tallinn office of Spedman UAB)', null, 'sales@spedman.ee', 'https://spedman.ee', 'xlsx 24.10.2026 (forwarder)', 11, true, 'EE', 'en'),
  ('SHIPPER', 'Ursus Forwarding SIA', '40003931354', 'info@ursus.lv', 'https://www.ursus.lv', 'xlsx 24.10.2026 (forwarder)', 12, true, 'LV', 'en'),
  ('SHIPPER', 'REWICO Baltikum SIA', '40003632770', 'sales@rewico.lv', 'https://www.rewico.lv', 'xlsx 24.10.2026 (forwarder)', 13, true, 'LV', 'en'),
  ('SHIPPER', 'UAB Tarptautinės logistikos centras (TLC)', '136028376', 'info@tlclogistics.lt', 'https://tlclogistics.lt', 'xlsx 24.10.2026 (forwarder)', 14, true, 'LT', 'en'),
  ('SHIPPER', 'UAB DSV Lietuva', null, 'vilnius@lt.dsv.com', 'https://www.dsv.com/en/countries/europe/lithuania', 'xlsx 24.10.2026 (forwarder)', 15, true, 'LT', 'en'),
  ('SHIPPER', 'Alpi Finland Oy', '0913450-7', 'alpifinland@alpifinland.fi', 'https://www.alpifinland.fi', 'xlsx 24.10.2026 (forwarder)', 16, true, 'FI', 'fi'),
  ('SHIPPER', 'LS Cargo Logistics Oy', '2628631-8', 'info@ls-cargo.com', 'https://ls-cargo.com', 'xlsx 24.10.2026 (forwarder)', 17, true, 'FI', 'fi'),
  ('SHIPPER', 'Passion Logistics Oy', '2452644-5', 'info@passionlogistics.com', 'https://passionlogistics.com', 'xlsx 24.10.2026 (forwarder)', 18, true, 'FI', 'fi'),
  ('SHIPPER', 'Oy Vaasahuolinta - Vasaspedition Ab', '0735701-0', 'info@vasaspedition.fi', 'https://vasaspedition.fi', 'xlsx 24.10.2026 (forwarder)', 19, true, 'FI', 'fi'),
  ('SHIPPER', 'X-WK Logistics Oy Ab', '2882230-5', 'sales@x-wk.com', 'https://x-wk.com', 'xlsx 24.10.2026 (forwarder)', 20, true, 'FI', 'fi'),
  ('SHIPPER', 'Hecksher Finland Oy', '1598348-4', 'ocean.finland@hecksher.com', 'https://hecksher.com', 'xlsx 24.10.2026 (forwarder)', 21, true, 'FI', 'fi'),
  ('SHIPPER', 'Auto-Uuttera Oy', '1717654-7', 'asiakaspalvelu@auto-uuttera.fi', 'https://auto-uuttera.fi', 'xlsx 24.10.2026 (forwarder)', 22, true, 'FI', 'fi'),
  ('SHIPPER', 'NCS Finland Oy', '1777929-2', 'ncs@ncs.fi', 'https://www.ncs.fi', 'xlsx 24.10.2026 (forwarder)', 23, true, 'FI', 'fi'),
  ('SHIPPER', 'ColliCare Logistics Oy', '2882755-2', 'sales@collicare.fi', 'https://www.collicare.fi', 'xlsx 24.10.2026 (forwarder)', 24, true, 'FI', 'fi'),
  ('SHIPPER', 'ISA Nordic Oy', '3193280-4', 'sales.fi@isanordic.com', 'https://isanordic.com', 'xlsx 24.10.2026 (forwarder)', 25, true, 'FI', 'fi'),
  ('SHIPPER', 'Scan Global Logistics AS', null, 'oslo@scangl.com', 'https://www.scangl.com', 'xlsx 24.10.2026 (forwarder)', 26, true, 'NO', 'en'),
  ('SHIPPER', 'Pentagon Freight Services Norway', null, 'quotes.norway@pentagonfreight.com', 'https://www.pentagonfreight.com', 'xlsx 24.10.2026 (forwarder)', 27, true, 'NO', 'en'),
  ('SHIPPER', 'Greencarrier Consolidators Norway AS', null, 'export.gcc.no@greencarrier.com', 'https://greencarrier.com', 'xlsx 24.10.2026 (forwarder)', 28, true, 'NO', 'en'),
  ('SHIPPER', 'Holship Norge AS', '976549015', 'seanorway@holship.com', 'https://holship.com', 'xlsx 24.10.2026 (forwarder)', 29, true, 'NO', 'en'),
  ('SHIPPER', 'LEMAN AS Norway', null, 'kontakt.no@leman.com', 'https://leman.com', 'xlsx 24.10.2026 (forwarder)', 30, true, 'NO', 'en'),
  ('SHIPPER', 'Tschudi Logistics Norway', null, 'norway@tschudilogistics.com', 'https://www.tschudigroup.com', 'xlsx 24.10.2026 (forwarder)', 31, true, 'NO', 'en'),
  ('SHIPPER', 'B. Iversen Spedisjon AS', null, 'booking@biversen.no', 'https://www.biversen.no', 'xlsx 24.10.2026 (forwarder)', 32, true, 'NO', 'en'),
  ('SHIPPER', 'Nord-Norsk Spedisjon AS', null, 'post@nnsped.no', 'https://www.nnsped.no', 'xlsx 24.10.2026 (forwarder)', 33, true, 'NO', 'en'),
  ('SHIPPER', 'NTEX AB', null, 'info@ntex.se', 'https://www.ntex.se', 'xlsx 24.10.2026 (forwarder)', 34, true, 'SE', 'en'),
  ('SHIPPER', 'Greencarrier Consolidators Sweden', null, 'export.gcc.se@greencarrier.com', 'https://www.greencarrier.com', 'xlsx 24.10.2026 (forwarder)', 35, true, 'SE', 'en'),
  ('SHIPPER', 'Spedman Global Logistics Sweden', null, 'sales@spedman.se', 'https://spedman.com', 'xlsx 24.10.2026 (forwarder)', 36, true, 'SE', 'en'),
  ('SHIPPER', 'Blue Water Shipping Sverige', null, 'gothenburg@bws.net', 'https://www.bws.net', 'xlsx 24.10.2026 (forwarder)', 37, true, 'SE', 'en'),
  ('SHIPPER', 'Scanlink Transport & Logistics AB', '556273-2767', 'scanlink@scanlink.se', 'https://scanlink.se', 'xlsx 24.10.2026 (forwarder)', 38, true, 'SE', 'en'),
  ('SHIPPER', 'FREJA Transport & Logistics AB', null, 'sales.sweden@freja.com', 'https://en.freja.com', 'xlsx 24.10.2026 (forwarder)', 39, true, 'SE', 'en'),
  ('SHIPPER', 'Nordic Freight AB', null, 'sales@nordicfreight.se', 'https://www.nordicfreight.se', 'xlsx 24.10.2026 (forwarder)', 40, true, 'SE', 'en'),
  ('SHIPPER', 'Trilog AB', '556610-2488', 'info@trilog.se', 'https://trilog.se', 'xlsx 24.10.2026 (forwarder)', 41, true, 'SE', 'en'),
  ('SHIPPER', 'Leman Sverige', null, 'salessweden@leman.com', 'https://leman.com', 'xlsx 24.10.2026 (forwarder)', 42, true, 'SE', 'en'),
  ('SHIPPER', 'Interfreight Scandinavia AB', null, 'info@interfreight.se', 'https://interfreight.se', 'xlsx 24.10.2026 (forwarder)', 43, true, 'SE', 'en'),
  ('SHIPPER', 'TSG Thor Svecon Group (TSG Forwarding)', null, 'sales@tsg.se', 'https://www.tsg.se', 'xlsx 24.10.2026 (forwarder)', 44, true, 'SE', 'en')
on conflict (email) do nothing;
