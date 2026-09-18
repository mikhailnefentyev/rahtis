-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · условия для заказчиков, редакция 1
--
-- Третий вид документа в перечне legal_kind заводится впервые:
-- SHIPPER_AGREEMENT. До сих пор всё, что знал заказчик, лежало в общих
-- условиях использования, а коммерческих правил — простой, паром,
-- претензии, сроки оплаты — там не было вовсе.
--
-- Источник — русский проект Customer Terms от 16 сентября. Перенесён
-- целиком, с тремя правками по фактам платформы:
--
--   1. Время недельного отчёта. В проекте «по понедельникам в 04:00 по
--      времени Europe/Helsinki»; на деле задание стоит в UTC, то есть
--      06:00 зимой и 07:00 летом. Написано проверенное.
--
--   2. «Подтверждение заказа» в проекте звучит как отдельный документ.
--      В платформе такого документа нет: заказ становится обязывающим,
--      когда перевозчик подтверждает работу, и все согласованные
--      условия видны в самой записи заказа. Текст говорит о заказе,
--      подтверждённом в сервисе, а не о бумаге, которой никто не
--      выпускает.
--
--   3. Распределение двухчасовой нормы по нескольким точкам проект
--      требует указывать «в подтверждении». Отдельного поля для этого
--      в форме нет, и обещать его нельзя: сказано, что заказчик
--      указывает распределение в заказе до его подтверждения — для
--      этого годится описание заказа.
--
-- Редакционные примечания русского проекта («не публиковать») сюда не
-- переносились: это записка юристу, а не условие договора.
-- ═══════════════════════════════════════════════════════════════════

do $$
declare
  v_doc uuid;
  v_marker_fi text := '[Kohta täydennetään juristin kanssa.]';
  v_marker_en text := '[This clause is to be completed with counsel.]';
