# GPS-провайдеры, топливные карты, LogiApp — проверка (28.10.2026)

[V] — подтверждено источником, [?] — не подтверждено. Не открылись (403 или ошибка сертификата): abax.com, gasum.com, vehco.com, logiapps.fi, developer.circlek.com.

## GPS-провайдеры
- **ABAX:**
  - Open API (оборудование, машины, поездки), OAuth, client_id и secret из ABAX Developer portal, sandbox, production по заявке [V по выдержке]: https://www.abax.com/blog/abax-open-api-for-a-unified-customer-experience
  - Одометр через API [V]: https://www.automotive-fleet.com/news/telematics-company-abax-partners-with-fleetcheck , https://peliqan.io/datamodel/abax
  - Портал https://developers.abax.cloud/ — содержимое не прочитано [?].
- **Mapon:**
  - ключи создаёт администратор клиента, ограничение по юнитам [V]: https://help.mapon.com/en/articles/195274-where-can-i-find-mapon-api-documentation
  - `unit/list`: lat/lng/speed/mileage, include=fuel/can; Data_forwarding (push); часть методов платная (ошибки 1013/1015) [V]: https://mapon.com/api/
- **Navirec:**
  - токен клиента через API access, права «See location» [V]: https://co3.io/integrations/navirec
  - больше 10 000 клиентов, лидер в Эстонии [V]: https://navirec.com/en/about-us
  - Доля в FI не подтверждена [?].
- **Webfleet:** ключ клиента через My Account, .connect Partner Program, отдельный пользователь WEBFLEET.connect, очереди сообщений, цена по запросу [V]: https://www.webfleet.com/en_gb/webfleet/partners/integration/developer-resources/
- **Vehco (AddSecure):** купила Paetronics, тяжёлые грузовики, SE/FI/NO/DK [V]: https://www.mynewsdesk.com/se/addsecure/pressreleases/addsecure-aegda-vehco-foervaervar-finlands-ledande-fleet-management-foeretag-paetronics-oy-foer-att-staerka-sin-nordiska-position-2825616 ; публичного API нет [?].
- **Ecofleet (Fleet Complete):** куплена в 2018, лидер в Северной Европе [V]: https://www.freightwaves.com/news/2018-2-1-fleet-complete-acquires-european-telematics-provider ; публичного API нет [?].
- **Frotcom:** авторизация логином клиента, api_key истекает через 20 мин без активности, webhooks с позициями не чаще раза в минуту [V]: https://frotcominternational.zendesk.com/hc/en-gb/articles/360001005854-Authentication-in-Frotcom-API
- **GpsGate:** REST-токен генерирует администратор, `usersstatus` [V]: https://gpsgate.com/releases/august-2023-release , https://support.gpsgate.com/hc/en-us/articles/15851022607900

## Длинный хвост
- **Teltonika FMB, второй сервер** в режиме Duplicate: запись удаляется только после подтверждения от обоих серверов [V]: https://wiki.teltonika-gps.com/view/FMB120_GPRS_settings . Конфигурацию обычно держит реселлер [?].
- **flespi:** бесплатно 10 устройств; Commercial 130 €/мес — 1000 устройств, 3 канала, дополнительный канал 40 € [V]: https://flespi.com/pricing , https://flespi.com/kb/how-flespi-pricing-works
- **Wialon Retranslator:** протоколы Wialon IPS, Retranslator, EGTS, на несколько серверов [V]: https://help.wialon.com/en/wialon-hosting/user-guide/management-system/retranslators/creating-retranslators

## LogiApp
- Silvasti Software Oy (FI): около 4000 пользователей, больше 150 компаний (FI/DE/DK), ERP для перевозок с приложением водителя, 30 дней бесплатно [V]: https://logiapp.com/?p=566 , https://apps.apple.com/hu/app/logiapp/id1521848437
- В описаниях есть отчёты о заправках, телематика, тахограф и FMS [V/?]. Поля формы заправки и аналитика публично не описаны: смотреть на демо.

## Топливные карты
- **Neste:**
  - CSV по заправкам, Navirec его импортирует [V]: https://intercom.help/navirec/et/articles/3049341-fuel-cards
  - ежедневная интеграция Mapon (время, карта, объём, сумма, чек, продукт) [V]: https://www.mapon.com/en/fleet-management-solutions/process-automation/api-integrations/neste-fuel-integration
  - публичного API нет [?].
- **St1/Shell (FI):** кабинет Fleet Hub Online [V]: https://lawinsider.com/fi/contracts/avJksHNJzBg ; колонки экспорта не проверены [?].
- **Shell API:** одометр в поле `OdometerInput`, если на карте включено `OdometerInputRequired` [V]: https://developer.shell.com/use-cases/odometer-readings-shell-api ; работает ли с финскими картами — неизвестно [?].
- **Circle K:**
  - Transactions API: SE/NO/DK/LT/LV/EE [V]: https://www.developer.circlek.com/transactions-api-use-cases
  - интеграция Mapon по договору с Circle K, раз в сутки [V]: https://help.mapon.com/en/articles/500949-circlek-integration
- **DKV:** Enterprise API, technical user через отдел продаж [V]: https://api-portal.dkv-mobility.com/enterprise-api-faq
- **Teboil, ABC, UTA, Preem, OKQ8, Uno-X/YX, Q8** — форматы и API не найдены [?].

## Продукты
- Gasum: LBG и CBG для тяжёлого транспорта, почти весь газ для транспорта — биогаз [V]: https://lngprime.com/?p=48484
- Единицы: дизель, HVO, AdBlue — литры; LNG, LBG, CNG, CBG — кг [? общепринято].
