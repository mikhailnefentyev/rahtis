-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · условия использования, редакция 4
--
-- Откуда текст. 16 сентября подготовлены три русских проекта:
-- Platform Terms, Customer Terms и Privacy Policy. Эта миграция
-- переносит первый из них в базу на финском и английском.
--
-- ЧТО ИЗМЕНИЛОСЬ ПРОТИВ РЕДАКЦИИ 3.
--
-- Заполнены пять мест, где стояла пометка «[Kohta täydennetään
-- juristin kanssa.]»: прекращение исполнения, ответственность,
-- ограничение доступа, подсудность и порядок изменений. Теперь там
-- текст, а не обещание текста.
--
-- Исправлены два факта, разошедшиеся с платформой:
--
--   1. Редакция 3 обещала «две ветки: перецепы и контейнеры, другого
--      через платформу не заказывают». С 14 сентября заказывают:
--      экспресс фургоном и грузовиком опубликован на витрине и работает
--      в кабинете. Раздел 5 теперь называет три ветки.
--
--   2. Русский проект называл рассылку недельного отчёта «по
--      понедельникам в 04:00 по времени Europe/Helsinki». Задание
--      pg_cron стоит на '0 4 * * 1', а cron считает в UTC: это 06:00
--      зимой и 07:00 летом по Хельсинки. В проекте рядом стояла
--      редакционная пометка «подтвердить часовой пояс» — подтверждено
--      расписанием, и в тексте стоит проверенное время.
--
-- Добавлен почтовый адрес: Kankarepolku 5F B335, 00770 Helsinki. Он
-- взят не из воздуха — это legal_street компании Aivomaa Oy в самой
-- базе, заполненный оператором.
--
-- Пометка юриста осталась в одном месте — приоритетный язык редакции.
-- Это выбор, который делает не разработчик: русский проект прямо
-- требует указать его перед выпуском, а угадать его нельзя.
-- ═══════════════════════════════════════════════════════════════════

do $$
declare
  v_doc uuid;
  v_marker_fi text := '[Kohta täydennetään juristin kanssa.]';
  v_marker_en text := '[This clause is to be completed with counsel.]';
