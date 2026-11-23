import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import { PDF_FONT } from '@/lib/reports/pdfFont';
import { ansi } from '@/lib/reports/PeriodReportPdf';

/**
 * Osamaksusopimus — договор рассрочки между компаниями (22.11.2026).
 *
 * Текст — шаблон docs/equipment-sale/osamaksusopimus-pohja.md v0.2 (после
 * независимой проверки по закону 91/1966, VNA 790/2010, KKO 2016:46,
 * 2009:13, 2008:15). Обязательное по VNA 790/2010: заголовок
 * «Osamaksusopimus», на первой странице крупнее остального текста —
 * оговорка о сохранении права собственности; стороны с адресами;
 * предмет; поставка; käteishinta, взнос, проценты; срок, число и размер
 * взносов, даты; просрочка; досрочное погашение по 3 и 5 §; орган для
 * tilitys; ссылка на закон. Чего в RAHTIS нет (VIN, номер лицензии,
 * выбор страховщика), — поля для заполнения от руки.
 *
 * 22.11.2026: п. 5.3 — срок покупателя от дня перехода права собственности
 * (ajoneuvolaki 84 §); новый п. 9.8 — запись о прекращении сделки в RAHTIS.
 * Тот же текст — в docs/equipment-sale/osamaksusopimus-pohja.md.
 */

export type ContractPdfInput = {
  number: string;
  date: string;
  seller: Party;
  buyer: Party;
  vehicle: { make: string; plate: string; odometer: string };
  price: {
    net: string;
    vatLabel: string;
    vat: string;
    gross: string;
    downGross: string;
    rest: string;
    interestTotal: string | null;
    installmentPrice: string;
    tenth: string;
    twentieth: string;
    /*
     * Для договоров Швеции и Дании (23.11.2026); финский шаблон их не читает.
     * creditClaim — kreditfordran: часть цены в кредит и все проценты;
     * totalPayable — вся сумма к уплате: цена с НДС и все проценты.
     */
    creditClaim: string;
    totalPayable: string;
  };
  vatMode: 'STANDARD' | 'MARGIN' | 'EXEMPT' | 'NONE';
  months: number;
  ratePercent: string | null;
  handover: string;
  schedule: { n: number; due: string; principal: string; interest: string }[];
  /*
   * Ниже — поля для договоров других стран (23.11.2026, contractText/):
   * финский шаблон их не читает и печатается как раньше.
   */
  /** Ставка НДС числом на языке договора: «24», «25,5». */
  vatPercent: string;
  /** Взнос без НДС (часть цены), входящий в первый счёт. */
  down: string;
  /** Номер первого счёта, если он уже выставлен; иначе null — в договоре остаётся прочерк. */
  firstInvoiceNumber: string | null;
  /** График с итогом строки и остатком цены после платежа — для приложения 1. */
  plan: { n: number; due: string; principal: string; interest: string; total: string; balance: string }[];
  /** Итоги графика: взносы 1–N (без первого счёта), проценты, всё вместе с первым счётом. */
  planTotals: { principal: string; interest: string; all: string };
  /** Число месяца, на которое приходятся взносы (по первому сроку). */
  dueDay: number;
};

type Party = { name: string; businessId: string; address: string; vatRegistered: boolean; email: string; phone: string };

const s = StyleSheet.create({
  page: { fontFamily: PDF_FONT, paddingTop: 36, paddingBottom: 48, paddingHorizontal: 44, fontSize: 8.6, lineHeight: 1.35, color: '#111' },
  title: { fontSize: 20, fontWeight: 'bold', lineHeight: 1.2 },
  annex: { fontSize: 14, fontWeight: 'bold', lineHeight: 1.25, marginBottom: 4 },
  notice: { marginTop: 10, padding: 8, borderWidth: 1.2, borderColor: '#111', fontSize: 12.5, fontWeight: 'bold' },
  meta: { marginTop: 6, color: '#333' },
  h: { fontSize: 10, fontWeight: 'bold', marginTop: 12, marginBottom: 3 },
  p: { marginBottom: 4 },
  row: { flexDirection: 'row', gap: 16 },
  col: { flex: 1 },
  kv: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#ccc', paddingVertical: 2 },
  k: { width: 260, color: '#333' },
  v: { flex: 1 },
  bold: { fontWeight: 'bold' },
  sign: { marginTop: 26, flexDirection: 'row', gap: 30 },
  line: { marginTop: 28, borderTopWidth: 0.8, borderTopColor: '#111', paddingTop: 3 },
  tHead: { flexDirection: 'row', borderBottomWidth: 0.8, borderBottomColor: '#111', paddingBottom: 2, fontWeight: 'bold' },
  tRow: { flexDirection: 'row', borderBottomWidth: 0.4, borderBottomColor: '#ddd', paddingVertical: 1.5 },
  footer: { position: 'absolute', bottom: 22, left: 44, right: 44, fontSize: 7, color: '#777', flexDirection: 'row', justifyContent: 'space-between' },
});

