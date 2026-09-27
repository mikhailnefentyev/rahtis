/**
 * Заглушка экрана водителя, пока сервер отвечает.
 *
 * В порту сеть медленная: без неё после нажатия экран стоит как был, и
 * водитель жмёт ещё раз. Серые плашки повторяют форму экрана — заголовок,
 * полоса действия, карточки, — поэтому переход не дёргает вёрстку.
 */
export function DriverSkeleton() {
  return (
    <div aria-busy="true" className="flex flex-col gap-4 motion-safe:animate-pulse">
      <div className="h-8 w-40 rounded-control bg-raised" />
      <div className="h-24 rounded-card bg-raised" />
      <div className="h-12 rounded-pill bg-raised" />
      <div className="h-40 rounded-card bg-raised" />
      <div className="h-40 rounded-card bg-raised" />
    </div>
  );
}