begin

  insert into public.legal_documents (kind, version, status, effective_from)
  values (
    'TERMS',
    coalesce((select max(version) + 1 from public.legal_documents where kind = 'TERMS'), 1),
    'DRAFT',
    date '2026-09-18'
  )
  returning id into v_doc;

  insert into public.legal_clauses (document_id, locale, path, title, body) values

  -- ── 1. Ylläpitäjä ja palvelun tarkoitus ──────────────────────────
  (v_doc, 'fi', '{1}', 'Ylläpitäjä ja palvelun tarkoitus', null),
  (v_doc, 'fi', '{1,1}', null,
   'RAHTIS on Aivomaa Oy:n (Y-tunnus 3592993-6, ALV-numero FI35929936, Kankarepolku 5F B335, 00770 Helsinki) digitaalinen palvelu. Palvelua ja sopimuksia koskevat yhteydenotot: admin@rahtis.eu. Palvelu on tarkoitettu yritysten ja ammatinharjoittajien elinkeinotoimintaan.'),
  (v_doc, 'fi', '{1,2}', null,
   'Nämä ehdot koskevat rekisteröintiä, käyttöoikeutta, tunnusten käyttöä, toimeksiantojen julkaisemista ja käsittelyä, asiakirjojen välittämistä ja palvelun yleisiä pelisääntöjä. Tilaaja on se, joka tilaa kuljetuksen Aivomaa Oy:ltä. Kuljetusliike on ulkopuolinen suorittaja, jonka Aivomaa Oy ottaa mukaan erillisellä sopimuksella. Käyttäjä on luonnollinen henkilö, joka toimii yrityksensä puolesta annettujen valtuuksien rajoissa.'),
  (v_doc, 'fi', '{1,3}', null,
   'Aivomaa Oy ottaa tilauksen vastaan omissa nimissään ja huolehtii sen toteutumisesta tarvittaessa ulkopuolisia kuljetusliikkeitä käyttäen. Aivomaa Oy on tilaajan sopimuskumppani vastaanotetussa tilauksessa. Kuljetusliikkeen käyttäminen ei sinänsä synnytä suoraa sopimusta tilaajan ja kuljetusliikkeen välille.'),
  (v_doc, 'fi', '{1,4}', null,
   'Aivomaa Oy ei itse kuljeta eikä omista kalustoa. Kuljetuksen suorittaa kuljetusliike omalla kalustollaan ja omalla liikenneluvallaan, ja Aivomaa Oy maksaa sille sopimuksensa mukaisesti. Tilaaja maksaa Aivomaa Oy:lle.'),

  -- ── 2. Asiakirjat ja niiden hyväksyminen ─────────────────────────
  (v_doc, 'fi', '{2}', 'Asiakirjat ja niiden hyväksyminen', null),
  (v_doc, 'fi', '{2,1}', null,
   'Valtuutettu käyttäjä hyväksyy nämä ehdot yrityksen puolesta rekisteröinnin yhteydessä tai ennen palvelun käytön aloittamista. Kuljetuksen tilaamiseen hyväksytään lisäksi tilaajan ehdot. Ulkopuolisen kuljetusliikkeen suorittamat kuljetukset edellyttävät erikseen hyväksyttyä kuljetusliikkeen sopimusta; näiden ehtojen julkaiseminen ei korvaa sen hyväksymistä.'),
  (v_doc, 'fi', '{2,2}', null,
   'Sovellettavat ehdot annetaan nähtäväksi ennen sitoutumista. Aivomaa Oy tallentaa hyväksytyn version, päivämäärän ja yrityksen puolesta toimineen henkilön. Yritys voi pyytää omaan tilaukseensa sovellettavien asiakirjojen jäljennökset osoitteesta admin@rahtis.eu.'),
  (v_doc, 'fi', '{2,3}', null,
   'Pakottava laki ja sovellettavat kansainväliset yleissopimukset ovat etusijalla. Sen jälkeen sovelletaan järjestyksessä: osapuolten viimeksi sopimat tilauksen muutokset; vahvistettu tilaus ja erikseen sovitut erityisehdot; tilaajan ehdot tai kuljetusliikkeen sopimus niihin sisältyvine hinnastoineen; nämä ehdot. Muutos syrjäyttää aiemman ehdon vain siltä osin kuin osapuolet ovat sen todella muuttaneet.'),
  (v_doc, 'fi', '{2,4}', null,
   'Ohjeet ja markkinointimateriaali eivät muuta sopimusta, ellei niitä ole nimenomaisesti otettu siihen. Vahvistuksessa näytetty ja osapuolten hyväksymä hinta ja muut ehdot ovat osa kyseistä tilausta. Kuljetusliikkeen sopimus ei aseta tilaajalle velvoitteita ilman tämän erillistä suostumusta.'),
  (v_doc, 'fi', '{2,5}', null,
   'Tietosuojaseloste kertoo, miten henkilötietoja käsitellään. Sopimusehtojen hyväksyminen ei ole yleinen suostumus mihin tahansa käsittelyyn.'),

  -- ── 3. Rekisteröinti ja valtuudet ────────────────────────────────
  (v_doc, 'fi', '{3}', 'Rekisteröinti ja valtuudet', null),
  (v_doc, 'fi', '{3,1}', null,
   'Palveluun ei ole avointa itserekisteröintiä: hakemus käsitellään ja yritys tarkistetaan julkisista rekistereistä ennen hyväksymistä. Yritys ilmoittaa oikeat rekisteri-, vero-, yhteys- ja maksutiedot ja päivittää ne ajoissa. Aivomaa Oy voi tarkistaa tiedot rekistereistä ja pyytää asiakirjoja, jotka ovat tarpeen tunnistamiseen, tilauksen hoitamiseen ja väärinkäytön estämiseen.'),
  (v_doc, 'fi', '{3,2}', null,
   'Kuljetusliike vahvistaa, että sillä on vaaditut luvat, vakuutukset ja oikeus suorittaa kyseinen kuljetus. Jokainen ajoneuvo hyväksytään erikseen, ja avoimet keikat näkyvät vain yritykselle, jolla on vähintään yksi hyväksytty ajoneuvo ja voimassa olevat asiakirjat. Hyväksyntä palveluun ei vapauta suorittajaa kuljetuksia, kabotaasia, kalustoa ja työaikaa koskevista vaatimuksista.'),
  (v_doc, 'fi', '{3,3}', null,
   'Yritys määrittää käyttäjiensä valtuudet. Kuljettajan oikeus välittää tiloja, valokuvia ja asiakirjoja ei sinänsä anna hänelle valtuutta muuttaa hintaa tai pankkitietoja eikä hyväksyä sopimusehtoja yrityksen puolesta.'),

  -- ── 4. Tunnukset ja turvallisuus ─────────────────────────────────
  (v_doc, 'fi', '{4}', 'Tunnukset ja turvallisuus', null),
  (v_doc, 'fi', '{4,1}', null,
   'Käyttäjä pitää tunnuksensa salassa, ei luovuta niitä sivullisille ja ilmoittaa heti epäilystä väärinkäytöstä. Yritys päättää ajoissa niiden henkilöiden käyttöoikeuden, joiden valtuudet ovat lakanneet.'),
  (v_doc, 'fi', '{4,2}', null,
   'Pankkitiedot annetaan kyseisen yrityksen omassa näkymässä. Aivomaa Oy voi pyytää vahvistuksen tilin kuulumisesta yritykselle ja tietoja muuttavan henkilön valtuuksista. WhatsApp-viesti tai muu vapaamuotoinen viestittely ei sinänsä riitä maksunsaajan tilin vaihtamiseen.'),
  (v_doc, 'fi', '{4,3}', null,
   'Kielletty on luvaton pääsy, rajoitusten kiertäminen, palvelun toimintaan puuttuminen, asiakirjojen ja tilojen vääristely, laittoman kuorman tarjoaminen ja tieten virheellisten tietojen antaminen. Rajapintaa käytetään vain myönnettyjen oikeuksien rajoissa.'),

  -- ── 5. Mitä alustalla kuljetetaan ────────────────────────────────
  (v_doc, 'fi', '{5}', 'Mitä alustalla kuljetetaan', null),
  (v_doc, 'fi', '{5,1}', null,
   'Palvelussa tilataan kolmea kuljetuslajia: irtoperävaunujen vaihtoa, konttikuljetuksia ja pikakuljetuksia pakettiautolla tai kuorma-autolla. Muuta rahtia palvelun kautta ei tilata.'),
  (v_doc, 'fi', '{5,2}', null,
   'Irtoperä- ja konttikuljetuksessa liikkuu yksikkö: veturi noutaa perävaunun tai kontin ja toimittaa sen sovittuun paikkaan. Pikakuljetuksessa liikkuu kuorma auton kyydissä, eikä matkalla vaihdeta yksikköä. Tilauksessa ilmoitetaan, kumpi on kyseessä.'),
  (v_doc, 'fi', '{5,3}', null,
   'Toiminta-alue on Skandinavian satamat ja terminaalit: Suomi, Ruotsi, Norja ja Tanska. Perävaunusta ilmoitetaan tyyppi ja rekisteritunnus, kontista pituus jalkoina ja ISO 6346 -tunnus, kuormasta lavametrit ja paino.'),
  (v_doc, 'fi', '{5,4}', null,
   'Palvelu rajaa tarjoukset kalustoon, joka kyseiseen työhön kelpaa: konttikeikan näkevät vain ajoneuvot, joiden alusta ottaa ilmoitetun pituuden, ja kuorman näkevät ne, joiden kuormatila ja kantavuus riittävät. Rajaus on tekninen apu eikä korvaa suorittajan omaa arviota kuljetuksen turvallisuudesta ja sallittavuudesta.'),

  -- ── 6. Tilaus, tarjoukset ja sopimuksen synty ────────────────────
  (v_doc, 'fi', '{6}', 'Tilaus, tarjoukset ja sopimuksen synty', null),
  (v_doc, 'fi', '{6,1}', null,
   'Tilaaja julkaisee toimeksiannon. Pisteiden osoitteet valitaan palvelun ehdotuksista, jotta niillä on koordinaatit, ja etäisyys lasketaan niistä raskaalle kalustolle sopivaa reittiä. Tilaaja voi korjata lasketun etäisyyden.'),
  (v_doc, 'fi', '{6,2}', null,
   'Toimeksiannon julkaiseminen, arviohinnan näkyminen tai automaattinen ilmoitus ei tarkoita, että Aivomaa Oy on ottanut kuljetuksen hoidettavakseen. Yhtä toimeksiantoa kohti otetaan enintään kolme tarjousta.'),
  (v_doc, 'fi', '{6,3}', null,
   'Tilaaja valitsee tarjouksen, ja valittu suorittaja vahvistaa työn. Kummallakin päätöksellä on 15 minuutin määräaika, jonka jälkeen keikka palaa tarjottavaksi. Sitova kuljetussopimus syntyy, kun suorittaja vahvistaa työn; siihen asti kumpikin voi perääntyä ilman seurauksia.'),
  (v_doc, 'fi', '{6,4}', null,
   'Vahvistuksessa määrittyvät osapuolet, reitti, kuorma tai kuljetettava yksikkö, aikataulu, hinta ja erityisehdot. Ulkopuolisen kuljetusliikkeen vastaanottoon sovelletaan kuljetusliikkeen sopimusta ja sen mukaista vahvistusta.'),
  (v_doc, 'fi', '{6,5}', null,
   'Toteutus ei voi edellyttää lain rikkomista, ylikuormaa, työaikasäännösten rikkomista tai turvattomia toimia. Jos toimeksianto on tällainen, suorittaja ei ole velvollinen vahvistamaan sitä eikä jatkamaan sen suorittamista.'),

  -- ── 7. Muutokset ja keskeytykset ─────────────────────────────────
  (v_doc, 'fi', '{7}', 'Muutokset ja keskeytykset', null),
  (v_doc, 'fi', '{7,1}', null,
   'Tilaaja voi ehdottaa ennakolta tulevien vaiheiden muutoksia: lisätä, poistaa tai muuttaa pisteitä, joihin ei ole vielä saavuttu. Jokainen muutos kirjataan tilauksen muutoslokiin tekijän ja ajan kanssa, ja suorittajalle ilmoitetaan.'),
  (v_doc, 'fi', '{7,2}', null,
   'Kuljettajan merkitsemiä ohitettuja pisteitä ja vaiheita ei muuteta jälkikäteen. Virhe korjataan erillisellä täsmennyksellä niin, että alkuperäinen tapahtuma, sen tekijä, aika ja korjauksen syy jäävät näkyviin.'),
  (v_doc, 'fi', '{7,3}', null,
   'Pisteiden muuttaminen ei sinänsä muuta etäisyyttä eikä hintaa. Ne muuttuvat vain erillisellä päivityksellä, jonka tilaaja vahvistaa; palvelu ehdottaa uutta hintaa alun perin sovitulla kilometrihinnalla. Kuljettajan vastaus, tiedote tai avustajan vastaus ei sinänsä muuta sovittua hintaa.'),
  (v_doc, 'fi', '{7,4}', null,
   'Tilaaja tai Aivomaa Oy voi peruuttaa toimeksiannon ennen sen valmistumista. Peruutus kirjataan lokiin syineen ja suorittajalle ilmoitetaan. Tehdystä työstä maksettava osuus ja jatkotoimet käsitellään tilaajan ehtojen ja sovellettavan lain mukaan.'),
  (v_doc, 'fi', '{7,5}', null,
   'Suorittaja voi perääntyä vahvistamastaan keikasta. Jos yhtään pistettä ei ole ohitettu, keikka palaa muiden tarjottavaksi; jos ajo on alkanut, keikka keskeytetään ja Aivomaa Oy ottaa yhteyttä. Perääntyminen kirjataan lokiin. Vastaanotettu kuorma, perävaunu tai kontti säilytetään asianmukaiseen luovutukseen asti, ja luovutus sovitaan Aivomaa Oy:n kautta.'),

  -- ── 8. Asiakirjat, raportit ja tilitykset ────────────────────────
  (v_doc, 'fi', '{8}', 'Asiakirjat, raportit ja tilitykset', null),
  (v_doc, 'fi', '{8,1}', null,
   'Asiakirjat ja valokuvat liitetään kyseiseen tilaukseen. Tilaaja saa oman tilauksensa asiakirjat ja suoritustiedot. Käyttäjä ei saa ladata palveluun sivullisten henkilötietoja tai asiakirjoja, jotka eivät ole työn kannalta tarpeen.'),
  (v_doc, 'fi', '{8,2}', null,
   'Keikkaa ei voi merkitä valmiiksi ennen kuin rahtikirja on liitetty siihen. Vauriot kirjataan keikalle valokuvineen ja vaiheen tiedoin. Jos allekirjoitus tai lataus on mahdotonta, suorittaja ilmoittaa syyn Aivomaa Oy:lle ja toimittaa käytettävissä olevan näytön suorituksesta.'),
  (v_doc, 'fi', '{8,3}', null,
   'Tilat, valokuvat, asiakirjat ja tapahtumaloki palvelevat työn järjestämistä ja suorituksen osoittamista. Niitä arvioidaan muun näytön kanssa, eikä niitä pidetä lähtökohtaisesti virheettöminä tai kumoamattomina.'),
  (v_doc, 'fi', '{8,4}', null,
   'Tilityskausi on puoli kuukautta: kuukauden 1.-15. päivä ja 16. päivästä kuukauden loppuun. Kuljetus kuuluu siihen kauteen, jonka aikana se on merkitty valmiiksi. Tilaaja maksaa kauden 15 päivän kuluessa kauden päättymisestä, ja kuljetusliikkeelle maksetaan 30 päivän kuluessa kauden päättymisestä.'),
  (v_doc, 'fi', '{8,5}', null,
   'Palvelumaksu otetaan tilaajan maksamasta hinnasta. Keikan valmistumishetkellä voimassa oleva maksuprosentti kirjataan kyseiselle keikalle, eivätkä myöhemmät muutokset vaikuta jo valmistuneisiin keikkoihin. Arvonlisävero määräytyy sopimuskumppanin maan mukaan: suomalaiselle yritykselle lisätään 25,5 prosenttia, muun maan yritykselle sovelletaan käännettyä verovelvollisuutta, jolloin myyjä laskuttaa nollalla ja ostaja tilittää veron omassa maassaan. Kansainvälinen reitti tai ulkomainen osoite ei sinänsä tarkoita nollaverokantaa.'),
  (v_doc, 'fi', '{8,6}', null,
   'Edellisen viikon (maanantaista sunnuntaihin) raportti muodostetaan ja lähetetään jokaiselle yritykselle sen omista töistä maanantaisin kello 4.00 UTC, mikä on Suomen aikaa 6.00 talvella ja 7.00 kesällä. Viikkoraportti ei korvaa laskua eikä muuta sovittua tilityskautta. Aivomaa Oy:n laskun tekeminen kuljetusliikkeen puolesta (self-billing) edellyttää erillistä nimenomaista sopimusta; pankkitietojen antaminen ja näiden ehtojen hyväksyminen ei ole tällainen sopimus.'),

  -- ── 9. Palvelun toiminta ja automaatio ───────────────────────────
  (v_doc, 'fi', '{9}', 'Palvelun toiminta ja automaatio', null),
  (v_doc, 'fi', '{9,1}', null,
   'Aivomaa Oy toimii kohtuullisin keinoin palvelun saatavuuden ja turvallisuuden puolesta. Huoltokatkot, tietoliikennehäiriöt ja ilmoitusten viiveet ovat mahdollisia. Aivomaa Oy ei takaa, että julkaistu keikka saa tarjouksia, eikä vastaa kolmannen osapuolen palvelujen, kuten karttojen, reititysten tai sähköpostin, katkoista. Merkittävästä tiedossa olevasta häiriöstä ilmoitetaan osoitteeseen admin@rahtis.eu; kiireelliset asiat hoidetaan tilauksen sovitun yhteyshenkilön kautta.'),
  (v_doc, 'fi', '{9,2}', null,
   'Jos palvelussa käytetään automaattisia ehdotuksia, laskelmia tai tekoälyavustajaa, käyttäjä tarkistaa niiden soveltuvuuden kyseiseen kuljetukseen. Ne eivät korvaa turvallisuuden ja pakottavien rajoitusten tarkistamista eikä sopimusmuutoksista sopimista.'),
  (v_doc, 'fi', '{9,3}', null,
   'Tekninen häiriö ei poista jo syntyneitä velvoitteita. Suorituksen olosuhteet ja asiakirjat voidaan toimittaa Aivomaa Oy:lle sovittua varakanavaa käyttäen ja kirjata tilaukseen jälkikäteen.'),

  -- ── 10. Tiedot ja sallittu käyttö ────────────────────────────────
  (v_doc, 'fi', '{10}', 'Tiedot ja sallittu käyttö', null),
  (v_doc, 'fi', '{10,1}', null,
   'Henkilötietojen käsittely on kuvattu erillisessä RAHTIS-tietosuojaselosteessa. Yritys luovuttaa työntekijöidensä, kuljettajiensa ja yhteyshenkilöidensä tiedot lainmukaisella perusteella ja huolehtii näiden henkilöiden informoinnista. Tämä ei poista Aivomaa Oy:n omia tietosuojavelvoitteita.'),
  (v_doc, 'fi', '{10,2}', null,
   'Palvelun kautta saatuja liiketietoja, yhteystietoja ja asiakirjoja käytetään kyseisten tilausten hoitamiseen ja niihin liittyviin laillisiin tarkoituksiin. Niitä ei saa luovuttaa sivullisille ilman perustetta eikä käyttää luvattomaan markkinointiin.'),
  (v_doc, 'fi', '{10,3}', null,
   'Aivomaa Oy:n kautta jo vahvistettua tilausta ei saa siirtää sovittujen sopimusten ja tilitysten ohi. Tämä ei aseta pysyvää kieltoa osapuolten omille suhteille muissa tilauksissa.'),
  (v_doc, 'fi', '{10,4}', null,
   'Jos arviointitoiminto on käytössä, arvion on perustuttava todelliseen yhteistyöhön eikä se saa sisältää tieten virheellisiä väitteitä tai tarpeettomia henkilötietoja. Aivomaa Oy voi selvittää ilmoituksen väärinkäytöstä ja rajoittaa pääsyä kiistanalaiseen sisältöön selvityksen ajaksi.'),

  -- ── 11. Käytön rajoittaminen ja muutoksenhaku ────────────────────
  (v_doc, 'fi', '{11}', 'Käytön rajoittaminen ja muutoksenhaku', null),
  (v_doc, 'fi', '{11,1}', null,
   'Aivomaa Oy voi rajoittaa käyttöoikeutta oikeasuhtaisesti, jos turvallisuus vaarantuu, epäillään petosta, ehtoja rikotaan olennaisesti tai lainmukainen vaatimus sitä edellyttää. Jos olosuhteet sallivat, yritykselle ilmoitetaan syy ja tapa korjata rikkomus ennakolta. Käytön jäädyttäminen ei poista tietoja: kuljetushistoria, asiakirjat ja summat säilytetään lain vaatiman ajan.'),
  (v_doc, 'fi', '{11,2}', null,
   'Muutoksenhaku ja pyyntö asian uudelleen käsittelystä lähetetään osoitteeseen admin@rahtis.eu. Yritys voi esittää selvityksensä ja näyttönsä ja pyytää asian käsittelyä valtuutetulla henkilöllä. Käyttöoikeuden rajoittaminen ei automaattisesti päätä käynnissä olevia tilauksia eikä rahavelvoitteita.'),
  (v_doc, 'fi', '{11,3}', null,
   'Käyttöoikeuden päättymisen jälkeen yritys voi pyytää itseään koskevat sopimus- ja tilitysasiakirjat, jotka Aivomaa Oy:llä on. Ne annetaan ottaen huomioon muiden oikeudet, turvallisuusvaatimukset ja lakisääteiset säilytysajat.'),

  -- ── 12. Vastuu, muutokset ja riidat ──────────────────────────────
  (v_doc, 'fi', '{12}', 'Vastuu, muutokset ja riidat', null),
  (v_doc, 'fi', '{12,1}', null,
   'Aivomaa Oy:n ja käyttäjien vastuu määräytyy sovellettavan lain ja tehtyjen sitoumusten mukaan. Kuljetuksesta, kalustosta ja kuljettajista vastaa kuljetusliike; kumpikin osapuoli vastaa itse antamiensa tietojen oikeellisuudesta. Ulkopuolisen suorittajan käyttäminen ei poista Aivomaa Oy:n lakiin perustuvaa vastuuta. Nämä ehdot eivät poista eivätkä rajoita vastuuta, jota ei voi sopimuksella poistaa tai rajoittaa.'),
  (v_doc, 'fi', '{12,2}', null,
   'Ehtojen muutoksista ilmoitetaan käyttäjille ennen niiden soveltamista ja samalla kerrotaan uusi versio ja voimaantulopäivä. Olennaiset muutokset, jotka vaativat hyväksynnän, hyväksytään erikseen. Muutokset eivät koske takautuvasti jo vahvistettuja tilauksia.'),
  (v_doc, 'fi', '{12,3}', null,
   'Sovelletaan Suomen lakia, kuitenkin niin, että pakottavat säännökset ja sovellettavat kansainväliset yleissopimukset ovat etusijalla. Osapuolet yrittävät ensin sopia riidan osoitteen admin@rahtis.eu kautta. Jos sopimukseen ei päästä, riita käsitellään Helsingin toimivaltaisessa tuomioistuimessa, jolleivät pakottavat oikeuspaikkasäännökset, mukaan lukien sovellettava CMR-yleissopimus, edellytä muuta.'),
  (v_doc, 'fi', '{12,4}', null, v_marker_fi),

  -- ══ English ═════════════════════════════════════════════════════

  (v_doc, 'en', '{1}', 'The operator and the purpose of the service', null),
  (v_doc, 'en', '{1,1}', null,
   'RAHTIS is a digital service of Aivomaa Oy (business ID 3592993-6, VAT number FI35929936, Kankarepolku 5F B335, 00770 Helsinki, Finland). For service and contract matters: admin@rahtis.eu. The service is intended for the business activity of companies and self-employed operators.'),
  (v_doc, 'en', '{1,2}', null,
   'These terms govern registration, access, the use of accounts, the publishing and handling of jobs, the exchange of documents and the general rules of the service. The shipper is the party ordering carriage from Aivomaa Oy. The carrier is an external performer engaged by Aivomaa Oy under a separate agreement. The user is a natural person acting on behalf of their company within the authority granted to them.'),
  (v_doc, 'en', '{1,3}', null,
   'Aivomaa Oy accepts an order in its own name and sees to its performance, engaging external carriers where needed. Aivomaa Oy is the shipper''s counterparty in an accepted order. Engaging a carrier does not in itself create a direct contract between the shipper and the carrier.'),
  (v_doc, 'en', '{1,4}', null,
   'Aivomaa Oy neither carries goods nor owns vehicles. Transport is performed by the carrier with its own equipment and under its own operating licence, and Aivomaa Oy pays the carrier under its agreement with it. The shipper pays Aivomaa Oy.'),

  (v_doc, 'en', '{2}', 'Documents and their acceptance', null),
  (v_doc, 'en', '{2,1}', null,
   'A user with the necessary authority accepts these terms on behalf of the company at registration or before the service is first used. Ordering carriage additionally requires acceptance of the customer terms. Transport performed by an external carrier requires a separately accepted carrier agreement; publishing these terms does not replace accepting it.'),
  (v_doc, 'en', '{2,2}', null,
   'The applicable terms are made available before any commitment. Aivomaa Oy records the accepted version, the date and the person who acted for the company. A company may request copies of the documents applicable to its order from admin@rahtis.eu.'),
  (v_doc, 'en', '{2,3}', null,
   'Mandatory law and applicable international conventions take precedence. After them apply, in order: the changes to the order last agreed by the parties; the confirmed order and expressly agreed special terms; the customer terms or the carrier agreement together with the rates included in them; these terms. A change displaces an earlier term only to the extent the parties actually changed it.'),
  (v_doc, 'en', '{2,4}', null,
   'Guidance and marketing material do not alter the contract unless expressly incorporated into it. The price and other terms shown at confirmation and accepted by the parties form part of that order. The carrier agreement imposes no obligations on the shipper without the shipper''s separate consent.'),
  (v_doc, 'en', '{2,5}', null,
   'The privacy notice explains how personal data is processed. Accepting contractual terms is not a general consent to any kind of processing.'),

  (v_doc, 'en', '{3}', 'Registration and authority', null),
  (v_doc, 'en', '{3,1}', null,
   'There is no open self-registration: an application is reviewed and the company is checked against public registers before approval. The company provides accurate registration, tax, contact and payment details and keeps them up to date. Aivomaa Oy may verify the details against registers and request documents needed for identification, performance of the order and prevention of misuse.'),
  (v_doc, 'en', '{3,2}', null,
   'The carrier confirms that it holds the required licences and insurance and the right to perform the transport in question. Each vehicle is approved separately, and open jobs are visible only to a company with at least one approved vehicle and valid documents. Approval to the service does not relieve the performer of the requirements on transport, cabotage, equipment and working time.'),
  (v_doc, 'en', '{3,3}', null,
   'The company determines the authority of its users. A driver''s access for passing on statuses, photographs and documents does not in itself give the driver authority to change the price or bank details, or to accept contractual terms on behalf of the company.'),

  (v_doc, 'en', '{4}', 'Accounts and security', null),
  (v_doc, 'en', '{4,1}', null,
   'The user keeps their credentials confidential, does not pass them to unauthorised persons and reports any suspected compromise immediately. The company promptly ends the access of persons whose authority has ceased.'),
  (v_doc, 'en', '{4,2}', null,
   'Bank details are entered in the company''s own view. Aivomaa Oy may request confirmation that the account belongs to the company and of the authority of the person changing the details. A message on WhatsApp or other informal correspondence is not in itself sufficient ground for changing the payee account.'),
  (v_doc, 'en', '{4,3}', null,
   'Unauthorised access, circumvention of restrictions, interference with the service, falsification of documents or statuses, offering unlawful cargo and knowingly providing false information are prohibited. The interface is used only within the rights granted.'),

  (v_doc, 'en', '{5}', 'What is carried through the platform', null),
  (v_doc, 'en', '{5,1}', null,
   'Three kinds of transport are ordered in the service: semi-trailer swaps, container haulage and express transport by van or truck. No other freight is ordered through the service.'),
  (v_doc, 'en', '{5,2}', null,
   'In trailer and container work a unit moves: the tractor collects the trailer or the container and delivers it to the agreed place. In express work the load travels in the vehicle and no unit is exchanged on the way. The order states which of the two applies.'),
  (v_doc, 'en', '{5,3}', null,
   'The operating area is the ports and terminals of Scandinavia: Finland, Sweden, Norway and Denmark. For a trailer the type and registration are given, for a container the length in feet and the ISO 6346 number, and for a load the loading metres and the weight.'),
  (v_doc, 'en', '{5,4}', null,
   'The service limits offers to equipment fit for the work: a container job is visible only to vehicles whose chassis accepts the stated length, and a load is visible to those whose load space and capacity suffice. The limitation is a technical aid and does not replace the performer''s own assessment of the safety and permissibility of the transport.'),

  (v_doc, 'en', '{6}', 'Ordering, offers and formation of the contract', null),
  (v_doc, 'en', '{6,1}', null,
   'The shipper publishes the job. Stop addresses are picked from the service''s suggestions so that they carry coordinates, and the distance is computed from them along a route suitable for heavy vehicles. The shipper may correct the computed distance.'),
  (v_doc, 'en', '{6,2}', null,
   'Publishing a job, the display of an indicative price or an automatic notification does not mean that Aivomaa Oy has undertaken to perform the transport. At most three offers are accepted per job.'),
  (v_doc, 'en', '{6,3}', null,
   'The shipper selects an offer and the selected performer confirms the work. Each decision has a 15-minute deadline, after which the job returns to the board. A binding contract of carriage is formed when the performer confirms the work; before that, either party may step back without consequence.'),
  (v_doc, 'en', '{6,4}', null,
   'The confirmation determines the parties, the route, the load or the unit to be carried, the schedule, the price and any special terms. Acceptance by an external carrier is governed by the carrier agreement and the confirmation issued under it.'),
  (v_doc, 'en', '{6,5}', null,
   'Performance cannot require breaking the law, overloading, breaching driving and working time rules or unsafe acts. Where a job is of that kind, the performer is not obliged to confirm it or to continue performing it.'),

  (v_doc, 'en', '{7}', 'Changes and interruptions', null),
  (v_doc, 'en', '{7,1}', null,
   'The shipper may propose changes to future stages in advance: adding, removing or changing stops that have not been reached. Every change is written to the job''s change log with its author and time, and the performer is notified.'),
  (v_doc, 'en', '{7,2}', null,
   'Stops and stages already marked by the driver are not altered retroactively. An error is corrected by a separate clarification, leaving the original event, its author, its time and the reason for the correction visible.'),
  (v_doc, 'en', '{7,3}', null,
   'Changing stops does not in itself change the distance or the price. Those change only through a separate update confirmed by the shipper; the service proposes a new price at the originally agreed price per kilometre. A driver''s reply, a notification or an assistant''s answer does not in itself change the agreed price.'),
  (v_doc, 'en', '{7,4}', null,
   'The shipper or Aivomaa Oy may cancel the job before it is completed. The cancellation is written to the log with its reason and the performer is notified. The amount payable for work actually done and the next steps are handled under the customer terms and applicable law.'),
  (v_doc, 'en', '{7,5}', null,
   'The performer may step back from a job it has confirmed. If no stop has been reached, the job returns to the board for others; if the run has started, the job is interrupted and Aivomaa Oy makes contact. Stepping back is written to the log. A load, trailer or container already taken over is kept until it is properly handed over, and the handover is agreed through Aivomaa Oy.'),

  (v_doc, 'en', '{8}', 'Documents, reports and settlement', null),
  (v_doc, 'en', '{8,1}', null,
   'Documents and photographs are attached to the job in question. The shipper receives the documents and performance data of its own job. A user must not upload personal data or documents of outsiders that the work does not require.'),
  (v_doc, 'en', '{8,2}', null,
   'A job cannot be marked complete before the consignment note is attached to it. Damage is recorded on the job with photographs and the stage concerned. Where a signature or an upload is impossible, the performer reports the reason to Aivomaa Oy and delivers the available evidence of performance.'),
  (v_doc, 'en', '{8,3}', null,
   'Statuses, photographs, documents and the event log serve to organise the work and to show that it was performed. They are assessed together with other evidence and are not treated as inherently error-free or conclusive.'),
  (v_doc, 'en', '{8,4}', null,
   'The settlement period is half a month: the 1st to the 15th, and the 16th to the last day of the month. A transport belongs to the period in which it was marked complete. The shipper pays within 15 days of the end of the period, and the carrier is paid within 30 days of the end of the period.'),
  (v_doc, 'en', '{8,5}', null,
   'The service fee is taken from the price paid by the shipper. The fee percentage in force when the job is completed is recorded on that job, and later changes do not affect jobs already completed. Value added tax follows the counterparty''s country: for a Finnish company 25.5 per cent is added, and for a company in another country the reverse charge applies, so the seller invoices at zero and the buyer accounts for the tax in its own country. An international route or a foreign address does not in itself mean a zero rate.'),
  (v_doc, 'en', '{8,6}', null,
   'A report on the previous week, Monday to Sunday, is produced and sent to each company on its own work on Mondays at 04:00 UTC, which is 06:00 Finnish time in winter and 07:00 in summer. The weekly report does not replace an invoice and does not change the agreed settlement period. Invoicing by Aivomaa Oy on the carrier''s behalf (self-billing) requires a separate express agreement; providing bank details and accepting these terms is not such an agreement.'),

  (v_doc, 'en', '{9}', 'Operation of the service and automation', null),
  (v_doc, 'en', '{9,1}', null,
   'Aivomaa Oy takes reasonable measures for the availability and security of the service. Maintenance windows, network failures and delays in notifications are possible. Aivomaa Oy does not guarantee that a published job will receive offers and is not liable for outages of third-party services such as mapping, routing or email. Significant known disruption should be reported to admin@rahtis.eu; urgent matters are handled through the agreed contact for the order.'),
  (v_doc, 'en', '{9,2}', null,
   'Where the service uses automatic suggestions, calculations or an AI assistant, the user checks that they fit the transport in question. They do not replace checking safety and mandatory restrictions, nor agreeing on contractual changes.'),
  (v_doc, 'en', '{9,3}', null,
   'A technical failure does not remove obligations that have already arisen. The circumstances of performance and the documents may be delivered to Aivomaa Oy through an agreed fallback channel and recorded on the job afterwards.'),

  (v_doc, 'en', '{10}', 'Data and acceptable use', null),
  (v_doc, 'en', '{10,1}', null,
   'The processing of personal data is described in the separate RAHTIS privacy notice. A company passes on the data of its employees, drivers and contacts on a lawful basis and sees to informing those persons. This does not remove Aivomaa Oy''s own data protection obligations.'),
  (v_doc, 'en', '{10,2}', null,
   'Commercial data, contact details and documents obtained through the service are used to perform the orders concerned and for lawful related purposes. They must not be disclosed to outsiders without a basis or used for unauthorised marketing.'),
  (v_doc, 'en', '{10,3}', null,
   'An order already confirmed through Aivomaa Oy must not be diverted around the agreed contracts and settlements. This does not impose a permanent bar on the parties'' own dealings in other orders.'),
  (v_doc, 'en', '{10,4}', null,
   'Where a rating feature is available, a rating must concern real dealings and must not contain knowingly false statements or unnecessary personal data. Aivomaa Oy may investigate a report of misuse and restrict access to the disputed material while the investigation lasts.'),

  (v_doc, 'en', '{11}', 'Restricting access and seeking review', null),
  (v_doc, 'en', '{11,1}', null,
   'Aivomaa Oy may restrict access proportionately where security is at risk, fraud is suspected, the terms are materially breached or a lawful requirement so demands. Where the circumstances allow, the company is told the reason and how to cure the breach beforehand. Freezing access does not delete data: transport history, documents and amounts are retained for the period required by law.'),
  (v_doc, 'en', '{11,2}', null,
   'Requests for review are sent to admin@rahtis.eu. The company may present its explanation and evidence and ask that the matter be handled by an authorised person. Restricting an account does not automatically end ongoing orders or monetary obligations.'),
  (v_doc, 'en', '{11,3}', null,
   'After access has ended, the company may request the contractual and settlement documents concerning it that Aivomaa Oy holds. They are provided having regard to the rights of others, security requirements and statutory retention periods.'),

  (v_doc, 'en', '{12}', 'Liability, changes and disputes', null),
  (v_doc, 'en', '{12,1}', null,
   'The liability of Aivomaa Oy and of users is determined by applicable law and by the commitments made. The carrier is responsible for the transport, its equipment and its drivers; each party is responsible for the accuracy of the data it enters. Engaging an external performer does not remove the liability Aivomaa Oy has under the law. These terms neither exclude nor limit liability that cannot be excluded or limited by agreement.'),
  (v_doc, 'en', '{12,2}', null,
   'Changes to the terms are notified to users before they are applied, stating the new version and the date it takes effect. Material changes requiring consent are accepted separately. Changes do not apply retroactively to orders already confirmed.'),
  (v_doc, 'en', '{12,3}', null,
   'Finnish law applies, subject to the precedence of mandatory provisions and applicable international conventions. The parties first seek to settle a dispute through admin@rahtis.eu. Failing agreement, the dispute is heard by the competent court in Helsinki unless mandatory rules on jurisdiction, including the applicable CMR Convention, require otherwise.'),
  (v_doc, 'en', '{12,4}', null, v_marker_en);

  raise notice 'TERMS: черновик редакции % заведён', (select version from public.legal_documents where id = v_doc);
end;
$$;