begin

  insert into public.legal_documents (kind, version, status, effective_from)
  values (
    'SHIPPER_AGREEMENT',
    coalesce((select max(version) + 1 from public.legal_documents where kind = 'SHIPPER_AGREEMENT'), 1),
    'DRAFT',
    date '2026-09-18'
  )
  returning id into v_doc;

  insert into public.legal_clauses (document_id, locale, path, title, body) values

  -- ── 1. Osapuolet ja sopimus ──────────────────────────────────────
  (v_doc, 'fi', '{1}', 'Osapuolet ja sopimus', null),
  (v_doc, 'fi', '{1,1}', null,
   'Näitä ehtoja sovelletaan yritysten ja ammatinharjoittajien tilauksiin, jotka Aivomaa Oy (Y-tunnus 3592993-6, Kankarepolku 5F B335, 00770 Helsinki) ottaa vastaan RAHTIS-palvelussa tai muussa sovitussa kanavassa. Yhteydenotot: admin@rahtis.eu. Tilaaja on yritys tai ammatinharjoittaja, jonka puolesta tilaus on otettu vastaan.'),
  (v_doc, 'fi', '{1,2}', null,
   'Aivomaa Oy ottaa tilauksen vastaan omissa nimissään ja huolehtii sen toteutumisesta tarvittaessa ulkopuolisia kuljetusliikkeitä käyttäen. Tilaajan sopimuskumppani on Aivomaa Oy. Ulkopuolisen kuljetusliikkeen nimeäminen ei synnytä automaattisesti suoraa sopimusta sen ja tilaajan välille eikä vapauta Aivomaa Oy:tä sen omista velvoitteista.'),
  (v_doc, 'fi', '{1,3}', null,
   'Tilaaja hyväksyy nämä ehdot ennen tilauksen vahvistamista. Lisäksi sovelletaan hyväksyttyjä RAHTIS-käyttöehtoja. Etusijalla ovat pakottava laki ja yleissopimukset, sitten osapuolten viimeksi sopimat tilauksen muutokset, vahvistettu tilaus ja erityisehdot, nämä ehdot ja viimeisenä RAHTIS-käyttöehdot. Muutos syrjäyttää aiemman ehdon vain sovitulta osin.'),
  (v_doc, 'fi', '{1,4}', null,
   'NSAB tai muut alan vakioehdot eivät tule sovellettaviksi automaattisesti: niiden soveltaminen edellyttää erillistä nimenomaista sopimista ennen kyseisen tilauksen vastaanottamista ja sovellettavan version antamista tilaajalle.'),

  -- ── 2. Toimeksianto ja tilauksen vastaanotto ─────────────────────
  (v_doc, 'fi', '{2}', 'Toimeksianto ja tilauksen vastaanotto', null),
  (v_doc, 'fi', '{2,1}', null,
   'Tilaaja antaa oikeat tiedot reitistä ja pisteistä, aikaikkunoista, kuormasta tai kuljetettavasta yksiköstä, painosta, mitoista, kollimäärästä, yhteyshenkilöistä, kohteisiin pääsystä sekä kalustoa, lastausta, purkua ja asiakirjoja koskevista vaatimuksista. Vaaralliset aineet, jätteet, lämpötilavaatimukset, erikoismitat ja muut erityisvaatimukset kerrotaan ennen tilauksen vahvistamista.'),
  (v_doc, 'fi', '{2,2}', null,
   'Tilaaja vastaa sovellettavan lain rajoissa toimeksiannon oikeellisuudesta, tarvittavien lähtö- ja rahtiasiakirjojen toimittamisesta sekä omalle vastuulleen kuuluvista kuorman asiakirjavelvoitteista. Kuljettajalle ja muille osapuolille laissa asetetut velvollisuudet eivät siirry tilaajalle pelkästään tämän kohdan nojalla.'),
  (v_doc, 'fi', '{2,3}', null,
   'Toimeksiannon julkaiseminen, arviohinnan näkyminen ja automaattinen vastaanottoilmoitus eivät tarkoita tilauksen hyväksymistä. Sopimus syntyy, kun tilaus vahvistetaan palvelussa sille varatulla toimenpiteellä tai kun Aivomaa Oy:n valtuuttama henkilö vahvistaa sen.'),
  (v_doc, 'fi', '{2,4}', null,
   'Vahvistetusta tilauksesta käyvät ilmi reitti, kuorma tai yksikkö, sovitut päivät ja aikaikkunat, hinta, siihen sisältyvät kulut, arvonlisäveron käsittely ja erityisehdot. Tilaaja tarkistaa tiedot ja ilmoittaa poikkeamista viivytyksettä. Suoritus ei voi edellyttää lain rikkomista, ylikuormaa, työaikasäännösten rikkomista tai turvattomia toimia.'),

  -- ── 3. Hinta ja lisätyöt ─────────────────────────────────────────
  (v_doc, 'fi', '{3}', 'Hinta ja lisätyöt', null),
  (v_doc, 'fi', '{3,1}', null,
   'Perushinta sidotaan siihen toimeksiantoon, joka on vahvistetussa tilauksessa. Lautat, tiemaksut, terminaalipalvelut ja muut kulut otetaan huomioon vahvistuksen mukaisesti. Ilmoittamattomia harkinnanvaraisia lisiä ei veloiteta automaattisesti.'),
  (v_doc, 'fi', '{3,2}', null,
   'Laskutusvaluutta on euro, jolleivät osapuolet ole nimenomaisesti muuta sopineet. Vahvistuksessa ja laskussa kerrotaan sovellettava arvonlisäverokäsittely: suomalaiselle yritykselle lisätään 25,5 prosenttia, muun maan yritykseen sovelletaan käännettyä verovelvollisuutta. Kansainvälinen reitti tai ulkomainen osoite ei sinänsä tarkoita nollaverokantaa.'),
  (v_doc, 'fi', '{3,3}', null,
   'Sovitusta muutoksesta johtuvat lisäkilometrit, -tunnit ja -työt nostavat hintaa. Lisä määräytyy ennalta hyväksytyn hinnaston mukaan tai sovitaan erikseen ennen muutoksen suorittamista. Näissä ehdoissa ei aseteta erillistä vakiohintaa lisäkilometrille.'),

  -- ── 4. Muutokset suorituksen aikana ──────────────────────────────
  (v_doc, 'fi', '{4}', 'Muutokset suorituksen aikana', null),
  (v_doc, 'fi', '{4,1}', null,
   'Tilaaja voi ehdottaa ennakolta reitin, kuorman tai tulevien työvaiheiden muutosta palvelussa tai sovitun Aivomaa Oy:n yhteyden kautta. Muutoksen on tultava ennen kyseisen vaiheen alkua ja jätettävä kohtuullinen mahdollisuus turvalliseen suoritukseen.'),
  (v_doc, 'fi', '{4,2}', null,
   'Kuljettajan jo merkitsemiä ohitettuja pisteitä ja vaiheita ei muuteta jälkikäteen. Virheen sattuessa lisätään erillinen selvitys, ja alkuperäinen tapahtuma, sen aika, tekijä ja korjauksen syy jäävät näkyviin.'),
  (v_doc, 'fi', '{4,3}', null,
   'Aivomaa Oy vahvistaa muutoksen mahdollisuuden, uuden hinnan ja vaikutuksen aikatauluun. Viesti kuljettajalle ei korvaa tarvittavaa sopimista Aivomaa Oy:n kanssa. Kuljettajan tai avustajan vastaus ei sinänsä vahvista hinnan muutosta.'),
  (v_doc, 'fi', '{4,4}', null,
   'Jos ihmisiä, kuormaa tai omaisuutta uhkaa välitön vaara, suorittaja saa ryhtyä välttämättömiin turvallisuustoimiin ja ilmoittaa niistä viivytyksettä Aivomaa Oy:lle. Toimien tarpeellisuus ja kustannukset dokumentoidaan; kustannusten jako määräytyy lain ja olosuhteiden mukaan, eikä tilaaja hyväksy automaattisesti mitä tahansa vaadittua summaa.'),

  -- ── 5. Lastaus, purku ja odotusaika ──────────────────────────────
  (v_doc, 'fi', '{5}', 'Lastaus, purku ja odotusaika', null),
  (v_doc, 'fi', '{5,1}', null,
   'Hintaan sisältyy erikseen 2 tuntia lastaukseen ja erikseen 2 tuntia purkuun. Toisen toimenpiteen käyttämätöntä aikaa ei siirretä toiseen. Jos tilauksessa on useampi lastaus- tai purkupaikka, tilaaja ilmoittaa tuntien jakautumisen tilauksessa ennen sen vahvistamista.'),
  (v_doc, 'fi', '{5,2}', null,
   'Kyseisen rajan ylittymisestä veloitetaan 45 euroa ilman arvonlisäveroa jokaiselta alkavalta tunnilta. Vajaa ylitystunti pyöristetään ylöspäin täydeksi tunniksi erikseen lastauksessa ja erikseen purussa. Sovellettava arvonlisävero lisätään.'),
  (v_doc, 'fi', '{5,3}', null,
   'Esimerkkejä: lastaus 2 tuntia 15 minuuttia - lisä 45 euroa; lastaus 3 tuntia 15 minuuttia - 90 euroa; lastaus 2 tuntia 15 minuuttia ja purku 2 tuntia 10 minuuttia - yhteensä 90 euroa ilman arvonlisäveroa.'),
  (v_doc, 'fi', '{5,4}', null,
   'Aika lasketaan siitä, kun kyseiseen toimenpiteeseen valmis kalusto on saapunut, kuitenkin aikaisintaan sovitusta saapumisajasta, toimenpiteen päättymiseen. Suorittajan vastuulla olevista syistä johtuvaa viivettä ei lueta maksulliseen ylitykseen. Samaa aikaa ei makseta kahteen kertaan sekä odotuksena että muuna tuntityönä.'),
  (v_doc, 'fi', '{5,5}', null,
   'Saapuminen sekä toimenpiteen alku ja loppu kirjataan tilaukselle. Näyttönä toimivat sovelluksen merkinnät ja käytettävissä olevat asiakirjat, valokuvat, kohteen merkinnät tai muu viivettä koskeva selvitys. Tilaaja voi pyytää laskelman ja esittää perustellut huomautukset. Kohteen edustajan allekirjoituksen puuttuminen ei sinänsä tee odotusaikaa toteennäytetyksi eikä näyttämättömäksi.'),
  (v_doc, 'fi', '{5,6}', null,
   'Vahvistettu odotusaika laskutetaan siten, että laskusta käyvät ilmi toimenpide, kesto, pois luettavat jaksot ja maksettavat alkavat tunnit. Riidattoman osan maksua ei viivytetä yksittäisestä lisästä käytävän erimielisyyden vuoksi.'),

  -- ── 6. Suorituksen keskeytyminen ja suorittajan vaihto ───────────
  (v_doc, 'fi', '{6}', 'Suorituksen keskeytyminen ja suorittajan vaihto', null),
  (v_doc, 'fi', '{6,1}', null,
   'Näissä ehdoissa ei aseteta erillistä peruutushinnastoa eikä kiinteää sopimussakkoa peruutuksesta. Tilauksen päättyminen ja korvaus tosiasiallisesti tehdystä työstä arvioidaan olosuhteiden ja sovellettavan lain mukaan.'),
  (v_doc, 'fi', '{6,2}', null,
   'Jos ulkopuolinen kuljetusliike perääntyy ennen kuorman, perävaunun tai kontin vastaanottoa, tilaus voidaan palauttaa keikkalistalle toisen suorittajan nimeämistä varten. Tämä ei sinänsä pura Aivomaa Oy:n ja tilaajan välistä sopimusta. Vaihdon vaikutuksesta sovittuun aikatauluun Aivomaa Oy ilmoittaa tilaajalle.'),
  (v_doc, 'fi', '{6,3}', null,
   'Kun kuorma, perävaunu tai kontti on tosiasiallisesti otettu vastaan, maksullinen työ on jo alkanut. Jos suoritus keskeytyy, tehdyn työn määrä, maksettava summa ja jatkotoimet sovitaan Aivomaa Oy:n kautta; tilauksen palauttaminen keikkalistalle ei nollaa tehtyä työtä.'),
  (v_doc, 'fi', '{6,4}', null,
   'Vastaanotettu kuorma tai yksikkö säilytetään asianmukaiseen luovutukseen asti, ja luovutus sovitaan Aivomaa Oy:n kautta. Suorittajan vaihtuessa säilyvät tiedot tosiasiallisesta sijainnista, tehdyistä vaiheista ja jäljellä olevasta työstä. Vastaanotettua kuormaa ei saa jättää ilman asianmukaista luovutusta.'),

  -- ── 7. Lautat ja myöhästyminen ───────────────────────────────────
  (v_doc, 'fi', '{7}', 'Lautat ja myöhästyminen', null),
  (v_doc, 'fi', '{7,1}', null,
   'Lauttamatkaa sisältävässä kuljetuksessa osapuolet kirjaavat, kuka tekee varauksen, lähtöajan, sovellettavan ilmoittautumisajan, rekisteröintivaatimukset ja tarvittavat tiedot. Myöhästymisen riskistä ilmoitetaan viivytyksettä kulujen rajoittamiseksi.'),
  (v_doc, 'fi', '{7,2}', null,
   'Lautan myöhästymisestä aiheutuneet todennetut kulut, mukaan lukien tosiasiallisesti veloitettu no-show-maksu ja tarpeellinen uudelleenvaraus, kohdistuvat vastuussa olevaan osapuoleen - tilaajaan, suorittajaan tai Aivomaa Oy:hyn - sovellettavan lain, syy-yhteyden ja lakisääteisten vastuunrajoitusten rajoissa.'),
  (v_doc, 'fi', '{7,3}', null,
   'Jos syynä ovat tilaajan vastuulla olevat virheelliset tiedot, myöhäinen muutos tai viive, vaatimus esitetään tilaajalle todentavine asiakirjoineen. Jos syy kuuluu Aivomaa Oy:n tai sen käyttämän suorittajan vastuupiiriin, kuluja ei siirretä tilaajalle automaattisesti.'),
  (v_doc, 'fi', '{7,4}', null,
   'RAHTIS ei peri omaa erillistä sakkoa lautalta myöhästymisestä. Huomioon otetaan palautukset, hyvitykset, mahdollisuus rajoittaa vahinkoa ja kaksinkertaisen perinnän kielto. Korvattaviin kuluihin ei lisätä erillistä RAHTIS-katetta.'),

  -- ── 8. Asiakirjat ja suorituksen osoittaminen ────────────────────
  (v_doc, 'fi', '{8}', 'Asiakirjat ja suorituksen osoittaminen', null),
  (v_doc, 'fi', '{8,1}', null,
   'Allekirjoitettu rahtikirja kirjataan palveluun heti sen saamisen jälkeen ja tulee tilaajan nähtäväksi. Keikkaa ei voi tavanomaisesti sulkea palvelussa ilman rahtikirjan lataamista. Vauriokuvat liitetään tilaukseen vaiheen ja olosuhteiden tiedoin.'),
  (v_doc, 'fi', '{8,2}', null,
   'Jos allekirjoitus tai asiakirjan lataus on mahdotonta, suorittaja ilmoittaa syyn Aivomaa Oy:lle ja toimittaa käytettävissä olevan näytön suorituksesta. Tilauksen tekninen tila ei sinänsä poista tosiasiallisesti tehtyä työtä eikä oikeuta pidättämään riidatonta maksua rajattomasti. Asiakirjapoikkeama käsitellään Aivomaa Oy:n kautta pakottava laki huomioon ottaen.'),
  (v_doc, 'fi', '{8,3}', null,
   'Aivomaa Oy järjestää tilaukseen liittyvän asiakirjaliikenteen. Tilaaja vastaa omaan vastuupiiriinsä kuuluvista tiedoista ja asiakirjoista, suorittaja kuljetuksen suorittamisesta ja omista asiakirjoistaan. Järjestelmän merkintä tai valokuva ei sinänsä osoita tietyn osapuolen tuottamusta.'),

  -- ── 9. Laskut ja maksaminen ──────────────────────────────────────
  (v_doc, 'fi', '{9}', 'Laskut ja maksaminen', null),
  (v_doc, 'fi', '{9,1}', null,
   'Tilityskaudet ovat kuukauden 1.-15. päivä ja 16. päivä kuukauden viimeiseen päivään. Aivomaa Oy laskuttaa tilaajaa omissa nimissään kauden aikana valmistuneista töistä ja vahvistetuista lisistä ja toimittaa laskun sovittua kanavaa pitkin niin, että se näkyy myös palvelussa.'),
  (v_doc, 'fi', '{9,2}', null,
   'Tilaaja maksaa laskun 15 kalenteripäivän kuluessa kyseisen tilityskauden päättymisestä. Syyskuun 1.-15. päivän työt maksetaan 30. syyskuuta mennessä ja 16.-30. päivän työt 15. lokakuuta mennessä. Määräaika lasketaan kauden päättymisestä, ei viikkoraportista.'),
  (v_doc, 'fi', '{9,3}', null,
   'Jos eräpäivä osuu Suomessa pankkien vapaapäivälle, maksu suoritetaan viimeistään seuraavana pankkipäivänä. Aivomaa Oy toimittaa laskun ajoissa; laskun toimittamisen viive ei synnytä tilaajalle keinotekoista viivästystä ajalta, jolta asianmukaista laskua ei vielä ollut.'),
  (v_doc, 'fi', '{9,4}', null,
   'Maksu suoritetaan asianmukaisessa laskussa ilmoitetulle Aivomaa Oy:n tilille. Tilaajan pankkitiedot palvelussa ovat tilitysten hoitamista varten; niiden antaminen ei ole lupa veloittaa tilaajan tililtä automaattisesti.'),
  (v_doc, 'fi', '{9,5}', null,
   'Edellisen maanantain ja sunnuntain välinen raportti muodostetaan ja lähetetään maanantaisin kello 4.00 UTC, mikä on Suomen aikaa 6.00 talvella ja 7.00 kesällä. Raportti palvelee täsmäytystä eikä korvaa tilityskauden laskua.'),
  (v_doc, 'fi', '{9,6}', null,
   'Tilaaja ilmoittaa laskun virheestä ilman aiheetonta viivytystä ja yksilöi riitautetut erät perusteineen. Korjaukset tehdään niin, että yhteys alkuperäiseen laskuun säilyy. Riidaton summa maksetaan eräpäivään mennessä. Viivästyksestä sovelletaan lain mukaista korkoa ja sallittuja perintäkuluja.'),
  (v_doc, 'fi', '{9,7}', null,
   'Ulkopuolisen kuljetusliikkeen palkkion maksaa Aivomaa Oy erillisen sopimuksensa mukaan. Tilaajasta ei tule kuljetusliikkeen maksajaa pelkästään suorittajan nimeämisen tai rahtikirjan vastaanottamisen vuoksi.'),

  -- ── 10. Vahingot ja vaatimukset ──────────────────────────────────
  (v_doc, 'fi', '{10}', 'Vahingot ja vaatimukset', null),
  (v_doc, 'fi', '{10,1}', null,
   'Vahingosta, vajauksesta, sinetin rikkoutumisesta, viivästyksestä tai muusta ongelmasta ilmoitetaan Aivomaa Oy:lle viivytyksettä. Asiakirjoihin tehdään tarvittavat varaumat, ja valokuvat, asiakirjat ja muu näyttö säilytetään. Ilmoitus palvelussa ei korvaa sovellettavan lain mukaisia menettelyjä ja määräaikoja.'),
  (v_doc, 'fi', '{10,2}', null,
   'Vaatimus lähetetään osoitteeseen admin@rahtis.eu ja siinä ilmoitetaan tilauksen numero, olosuhteet, vaadittu summa ja käytettävissä oleva näyttö. Aivomaa Oy pyytää tarvittaessa täsmennyksiä ja hoitaa yhteydenpidon suorittajaan ja vakuutusyhtiöön.'),
  (v_doc, 'fi', '{10,3}', null,
   'Vastuu kuormasta, kuljetuksesta, asiakirjoista ja järjestämisestä määräytyy tosiasiallisesti tehtyjen sitoumusten, sovellettavan lain ja soveltuvin osin CMR-yleissopimuksen mukaan. Ulkopuolisen suorittajan käyttäminen ei poista Aivomaa Oy:n lakiin perustuvaa vastuuta. Nämä ehdot eivät laajenna vastuuta pakottavien sääntöjen yli eivätkä poista vastuuta, jota ei voi sopimuksella poistaa.'),
  (v_doc, 'fi', '{10,4}', null,
   'Osapuoli, jonka suoritus estyy, ilmoittaa siitä toiselle ajoissa ja ryhtyy kohtuullisiin toimiin seurausten rajoittamiseksi. Vapautuminen vastuusta esteen vuoksi määräytyy lain mukaan; pelkkä vetoaminen ylivoimaiseen esteeseen ei poista jo tehdyn työn maksamista.'),

  -- ── 11. Loppumääräykset ──────────────────────────────────────────
  (v_doc, 'fi', '{11}', 'Loppumääräykset', null),
  (v_doc, 'fi', '{11,1}', null,
   'Ehtojen muutoksia ei sovelleta takautuvasti vahvistettuihin tilauksiin ilman osapuolten suostumusta, ellei laki sitä edellytä. Henkilötietoja käsitellään erillisen RAHTIS-tietosuojaselosteen mukaisesti.'),
  (v_doc, 'fi', '{11,2}', null,
   'Sovelletaan Suomen lakia ottaen huomioon pakottavat säännökset ja sovellettavat kansainväliset yleissopimukset. Osapuolet yrittävät ensin sopia riidan Aivomaa Oy:n kautta. Jos sopimukseen ei päästä, riita käsitellään Helsingin toimivaltaisessa tuomioistuimessa, kuitenkin niin, että pakottavat oikeuspaikkasäännökset ja CMR:n mukaiset oikeuspaikkavaihtoehdot säilyvät, jos CMR on sovellettavissa.'),
  (v_doc, 'fi', '{11,3}', null, v_marker_fi),

  -- ══ English ═════════════════════════════════════════════════════

  (v_doc, 'en', '{1}', 'The parties and the contract', null),
  (v_doc, 'en', '{1,1}', null,
   'These terms apply to orders of companies and self-employed operators accepted by Aivomaa Oy (business ID 3592993-6, Kankarepolku 5F B335, 00770 Helsinki, Finland) through RAHTIS or another agreed channel. Contact: admin@rahtis.eu. The shipper is the company or self-employed operator on whose behalf the order was accepted.'),
  (v_doc, 'en', '{1,2}', null,
   'Aivomaa Oy accepts an order in its own name and sees to its performance, engaging external carriers where needed. The shipper''s counterparty is Aivomaa Oy. Naming an external carrier does not automatically create a direct contract between that carrier and the shipper and does not relieve Aivomaa Oy of its own obligations.'),
  (v_doc, 'en', '{1,3}', null,
   'The shipper accepts these terms before an order is confirmed. The accepted RAHTIS terms of use also apply. Precedence goes to mandatory law and conventions, then to the changes to the order last agreed by the parties, the confirmed order and special terms, these terms, and lastly the RAHTIS terms of use. A change displaces an earlier term only to the extent agreed.'),
  (v_doc, 'en', '{1,4}', null,
   'NSAB or other industry standard terms do not apply automatically: their application requires separate express agreement before the order in question is accepted, together with delivery of the applicable version to the shipper.'),

  (v_doc, 'en', '{2}', 'The job and acceptance of the order', null),
  (v_doc, 'en', '{2,1}', null,
   'The shipper provides accurate information on the route and stops, time windows, the load or the unit to be carried, weight, dimensions, number of items, contacts, access to the sites, and requirements on equipment, loading, unloading and documents. Dangerous goods, waste, temperature requirements, out-of-gauge dimensions and other special requirements are disclosed before the order is confirmed.'),
  (v_doc, 'en', '{2,2}', null,
   'Within the limits of applicable law the shipper is responsible for the accuracy of the job, for providing the necessary source and consignment documents, and for the cargo documentation duties that fall to it. Duties placed by law on the carrier and other participants do not pass to the shipper by virtue of this clause alone.'),
  (v_doc, 'en', '{2,3}', null,
   'Publishing a job, the display of an indicative price and an automatic acknowledgement do not amount to acceptance of the order. The contract is formed when the order is confirmed in the service by the action provided for that purpose, or when a person authorised by Aivomaa Oy confirms it.'),
  (v_doc, 'en', '{2,4}', null,
   'A confirmed order shows the route, the load or the unit, the agreed dates and windows, the price, the costs included in it, the treatment of value added tax and any special terms. The shipper checks the details and reports discrepancies without delay. Performance cannot require breaking the law, overloading, breaching working time rules or unsafe acts.'),

  (v_doc, 'en', '{3}', 'Price and additional work', null),
  (v_doc, 'en', '{3,1}', null,
   'The base price is tied to the job set out in the confirmed order. Ferries, road charges, terminal services and other costs are taken into account as stated in the confirmation. Unstated discretionary surcharges are not applied automatically.'),
  (v_doc, 'en', '{3,2}', null,
   'The billing currency is the euro unless the parties expressly agree otherwise. The confirmation and the invoice state the applicable value added tax treatment: for a Finnish company 25.5 per cent is added, and for a company in another country the reverse charge applies. An international route or a foreign address does not in itself mean a zero rate.'),
  (v_doc, 'en', '{3,3}', null,
   'Additional kilometres, hours and work arising from an agreed change increase the price. The surcharge follows a rate accepted in advance or is agreed separately before the change is carried out. These terms do not set a separate standard rate for an additional kilometre.'),

  (v_doc, 'en', '{4}', 'Changes during performance', null),
  (v_doc, 'en', '{4,1}', null,
   'The shipper may propose in advance a change to the route, the load or future operations through the service or the agreed Aivomaa Oy contact. The change must arrive before the stage concerned begins and must leave a reasonable opportunity for safe performance.'),
  (v_doc, 'en', '{4,2}', null,
   'Stops and stages already marked by the driver are not altered retroactively. Where there is an error, a separate explanation is added, and the original event, its time, its author and the reason for the correction remain visible.'),
  (v_doc, 'en', '{4,3}', null,
   'Aivomaa Oy confirms whether the change is possible, the new price and the effect on the schedule. A message to the driver does not replace the agreement required with Aivomaa Oy. A reply by the driver or by the assistant does not in itself confirm a change in price.'),
  (v_doc, 'en', '{4,4}', null,
   'Where people, cargo or property are in immediate danger, the performer may take the minimum necessary safety measures and notifies Aivomaa Oy without delay. The necessity and cost of such measures are documented; the allocation of costs follows the law and the circumstances, and the shipper does not automatically accept any amount claimed.'),

  (v_doc, 'en', '{5}', 'Loading, unloading and waiting time', null),
  (v_doc, 'en', '{5,1}', null,
   'The price includes 2 hours for loading and, separately, 2 hours for unloading. Unused time from one operation is not carried over to the other. Where an order has several loading or unloading places, the shipper states how the hours are divided in the order before it is confirmed.'),
  (v_doc, 'en', '{5,2}', null,
   'Exceeding the relevant allowance is charged at 45 euros excluding value added tax for each hour begun. A partial hour of excess is rounded up to a full hour, separately for loading and for unloading. Applicable value added tax is added.'),
  (v_doc, 'en', '{5,3}', null,
   'Examples: loading 2 hours 15 minutes - a surcharge of 45 euros; loading 3 hours 15 minutes - 90 euros; loading 2 hours 15 minutes and unloading 2 hours 10 minutes - 90 euros excluding value added tax in total.'),
  (v_doc, 'en', '{5,4}', null,
   'Time is counted from the arrival of equipment ready for the operation concerned, but no earlier than the agreed arrival time, until the operation ends. Delay for reasons for which the performer is responsible is not counted as chargeable excess. The same time is not paid twice, both as waiting time and as other hourly work.'),
  (v_doc, 'en', '{5,5}', null,
   'Arrival and the start and end of the operation are recorded on the order. Evidence consists of the entries in the application and the available documents, photographs, site records or other information concerning the delay. The shipper may request the calculation and submit reasoned objections. The absence of a signature by a representative of the site does not in itself make the claimed waiting time proved or disproved.'),
  (v_doc, 'en', '{5,6}', null,
   'Confirmed waiting time is invoiced so that the invoice shows the operation, the duration, the periods excluded and the number of hours begun that are charged. Payment of the undisputed part is not delayed because of a disagreement over a single surcharge.'),

  (v_doc, 'en', '{6}', 'Interruption of performance and change of performer', null),
  (v_doc, 'en', '{6,1}', null,
   'These terms do not set a separate cancellation tariff or a fixed cancellation penalty. The ending of an order and payment for work actually done are assessed in the light of the circumstances and applicable law.'),
  (v_doc, 'en', '{6,2}', null,
   'If an external carrier steps back before taking over the load, trailer or container, the order may be returned to the job board so that another performer can be named. That does not in itself terminate the contract between Aivomaa Oy and the shipper. Aivomaa Oy informs the shipper of the effect of the change on the agreed schedule.'),
  (v_doc, 'en', '{6,3}', null,
   'Once the load, trailer or container has actually been taken over, chargeable work has already begun. If performance is interrupted, the amount of work done, the sum payable and the next steps are agreed through Aivomaa Oy; returning the order to the job board does not cancel the work already done.'),
  (v_doc, 'en', '{6,4}', null,
   'A load or unit taken over is kept until it is properly handed over, and the handover is agreed through Aivomaa Oy. Where the performer changes, the information on the actual location, the stages completed and the work remaining is preserved. A load taken over must not be abandoned without a proper handover.'),

  (v_doc, 'en', '{7}', 'Ferries and missed departures', null),
  (v_doc, 'en', '{7,1}', null,
   'For a transport that includes a ferry, the parties record who makes the booking, the departure time, the applicable cut-off, the check-in requirements and the details needed. The risk of missing a departure is reported without delay so that costs can be limited.'),
  (v_doc, 'en', '{7,2}', null,
   'Documented costs arising from a missed ferry, including a no-show charge actually levied and any necessary rebooking, fall on the party responsible - the shipper, the performer or Aivomaa Oy - within the limits of applicable law, causation and the limitations of liability provided by law.'),
  (v_doc, 'en', '{7,3}', null,
   'Where the cause is incorrect information, a late change or a delay for which the shipper is responsible, the claim is addressed to the shipper with supporting documents. Where the cause falls within the sphere of Aivomaa Oy or the performer it engages, the costs are not passed on to the shipper automatically.'),
  (v_doc, 'en', '{7,4}', null,
   'RAHTIS does not levy a penalty of its own for a missed ferry. Refunds, credits, the opportunity to mitigate loss and the prohibition of double recovery are taken into account. No separate RAHTIS mark-up is added to such recoverable costs.'),

  (v_doc, 'en', '{8}', 'Documents and proof of performance', null),
  (v_doc, 'en', '{8,1}', null,
   'A signed consignment note is recorded in the service as soon as it is received and becomes available to the shipper. A job cannot ordinarily be closed in the service without the consignment note being uploaded. Damage photographs are attached to the order with the stage and the circumstances.'),
  (v_doc, 'en', '{8,2}', null,
   'Where a signature or the upload of a document is impossible, the performer reports the reason to Aivomaa Oy and delivers the available evidence of performance. The technical status of an order does not in itself negate work actually done and is no ground for withholding undisputed payment indefinitely. A documentary discrepancy is handled through Aivomaa Oy, having regard to mandatory law.'),
  (v_doc, 'en', '{8,3}', null,
   'Aivomaa Oy arranges the documentation flow relating to the order. The shipper is responsible for the information and documents within its own sphere, and the performer for carrying out the transport and for its own documents. A system entry or a photograph does not in itself establish fault on the part of a particular party.'),

  (v_doc, 'en', '{9}', 'Invoices and payment', null),
  (v_doc, 'en', '{9,1}', null,
   'The settlement periods are the 1st to the 15th of the month and the 16th to the last day of the month. Aivomaa Oy invoices the shipper in its own name for the work completed and the confirmed surcharges of the period and delivers the invoice through the agreed channel so that it is also visible in the service.'),
  (v_doc, 'en', '{9,2}', null,
   'The shipper pays the invoice within 15 calendar days of the end of the settlement period concerned. Work between 1 and 15 September is paid by 30 September, and work between 16 and 30 September by 15 October. The period runs from the end of the settlement period, not from the weekly report.'),
  (v_doc, 'en', '{9,3}', null,
   'Where the due date falls on a non-banking day in Finland, payment is made no later than the next banking day. Aivomaa Oy delivers the invoice in good time; a delay in delivering it does not create an artificial default by the shipper for the time during which no proper invoice was yet available.'),
  (v_doc, 'en', '{9,4}', null,
   'Payment is made to the Aivomaa Oy account stated on the proper invoice. The shipper''s bank details in the service serve the handling of settlements; providing them is not authorisation to debit the shipper''s account automatically.'),
  (v_doc, 'en', '{9,5}', null,
   'A report covering the previous Monday to Sunday is produced and sent on Mondays at 04:00 UTC, which is 06:00 Finnish time in winter and 07:00 in summer. The report serves reconciliation and does not replace the invoice for the settlement period.'),
  (v_doc, 'en', '{9,6}', null,
   'The shipper reports an error in an invoice without undue delay, identifying the disputed items and the reasons. Corrections are made so that the link to the original invoice is preserved. The undisputed amount is paid by the due date. On late payment, statutory interest and permitted collection costs apply.'),
  (v_doc, 'en', '{9,7}', null,
   'The fee of an external carrier is paid by Aivomaa Oy under its separate agreement. The shipper does not become the carrier''s payer merely because a performer was named or a consignment note was received.'),

  (v_doc, 'en', '{10}', 'Damage and claims', null),
  (v_doc, 'en', '{10,1}', null,
   'Damage, shortage, a broken seal, delay or any other problem is reported to Aivomaa Oy without delay. The necessary reservations are entered in the documents, and photographs, documents and other evidence are preserved. A notification in the service does not replace the procedures and time limits required by applicable law.'),
  (v_doc, 'en', '{10,2}', null,
   'A claim is sent to admin@rahtis.eu stating the order number, the circumstances, the amount claimed and the available evidence. Where necessary Aivomaa Oy requests clarification and handles contact with the performer and the insurer.'),
  (v_doc, 'en', '{10,3}', null,
   'Liability for the cargo, the carriage, the documents and the arrangements is determined by the commitments actually made, applicable law and, where applicable, the CMR Convention. Engaging an external performer does not remove the liability Aivomaa Oy has under the law. These terms do not extend liability beyond mandatory rules and do not exclude liability that cannot be excluded by agreement.'),
  (v_doc, 'en', '{10,4}', null,
   'A party facing an impediment to performance notifies the other in good time and takes reasonable steps to limit the consequences. Release from liability on account of such an impediment is determined by law; invoking force majeure does not by itself remove payment for work already done.'),

  (v_doc, 'en', '{11}', 'Final provisions', null),
  (v_doc, 'en', '{11,1}', null,
   'Changes to the terms do not apply retroactively to confirmed orders without the consent of the parties, except where the law requires it. Personal data is processed in accordance with the separate RAHTIS privacy notice.'),
  (v_doc, 'en', '{11,2}', null,
   'Finnish law applies, having regard to mandatory provisions and applicable international conventions. The parties first seek to settle a dispute through Aivomaa Oy. Failing agreement, the dispute is heard by the competent court in Helsinki, while preserving mandatory rules on jurisdiction and the options for bringing proceedings under the CMR Convention where it applies.'),
  (v_doc, 'en', '{11,3}', null, v_marker_en);

  raise notice 'SHIPPER_AGREEMENT: черновик редакции % заведён', (select version from public.legal_documents where id = v_doc);
end;
$$;
