/**
 * Раздел «Продажа техники в рассрочку» — только для финских компаний
 * (22.11.2026): договор по финскому закону о рассрочке и финскому НДС.
 * Пункт меню у остальных скрыт (CabinetShell), а по прямой ссылке
 * каталог и формы открывались и кончались общей ошибкой. Страницы
 * раздела сверяются с этим правилом; сделку её стороны видят всегда.
 * Без зависимостей: читают страницы и тесты.
 */
export function installmentsAvailable(country: string | null | undefined): boolean {
  return country === 'FI';
}

/** Машину можно выставить на продажу: не купленная в рассрочку до выплаты и не проданная (как app.vehicle_sellable). */
export function vehicleSellable(installmentRole: string | null | undefined): boolean {
  return installmentRole == null || installmentRole === 'OWNED';
}
