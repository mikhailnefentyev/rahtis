'use client';

import { useId, useRef, useState } from 'react';
import { cn } from '@/lib/cn';

/**
 * Поле файла с перетаскиванием.
 *
 * Обычное `input[type=file]` внутри подписи, а не самодельный виджет:
 * без JS оно остаётся полем выбора файла, работает с клавиатуры и
 * отправляется формой как прежде. Перетаскивание и проверка — надстройка
 * над ним, а не замена.
 *
 * Проверка до отправки повторяет серверную: там те же 10 МБ и тот же
 * список типов. Дублирование здесь осознанное — сервер остаётся
 * единственным, кому верят, но узнавать о неподходящем файле после
 * загрузки десяти мегабайт по мобильной связи человек не должен.
 *
 * Библиотеку не берём: перетаскивание — это три обработчика и
 * DataTransfer, а react-dropzone стоит килобайт в бандле у каждого, кто
 * открыл страницу с формой.
 */
export function FileDrop({
  name,
  accept,
  maxBytes,
  required,
  hint,
  choose,
  drop,
  tooLarge,
  wrongType,
}: {
  name: string;
  accept: string;
  maxBytes: number;
  required?: boolean;
  /** Что показать под областью, пока файл не выбран. */
  hint?: string;
  choose: string;
  drop: string;
  tooLarge: string;
  wrongType: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const id = useId();
  const [over, setOver] = useState(false);
  const [picked, setPicked] = useState<{ name: string; size: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const types = accept.split(',').map((type) => type.trim());

  function take(file: File | undefined): void {
    if (!file) return;

    if (!types.includes(file.type)) {
      setError(wrongType);
      setPicked(null);
      if (input.current) input.current.value = '';
      return;
    }
    if (file.size > maxBytes) {
      setError(tooLarge);
      setPicked(null);
      if (input.current) input.current.value = '';
      return;
    }

    setError(null);
    setPicked({ name: file.name, size: file.size });
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={id}
        onDragOver={(event) => {
          event.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setOver(false);

          const file = event.dataTransfer.files?.[0];
          if (!file || !input.current) return;

          /*
           * Файл кладётся в само поле, а не в состояние: форму отправляет
           * браузер, и он возьмёт то, что лежит в input. Состояние здесь
           * только для подписи.
           */
          input.current.files = event.dataTransfer.files;
          take(file);
        }}
        className={cn(
          'flex cursor-pointer flex-col items-center gap-1 rounded-control border border-dashed px-4 py-5 text-center transition-colors duration-150',
          over ? 'border-accent bg-accent/5' : 'border-line hover:border-ink-dim',
        )}
      >
        <span className="text-[13px] font-semibold text-ink">{picked ? picked.name : choose}</span>
        <span className="text-[12px] text-ink-dim">
          {picked ? `${Math.max(1, Math.round(picked.size / 1024))} kB` : drop}
        </span>

        <input
          ref={input}
          id={id}
          type="file"
          name={name}
          accept={accept}
          required={required}
          onChange={(event) => take(event.target.files?.[0])}
          className="sr-only"
        />
      </label>

      {error ? (
        <p role="alert" className="text-[12px] text-danger">
          {error}
        </p>
      ) : (
        hint && <p className="text-[12px] text-ink-dim">{hint}</p>
      )}
    </div>
  );
}
