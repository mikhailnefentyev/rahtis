# GPS-провайдеры с ключом из кабинета клиента (29.10.2026)

Вопрос пользователя: у кого из провайдеров GPS в 9 странах (FI, SE, NO, DK, EE, LV, LT, PL, DE) клиент сам создаёт API-ключ в своём кабинете — чтобы подключать «как Wialon». И брать максимум данных: место, топливо, стоянки.

Код: `src/lib/gps/providers.ts` (адаптеры), `catalog.ts` (что показывает форма), `sync.ts`, миграция `20261029050000_gps_providers`.

## Сделано (ключ создаёт сам клиент)

| Провайдер | Где распространён | Где ключ | Что берём | Проверено |
|---|---|---|---|---|
| Wialon | FI, EE, LV, LT, PL | Locator или Tokens | точка, пробег и моточасы (счётчики), топливо и зажигание из последнего сообщения (имена параметров FMS/Teltonika) | живой ключ — раньше; неверный ключ → «ключ не подходит» |
| Mapon | FI, SE, DK, EE, LV, LT, PL | Settings → API keys (администратор) | точка, адрес, состояние и с какого времени, топливо (л или %), бак, CAN: расход, пробег, моточасы; водитель; **заправки** — `fuel/changes` | неверный ключ → ошибка 1005 |
| Navirec | FI, EE, LV, LT | Account settings → API access | точка, activity + с какого времени, зажигание, пробег, моточасы, общий расход, уровень топлива, бак, водитель | неверный ключ → 401 |
| Ruptela TrustTrack | LT, LV, PL | Account settings → API Key Settings (если нет — включает Ruptela) | точка, номер, бак; **заправки** — `fuel-events` | неверный ключ → 401 |
| Navixy | вся ЕС, много реселлеров под своей маркой | User settings → API keys | точка, movement_status + с какого времени, зажигание | неверный ключ → код 3 «Wrong hash» |
| Samsara | ЕС | Settings → API Tokens | точка, адрес, зажигание (engineState), пробег, моточасы, уровень и общий расход топлива | неверный ключ → 401 |

Заправки, которые провайдер сам не отдаёт (Wialon, Navirec, Navixy, Samsara), ищем по скачку уровня между обновлениями: не меньше 30 л или 15 % бака, машина не едет. Они уходят в «Топливо» (`telematics_fuel_add`) только у машин, привязанных к автопарку.

## Не сделано — нужен договор или другой вход

- **Webfleet** (№ 1 в Германии): ключ — по заявке клиента в My Account, плюс пользователь с правом WEBFLEET.connect; вход логином, паролем и ключом.
- **Geotab**: вход логином, паролем и базой (можно служебный пользователь клиента).
- **ABAX** (лидер в Скандинавии): OAuth-приложение, которое регистрируем мы; клиент нажимает «Подключить ABAX».
- **rFMS** Scania, Volvo, DAF, MAN: клиентские данные доступа, но платная подписка производителя.
- **Frotcom**: вход логином и паролем, ключ живёт 20 минут.
- **Vehco, Ecofleet/Fleet Complete, YellowFox, Spedion, idem, TX-Connect, Linqo, Framelogic, GBox, Positrex**: публичной документации нет — только через переговоры.

## Что не проверено

Ни у одного провайдера, кроме Wialon, нет живого ключа: адаптеры написаны по документации. Проверены адреса API и вход — каждый сервер на неверный ключ отвечает «ключ не подходит». Названия полей и единицы (метры или км, секунды или часы) проверить можно только на первом настоящем подключении.

Navixy отдаёт время в часовом поясе аккаунта без зоны: считаем UTC, ошибка в «когда видели» — до пары часов.

## Источники

- Mapon: https://mapon.com/api/ , https://help.mapon.com/en/articles/174904-how-to-create-api-key
- Navirec: https://api.navirec.com/schema/
- Ruptela: https://api.fm-track.com/swagger.json
- Navixy: https://www.navixy.com/docs/navixy-api/user-api/backend-api/resources/tracking/tracker
- Samsara: https://developers.samsara.com/docs/authentication , https://developers.samsara.com/reference/getvehiclestats
- Webfleet: https://www.webfleet.com/en_ie/fleet-management/integration/resources/
- Geotab: https://developers.geotab.com/myGeotab/apiReference/objects/DeviceStatusInfo
- ABAX: https://developers.abax.cloud/getting-started