const P = ({ children }: { children: string }) => <Text style={s.p}>{ansi(children)}</Text>;
const H = ({ children }: { children: string }) => <Text style={s.h}>{ansi(children)}</Text>;
const KV = ({ k, v }: { k: string; v: string }) => (
  <View style={s.kv} wrap={false}>
    <Text style={s.k}>{ansi(k)}</Text>
    <Text style={s.v}>{ansi(v)}</Text>
  </View>
);

function PartyBlock({ label, p, extra }: { label: string; p: Party; extra?: string }) {
  return (
    <View style={s.col}>
      <Text style={s.bold}>{ansi(label)}</Text>
      <Text>{ansi(p.name)}</Text>
      <Text>{ansi(`Y-tunnus ${p.businessId}`)}</Text>
      <Text>{ansi(`Käyntiosoite: ${p.address || '______________________'}`)}</Text>
      <Text>{ansi(`Arvonlisäverorekisterissä: ${p.vatRegistered ? 'kyllä' : 'ei'}`)}</Text>
      {extra ? <Text>{ansi(extra)}</Text> : null}
      <Text>{ansi(`Yhteyshenkilö: ______________________`)}</Text>
      <Text>{ansi(`Puhelin: ${p.phone || '______________'} · Sähköposti: ${p.email || '______________'}`)}</Text>
    </View>
  );
}

