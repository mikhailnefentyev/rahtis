import { fill, type InstallmentUiCopy } from '@/lib/installments/copy';
import { countryName } from '@/lib/installments/countryCopy';

/**
 * Оговорка для сторон не из Финляндии (23.11.2026): текст договора
 * подготовлен платформой по праву страны продавца, RAHTIS — не сторона и не
 * юридический консультант, договор стоит показать своему юристу. У финской
 * компании и финской сделки её нет (ui.country пуст) — там всё как было.
 * Стоит на форме объявления, у предложения покупателя и на странице сделки.
 */
export function LegalNotice({ ui, locale }: { ui: InstallmentUiCopy; locale: string }) {
  if (!ui.country) return null;
  return (
    <p className="rounded-card border border-warn/35 bg-warn/10 px-4 py-3 text-[14px] text-warn">
      {fill(ui.country.legalNotice, { country: countryName(locale, ui.country.code) })}
    </p>
  );
}
