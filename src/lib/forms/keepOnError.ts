'use client';

import { useEffect, useRef, type FormEvent, type RefObject } from 'react';

/**
 * Введённое в форму переживает отказ сервера.
 *
 * После серверного действия React сбрасывает форму. При успехе это и
 * нужно, а при отказе («проверьте время», «такой номер уже есть»)
 * человек терял всё, что набрал: почту на странице входа после неверного
 * пароля, время смены после ошибки в одометре, компанию и контакты в
 * заявке (прогон 12.10.2026). Поля, которые держит состояние React, сброс
 * не трогает; остальные возвращаются отсюда.
 *
 * Хук запоминает значения в момент отправки и, если ответ пришёл с
 * ошибкой, раскладывает их обратно. Пароли и файлы не возвращаются: их
 * положено вводить заново.
 */
export function useKeepOnError(state: { error?: string | null }): {
  ref: RefObject<HTMLFormElement | null>;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
} {
  const ref = useRef<HTMLFormElement | null>(null);
  const saved = useRef<FormData | null>(null);

  useEffect(() => {
    const form = ref.current;
    const data = saved.current;
    if (!state.error || !form || !data) return;

    /* После кадра: сброс формы React делает в том же коммите, что и показ ошибки. */
    const id = window.setTimeout(() => restore(form, data), 0);
    return () => window.clearTimeout(id);
  }, [state]);

  return {
    ref,
    onSubmit: (event) => {
      saved.current = new FormData(event.currentTarget);
    },
  };
}

function restore(form: HTMLFormElement, data: FormData): void {
  for (const element of Array.from(form.elements)) {
    if (
      !(element instanceof HTMLInputElement) &&
      !(element instanceof HTMLSelectElement) &&
      !(element instanceof HTMLTextAreaElement)
    ) {
      continue;
    }
    if (!element.name || !data.has(element.name)) continue;

    if (element instanceof HTMLInputElement) {
      if (['hidden', 'file', 'password', 'submit', 'button', 'reset', 'image'].includes(element.type)) continue;

      if (element.type === 'checkbox' || element.type === 'radio') {
        element.checked = data.getAll(element.name).includes(element.value);
        continue;
      }
    }

    const value = data.get(element.name);
    if (typeof value === 'string' && element.value !== value) element.value = value;
  }
}
