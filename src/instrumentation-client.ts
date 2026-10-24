import { analytics } from '@heycatch/sdk';
import { isPublicPath, scrubProperties } from '@/lib/analytics/public';

/*
 * Аналитика HeyCatch (24.10.2026).
 *
 * Запускается на каждой странице, но молчит, пока посетитель не нажал
 * «Разрешить»: optOutCapturingByDefault не даёт ни отправлять, ни писать
 * в браузер. Согласие включает AnalyticsConsent (optInCapturing).
 *
 * Даже после согласия события уходят только с открытых страниц:
 * beforeSend отбрасывает всё из кабинетов, а в остальном вычищает все
 * адреса: строку запроса (код приглашения) и пути закрытых страниц
 * (код ссылки отслеживания в «откуда пришёл»).
 */
analytics.init({
  projectKey: 'hck_pk_uxM3NqYDFHlLmduLaQ-BOX_oJ8TDrpMR',
  install: { framework: 'nextjs', frameworkVersion: '16', agent: 'claude-code' },
  optOutCapturingByDefault: true,
  cookieExpirationDays: 365,
  beforeSend: (event) => {
    if (!event || typeof window === 'undefined' || !isPublicPath(window.location.pathname)) return null;
    event.properties = scrubProperties(event.properties) as Record<string, unknown>;
    return event;
  },
});
