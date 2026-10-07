'use client';

import { useFormStatus } from 'react-dom';
import { buttonClass, type ButtonSize, type ButtonVariant } from './buttonClass';

/**
 * Кнопка. У кнопки отправки формы — мгновенный отклик (8.10.2026).
 *
 * Серверное действие отвечает за полсекунды-секунду, и всё это время
 * кнопка стояла как ни в чём не бывало: человек жал второй раз и
 * думал, что сайт не реагирует. Теперь кнопка отправки сразу гаснет и
 * крутит индикатор, пока форма уходит. Работает в любой форме без
 * правок на месте: состояние берётся из useFormStatus ближайшей формы.
 */
export function Button({
  variant = 'default',
  size = 'md',
  className,
  type = 'button',
  disabled,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  const { pending } = useFormStatus();
  const busy = type === 'submit' && pending;
  return (
    <button
      type={type}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      className={buttonClass({ variant, size, className })}
      {...props}
    >
      {busy && <span className="btn-spinner" aria-hidden />}
      {children}
    </button>
  );
}
