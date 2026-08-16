'use client';

import { useId } from 'react';
import { cn } from '@/lib/cn';

/**
 * Обёртка поля формы: подпись, контрол, подсказка, ошибка.
 *
 * Подпись всегда видима — плейсхолдер вместо подписи исчезает, как только
 * человек начал печатать, и заполненная форма превращается в набор строк
 * без объяснений. Ошибка стоит под своим полем, а не общим списком сверху.
 */
export function Field({
  label,
  hint,
  error,
  required,
  children,
  className,
}: {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: (props: { id: string; 'aria-describedby'?: string; 'aria-invalid'?: boolean }) => React.ReactNode;
  className?: string;
}) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="label-micro">
        {label}
        {required && (
          <span aria-hidden className="ml-1 text-danger">
            *
          </span>
        )}
      </label>

      {children({ id, 'aria-describedby': describedBy, 'aria-invalid': error ? true : undefined })}

      {error && (
        <p id={errorId} className="text-xs text-danger">
          {error}
        </p>
      )}
      {hint && !error && (
        <p id={hintId} className="text-xs text-ink-faint">
          {hint}
        </p>
      )}
    </div>
  );
}

const controlClass = cn(
  'w-full rounded-control border border-line bg-sunken px-3 text-[13px] text-ink',
  'placeholder:text-ink-dim transition-colors duration-150',
  'hover:border-line-strong focus:border-accent focus:outline-none',
  'disabled:cursor-not-allowed disabled:opacity-45',
  'aria-invalid:border-danger',
);

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(controlClass, 'h-9', className)} {...props} />;
}

/** Поле для данных: номера машин, суммы, даты — моноширинным. */
export function InputMono({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <Input className={cn('font-mono tracking-tight', className)} {...props} />;
}

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(controlClass, 'resize-y py-2 leading-relaxed', className)} {...props} />;
}

export function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(controlClass, 'h-9 cursor-pointer appearance-none pr-8', className)}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath fill='%237a8d93' d='M0 0h10L5 6z'/%3E%3C/svg%3E\")",
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'right 0.75rem center',
      }}
      {...props}
    />
  );
}
