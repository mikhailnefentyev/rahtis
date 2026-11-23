/**
 * Договор Польши: «Umowa sprzedaży pojazdu na raty z zastrzeżeniem
 * własności» (23.11.2026).
 *
 * Текст — шаблон docs/equipment-sale/countries/pl.md, раздел 5, версия 0.1
 * (черновик, польским юристом и бухгалтером не проверен — об этом сторонам
 * сказано в кабинете). Юридический текст перенесён дословно; подставлены
 * только данные сделки. Чего в RAHTIS нет (VIN, год первой регистрации, REGON,
 * KRS или CEIDG, номер лицензии, представитель, номер счёта продавца, номер
 * счёта в KSeF, условия страховки, место заключения), — строки для заполнения
 * от руки; где шаблон даёт выбор, который платформа не знает (статус крупного
 * предприятия, как передаётся машина, кто страхует, как часто осмотр,
 * факультативные пункты), — варианты с отметкой «( )».
 *
 * Даты — «дд.мм.гггг», суммы — «123 456,78» в таблицах с «zł» в шапке.
 *
 * Решения:
 *   · только обычный НДС 23 %: кабинет других режимов не создаёт, варианты
 *     B–D п. 4.2 (маржа, освобождение, не плательщик) и примечание к ним не
 *     печатаются;
 *   · счета: шаблон уже говорит, что фактуры выставляет продавец в KSeF
 *     (п. 4.2, 4.3, 9.5) и что Aivomaa Oy счетов не выставляет (п. 10.2) —
 *     ни один пункт не говорит, что счёт выставляет платформа, менять текст
 *     не пришлось. Номер фактуры в KSeF в п. 4.3 платформе неизвестен
 *     (фактуру продавец выставит сам, при передаче) — строка для заполнения;
 *     d.firstInvoiceNumber (номер уведомления платформы) не используется;
 *   · п. 1.2 (статус крупного предприятия по UTH) — оба варианта для каждой
 *     стороны: платформа статуса не знает; что пара «крупный покупатель —
 *     малый продавец» опасна (art. 7 ust. 2a), сказано в кабинете и чек-листе;
 *   · п. 4.4: вариант A без процентов, вариант B — со ставкой и суммой
 *     (ставка не больше 7 %: предел odsetek maksymalnych — countries.ts);
 *   · пороги п. 9.1 — договорные, суммы в них нет (rules.ts PL_KC589);
 *   · п. 9.8 (нотариальное подчинение исполнению) — факультативный, с «( )»;
 *   · территория — страны ЕЭЗ и Швейцария; подсудность — по месту продавца.
 */
import type { ContractPdfInput } from '../ContractPdf.tsx';
import { BLANK, h, kv, li, LONG_BLANK, p, sub, type ContractBlock, type ContractDocument } from './blocks.ts';

/** Сумма без знака злотого: «70 000 zł» → «70 000»; валюта стоит в шапке таблицы или словом «zł». */
export const bareZl = (money: string) => money.replace(/[\s  ]*zł/g, '').trim();

const zl = (money: string) => `${bareZl(money)} zł`;
const DATE_BLANK = '__.__.____';

function party(label: string, x: ContractPdfInput['seller'], extra?: string): string[] {
  return [
    label,
    x.name,
    `Siedziba i adres: ${x.address || LONG_BLANK}`,
    `( ) KRS nr ${BLANK}, Sąd Rejonowy ${BLANK}  ( ) CEIDG`,
    `NIP: ${x.businessId} · REGON: ${BLANK}`,
    `Czynny podatnik VAT: ${x.vatRegistered ? 'tak' : 'nie'}`,
    ...(extra ? [extra] : []),
    `Reprezentowany przez: ${LONG_BLANK}`,
    `Telefon: ${x.phone || BLANK} · E-mail: ${x.email || BLANK}`,
  ];
}

