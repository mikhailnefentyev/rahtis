import Image from 'next/image';
import { cn } from '@/lib/cn';
import { plateCountryCode, truckPhoto } from '@/lib/fleet/truckPhoto';

/**
 * Фото машины с её госномером на бампере (21.11.2026).
 *
 * Тягач известной марки — студийный снимок этой марки. Номерной знак —
 * часть снимка, а не наклейка поверх: настоящий размер на этом бампере,
 * наклон бампера, освещение студии (верх светлее), чуть мягче резкости,
 * без тени, финский шрифт номеров. Размеры — в единицах контейнера, знак
 * масштабируется вместе с кадром. Для остальных машин — та же плитка со
 * знаком по центру, чтобы карточки парка выглядели одинаково.
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
            <BumperPlate
              text={plate}
              code={code}
              style={{
                left: `${photo.plate.x * 100}%`,
                top: `${photo.plate.y * 100}%`,
                width: `${photo.plate.w * 100}%`,
                fontSize: `${photo.plate.w * 16}cqw`,
                transform: `translate(-50%, -50%) skewY(${photo.plate.skew}deg)`,
              }}
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

/**
 * Знак на бампере. Шрифт — узкий гротеск, как у финских знаков (не
 * моноширинный), поле не чисто белое, сверху светлее — как свет студии на
 * остальном бампере; тонкая тёмная рамка держателя, лёгкая мягкость.
 */
function BumperPlate({ text, code, style }: { text: string; code: string | null; style: React.CSSProperties }) {
  return (
    <span
      aria-label={text}
      style={style}
      className="absolute flex aspect-[46/10] items-stretch overflow-hidden rounded-[0.12em] bg-[linear-gradient(180deg,#f6f6f3_0%,#e4e4df_70%,#d2d2cc_100%)] leading-none opacity-[0.93] shadow-[inset_0_0_0_0.06em_rgb(30_30_30/0.85),0_0_0_0.05em_rgb(20_24_30/0.55)] blur-[0.012em]"
    >
      <span className="flex w-[12%] shrink-0 items-end justify-center bg-[linear-gradient(180deg,#2f55a8,#1b3a85)] pb-[0.1em] text-[0.34em] font-semibold text-white/90">
        {code}
      </span>
      <span className="flex flex-1 items-center justify-center font-[Arial_Narrow,Roboto_Condensed,Helvetica_Neue,Arial,sans-serif] text-[0.78em] font-bold tracking-[0.02em] whitespace-nowrap text-[#1c1c1c] [font-stretch:condensed]">
        {text}
      </span>
    </span>
  );
}

/** Знак ЕС в плитке без фото: белое поле, тонкая рамка, синяя полоса с кодом страны. */
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