export function ContractPdf(d: ContractPdfInput) {
  const vatText =
    d.vatMode === 'STANDARD'
      ? 'Myyjä laskuttaa ensimmäisellä laskulla käteismaksuosuuden, joka sisältää koko kauppahinnan arvonlisäveron. Lasku erääntyy ennen luovutusta. Veron suorittamisvelvollisuus syntyy ennen luovutusta maksetun käteismaksuosuuden osalta maksun kertyessä ja muilta osin ajoneuvon luovutuksessa (arvonlisäverolain 15 §:n 1 momentin 1 ja 2 kohta).'
      : d.vatMode === 'MARGIN'
        ? 'Myyjä on arvonlisäverolain 79 a §:n 3 momentissa tarkoitettu verovelvollinen jälleenmyyjä, joka on hankkinut ajoneuvon edelleenmyyntiä varten lain 79 f §:n edellytysten mukaisesti. Laskussa ei eritellä arvonlisäveroa, ja siihen merkitään ”voittomarginaalijärjestelmä – käytetyt tavarat”. Ostaja ei voi vähentää kauppahintaan sisältyvää veroa. Käsiraha laskutetaan ensimmäisellä laskulla, joka erääntyy ennen luovutusta.'
        : d.vatMode === 'EXEMPT'
          ? 'Ajoneuvo ei ole ollut myyjällä vähennykseen oikeuttavassa käytössä, joten myynnistä ei suoriteta arvonlisäveroa (arvonlisäverolain 61 §). Laskuun merkitään ”veroton myynti, AVL 61 §”. Käsiraha laskutetaan ensimmäisellä laskulla, joka erääntyy ennen luovutusta.'
          : 'Myyjä ei ole arvonlisäverovelvollinen, eikä kauppahintaan sisälly arvonlisäveroa. Käsiraha laskutetaan ensimmäisellä laskulla, joka erääntyy ennen luovutusta.';

  return (
    <Document title={ansi(`Osamaksusopimus ${d.number}`)} author={ansi(d.seller.name)}>
      <Page size="A4" style={s.page}>
        <Text style={s.title}>OSAMAKSUSOPIMUS</Text>
        <Text style={s.notice}>
          {ansi('OMISTUSOIKEUS KAUPAN KOHTEESEEN EI SIIRRY OSTAJALLE ENNEN KUIN KAUPPAHINTA ON KOKONAAN MAKSETTU.')}
        </Text>
        <Text style={s.meta}>{ansi(`Sopimus nro ${d.number} · Päiväys ${d.date}`)}</Text>

        <H>1. Sopimusosapuolet</H>
        <View style={s.row}>
          <PartyBlock label="Myyjä" p={d.seller} />
          <PartyBlock label="Ostaja" p={d.buyer} extra="Tavaraliikennelupa nro: ______________" />
        </View>
        <P>Luotonantajana on myyjä. Ostaja vakuuttaa tekevänsä tämän kaupan elinkeinotoimintaansa varten.</P>

        <H>2. Kaupan kohde</H>
        <KV k="Ajoneuvo" v={d.vehicle.make} />
        <KV k="Rekisteritunnus" v={d.vehicle.plate} />
        <KV k="Valmistenumero (VIN)" v="______________________________" />
        <KV k="Käyttöönottovuosi" v="__________" />
        <KV k="Matkamittarilukema sopimusta tehtäessä" v={d.vehicle.odometer} />
        <KV k="Lisävarusteet" v="ei lisävarusteita / ________________________" />
        <KV k="Voimassa olevat kiinnitykset" v="( ) ei kiinnityksiä  ( ) kiinnitys: ________________" />
        <P>2.1 Myyjä vakuuttaa, että se omistaa ajoneuvon ja sen lisävarusteet, että niihin ei kohdistu kolmannen omistuksenpidätystä, takaisinotto-oikeutta, panttioikeutta tai kiinnitystä, jota ei ole mainittu edellä, ja että sillä on oikeus myydä ajoneuvo tämän sopimuksen ehdoin. Myyjä toimittaa ostajalle ennen sopimuksen allekirjoittamista ajoneuvon rekisteriotteen.</P>
        <P>2.2 Ajoneuvo myydään luovutustarkastuspöytäkirjassa (liite 2) kuvatussa kunnossa. Ostajan on ilmoitettava virheestä myyjälle kirjallisesti kohtuullisessa ajassa siitä, kun se havaitsi tai sen olisi pitänyt havaita virhe.</P>

        <H>3. Toimitus</H>
        <P>{`3.1 Toimitustapa: ( ) nouto myyjältä  ( ) myyjä toimittaa osoitteeseen ______________. Toimitusaika: ${d.handover}.`}</P>
        <P>3.2 Ajoneuvo luovutetaan vasta, kun 1) tämä sopimus on allekirjoitettu; 2) ensimmäinen lasku (kohta 4.2) on maksettu myyjän tilille; 3) ostaja on merkitty liikenneasioiden rekisteriin ajoneuvon haltijaksi, ja myyjä on edelleen merkittynä sen omistajaksi; 4) ajoneuvolle on otettu kohdan 7.1 mukainen liikennevakuutus, joka on voimassa luovutuspäivästä alkaen, ja kohdan 7.2 mukainen vahvistus on toimitettu; ja 5) ajoneuvon käyttötarkoitukseksi on ilmoitettu luvanvarainen käyttö.</P>
        <P>3.3 Luovutuksessa osapuolet tekevät luovutustarkastuksen ja allekirjoittavat pöytäkirjan (liite 2), johon merkitään luovutuksen ajankohta. Vaaranvastuu siirtyy ostajalle luovutuksessa.</P>

        <H>4. Hinta ja maksaminen</H>
        <Text style={[s.p, s.bold]}>4.1 Hinta</Text>
        <KV k={d.vatMode === 'STANDARD' ? 'Ajoneuvon käteishinta (veroton)' : 'Ajoneuvon käteishinta'} v={d.price.net} />
        {d.vatMode === 'STANDARD' ? <KV k={d.price.vatLabel} v={d.price.vat} /> : null}
        {d.vatMode === 'STANDARD' ? <KV k="Käteishinta yhteensä (sisältää arvonlisäveron)" v={d.price.gross} /> : null}
        <KV k="Käteismaksuosuus, maksetaan ennen luovutusta" v={d.price.downGross} />
        <KV k="Loppuosa kauppahinnasta (ei sisällä arvonlisäveroa)" v={d.price.rest} />
        <KV k="Luottokustannukset: erikseen maksettava korko" v={d.price.interestTotal ?? 'ei korkoa'} />
        <KV k="Osamaksuhinta (käteismaksuosuus ja maksuerät yhteensä)" v={d.price.installmentPrice} />
        <P>
          {d.vatMode === 'STANDARD'
            ? 'Tässä sopimuksessa käteishinnalla ja osamaksuhinnalla tarkoitetaan arvonlisäverollisia määriä. Koska korko maksetaan erikseen, käteishinta ja osamaksuhinta ovat yhtä suuret.'
            : 'Koska korko maksetaan erikseen, käteishinta ja osamaksuhinta ovat yhtä suuret.'}
        </P>
        <Text style={[s.p, s.bold]}>4.2 Ensimmäinen lasku ja arvonlisävero</Text>
        <P>{vatText}</P>
        <Text style={[s.p, s.bold]}>4.3 Maksuerät</Text>
        <P>{`Luottoaika ${d.months} kuukautta, maksuerien lukumäärä ${d.months}. Maksuerien suuruus ja eräpäivät: maksusuunnitelma (liite 1). Maksuerät eivät sisällä arvonlisäveroa.`}</P>
        <Text style={[s.p, s.bold]}>4.4 Korko</Text>
        <P>
          {d.ratePercent
            ? `Kauppahinnan loppuosalle peritään luovutuspäivästä alkaen kiinteää ${d.ratePercent} prosentin vuotuista korkoa. Korko lasketaan kulloinkin maksamatta olevalle loppuosalle todellisten päivien mukaan (todelliset päivät / 365), ja se maksetaan kunkin maksuerän yhteydessä erikseen. Maksusuunnitelman mukaan maksettaessa koron yhteismäärä on ${d.price.interestTotal} (liite 1). Korko on veroton rahoituspalvelu (arvonlisäverolain 41 §).`
            : 'Kauppahinnan loppuosalle ei peritä korkoa.'}
        </P>
        <P>Myyjä ei peri ostajalta korkoa tai maksuja, joista ei ole sovittu tässä sopimuksessa (osamaksukaupasta annetun lain 1 c §:n 3 momentti).</P>
        <Text style={[s.p, s.bold]}>4.5 Viivästyskorko</Text>
        <P>Viivästyneelle määrälle maksetaan eräpäivästä alkaen viivästyskorkoa korkolain (633/1982) 4 a §:n mukaisesti eli kahdeksan prosenttiyksikköä yli kulloinkin voimassa olevan korkolain 12 §:ssä tarkoitetun viitekoron. Jos kohdan 4.4 mukainen korko on tätä korkeampi, viivästyskorko määräytyy korkolain 4 a §:n 2 momentin mukaisesti.</P>
        <Text style={[s.p, s.bold]}>4.6 Ennenaikainen maksaminen</Text>
        <P>Ostajalla on oikeus maksaa koko loppuosa tai osa siitä sovittua aikaisemmin. Myyjän saatava lasketaan tällöin osamaksukaupasta annetun lain (91/1966) 3 ja 5 §:n mukaisesti.</P>
        <Text style={[s.p, s.bold]}>4.7 Muut maksut</Text>
        <P>Ostaja maksaa maksumuistutuksesta 5 euroa. Myyjällä on lisäksi oikeus korvaukseen perintäkuluista saatavien perinnästä annetun lain (513/1999) 10 ja 10 i §:n mukaisesti sekä takaisinotosta aiheutuneisiin kustannuksiin osamaksukaupasta annetun lain 3 §:n 2 momentin 4 kohdan mukaisesti. Ajoneuvon rekisteröinnistä aiheutuvat viranomaismaksut maksaa ostaja. Muita maksuja ei peritä.</P>
        <Text style={[s.p, s.bold]}>4.8 Suoritusten kohdentaminen</Text>
        <P>Ostajan suoritukset käytetään vain tämän sopimuksen mukaisten saatavien maksamiseen: ensin erääntyneisiin kuluihin ja korkoihin ja sen jälkeen maksueriin vanhimmasta alkaen.</P>

        <H>5. Omistuksenpidätys, rekisteröinti ja käyttö</H>
        <P>5.1 Omistusoikeus ajoneuvoon säilyy myyjällä ja siirtyy ostajalle, kun osamaksuhinta ja kohdan 4.4 mukainen korko on maksettu kokonaan. Omistusoikeuden siirtymisen ehtona ei ole muiden kuin tähän sopimukseen perustuvien velkojen maksaminen.</P>
        <P>5.2 Myyjä tekee haltijaa koskevan rekisteri-ilmoituksen viimeistään luovutuspäivänä (ajoneuvolaki 82/2021 83 ja 84 §). Ostaja nimeää rekisteriin käyttövastaavan ja liittää ajoneuvon tavaraliikenneluvalleen ennen kuin käyttää sitä luvanvaraisessa liikenteessä (laki liikenteen palveluista 320/2017 17 §). Ajoneuvo on ostajan yksinomaisessa hallinnassa, eikä myyjää merkitä rekisteriin haltijaksi. Ajoneuvoverosta vastaa ostaja rekisteriin merkittynä haltijana (ajoneuvoverolaki 1281/2003 5 §).</P>
        {/* 5.3 (22.11.2026): семь дней покупателя считаются от перехода права собственности — дня последнего платежа, а не от уведомления продавца (ajoneuvolaki 82/2021 84 §). */}
        <P>5.3 Kun osamaksuhinta ja korko on maksettu kokonaan, omistusoikeus siirtyy ostajalle sinä päivänä, jona viimeinen suoritus on kirjattu myyjän tilille (luovutuspäivä). Myyjä tekee luovutusilmoituksen viipymättä, ja ostaja ilmoittaa itsensä omistajaksi seitsemän päivän kuluessa luovutuspäivästä (ajoneuvolaki 82/2021 84 §).</P>
        <P>5.4 Ostaja ei saa ennen omistusoikeuden siirtymistä ilman myyjän kirjallista suostumusta 1) myydä, vaihtaa tai lahjoittaa ajoneuvoa; 2) pantata ajoneuvoa tai hakea siihen kiinnitystä; 3) vuokrata, lainata tai muutoin luovuttaa ajoneuvoa kolmannen hallintaan tai käyttöön; 4) rekisteröidä ajoneuvoa toiseen valtioon; 5) tehdä ajoneuvoon muutoksia, jotka edellyttävät muutoskatsastusta; 6) liittää ajoneuvoa tai sen lisävarusteita muuhun omaisuuteen taikka irrottaa ajoneuvosta lisävarusteita luovuttaakseen ne edelleen. Kohdan 3 tarkoittamana luovutuksena ei pidetä sitä, että ajoneuvoa kuljettavat ostajan omassa liikenteessä ostajan palveluksessa olevat tai sille vuokratyönä työskentelevät kuljettajat.</P>
        <P>5.5 Ostaja saa käyttää ajoneuvoa omassa liikenteessään sopimusalueella, joka on ETA-valtiot ja Sveitsi. Ajoneuvon käyttö sopimusalueen ulkopuolella edellyttää myyjän etukäteen antamaa kirjallista suostumusta.</P>

        <H>6. Kunnossapito ja katsastus</H>
        <P>6.1 Määräaikaishuolto ei sisälly kauppahintaan. Jos osapuolet sopivat, että myyjä huoltaa ajoneuvon, siitä tehdään erillinen huoltosopimus (liite 4), jossa sovitaan huollon sisällöstä, hinnasta ja laskutuksesta. Huolto laskutetaan arvonlisäverollisena sen suorittamisen jälkeen.</P>
        <P>6.2 Ostaja vastaa kaikista muista ajoneuvon käytöstä ja ylläpidosta aiheutuvista kuluista, kuten korjauksista, renkaista, laseista, jarruista, polttoaineesta, AdBluesta ja pesuista.</P>
        <P>6.3 Ostaja pitää ajoneuvon hyvässä kunnossa, käyttää sitä sen käyttötarkoituksen mukaisesti ja ilmoittaa myyjälle viipymättä vahingoista ja vioista, jotka voivat olennaisesti alentaa ajoneuvon arvoa.</P>
        <P>6.4 Ostaja katsastuttaa ajoneuvon määräaikaisesti ajoneuvolain 149 §:n mukaisesti ennen määräpäivää ja toimittaa katsastustodistuksen tai -pöytäkirjan myyjälle RAHTIS-palvelun kautta tai muutoin kirjallisesti.</P>
        <P>6.5 Myyjän tarkastusoikeus: myyjällä on oikeus tarkastaa ajoneuvo ( ) kahden ( ) kolmen kuukauden välein ennalta sovittuna aikana ostajan toimipaikassa. Tarkastuksesta laaditaan pöytäkirja.</P>

        <H>7. Vakuutukset</H>
        <P>7.1 Ajoneuvolla on oltava voimassa oleva liikennevakuutus koko sopimuksen ajan. Omistaja ja haltija vastaavat vakuuttamisvelvollisuudesta yhteisvastuullisesti (liikennevakuutuslaki 460/2016 6 §). Vakuutuksen ottaa ja maksaa ( ) ostaja ( ) myyjä. Jos vakuutuksen ottaa myyjä, ostaja hyvittää myyjälle vakuutusmaksun ______________ kunkin maksuerän yhteydessä erikseen.</P>
        <P>7.2 Ostaja ottaa ja maksaa ajoneuvolle kaskovakuutuksen, joka kattaa vähintään törmäys-, palo-, varkaus- ja ilkivaltavahingot, omavastuu enintään ________ euroa. Myyjä merkitään vakuutuskirjaan nimeltä vakuutetuksi ajoneuvon omistajana (vakuutussopimuslaki 543/1994 62, 65 ja 66 §). Ostaja toimittaa myyjälle ennen luovutusta vakuutuksenantajan kirjallisen vahvistuksen siitä, että myyjä on merkitty vakuutetuksi ja että vakuutuksenantaja ilmoittaa myyjälle vakuutuksen päättymisestä.</P>
        <P>7.3 Jos ajoneuvo tuhoutuu tai katoaa, ostajan maksuvelvollisuus jatkuu. Myyjälle maksettu vakuutuskorvaus luetaan ostajan hyväksi ennenaikaisena maksuna, ja myyjän saatava lasketaan osamaksukaupasta annetun lain 5 §:n 3 momentin ja 3 §:n mukaisesti. Korvausta käytetään vain tähän sopimukseen perustuvan saatavan maksamiseen. Ylimenevä osa maksetaan ostajalle viipymättä.</P>

        <H>8. Paikannus</H>
        <P>8.1 Ajoneuvossa on sopimuksen ajan myyjän asentama tai hyväksymä paikannuslaite. Ostaja ei saa poistaa laitetta tai estää sen toimintaa.</P>
        <P>8.2 Myyjä näkee vain matkamittarilukeman ja sen, onko ajoneuvo sopimusalueella (kohta 5.5). Tarkka sijainti näytetään myyjälle vain, jos 1) ajoneuvon anastuksesta on tehty rikosilmoitus; 2) ajoneuvo on ollut sopimusalueen ulkopuolella yli 24 tuntia ilman myyjän suostumusta; tai 3) kohdan 9.1 mukaiset takaisinoton edellytykset ovat täyttyneet tai sopimus on purettu.</P>
        <P>8.3 Myyjä on paikannustietojen rekisterinpitäjä. Tietoja käsitellään myyjän omistusoikeuden suojaamiseksi, ja käsittely perustuu myyjän oikeutettuun etuun (EU:n yleisen tietosuoja-asetuksen (EU) 2016/679 6 artiklan 1 kohdan f alakohta). Myyjä ei käytä paikannustietoja kuljettajien työajan, ajotavan tai muun työsuorituksen seurantaan. Tarkan sijainnin jokainen katselu ja sen peruste kirjataan, ja ostajalle ilmoitetaan siitä viimeistään 3 päivän kuluessa, jollei ilmoitus vaaranna rikoksen selvittämistä. Tarkat sijaintitiedot poistetaan 30 päivän kuluttua tai, jos ne on avattu kohdan 8.2 perusteella, kun asia on käsitelty loppuun.</P>
        <P>8.4 Myyjä laatii kuljettajia varten tietosuoja-asetuksen 14 artiklan mukaisen informaation, ja ostaja toimittaa sen kuljettajilleen ennen luovutusta. Ostaja vastaa työnantajana siitä, että työelämän tietosuojalain (759/2004) 21 §:n mukainen yhteistoimintamenettely tai kuuleminen on tarvittaessa käyty.</P>
        <P>8.5 Jos ajoneuvoon asennetaan etäkäynnistyksenesto, sitä saa käyttää vain ajoneuvon ollessa pysäköitynä ja vain, jos a) poliisi sitä pyytää tai siihen suostuu ajoneuvon anastusta koskevan rikosilmoituksen jälkeen, tai b) ostaja antaa siihen kirjallisen suostumuksensa kyseisellä hetkellä. Käynnistyksenestoa ei käytetä maksujen perimiseen eikä ajoneuvon takaisinottoon; takaisinotto tapahtuu kohdan 9 mukaisesti.</P>

        <H>9. Maksun viivästyminen, sopimusrikkomus ja takaisinotto</H>
        <P>{`9.1 Jos ostaja jättää maksun suorittamatta, myyjällä ei ole oikeutta ottaa ajoneuvoa takaisin tai vaatia maksuerää, joka muuten ei ole erääntynyt, eikä saattaa voimaan muuta sopimuksessa määrättyä erityistä seuraamusta, ellei maksamatta jätetty määrä ole ollut suorittamatta vähintään neljätoista päivää eräpäivästä lukien ja ole edelleen maksamatta ja ellei tämä määrä ole vähintään kymmenesosa tai, jos siihen sisältyy kaksi tai useampia maksueriä, vähintään kahdeskymmenesosa osamaksuhinnasta taikka käsitä myyjän koko jäännössaatavaa (osamaksukaupasta annetun lain 2 §). Tämän sopimuksen osamaksuhinnasta laskettuna kymmenesosa on ${d.price.tenth} ja kahdeskymmenesosa ${d.price.twentieth}.`}</P>
        <P>9.2 Jos kohdan 9.1 edellytykset täyttyvät, myyjä voi kirjallisella ilmoituksella vaatia koko maksamatta olevan kauppahinnan maksettavaksi heti. Myyjän saatava lasketaan tällöin osamaksukaupasta annetun lain 8 ja 3 §:n mukaisesti, eikä erääntymättömälle ajalle kohdistuvaa korkoa peritä.</P>
        <P>9.3 Myyjällä on oikeus ottaa ajoneuvo takaisin myös, jos ostaja olennaisesti rikkoo jotakin seuraavista velvollisuuksistaan eikä korjaa rikkomusta 14 päivän kuluessa myyjän kirjallisesta huomautuksesta, jollei rikkomus ole luonteeltaan sellainen, ettei sitä voida korjata: 1) kohdan 5.4 kiellot; 2) kohdan 5.2 rekisteröinti- ja liikennelupavelvollisuudet; 3) velvollisuus pitää voimassa kohtien 7.1 ja 7.2 mukaiset vakuutukset, kun vakuutus on päättynyt tai lakannut kattamasta ajoneuvoa mistä syystä tahansa; 4) määräaikaiskatsastus (kohta 6.4); 5) kielto poistaa paikannuslaite tai estää sen toiminta (kohta 8.1).</P>
        <P>9.4 Takaisinotossa myyjän ja ostajan välillä toimitetaan osamaksutilitys. Ajoneuvon arvo määrätään sen mukaan, mitä myyjälle voidaan olettaa jäävän, kun ajoneuvo myydään tarkoituksenmukaisella tavalla ja tarvittaessa kohtuullisesti kunnostettuna. Arvoa määrättäessä otetaan huomioon myös tässä sopimuksessa mainittu käteishinta sekä se, kuinka kauan ajoneuvo on ollut ostajan hallinnassa ja miten siitä on pidetty huolta. Jos ajoneuvon arvo on suurempi kuin myyjän hyväksi luettava määrä, myyjä suorittaa erotuksen ostajalle tai tallettaa sen ulosottomiehelle ennen kuin saa ajoneuvon haltuunsa. Jos arvo on pienempi, myyjällä on ajoneuvon lisäksi oikeus vaatia ostajalta enintään näiden määrien erotus (osamaksukaupasta annetun lain 3 ja 4 §).</P>
        <P>9.5 Jos ostaja on takaisinottohetkellä arvonlisäverovelvollinen ja ajoneuvo on ollut sen vähennykseen oikeuttavassa käytössä, ostaja antaa myyjälle takaisinottoarvosta arvonlisäverollisen laskun, ja ostajan hyväksi luetaan takaisinottoarvo lisättynä arvonlisäverolla. Muussa tapauksessa, erityisesti jos ostajan arvonlisäverovelvollisuus on päättynyt konkurssin tai muun syyn vuoksi, takaisinottoarvo luetaan ostajan hyväksi ilman arvonlisäveroa.</P>
        <P>9.6 Kun myyjä on vaatinut ajoneuvoa takaisin, ostaja voi pitää ajoneuvon maksamalla kerralla sen määrän, joka osamaksukaupasta annetun lain 3 §:n mukaan on luettava myyjän hyväksi. Jos myyjä on jo ottanut ajoneuvon takaisin, ostaja voi lunastaa sen 14 päivän kuluessa takaisinotosta maksamalla ajoneuvon takaisinottoarvon sekä lain 4 §:n 2 momentin mukaisen erotuksen (lain 5 §).</P>
        <P>9.7 Osamaksutilityksissä toimivaltainen viranomainen on ajoneuvon sijaintipaikkakunnan tai ostajan kotipaikan ulosottomies (Ulosottolaitos). Jos osapuolet eivät sovi tilityksestä, sen toimittaa ulosottomies (osamaksukaupasta annetun lain 9 §:n 1 momentti ja 12 §).</P>
        {/* 9.8 (22.11.2026): прекращение сделки продавец записывает в RAHTIS — счета через сервис прекращаются; взаиморасчёт — дело сторон. */}
        <P>9.8 Jos kauppa päättyy siihen, että myyjä ottaa ajoneuvon takaisin, tai siihen, että osapuolet sopivat kaupan purkamisesta, myyjä kirjaa kaupan päättymisen RAHTIS-palveluun viipymättä. Kirjauksesta alkaen palvelun kautta ei enää laadita maksuerien laskuja eikä lähetetä maksumuistutuksia. Kirjaus ei muuta osapuolten oikeuksia eikä velvollisuuksia: osamaksukaupasta annetun lain 3 ja 4 §:n mukainen tilitys toimitetaan osapuolten kesken, ja jos osapuolet eivät sovi tilityksestä, sen toimittaa ulosottomies kohdan 9.7 mukaisesti.</P>

        <H>10. Tietojen jakaminen RAHTIS-palvelussa</H>
        <P>10.1 Osapuolet sopivat, että RAHTIS-palvelussa myyjälle näytetään sopimuksen ajan ajoneuvon matkamittarilukema, huolto-, vika-, tarkastus- ja katsastustiedot, maksutilanne sekä sijainti kohdan 8 rajoissa. Ajoneuvon kuljetustehtäviä ja tuloja koskevat tiedot näytetään myyjälle vain kuukausikoosteena ja vain, jos ostaja on sen palvelussa erikseen hyväksynyt.</P>
        <P>10.2 Aivomaa Oy (RAHTIS) ei ole tämän sopimuksen osapuoli, ei välitä maksuja eikä vastaa osapuolten velvoitteista. Aivomaa Oy käsittelee henkilötietoja osapuolten lukuun palvelun käyttöehtojen ja henkilötietojen käsittelysopimuksen mukaisesti.</P>

        <H>11. Muut ehdot</H>
        <P>11.1 Myyjä voi siirtää tämän sopimuksen kaikkine oikeuksineen ja velvollisuuksineen rahoituslaitokselle. Siirrosta ilmoitetaan ostajalle kirjallisesti, ja ilmoituksen saatuaan ostaja voi suorittaa maksut pätevästi vain siirronsaajalle.</P>
        <P>11.2 Tämän sopimuksen mukaiset ilmoitukset tehdään kirjallisesti kohdassa 1 mainittuihin sähköpostiosoitteisiin. Ilmoituksen katsotaan tulleen vastaanottajan tietoon lähettämistä seuraavana arkipäivänä.</P>
        <P>11.3 Sopimukseen sovelletaan osamaksukaupasta annettua lakia (91/1966) ja muutoin Suomen lakia.</P>
        <P>11.4 Riidat ratkaistaan myyjän kotipaikan käräjäoikeudessa. Tämä ei rajoita myyjän oikeutta hakea virka-apua ulosottomieheltä osamaksukaupasta annetun lain 9 §:n mukaisesti.</P>
        <P>11.5 Sopimuksen muutokset on tehtävä kirjallisesti.</P>
        <P>11.6 Sopimus allekirjoitetaan ennen ajoneuvon luovutusta joko käsin kahtena samasanaisena kappaleena, joista kumpikin osapuoli saa yhden, tai molempien osapuolten hyväksytyllä sähköisellä allekirjoituksella, jolloin kumpikin osapuoli saa allekirjoitetun sähköisen asiakirjan.</P>

        <H>12. Allekirjoitukset</H>
        <P>Paikka ja aika: ______________________________</P>
        <View style={s.sign} wrap={false}>
          <View style={s.col}>
            <Text style={s.line}>{ansi(`Myyjä: ${d.seller.name}`)}</Text>
            <Text>{ansi('Nimenselvennys ja asema')}</Text>
          </View>
          <View style={s.col}>
            <Text style={s.line}>{ansi(`Ostaja: ${d.buyer.name}`)}</Text>
            <Text>{ansi('Nimenselvennys ja asema')}</Text>
          </View>
        </View>
        <P>Liitteet: 1. Maksusuunnitelma · 2. Luovutustarkastuspöytäkirja · 3. Ensimmäinen lasku · 4. Huoltosopimus (jos sovittu) · 5. Kuljettajille annettava tietosuojainformaatio</P>

        <Footer number={d.number} />
      </Page>

      <Page size="A4" style={s.page}>
        <Text style={s.annex}>{ansi('Liite 1. Maksusuunnitelma')}</Text>
        <Text style={s.meta}>{ansi(`Osamaksusopimus nro ${d.number} · ${d.vehicle.make} ${d.vehicle.plate}`)}</Text>
        <View style={{ marginTop: 10 }}>
          <View style={s.tRow}>
            <Text style={{ width: 40 }}>0</Text>
            <Text style={{ width: 90 }}>{ansi(`ennen ${d.handover}`)}</Text>
            <Text style={{ flex: 1 }}>{ansi('Käteismaksuosuus (ensimmäinen lasku)')}</Text>
            <Text style={{ width: 90, textAlign: 'right' }}>{ansi(d.price.downGross)}</Text>
            <Text style={{ width: 80, textAlign: 'right' }}>–</Text>
          </View>
          <View style={s.tHead}>
            <Text style={{ width: 40 }}>Erä</Text>
            <Text style={{ width: 90 }}>Eräpäivä</Text>
            <Text style={{ flex: 1 }}> </Text>
            <Text style={{ width: 90, textAlign: 'right' }}>Maksuerä</Text>
            <Text style={{ width: 80, textAlign: 'right' }}>Korko</Text>
          </View>
          {d.schedule.map((r) => (
            <View key={r.n} style={s.tRow} wrap={false}>
              <Text style={{ width: 40 }}>{String(r.n)}</Text>
              <Text style={{ width: 90 }}>{ansi(r.due)}</Text>
              <Text style={{ flex: 1 }}> </Text>
              <Text style={{ width: 90, textAlign: 'right' }}>{ansi(r.principal)}</Text>
              <Text style={{ width: 80, textAlign: 'right' }}>{ansi(r.interest)}</Text>
            </View>
          ))}
        </View>
        <Text style={[s.p, { marginTop: 10 }]}>
          {ansi('Maksuerät eivät sisällä arvonlisäveroa. Korko lasketaan maksusuunnitelman mukaisilla maksuilla; ennenaikainen maksu pienentää korkoa (kohta 4.6).')}
        </Text>

        <Text style={[s.annex, { marginTop: 22 }]}>{ansi('Liite 2. Luovutustarkastuspöytäkirja')}</Text>
        <P>{`Ajoneuvo ${d.vehicle.make} ${d.vehicle.plate} luovutettiin ostajalle ____.____.________ klo ____:____ sen jälkeen, kun osamaksusopimus nro ${d.number} oli allekirjoitettu.`}</P>
        <P>Matkamittarilukema luovutushetkellä: ______________ km</P>
        <P>Havaitut viat ja vauriot: ________________________________________________________________</P>
        <P>________________________________________________________________________________________</P>
        <P>Mukana luovutetut avaimet, asiakirjat ja varusteet: __________________________________________</P>
        <View style={s.sign} wrap={false}>
          <View style={s.col}>
            <Text style={s.line}>{ansi('Myyjä')}</Text>
          </View>
          <View style={s.col}>
            <Text style={s.line}>{ansi('Ostaja')}</Text>
          </View>
        </View>
        <Footer number={d.number} />
      </Page>
    </Document>
  );
}

function Footer({ number }: { number: string }) {
  return (
    <View style={s.footer} fixed>
      <Text>{ansi(`Osamaksusopimus ${number} · laadittu RAHTIS-palvelussa; Aivomaa Oy ei ole sopimuksen osapuoli`)}</Text>
      <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
    </View>
  );
}
