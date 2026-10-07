/**
 * Экран загрузки раздела кабинета (8.10.2026).
 *
 * Без него нажатие на раздел в боковой панели ничего не меняло, пока
 * сервер собирал всю страницу — полсекунды-секунду кабинет выглядел
 * зависшим. Теперь переход мгновенный: каркас остаётся, на месте
 * содержимого — его очертания, а данные подъезжают следом.
 */
export function CabinetLoading() {
  return (
    <div className="cab-page" aria-busy="true" aria-live="polite">
      <div className="skeleton h-7 w-64 max-w-full" />
      <div className="skeleton mt-3 h-4 w-96 max-w-full" />
      <div className="mt-7 grid gap-3.5 sm:grid-cols-3">
        <div className="skeleton h-28" />
        <div className="skeleton h-28" />
        <div className="skeleton h-28" />
      </div>
      <div className="skeleton mt-4 h-56" />
    </div>
  );
}
