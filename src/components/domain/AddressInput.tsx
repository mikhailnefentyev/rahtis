'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Input } from '@/components/ui';
import type { AddressSuggestion, LatLon } from '@/lib/routing';
import { suggestAddressAction } from '@/lib/routing/actions';
import { useI18n } from '@/lib/i18n/provider';

/**
 * Поле адреса с подсказкой.
 *
 * Адрес выбирается из списка, а не набирается свободно, и координаты
 * запоминаются в момент выбора. Причина в замере: несуществующий адрес
 * геокодер не отвергает, а подбирает похожую улицу в другом городе —
 * «Teollisuuskatu 12, 20100 Turku» уехала в Kaskinen за двести
 * километров. По такой точке считается километраж, а километраж — это
 * ставка. Выбор из списка убирает саму возможность: координаты приходят
 * от той же строки, которую человек увидел и выбрал.
 *
 * Подсказка — платный вызов на каждое нажатие клавиши, и это главная
 * статья расходов на роутинг: четыре адреса по двадцать нажатий дают
 * восемьдесят вызовов на заказ вместо четырёх. Поэтому три ограничителя
 * стоят с самого начала, а не после первого счёта.
 */

/** Задержка после последней клавиши. */
const DEBOUNCE_MS = 300;

/** Короче трёх символов подсказка бессмысленна: «Sa» — это пол-Финляндии. */
const MIN_CHARS = 3;

/**
 * Кэш по строке запроса, общий на все поля формы.
 *
 * Живёт на модуле, а не в компоненте: в заказе четыре-шесть адресов, и
 * набранное в одном поле «Helsinki» переиспользуется в другом. Стирание
 * символа возвращает предыдущий запрос — с кэшем это ноль вызовов.
 */
const cache = new Map<string, AddressSuggestion[]>();

/** Ключ учитывает смещение: одна строка рядом с Ханко и рядом с Турку — разное. */
function cacheKey(query: string, near?: LatLon): string {
  const at = near ? `${near.lat.toFixed(2)},${near.lon.toFixed(2)}` : '';
  return `${query.toLowerCase()}|${at}`;
}

export type ChosenAddress = {
  address: string;
  city: string | null;
  /* Страна от геокодера: по ней выбирается профиль грузовика. */
  country: string | null;
  position: LatLon | null;
  score: number;
  precise: boolean;
};

export function AddressInput({
  name,
  required,
  placeholder,
  defaultValue,
  near,
  onChosen,
  id,
  'aria-describedby': describedBy,
}: {
  name: string;
  required?: boolean;
  placeholder?: string;
  defaultValue?: string;
  /** Смещение выдачи: обычно координаты города точки. */
  near?: LatLon;
  onChosen?: (chosen: ChosenAddress | null) => void;
  id?: string;
  'aria-describedby'?: string;
}) {
  const { t, locale } = useI18n();

  const [value, setValue] = useState(defaultValue ?? '');
  const [chosen, setChosen] = useState<ChosenAddress | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  /*
   * Ответ хранится вместе с запросом, которому он принадлежит. Список для
   * показа выводится при рендере, а не выставляется в эффекте: иначе
   * каждое нажатие клавиши сначала рисовало бы устаревшие подсказки, а
   * следом их же очистку.
   */
  const [answer, setAnswer] = useState<{ key: string; list: AddressSuggestion[] } | null>(null);

  const listId = useId();
  const boxRef = useRef<HTMLDivElement>(null);

  /* Ответы приходят не в том порядке, в каком уходили запросы. */
  const latest = useRef(0);

  const query = value.trim();
  const key = cacheKey(query, near);
  const settled = Boolean(chosen && chosen.address === query);
  const ready = query.length >= MIN_CHARS && !settled;

  const items = ready ? (answer?.key === key ? answer.list : (cache.get(key) ?? [])) : [];

  useEffect(() => {
    /* Уже есть в кэше или спрашивать нечего — вызова не будет. */
    if (!ready || cache.has(key)) return;

    const ticket = ++latest.current;

    const timer = setTimeout(async () => {
      setLoading(true);
      const result = await suggestAddressAction(query, near, locale);

      /* Пришёл ответ на устаревший запрос — выбрасываем. */
      if (ticket !== latest.current) return;

      setLoading(false);
      if (result.ok) {
        cache.set(key, result.suggestions);
        setAnswer({ key, list: result.suggestions });
      } else {
        setAnswer({ key, list: [] });
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [ready, key, query, near, locale]);

  /* Клик мимо списка закрывает его, но набранное сохраняет. */
  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!boxRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);

  function choose(item: AddressSuggestion) {
    const picked: ChosenAddress = {
      address: item.label,
      city: item.city,
      country: item.country,
      position: item.position,
      score: item.score,
      precise: item.precise,
    };

    setValue(item.label);
    setChosen(picked);
    setOpen(false);
    onChosen?.(picked);
  }

  /*
   * Ручная правка после выбора сбрасывает координаты. Оставить их значило
   * бы считать маршрут до места, которое в поле уже не написано.
   */
  function edit(next: string) {
    setValue(next);
    setOpen(true);
    if (chosen) {
      setChosen(null);
      onChosen?.(null);
    }
  }

  /*
   * Ненадёжен не тот адрес, у которого низкая оценка, а тот, что не
   * является точным адресом: центроид индекса или города стоит не там,
   * где ворота склада. Шкала оценки у подсказки и у геокодера разная
   * (0,99 против 7,87 на одном и том же адресе), поэтому порога по числу
   * здесь нет — см. комментарий в lib/routing/index.ts.
   */
  const weak = chosen !== null && !chosen.precise;

  return (
    <div ref={boxRef} className="relative">
      <Input
        id={id}
        aria-describedby={describedBy}
        name={name}
        required={required}
        placeholder={placeholder}
        value={value}
        autoComplete="off"
        role="combobox"
        aria-expanded={open && items.length > 0}
        aria-controls={listId}
        onChange={(e) => edit(e.target.value)}
        onFocus={() => setOpen(true)}
      />

      {/*
        * Координаты и город уезжают на сервер скрытыми полями рядом с
        * адресом. Города отдельным полем в форме больше нет: заказчик
        * пишет адрес целиком — улица, дом, индекс, город, — а название
        * города берётся из того же ответа геокодера, что и координаты.
        * Так город всегда совпадает с точкой на карте, а не с тем, что
        * человек выбрал в списке из шести штук.
        */}
      <input type="hidden" name={`${name}_city`} value={chosen?.city ?? ''} />
      <input type="hidden" name={`${name}_country`} value={chosen?.country ?? ''} />
      <input type="hidden" name={`${name}_lat`} value={chosen?.position?.lat ?? ''} />
      <input type="hidden" name={`${name}_lon`} value={chosen?.position?.lon ?? ''} />
      <input type="hidden" name={`${name}_score`} value={chosen?.score ?? ''} />

      {loading && ready && (
        <span className="absolute top-2.5 right-3 text-[11px] text-ink-dim">
          {t.routing.searching}
        </span>
      )}

      {open && items.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1 w-full overflow-hidden rounded-control border border-line-strong bg-raised shadow-lg"
        >
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                role="option"
                aria-selected={false}
                onClick={() => choose(item)}
                className="flex w-full items-baseline justify-between gap-3 px-3 py-2 text-left text-[13px] text-ink hover:bg-sunken"
              >
                <span className="truncate">{item.label}</span>
                {!item.precise && (
                  <span className="shrink-0 text-[11px] text-ink-dim">{t.routing.approximate}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      {weak && <p className="mt-1 text-xs text-warn">{t.routing.weakMatch}</p>}
    </div>
  );
}
