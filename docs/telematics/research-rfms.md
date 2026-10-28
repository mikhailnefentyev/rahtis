# rFMS и доступ к данным грузовиков — проверка (28.10.2026)

[V] — подтверждено источником, [?] — не подтверждено или источник старый.

## Стандарт rFMS (ACEA)
- Актуальная версия 5.0.0 от 25.07.2025 [V]: https://www.fms-standard.com/Truck/down_load/Technical_Specification_rFMS_vehicle_data_V5.0.0_25.07.2025.pdf ; у производителей в основном 4.0.0 (2021) [V]: https://www.fms-standard.com/Truck/down_load/Technical_Specification_rFMS_vehicle_data_V4.0.0_17.09.2021.pdf . Кто уже на v5 — не найдено [?].
- REST/JSON/OpenAPI 3.0, три ресурса [V]:
  - `/vehicles` — VIN, баки.
  - `/vehiclepositions` — GPS, скорость.
  - `/vehiclestatuses`:
    - одометр `hrTotalVehicleDistance`, `engineTotalFuelUsed`;
    - `fuelLevel1`, `driver1Id`, `driver1WorkingState` (опционально);
    - зажигание, накопленные данные, uptime, tell-tales, прицеп.
- Остаток времени вождения и файлы тахографа .DDD в rFMS не входят: это отдельный сервис remote download [V]. https://www.fms-standard.com/Truck/index.htm
- Получение данных [V]:
  - pull по `starttime`/`stoptime` или `latestOnly`, триггеры (`DRIVER_1_WORKING_STATE_CHANGED`, `DRIVER_LOGIN`, `TRAILER_CONNECTED`…);
  - push — только с v5.
- Гарантии [V]:
  - позиция не реже раза в 15 мин, статус — раз в 60 мин;
  - история не меньше 2 недель;
  - ограничения частоты запросов — заголовки `X-Rate-Limit-*` и ответ 429.
- Авторизация — OAuth2 Bearer (rFMS Authorization 1.1.x); до v3 был Basic [V]. Договор и цена — у каждого производителя свои.

## Производители
- **Volvo / Renault Trucks**:
  - Volvo Connect «Data Access» по Remote FMS: https://www.volvotrucks.com/en-en/services/fleet-management/compliance-and-data.html ; портал developer.volvotrucks.com.
  - Учётку создаёт владелец в Volvo Connect или выдаёт дилер [V]: https://flespi.com/protocols/volvo-trucks , https://www.hiboo.io/integrations/volvo-trucks-fms
  - Data Act — DART (dart.volvogroup.com) и договор на передачу данных, получатель должен быть из ЕС [V]: https://www.volvotrucks.com/data-act , https://www.renault-trucks.com/en/data-act
  - Renault — developer.renault-trucks.com, Optifleet: https://help.hiboo.io/en/articles/9790864-renault-trucks
- **Scania**:
  - Data Access — помесячная плата за машину, уровни Service Planning / Location (позиция, топливо) / Performance (история, rFMS) [V]: https://scania.com/uk/en/home/services/connected-services/data-access.html
  - developer.scania.com, Client ID и Secret [?, источник 2019 г.].
- **MAN**:
  - RIO Marketplace, партнёрские REST + OAuth и streaming [V]: https://company.rio.cloud/en/partner
  - Geo Data Flow — позиция каждые 15–20 с, хранение 7 дней [V]: https://rio.cloud/en/documents/geo-data-flow/dos
- **DAF**: DAF Connect Data Packs (rFMS), Open Platform только для «trusted 3rd parties» [V, 2021]: https://www.daf.co.uk/en-gb/daf-services/connected-services-old/daf-connect-webshop
- **Mercedes**:
  - Fleetboard SOAP API: позиции, время вождения и отдыха, скачивание тахографа [V]: https://portal.weu.prd-eu.fb.csg.daimlertruck.com/legal/en/servicedescription.html
  - Портал под Data Act: developer.daimlertruck.com.
  - С 12.2026 продуктовая линейка меняется: https://www.automotiveworld.com/news/fleetboard-consolidates-to-five-products-at-iaa-2026/
- **Iveco**: договор WEB API в IVECO ON [V, сторонний источник]: https://co3.io/integrations/iveco

## EU Data Act (2023/2854, применяется с 12.09.2025)
- Ст. 5 — пользователь вправе потребовать передачу данных третьей стороне.
- Ст. 9 — производитель может взимать компенсацию на условиях FRAND.
- https://www.eraneos.com/articles/eu-data-act-article-5-and-third-party-data-sharing-on-frand-terms-how-to-comply-and-compete-now/ ; Traficom: https://traficom.fi/en/digital-services-act/third-party-right-access-data

## Агрегаторы
- **flespi** (Латвия) — каналы Volvo и Fleetboard, тысячи моделей трекеров, Teltonika. Start 130 €/мес (3 канала), дополнительный канал 40 € [V]: https://flespi.com/kb/how-flespi-pricing-works
- **Hiboo** — 30+ марок, строительная техника: https://hiboo.io/integrations/man
- **Navixy** — заявляет поддержку основных марок: https://navixy.com/learn-more/oem-telematics/brands
- **Webfleet** — OEM.connect (из грузовиков подтверждён MAN), WEBFLEET.connect, TachoShare.connect: https://www.webfleet.com/en_gb/webfleet/partners/integration/developer-resources/
- **Vehco (AddSecure)** — купила финскую Paetronics (~350 клиентов в FI): https://addsecure.com/newsroom/vehco-acquires-finlands-leading-fleet-management-company-paetronics-oy-to-strengthen-its-nordic-footprint ; API публично не найден.
- **Mapon**:
  - API-ключи доступны в аккаунте;
  - файлы тахографа приходят через Volvo и Scania;
  - есть интеграция с Circle K.

  Источник: https://help.mapon.com/en/articles/195274-where-can-i-find-mapon-api-documentation

## Топливные карты
- **Shell**: Transaction Data API, в данных есть одометр, есть песочница [V]: https://developer.shell.com/pl/api-catalog/v2.1.0/b2b-mobility-card-transaction-data. В Финляндии карты Shell выпускает St1 — подходит ли этот API, не проверено [?].
- **Circle K**: Transactions API [V]: https://www.developer.circlek.com/transactions-api-use-cases
- **DKV**: Enterprise API, OAuth2, платный с 2025 г. [V]: https://api-portal.dkv-mobility.com/enterprise-api-faq
- **Neste**: API есть (документация Латвии, 2021), для FI — запрашивать [?]: https://www.neste.lv/sites/neste.lv/files/2a_pielikums.pdf
- **UTA, Teboil, St1, ABC**: только портал, отчёты, CSV или счета; API не найден [?].

## Не подтверждено
- Цены пакетов данных у всех производителей.
- Песочницы.
- Какие финские ERP для перевозчиков имеют API.
- Доли рынка телематики в FI/SE.
