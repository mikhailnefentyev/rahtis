import { Card, CardBody, Mono } from '@/components/ui';
import { getI18n, type Locale } from '@/lib/i18n';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/types/database';

type Kind = Database['public']['Enums']['legal_kind'];

/**
 * Юридический документ по разделам и пунктам.
 *
 * Каждый пункт получает якорь вида #p-5-2, а номер рядом с ним — ссылку
 * на самого себя. Это нужно не для красоты: и юрист в переписке, и агент
 * в ответе водителю ссылаются «по п. 5.2», и ссылка обязана вести ровно
 * туда, а не в начало страницы.
 *
 * Точка в якоре заменена дефисом: в CSS-селекторах и в старых браузерах
 * точка внутри идентификатора читается как начало класса.
 */
export async function LegalDocument({ locale, kind }: { locale: Locale; kind: Kind }) {
  const [{ t, m, f }, supabase] = await Promise.all([getI18n(locale), createClient()]);

  const { data: document } = await supabase
    .from('legal_documents')
    .select('id, version, effective_from')
    .eq('kind', kind)
    .eq('status', 'ACTIVE')
    .maybeSingle();

  if (!document) {
    return (
      <Card>
        <CardBody>
          <p className="text-[13px] text-ink-muted">{t.legal.missing}</p>
        </CardBody>
      </Card>
    );
  }

  const { data: clauses } = await supabase
    .from('legal_clauses')
    .select('id, path, number, title, body')
    .eq('document_id', document.id)
    .eq('locale', locale)
    .order('path');

  const list = clauses ?? [];

  return (
    <>
      <p className="label-micro mt-2">
        {m('legal.version', { n: document.version })} ·{' '}
        {m('legal.effective', { date: f.date(document.effective_from) })}
      </p>

      <div className="mt-6 flex flex-col gap-5">
        {list.map((clause) => {
          /* Глубина адреса решает всё: {5} — раздел, {5,2} и глубже — пункт. */
          const section = clause.path.length === 1;
          const anchor = `p-${clause.number.replaceAll('.', '-')}`;

          return (
            <section
              key={clause.id}
              id={anchor}
              className={section ? 'scroll-mt-24' : 'scroll-mt-24 pl-6'}
            >
              <div className="flex items-baseline gap-2.5">
                {/*
                  * Номер — ссылка на самого себя: правый клик, «копировать
                  * адрес», и ссылка на пункт готова.
                  */}
                <a
                  href={`#${anchor}`}
                  title={t.legal.clauseLink}
                  className="shrink-0 text-ink-faint hover:text-accent"
                >
                  <Mono className={section ? 'text-[15px] font-bold' : 'text-[13px]'}>
                    {clause.number}
                  </Mono>
                </a>

                <div className="min-w-0">
                  {clause.title && (
                    <h2
                      className={
                        section
                          ? 'text-[17px] font-semibold tracking-tight'
                          : 'text-[14px] font-semibold'
                      }
                    >
                      {clause.title}
                    </h2>
                  )}
                  {clause.body && (
                    <p className="mt-1 text-[13px] leading-relaxed whitespace-pre-line text-ink-muted">
                      {clause.body}
                    </p>
                  )}
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}
