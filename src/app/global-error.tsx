'use client';

import { useEffect } from 'react';
import { reportRenderFailure } from '@/lib/incidents/action';

/**
 * Последний рубеж: упал сам корневой layout.
 *
 * Этот файл заменяет собой всё дерево, включая <html> и провайдер языка.
 * Поэтому здесь нет ни словаря, ни компонентов кита, ни переменных темы —
 * ничего из того, что могло оказаться причиной падения. Текст по-фински
 * и вшит в разметку, стили заданы прямо на элементах.
 *
 * Выглядит это беднее остального сайта, и так и должно быть: страница
 * обязана нарисоваться, даже когда сломано всё остальное.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    void reportRenderFailure({ digest: error.digest, path: window.location.pathname });
  }, [error.digest]);

  return (
    <html lang="fi">
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
            Palvelu ei juuri nyt vastaa
          </h1>
          <p style={{ margin: '10px 0 0', fontSize: 14, lineHeight: 1.55, color: '#44546b' }}>
            Kuljetusten tiedot ovat tallessa. Yritä hetken kuluttua uudelleen.
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
            Yritä uudelleen
          </button>
        </div>
      </body>
    </html>
  );
}
