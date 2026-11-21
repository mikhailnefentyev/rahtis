'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { EMERGENCY_TEXT, emergencyLang } from '@/lib/i18n/emergency';
import { reportRenderFailure } from '@/lib/incidents/action';
import { errorClass, isStaleBundle, reloadOnce } from '@/lib/incidents/stale';

/**
 * Последний рубеж: упал сам корневой layout.
 *
 * Этот файл заменяет собой всё дерево, включая <html> и провайдер языка.
 * Поэтому здесь нет ни словаря, ни компонентов кита, ни переменных темы —
 * ничего из того, что могло оказаться причиной падения. Тексты на всех
 * языках сайта вшиты сюда же (аудит 21.11.2026: был только финский), язык
 * берётся из адреса после загрузки; стили заданы прямо на элементах.
 *
 * Выглядит это беднее остального сайта, и так и должно быть: страница
 * обязана нарисоваться, даже когда сломано всё остальное.
 */

const noop = () => () => {};

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  /* Язык из адреса; на сервере — финский, после гидратации — язык страницы. */
  const lang = useSyncExternalStore(noop, emergencyLang, () => 'fi' as const);
  const [title, lede, retry] = EMERGENCY_TEXT[lang];

  useEffect(() => {
    /* Старая сборка после выкладки: одна перезагрузка лечит, журнал не нужен. */
    if (isStaleBundle(error) && reloadOnce()) return;
    void reportRenderFailure({ digest: error.digest, path: window.location.pathname, name: errorClass(error) });
  }, [error]);

  return (
    <html lang={lang}>
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          background: '#eef1f6',
          color: '#0c1626',
          fontFamily: 'system-ui, -apple-system, Segoe UI, sans-serif',
        }}
      >
        <div style={{ maxWidth: 420, width: '100%' }}>
          <p
            style={{
              margin: 0,
              fontSize: 10,
              letterSpacing: '0.13em',
              textTransform: 'uppercase',
              color: '#5f6f86',
            }}
          >
            RAHTIS
          </p>
          <h1 style={{ margin: '10px 0 0', fontSize: 19, letterSpacing: '-0.01em' }}>
            {title}
          </h1>
          <p style={{ margin: '10px 0 0', fontSize: 14, lineHeight: 1.55, color: '#44546b' }}>
            {lede}
          </p>

          {error.digest && (
            <p
              style={{
                margin: '16px 0 0',
                fontFamily: 'ui-monospace, Consolas, monospace',
                fontSize: 13,
                color: '#44546b',
              }}
            >
              {error.digest}
            </p>
          )}

          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: 20,
              minHeight: 40,
              padding: '0 18px',
              border: 0,
              borderRadius: 6,
              background: '#0d647f',
              color: '#ffffff',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {retry}
          </button>
        </div>
      </body>
    </html>
  );
}