export function plContractText(d: ContractPdfInput): ContractDocument {
  const n = d.months;
  const first = d.plan[0];
  const last = d.plan[d.plan.length - 1];
  const regular = d.plan.slice(0, -1);
  const equal = regular.every((x) => x.principal === first.principal);
  const interestTotal = d.price.interestTotal ? zl(d.price.interestTotal) : null;

  /* 4.3: равные взносы — суммой, как в шаблоне; если расходятся на грош, — отсылка к графику. */
  const regularLine =
    regular.length === 0
      ? null
      : regular.length === 1
        ? `Rata 1: ${zl(first.principal)}, płatna do dnia ${first.due}.`
        : equal
          ? `Raty 1–${n - 1}: każda w kwocie ${zl(first.principal)}, płatna do ${d.dueDay}. dnia każdego miesiąca, pierwsza do dnia ${first.due}.`
          : `Raty 1–${n - 1}: w kwotach według harmonogramu spłat (załącznik nr 1), płatne do ${d.dueDay}. dnia każdego miesiąca, pierwsza do dnia ${first.due}.`;

  const main: ContractBlock[] = [
    { kind: 'title', text: 'UMOWA SPRZEDAŻY POJAZDU NA RATY Z ZASTRZEŻENIEM WŁASNOŚCI' },
    { kind: 'notice', text: 'WŁASNOŚĆ PRZEDMIOTU SPRZEDAŻY NIE PRZECHODZI NA KUPUJĄCEGO PRZED ZAPŁATĄ CAŁEJ CENY.' },
    { kind: 'meta', text: `Umowa nr ${d.number} · zawarta w dniu ${d.date}` },

    h('1. Strony'),
    {
      kind: 'parties',
      left: party('Sprzedawca', d.seller),
      right: party('Kupujący', d.buyer, `Zezwolenie na wykonywanie zawodu przewoźnika drogowego / licencja nr: ${BLANK}`),
    },
    p('Sprzedawca i Kupujący są dalej zwani łącznie „Stronami”.'),
    p('1.1 Kupujący oświadcza, że zawiera niniejszą umowę w zakresie działalności swojego przedsiębiorstwa, a umowa ma dla niego charakter zawodowy. Strony zgodnie stwierdzają, że do umowy nie stosuje się przepisów art. 583–588 Kodeksu cywilnego (art. 587 Kodeksu cywilnego).'),
    p('1.2 Sprzedawca oświadcza, że ( ) posiada ( ) nie posiada status dużego przedsiębiorcy, a Kupujący oświadcza, że ( ) posiada ( ) nie posiada status dużego przedsiębiorcy w rozumieniu ustawy z dnia 8 marca 2013 r. o przeciwdziałaniu nadmiernym opóźnieniom w transakcjach handlowych.'),
    p('1.3 Sprzedawca udziela Kupującemu odroczenia zapłaty części ceny na zasadach określonych w umowie. Żaden inny podmiot nie finansuje tej sprzedaży.'),

    h('2. Przedmiot sprzedaży'),
    kv('Pojazd', d.vehicle.make),
    kv('Numer rejestracyjny', d.vehicle.plate),
    kv('Numer identyfikacyjny pojazdu (VIN)', LONG_BLANK),
    kv('Rok pierwszej rejestracji', '__________'),
    kv('Stan licznika przy zawarciu umowy', d.vehicle.odometer),
    kv('Wyposażenie dodatkowe', `( ) brak wyposażenia dodatkowego  ( ) ${LONG_BLANK}`),
    kv('Obciążenia (zastaw, zastaw rejestrowy, zajęcie)', `( ) brak obciążeń  ( ) dane: ${BLANK}`),
    p('2.1 Sprzedawca oświadcza, że jest właścicielem pojazdu i jego wyposażenia dodatkowego, że nie są one obciążone prawami osób trzecich, w szczególności zastawem, zastawem rejestrowym, zastrzeżeniem własności na rzecz osoby trzeciej, przewłaszczeniem na zabezpieczenie ani zajęciem, poza wskazanymi powyżej, oraz że jest uprawniony do sprzedaży pojazdu na warunkach niniejszej umowy. Przed podpisaniem umowy Sprzedawca okazuje Kupującemu dowód rejestracyjny pojazdu.'),
    p('2.2 Pojazd jest sprzedawany w stanie opisanym w protokole zdawczo-odbiorczym (załącznik nr 2). Kupujący zawiadamia Sprzedawcę o wadzie na piśmie niezwłocznie po jej wykryciu. ( ) Strony wyłączają odpowiedzialność Sprzedawcy z tytułu rękojmi za wady fizyczne pojazdu, z wyjątkiem wad, które Sprzedawca podstępnie zataił.'),

    h('3. Wydanie pojazdu'),
    p(`3.1 Sposób wydania: ( ) odbiór u Sprzedawcy  ( ) Sprzedawca dostarcza pojazd pod adres ${BLANK}. Termin wydania: ${d.handover}.`),
    p('3.2 Pojazd zostaje wydany dopiero wtedy, gdy'),
    li('1. niniejsza umowa została podpisana przez obie Strony i uzyskała datę pewną zgodnie z pkt 11.6;'),
    li('2. pierwsza wpłata (pkt 4.2) została zaksięgowana na rachunku Sprzedawcy;'),
    li('3. Kupujący przedstawił potwierdzenie zawarcia umowy ubezpieczenia zgodnie z pkt 7.1 i 7.2, obowiązującej od dnia wydania;'),
    li('4. ( ) jeżeli Strony tak postanowiły – Kupujący złożył oświadczenie o poddaniu się egzekucji, o którym mowa w pkt 9.8.'),
    p('3.3 Przy wydaniu Strony dokonują oględzin pojazdu i podpisują protokół zdawczo-odbiorczy (załącznik nr 2) z oznaczeniem daty i godziny wydania. Z chwilą wydania na Kupującego przechodzą korzyści i ciężary związane z pojazdem oraz niebezpieczeństwo jego przypadkowej utraty lub uszkodzenia.'),
    p(`3.4 Wraz z pojazdem Sprzedawca wydaje Kupującemu dowód rejestracyjny, kluczyki w liczbie ${BLANK} oraz dokumentację pojazdu. Wydanie dowodu rejestracyjnego nie oznacza przeniesienia własności.`),

    h('4. Cena i płatności'),
    sub('4.1 Cena (zł)'),
    kv('Cena pojazdu (netto)', bareZl(d.price.net)),
    kv('Wyposażenie dodatkowe, wyszczególnione i wycenione (netto)', '–'),
    kv(`Podatek od towarów i usług ${d.vatPercent} % od kwoty ${bareZl(d.price.net)}`, bareZl(d.price.vat)),
    kv('Cena łącznie (brutto)', bareZl(d.price.gross), true),
    kv('Pierwsza wpłata, płatna przed wydaniem pojazdu (obejmuje kwotę odpowiadającą podatkowi od całej ceny)', bareZl(d.price.downGross)),
    kv('Pozostała część ceny, płatna w ratach', bareZl(d.price.rest)),
    kv('Odsetki od odroczonej części ceny (pkt 4.4), płatne odrębnie', interestTotal ?? 'brak odsetek'),
    p(`Cena brutto wynosi ${zl(d.price.gross)} (słownie: ${LONG_BLANK}).`),

    sub('4.2 Pierwsza wpłata, faktura i podatek od towarów i usług'),
    p(`Kupujący wpłaca pierwszą wpłatę w kwocie ${zl(d.price.downGross)} na rachunek Sprzedawcy przed wydaniem pojazdu, na podstawie niniejszej umowy. Sprzedawca dokumentuje otrzymaną wpłatę oraz dostawę pojazdu fakturami wystawionymi zgodnie z ustawą z dnia 11 marca 2004 r. o podatku od towarów i usług przy użyciu Krajowego Systemu e-Faktur. Faktura dokumentująca dostawę obejmuje całą cenę; obowiązek podatkowy od części ceny niezapłaconej przed wydaniem powstaje z chwilą wydania pojazdu (art. 7 ust. 1 pkt 2 i art. 19a ust. 1 tej ustawy). Sprzedawca przekazuje Kupującemu numer identyfikujący fakturę w Krajowym Systemie e-Faktur.`),

    sub('4.3 Raty'),
    p(`Okres spłaty: ${n} miesięcy. Liczba rat: ${n}.`),
    ...(regularLine ? [p(regularLine)] : []),
    p(`Ostatnia rata ${n}: ${zl(last.principal)}, płatna do dnia ${last.due}.`),
    p(`Raty stanowią zapłatę części ceny objętej fakturą nr ${BLANK}; Sprzedawca nie wystawia odrębnych faktur na poszczególne raty.`),
    p(`Raty są płatne przelewem na rachunek Sprzedawcy nr ${LONG_BLANK}, wskazany w wykazie podatników VAT. Za dzień zapłaty uważa się dzień uznania rachunku Sprzedawcy.`),
    p('Harmonogram spłat: załącznik nr 1.'),

    sub('4.4 Odsetki od odroczonej części ceny'),
    p(
      d.ratePercent
        ? `Od pozostałej do zapłaty części ceny Kupujący płaci, począwszy od dnia wydania pojazdu, odsetki według stałej stopy ${d.ratePercent} % w stosunku rocznym. Odsetki nalicza się od aktualnego salda pozostałego do zapłaty, za rzeczywistą liczbę dni (rzeczywista liczba dni / 365), i płaci odrębnie wraz z każdą ratą. Przy spłacie zgodnej z harmonogramem łączna kwota odsetek wynosi ${interestTotal ?? BLANK} (załącznik nr 1). Jeżeli stopa odsetek przekroczyłaby wysokość odsetek maksymalnych, należą się odsetki maksymalne (art. 359 § 2¹ i 2² Kodeksu cywilnego). Sprzedawca dokumentuje odsetki zgodnie z przepisami podatkowymi.`
        : 'Odroczona część ceny nie jest oprocentowana.',
    ),
    p('Sprzedawca nie pobiera od Kupującego odsetek ani opłat, które nie zostały przewidziane w niniejszej umowie lub w ustawie.'),

    sub('4.5 Odsetki za opóźnienie'),
    p('Za czas opóźnienia w zapłacie Sprzedawcy przysługują, bez wezwania, odsetki ustawowe za opóźnienie w transakcjach handlowych w rozumieniu ustawy z dnia 8 marca 2013 r. o przeciwdziałaniu nadmiernym opóźnieniom w transakcjach handlowych, od dnia następującego po dniu wymagalności do dnia zapłaty, w odniesieniu do każdej niezapłaconej raty (art. 7 ust. 1 i art. 11 ust. 2 tej ustawy). Sprzedawcy przysługuje ponadto rekompensata za koszty odzyskiwania należności określona w art. 10 tej ustawy.'),

    sub('4.6 Wcześniejsza spłata'),
    p('Kupujący może w każdym czasie zapłacić całość lub część pozostałej ceny przed terminem. W razie wcześniejszej spłaty odsetki, o których mowa w pkt 4.4, należą się wyłącznie za okres do dnia zapłaty i od kwoty faktycznie pozostającej do zapłaty. Sprzedawca nie pobiera opłaty za wcześniejszą spłatę. Częściowa wcześniejsza spłata ( ) skraca okres spłaty ( ) obniża wysokość kolejnych rat; Sprzedawca przekazuje Kupującemu zaktualizowany harmonogram.'),

    sub('4.7 Inne opłaty'),
    p('Opłaty za czynności rejestracyjne po przejściu własności ponosi Kupujący. Kupujący zwraca Sprzedawcy, w terminie 14 dni od otrzymania wezwania z dokumentem potwierdzającym, kwoty należności publicznoprawnych związanych z pojazdem, którymi obciążono Sprzedawcę jako właściciela za okres od dnia wydania pojazdu, w szczególności podatek od środków transportowych, opłaty drogowe oraz kary i opłaty za naruszenia popełnione w tym okresie. Innych opłat Sprzedawca nie pobiera.'),

    sub('4.8 Zaliczanie wpłat'),
    p('Wpłaty Kupującego zalicza się wyłącznie na należności z niniejszej umowy: w pierwszej kolejności na wymagalne koszty i odsetki, a następnie na raty, począwszy od najdawniej wymagalnej.'),

    h('5. Zastrzeżenie własności, rejestracja i używanie pojazdu'),
    p('5.1 Sprzedawca zastrzega sobie własność pojazdu wraz z wyposażeniem dodatkowym do chwili zapłaty całej ceny oraz odsetek, o których mowa w pkt 4.4 (art. 589 Kodeksu cywilnego). Przeniesienie własności następuje pod warunkiem zawieszającym zapłaty tych należności. Przejście własności nie jest uzależnione od zapłaty jakichkolwiek innych długów Kupującego.'),
    p('5.2 Do chwili przejścia własności Sprzedawca pozostaje wpisany jako właściciel pojazdu w centralnej ewidencji pojazdów i w dowodzie rejestracyjnym. Kupujący włada pojazdem jako posiadacz zależny i jest uprawniony do używania go we własnej działalności. Niniejsza umowa stanowi tytuł prawny Kupującego do dysponowania pojazdem w rozumieniu przepisów o transporcie drogowym; Kupujący we własnym zakresie zgłasza pojazd właściwemu organowi przed rozpoczęciem przewozów.'),
    p('5.3 Własność przechodzi na Kupującego z dniem zaksięgowania na rachunku Sprzedawcy ostatniej należności, o której mowa w pkt 5.1. W terminie 3 dni roboczych od tego dnia Sprzedawca wydaje Kupującemu pisemne oświadczenie o zapłacie całej ceny i przejściu własności. Sprzedawca zawiadamia starostę o zbyciu pojazdu, a Kupujący składa wniosek o rejestrację pojazdu, każdy w terminie 30 dni od dnia przejścia własności (art. 78 ust. 2 pkt 1 i art. 73aa ust. 1 pkt 1 ustawy z dnia 20 czerwca 1997 r. – Prawo o ruchu drogowym).'),
    p('5.4 Do chwili przejścia własności Kupujący nie może bez uprzedniej pisemnej zgody Sprzedawcy:'),
    li('1. sprzedać, zamienić, darować ani w inny sposób zbyć pojazdu;'),
    li('2. obciążyć pojazdu zastawem, zastawem rejestrowym ani innym prawem, ani przenieść go na zabezpieczenie;'),
    li('3. wynająć, wydzierżawić, użyczyć ani w inny sposób oddać pojazdu do używania osobie trzeciej;'),
    li('4. zarejestrować pojazdu w innym państwie;'),
    li('5. dokonywać zmian konstrukcyjnych pojazdu wymagających dodatkowego badania technicznego lub zmiany danych w dowodzie rejestracyjnym;'),
    li('6. połączyć pojazdu lub jego wyposażenia z inną rzeczą ani odłączyć wyposażenia w celu jego zbycia.'),
    p('Za oddanie do używania w rozumieniu ppkt 3 nie uważa się prowadzenia pojazdu w przewozach Kupującego przez kierowców zatrudnionych przez Kupującego lub skierowanych do niego przez agencję pracy tymczasowej.'),
    p('5.5 Kupujący może używać pojazdu we własnych przewozach na obszarze umownym, którym jest terytorium państw Europejskiego Obszaru Gospodarczego i Szwajcarii. Używanie pojazdu poza obszarem umownym wymaga uprzedniej pisemnej zgody Sprzedawcy.'),
    p('5.6 Kupujący niezwłocznie zawiadamia Sprzedawcę o zajęciu pojazdu, o wszczęciu wobec Kupującego postępowania egzekucyjnego obejmującego pojazd, o złożeniu wniosku o ogłoszenie upadłości lub o otwarcie postępowania restrukturyzacyjnego oraz informuje organ egzekucyjny, syndyka lub nadzorcę o zastrzeżeniu własności na rzecz Sprzedawcy.'),

    h('6. Utrzymanie i badania techniczne'),
    p(`6.1 Przeglądy okresowe nie są objęte ceną. ( ) Strony zawierają odrębną umowę serwisową (załącznik nr 4), na podstawie której Sprzedawca wykonuje przegląd pojazdu dwa razy w roku, obejmujący wymianę oleju silnikowego i przekładniowego wraz z filtrami oraz odczyt kodów usterek, za cenę ${BLANK} zł netto za każdy przegląd, fakturowaną po wykonaniu usługi.`),
    p('6.2 Kupujący ponosi wszystkie pozostałe koszty używania i utrzymania pojazdu, w szczególności koszty napraw, opon, szyb, hamulców, paliwa, AdBlue i mycia.'),
    p('6.3 Kupujący utrzymuje pojazd w należytym stanie, używa go zgodnie z przeznaczeniem i niezwłocznie zawiadamia Sprzedawcę o szkodach i usterkach mogących istotnie obniżyć wartość pojazdu.'),
    p('6.4 Kupujący poddaje pojazd okresowym badaniom technicznym w terminach wynikających z Prawa o ruchu drogowym i przekazuje Sprzedawcy potwierdzenie ich przeprowadzenia za pośrednictwem serwisu RAHTIS lub w inny sposób na piśmie.'),
    p('6.5 Prawo kontroli: Sprzedawca może dokonać oględzin pojazdu co ( ) dwa miesiące ( ) trzy miesiące, w uzgodnionym wcześniej terminie, w miejscu prowadzenia działalności przez Kupującego. Z oględzin sporządza się protokół.'),

    h('7. Ubezpieczenia'),
    p(`7.1 Przez cały okres obowiązywania umowy pojazd musi być objęty obowiązkowym ubezpieczeniem odpowiedzialności cywilnej posiadaczy pojazdów mechanicznych. Umowę ubezpieczenia zawiera i składkę opłaca ( ) Kupujący ( ) Sprzedawca. ( ) Jeżeli Sprzedawca: Kupujący zwraca Sprzedawcy składkę ${LONG_BLANK} odrębnie wraz z każdą ratą.`),
    p(`7.2 Kupujący zawiera i opłaca ubezpieczenie autocasco obejmujące co najmniej szkody wskutek kolizji, pożaru, kradzieży i wandalizmu, z udziałem własnym nie wyższym niż ${BLANK} zł. Kupujący dokonuje na rzecz Sprzedawcy przelewu (cesji) praw z umowy autocasco albo wskazuje Sprzedawcę jako ubezpieczonego właściciela pojazdu. Przed wydaniem pojazdu Kupujący przekazuje Sprzedawcy pisemne potwierdzenie ubezpieczyciela, że cesja została przyjęta albo Sprzedawca został wskazany w polisie.`),
    p('7.3 Utrata lub zniszczenie pojazdu nie zwalnia Kupującego z obowiązku zapłaty ceny. Odszkodowanie wypłacone Sprzedawcy zalicza się na poczet należności z niniejszej umowy jako wcześniejszą spłatę zgodnie z pkt 4.6. Nadwyżkę Sprzedawca niezwłocznie przekazuje Kupującemu.'),

    h('8. Lokalizacja pojazdu'),
    p('8.1 Przez okres obowiązywania umowy w pojeździe znajduje się urządzenie lokalizacyjne zainstalowane lub zaakceptowane przez Sprzedawcę. Kupujący nie może go usunąć ani zakłócać jego działania.'),
    p('8.2 Sprzedawca ma dostęp wyłącznie do stanu licznika oraz informacji, czy pojazd znajduje się na obszarze umownym (pkt 5.5). Dokładna lokalizacja jest udostępniana Sprzedawcy tylko wtedy, gdy'),
    li('1. złożono zawiadomienie o kradzieży pojazdu;'),
    li('2. pojazd przebywa poza obszarem umownym dłużej niż 24 godziny bez zgody Sprzedawcy; lub'),
    li('3. Sprzedawca odstąpił od umowy albo spełnione są przesłanki, o których mowa w pkt 9.1.'),
    p('8.3 Administratorem danych lokalizacyjnych jest Sprzedawca. Dane są przetwarzane w celu ochrony prawa własności Sprzedawcy, na podstawie jego prawnie uzasadnionego interesu (art. 6 ust. 1 lit. f rozporządzenia (UE) 2016/679). Sprzedawca nie wykorzystuje danych lokalizacyjnych do kontroli czasu pracy, stylu jazdy ani innej oceny pracy kierowców. Każdy dostęp do dokładnej lokalizacji i jego podstawa są rejestrowane, a Kupujący jest o nim informowany najpóźniej w terminie 3 dni, chyba że zagrażałoby to wyjaśnieniu przestępstwa. Dokładne dane lokalizacyjne są usuwane po 30 dniach albo, jeżeli zostały udostępnione na podstawie pkt 8.2, po zakończeniu sprawy.'),
    p('8.4 Sprzedawca przygotowuje dla kierowców informację wymaganą przez art. 14 rozporządzenia (UE) 2016/679, a Kupujący przekazuje ją kierowcom przed wydaniem pojazdu. Kupujący jako pracodawca odpowiada za dopełnienie obowiązków wynikających z przepisów prawa pracy dotyczących monitoringu.'),
    p('8.5 ( ) W pojeździe może zostać zainstalowana zdalna blokada rozruchu. Można jej użyć wyłącznie wtedy, gdy pojazd jest zaparkowany, i tylko jeżeli (a) po zawiadomieniu o kradzieży pojazdu Policja tego zażąda lub wyrazi na to zgodę albo (b) Kupujący w danej chwili wyrazi na to pisemną zgodę. Blokady nie stosuje się w celu dochodzenia płatności ani odebrania pojazdu; odebranie pojazdu następuje zgodnie z pkt 9.'),

    h('9. Opóźnienie w zapłacie, naruszenie umowy i odebranie pojazdu'),
    p('9.1 Jeżeli Kupujący pozostaje w zwłoce z zapłatą co najmniej dwóch rat dłużej niż 14 dni albo z zapłatą jednej raty dłużej niż 30 dni, Sprzedawca może wezwać Kupującego na piśmie do zapłaty zaległości, wyznaczając dodatkowy termin nie krótszy niż 14 dni, z zagrożeniem, że po jego bezskutecznym upływie będzie uprawniony, według swojego wyboru:'),
    li('1. zażądać natychmiastowej zapłaty całej pozostałej części ceny wraz z odsetkami naliczonymi do dnia zapłaty; odsetki, o których mowa w pkt 4.4, za okres przyszły nie są należne; albo'),
    li('2. odstąpić od umowy (art. 491 § 1 Kodeksu cywilnego).'),
    p('9.2 Sprzedawca może odstąpić od umowy także wtedy, gdy Kupujący istotnie narusza którykolwiek z poniższych obowiązków i nie usuwa naruszenia w terminie 14 dni od pisemnego wezwania, chyba że naruszenia nie da się usunąć:'),
    li('1. zakazy określone w pkt 5.4;'),
    li('2. obowiązek utrzymywania ubezpieczeń, o których mowa w pkt 7.1 i 7.2;'),
    li('3. obowiązek poddawania pojazdu badaniom technicznym (pkt 6.4);'),
    li('4. zakaz usuwania urządzenia lokalizacyjnego lub zakłócania jego działania (pkt 8.1);'),
    li('5. obowiązek zawiadomienia, o którym mowa w pkt 5.6.'),
    p(`Prawo odstąpienia na podstawie niniejszego punktu Sprzedawca może wykonać w terminie 60 dni od bezskutecznego upływu terminu wyznaczonego w wezwaniu, nie później jednak niż do dnia ${DATE_BLANK}.`),
    p(`9.3 Oświadczenie o odstąpieniu składa się na piśmie. W terminie 7 dni od jego otrzymania Kupujący wydaje Sprzedawcy pojazd wraz z wyposażeniem dodatkowym, dowodem rejestracyjnym, kluczykami i dokumentacją, w miejscu ${BLANK}, a Strony sporządzają protokół zwrotu z opisem stanu pojazdu i stanem licznika. Sprzedawca nie odbiera pojazdu samowolnie; jeżeli Kupujący nie wyda pojazdu dobrowolnie, Sprzedawca dochodzi wydania na drodze sądowej, a egzekucję prowadzi komornik sądowy (art. 1041 Kodeksu postępowania cywilnego).`),
    p('9.4 Po zwrocie pojazdu Strony dokonują rozliczenia. Na rzecz Kupującego zalicza się wszystkie zapłacone przez niego kwoty ceny. Sprzedawcy przysługują:'),
    li('1. wynagrodzenie za korzystanie z pojazdu oraz za jego zużycie i uszkodzenia (art. 591 Kodeksu cywilnego), równe różnicy między ceną netto pojazdu określoną w pkt 4.1 a wartością rynkową netto pojazdu w dniu zwrotu;'),
    li('2. odsetki, o których mowa w pkt 4.4 i 4.5, naliczone do dnia zwrotu pojazdu;'),
    li('3. udokumentowane, uzasadnione koszty odebrania, transportu i wyceny pojazdu.'),
    p(`Wartość rynkową pojazdu w dniu zwrotu Strony ustalają zgodnie; w razie braku porozumienia w terminie 14 dni ustala ją rzeczoznawca samochodowy wskazany przez ${BLANK}, którego koszt Strony ponoszą po połowie. Jeżeli kwoty zaliczone na rzecz Kupującego przewyższają należności Sprzedawcy, Sprzedawca zwraca różnicę Kupującemu w terminie 14 dni od ustalenia rozliczenia; w przeciwnym razie Kupujący dopłaca różnicę w tym samym terminie. Rozliczenie to wyczerpuje wzajemne roszczenia Stron o zwrot świadczeń z tytułu odstąpienia od umowy; nie wyłącza odpowiedzialności za szkodę wyrządzoną umyślnie.`),
    p('9.5 Sprzedawca koryguje fakturę dokumentującą dostawę i rozlicza podatek od towarów i usług w związku z odstąpieniem od umowy zgodnie z obowiązującymi przepisami, przy użyciu Krajowego Systemu e-Faktur. Kwoty rozliczenia, o którym mowa w pkt 9.4, ustala się z uwzględnieniem tego rozliczenia podatkowego.'),
    p('9.6 Do chwili złożenia przez Sprzedawcę oświadczenia o odstąpieniu Kupujący może zachować pojazd, płacąc wszystkie zaległe raty wraz z odsetkami za opóźnienie i należnymi kosztami.'),
    p('9.7 Postanowienia niniejszego punktu nie ograniczają uprawnienia Sprzedawcy do żądania zapłaty wymagalnych rat na zasadach ogólnych ani uprawnienia z art. 458 Kodeksu cywilnego.'),
    p(`9.8 ( ) W terminie 7 dni od zawarcia umowy, nie później niż przed wydaniem pojazdu, Kupujący złoży w formie aktu notarialnego oświadczenie o poddaniu się egzekucji na podstawie art. 777 § 1 pkt 4 Kodeksu postępowania cywilnego co do obowiązku wydania Sprzedawcy pojazdu opisanego w pkt 2 w terminie 7 dni od otrzymania oświadczenia Sprzedawcy o odstąpieniu od umowy oraz co do obowiązku zapłaty ceny w kwocie ${zl(d.price.gross)} w terminach wynikających z harmonogramu. Koszty aktu notarialnego ponosi ( ) Kupujący ( ) Sprzedawca.`),
    p('9.9 Jeżeli sprzedaż kończy się odebraniem pojazdu przez Sprzedawcę albo rozwiązaniem umowy za porozumieniem Stron, Sprzedawca niezwłocznie odnotowuje zakończenie sprzedaży w serwisie RAHTIS. Od tej chwili serwis nie przygotowuje dalszych wyliczeń rat ani nie wysyła przypomnień o płatnościach. Odnotowanie nie zmienia praw ani obowiązków Stron; rozliczenie, o którym mowa w pkt 9.4, Strony przeprowadzają między sobą.'),

    h('10. Udostępnianie danych w serwisie RAHTIS'),
    p('10.1 Strony postanawiają, że przez okres obowiązywania umowy Sprzedawca ma w serwisie RAHTIS wgląd w stan licznika pojazdu, dane o przeglądach, usterkach, oględzinach i badaniach technicznych, stan płatności oraz lokalizację w granicach określonych w pkt 8. Dane o zleceniach przewozowych i przychodach z pojazdu są udostępniane Sprzedawcy wyłącznie w postaci zestawienia miesięcznego i tylko wtedy, gdy Kupujący odrębnie wyraził na to zgodę w serwisie.'),
    p('10.2 Aivomaa Oy (RAHTIS) nie jest stroną niniejszej umowy. Aivomaa Oy udostępnia Stronom wyłącznie wyliczenia, wzory dokumentów i przypomnienia o płatnościach; nie finansuje sprzedaży, nie udziela poręczenia ani gwarancji, nie pośredniczy w płatnościach, nie dochodzi należności, nie wystawia faktur i nie odpowiada za wykonanie zobowiązań Stron. Aivomaa Oy przetwarza dane osobowe w imieniu Stron na podstawie regulaminu serwisu i umowy powierzenia przetwarzania danych osobowych.'),

    h('11. Postanowienia końcowe'),
    p('11.1 Sprzedawca może przenieść wierzytelności z niniejszej umowy wraz z zastrzeżoną własnością pojazdu na bank lub inną instytucję finansową. O przeniesieniu zawiadamia Kupującego na piśmie; po otrzymaniu zawiadomienia Kupujący może skutecznie płacić wyłącznie nabywcy.'),
    p('11.2 Zawiadomienia związane z umową Strony składają na piśmie lub w postaci elektronicznej na adresy poczty elektronicznej wskazane w pkt 1. Zawiadomienie wysłane pocztą elektroniczną uważa się za doręczone w następnym dniu roboczym po dniu wysłania. Oświadczenie o odstąpieniu od umowy oraz wezwanie, o którym mowa w pkt 9.1 i 9.2, składa się ponadto listem poleconym albo opatruje kwalifikowanym podpisem elektronicznym.'),
    p('11.3 Umowa podlega prawu polskiemu. W sprawach nieuregulowanych stosuje się przepisy Kodeksu cywilnego, w szczególności art. 589–591.'),
    p('11.4 Spory wynikające z umowy rozstrzyga sąd właściwy miejscowo dla siedziby Sprzedawcy.'),
    p('11.5 Zmiany umowy wymagają formy pisemnej albo formy elektronicznej pod rygorem nieważności.'),
    p('11.6 Umowę zawiera się przed wydaniem pojazdu: w formie elektronicznej, przez opatrzenie jej kwalifikowanymi podpisami elektronicznymi obu Stron oraz kwalifikowanym elektronicznym znacznikiem czasu, albo w formie pisemnej w dwóch jednobrzmiących egzemplarzach, po jednym dla każdej ze Stron, z urzędowym poświadczeniem daty przez notariusza. Strony zgodnie stwierdzają, że umowa ma datę pewną w rozumieniu art. 81 Kodeksu cywilnego, a zastrzeżenie własności jest stwierdzone pismem (art. 590 § 1 Kodeksu cywilnego).'),

    h('12. Podpisy'),
    p(`Miejscowość i data: ${LONG_BLANK}`),
    { kind: 'sign', left: [`Sprzedawca: ${d.seller.name}`, 'imię i nazwisko, funkcja'], right: [`Kupujący: ${d.buyer.name}`, 'imię i nazwisko, funkcja'] },
    p(`Załączniki: 1. Harmonogram spłat · 2. Protokół zdawczo-odbiorczy (zawiera wzmiankę: „Pojazd został wydany Kupującemu w dniu ${DATE_BLANK} o godz. __:__, po podpisaniu umowy nr ${d.number} i uzyskaniu przez nią daty pewnej.”) · 3. Potwierdzenie pierwszej wpłaty i numer faktury w Krajowym Systemie e-Faktur · 4. Umowa serwisowa · 5. Informacja o przetwarzaniu danych dla kierowców`),
  ];

  const annexes: ContractBlock[] = [
    { kind: 'annex', text: 'Załącznik nr 1 – Harmonogram spłat' },
    {
      kind: 'meta',
      text: `Umowa nr ${d.number} · Cena brutto ${zl(d.price.gross)} · Pierwsza wpłata ${zl(d.price.downGross)} · Pozostała część ceny ${zl(d.price.rest)} · Oprocentowanie ${d.ratePercent ?? '0'} % rocznie`,
    },
    {
      kind: 'table',
      head: ['Nr raty', 'Termin płatności', 'Rata (część ceny), zł', 'Odsetki (pkt 4.4), zł', 'Razem do zapłaty, zł', 'Saldo po zapłacie, zł'],
      rows: d.plan.map((r) => [String(r.n), r.due, bareZl(r.principal), bareZl(r.interest), bareZl(r.total), bareZl(r.balance)]),
      /* Итог — как в шаблоне: рата 1–N, проценты и всё вместе, без первой wpłaty. */
      foot: ['Razem', '', bareZl(d.planTotals.principal), bareZl(d.planTotals.interest), bareZl(d.planTotals.instalments), ''],
    },
    p(`Kwoty odsetek obliczono przy założeniu wydania pojazdu w dniu ${d.handover} i terminowej spłaty.`),

    { kind: 'annex', text: 'Załącznik nr 2 – Protokół zdawczo-odbiorczy' },
    { kind: 'meta', text: `Do umowy nr ${d.number} z dnia ${d.date}.` },
    kv('Pojazd', d.vehicle.make),
    kv('Numer rejestracyjny / VIN', `${d.vehicle.plate} / ${LONG_BLANK}`),
    kv('Data i godzina wydania', `${DATE_BLANK}, godz. __:__`),
    kv('Miejsce wydania', LONG_BLANK),
    kv('Stan licznika', `${BLANK} km`),
    kv('Poziom paliwa / AdBlue', `${BLANK} / ${BLANK}`),
    kv('Ogumienie (marka, głębokość bieżnika)', LONG_BLANK),
    kv('Stwierdzone wady i uszkodzenia', `${LONG_BLANK}, zdjęcia nr ${BLANK}`),
    kv('Wyposażenie dodatkowe', LONG_BLANK),
    kv('Wydane dokumenty', `dowód rejestracyjny, ${BLANK}`),
    kv('Liczba kluczyków', BLANK),
    kv('Urządzenie lokalizacyjne', `( ) zainstalowane, nr ${BLANK}  ( ) brak`),
    kv('Ubezpieczenie OC / autocasco', `polisa nr ${BLANK} / polisa nr ${BLANK}`),
    p(`Pojazd został wydany Kupującemu w dniu ${DATE_BLANK} o godz. __:__, po podpisaniu umowy nr ${d.number} i uzyskaniu przez nią daty pewnej. Kupujący potwierdza odbiór pojazdu w stanie opisanym powyżej. Pojazd pozostaje własnością Sprzedawcy do chwili zapłaty całej ceny.`),
    { kind: 'sign', left: [`Sprzedawca: ${d.seller.name}`, ''], right: [`Kupujący: ${d.buyer.name}`, ''] },
  ];

  return {
    title: `Umowa sprzedaży pojazdu na raty ${d.number}`,
    author: d.seller.name,
    footer: `Umowa ${d.number} · przygotowana w serwisie RAHTIS; Aivomaa Oy nie jest stroną umowy`,
    pages: [main, annexes],
  };
}
