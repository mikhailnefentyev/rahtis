# eFTI: подключение к тестовому шлюзу Fintraffic (этап А)

Код: `src/lib/efti/*`, маршруты `src/app/api/efti/gate/v1/*`, миграция
`20261119120000_efti_datasets.sql`. До сертификации платформы (регламент
2020/1056 ст. 9, правила сертификации ЕС ещё не приняты) — только тестовый
шлюз.

## Как идут запросы

```
RAHTIS → шлюз:  Vercel (Node https, взаимный TLS: наш клиентский сертификат)
                 PUT {EFTI_GATE_URL}/v1/consignments/{datasetId}

шлюз → RAHTIS:  https://efti.rahtis.eu  (прокси, проверяет сертификат шлюза)
                 → https://www.rahtis.eu/api/efti/gate/v1/...
                   + заголовок X-Efti-Proxy-Secret
```

Vercel не умеет проверять клиентские сертификаты входящих запросов, поэтому
нужен небольшой прокси с публичным TLS-сертификатом (Fintraffic не
принимает самоподписанные).

## Шаги (выполняет владелец)

1. **Ключ и запрос на сертификат (CSR).** На своём компьютере, не в репозитории:
   ```
   openssl req -new -newkey rsa:2048 -nodes -keyout efti-client.key \
     -out efti-client.csr -subj "/CN=efti.rahtis.eu/O=Aivomaa Oy/C=FI"
   ```
   `efti-client.key` — секрет: никому не отправлять, не коммитить.
2. **Письмо в Fintraffic** (support.efti@fintraffic.fi): приложить
   `efti-client.csr` и адрес Platform API for Gate: `https://efti.rahtis.eu`.
   В ответ придут: адрес тестового шлюза, подписанный клиентский сертификат,
   корневой сертификат шлюза (CA).
3. **DNS:** `efti.rahtis.eu` → сервер прокси.
4. **Прокси** (пример для Caddy):
   ```
   efti.rahtis.eu {
     tls {
       client_auth {
         mode require_and_verify
         trusted_ca_cert_file /etc/caddy/efti-gate-ca.pem
       }
     }
     reverse_proxy https://www.rahtis.eu {
       rewrite * /api/efti/gate{uri}
       header_up Host www.rahtis.eu
       header_up X-Efti-Proxy-Secret {env.EFTI_PROXY_SECRET}
       header_up -X-Efti-Proxy-Secret-Client
     }
   }
   ```
   Входящий заголовок `X-Efti-Proxy-Secret` от клиента прокси должен
   затирать (header_up выставляет своё значение).
5. **Переменные окружения Vercel** (Production):
   - `EFTI_GATE_URL` — адрес тестового шлюза из письма;
   - `EFTI_CLIENT_CERT` — подписанный сертификат (PEM);
   - `EFTI_CLIENT_KEY` — ключ из шага 1 (PEM);
   - `EFTI_GATE_CA` — корневой сертификат шлюза (PEM);
   - `EFTI_PROXY_SECRET` — длинная случайная строка, та же, что у прокси.
6. **Проверка:** `GET /v1/whoami` шлюза, затем тестовые прогоны
   `POST /v0/test-runs` по инструкции портала.

Пока переменных нет, eFTI выключен: ничего не отправляется, маршруты шлюза
отвечают 401.
