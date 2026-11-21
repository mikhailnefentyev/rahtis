import Image from 'next/image';
import { cn } from '@/lib/cn';
import { PLATE_WIDTH, plateCountryCode, truckPhoto } from '@/lib/fleet/truckPhoto';

/**
 * Фото машины с её госномером на бампере (21.11.2026).
 *
 * Тягач известной марки — студийный снимок этой марки; номерной знак
 * стоит на месте номера и масштабируется вместе с кадром (размеры в
 * единицах контейнера). Для остальных — та же плитка со знаком по центру,
 * чтобы карточки парка выглядели одинаково.
 *
 * Без хуков: подходит и серверным страницам (приложение водителя), и
 * клиентским (парк).
 */
export function TruckPhoto({
  make,
  vehicleClass,
  plate,
  country,
  sizes = '(min-width: 640px) 300px, 100vw',
  priority,
  zoom = 1.3,
  className,
}: {
  make: string | null | undefined;
  vehicleClass: string | null | undefined;
  plate: string | null | undefined;
  /** Страна регистрации (ISO), для кода на синей полосе знака. */
  country?: string | null;
  sizes?: string;
  priority?: boolean;
  /** Увеличение кадра: у снимков запас поля, в маленькой плитке машину приближаем. */
  zoom?: number;
  className?: string;
}) {
  const photo = truckPhoto(make, vehicleClass);
  const code = plateCountryCode(country);

  return (
    <div
      className={cn(
        'relative aspect-[16/10] w-full overflow-hidden rounded-card border border-line bg-ground [container-type:inline-size]',
        className,
      )}
    >
      {photo ? (
        <div className="absolute inset-0" style={{ transform: `scale(${zoom})`, transformOrigin: '50% 47%' }}>
          <Image
            src={photo.src}
            alt={make ?? ''}
            fill
            sizes={sizes}
            priority={priority}
            className="object-cover"
          />
          {plate && (
            <PlateSign
              text={plate}
              code={code}
              style={{
                left: `${photo.plate.x * 100}%`,
                top: `${photo.plate.y * 100}%`,
                width: `${PLATE_WIDTH * 100}%`,
                fontSize: `${PLATE_WIDTH * 13.5}cqw`,
              }}
              className="-translate-x-1/2 -translate-y-1/2"
            />
          )}
        </div>
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-[4cqw]">
          <TruckGlyph />
          {plate && (
            <PlateSign
              text={plate}
              code={code}
              style={{ position: 'relative', width: '46%', fontSize: '6.2cqw' }}
            />
          )}
        </div>
      )}
    </div>
  );
}

/** Знак ЕС: белое поле, тонкая рамка, синяя полоса с кодом страны. */
function PlateSign({
  text,
  code,
  style,
  className,
}: {
  text: string;
  code: string | null;
  style: React.CSSProperties;
  className?: string;
}) {
  return (
    <span
      aria-label={text}
      style={style}
      className={cn(
        'absolute flex aspect-[52/11] items-stretch overflow-hidden rounded-[0.18em] border-[0.08em] border-black/80 bg-white leading-none shadow-[0_0.1em_0.25em_rgb(0_0_0/0.25)]',
        className,
      )}
    >
      <span className="flex w-[13%] shrink-0 flex-col items-center justify-end bg-[#0b3ea8] pb-[0.12em] text-[0.42em] font-bold text-white">
        {code}
      </span>
      <span className="flex flex-1 items-center justify-center font-mono font-bold tracking-tight whitespace-nowrap text-black">
        {text}
      </span>
    </span>
  );
}

function TruckGlyph() {
  return (
    <svg viewBox="0 0 64 40" aria-hidden className="w-[30%] text-ink-dim" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
      <path d="M4 30V10a2 2 0 0 1 2-2h30a2 2 0 0 1 2 2v20" />
      <path d="M38 16h11l9 9v5H38" />
      <path d="M4 30h4m10 0h20m14 0h6" />
      <circle cx="13" cy="31" r="4" />
      <circle cx="47" cy="31" r="4" />
    </svg>
  );
}
