import { analytics } from '@heycatch/sdk';
import { cleanUrl, isPublicPath } from '@/lib/analytics/public';

/*
 * Аналитика HeyCatch (24.10.2026).
 *
 * Запускается на каждой странице, но молчит, пока посетитель не нажал
 * «Разрешить»: optOutCapturingByDefault не даёт ни отправлять, ни писать
 * в браузер. Согласие включает AnalyticsConsent (optInCapturing).
 *
 * Даже после согласия события уходят только с открытых страниц:
 * beforeSend отбрасывает всё из кабинетов и вычищает из адресов
 * строку запроса (код приглашения).
 */
analytics.init({
  projectKey: 'hck_pk_uxM3NqYDFHlLmduLaQ-BOX_oJ8TDrpMR',
  install: { framework: 'nextjs', frameworkVersion: '16', agent: 'claude-code' },
  optOutCapturingByDefault: true,
  cookieExpirationDays: 365,
  beforeSend: (event) => {
    if (!event || typeof window === 'undefined' || !isPublicPath(window.location.pathname)) return null;
    const p = event.properties;
    for (const key of ['$current_url', '$referrer', '$initial_referrer', '$initial_current_url']) {
      if (key in p) p[key] = cleanUrl(p[key]);
    }
    return event;
  },
});
