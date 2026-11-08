import Image from 'next/image';
import { vehicleSrc, type Vehicle } from '@/lib/blog/visuals';

/**
 * Обложка статьи: машина по теме на фирменном фоне RAHTIS — светлая
 * акцентная заливка, голубой отсвет, тонкая сетка и «дорога» под колёсами.
 * Без текста на картинке: заголовок рядом, обычным текстом (его видят
 * поиск и читалки экрана). `small` — карточка в списке.
 */
export function BlogCover({ vehicle, small = false, priority = false }: { vehicle: Vehicle; small?: boolean; priority?: boolean }) {
  return (
    <div className={`blog-cover relative isolate overflow-hidden ${small ? 'aspect-[16/9] rounded-lg' : 'aspect-[2/1] rounded-xl'}`}>
      <Image
        src={vehicleSrc(vehicle)}
        alt={vehicle.label}
        width={1000}
        height={250}
        priority={priority}
        sizes={small ? '(min-width: 768px) 340px, 90vw' : '(min-width: 768px) 720px, 95vw'}
        className={`blog-cover-truck absolute bottom-[14%] h-auto max-w-none ${vehicle.file === 'kippiauto' ? 'left-[20%] w-[60%]' : 'left-[6%] w-[88%]'}`}
      />
    </div>
  );
}
