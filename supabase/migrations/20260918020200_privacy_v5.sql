-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · политика конфиденциальности, редакция 5
--
-- Русский проект от 16 сентября пришёл с пустыми скобками: «[ЗАПОЛНИТЬ:
-- фактические поставщики]», «[УТОЧНИТЬ: собираются ли GPS-координаты]»,
-- «[ЗАПОЛНИТЬ ТАБЛИЦУ ХРАНЕНИЯ]». Редакционная пометка прямо говорила,
-- что документ не готов к публикации, пока скобки не заполнены.
--
-- Скобки заполнены не догадками, а замерами по коду и по живой системе:
--
--   поставщики  — Vercel (приложение, функции в cdg1, Париж), Supabase
--                 (база, вход, файлы; проект в aws eu-west-3, Париж),
--                 TomTom (подсказка адресов и грузовой маршрут),
--                 MapTiler (подложка карты), Resend (письма),
--                 WhatsApp Business Platform (graph.facebook.com в
--                 воркфлоу водительского агента), Anthropic
--                 (api.anthropic.com там же), n8n (связка агентов);
--
--   геолокация  — с 14 сентября точка прохождения пишется в
--                 order_stops.completed_lat/lon/accuracy_m: одна
--                 отметка на точку, в момент нажатия, с разрешения
--                 браузера. Непрерывного слежения нет ни в одной строке
--                 кода, и политика теперь говорит об этом прямо;
--
--   куки        — замер боевого сайта: анониму не ставится ни одной,
--                 после входа появляется одна сессионная кука
--                 Supabase, при смене языка — языковая. Аналитики и
--                 маркетинговых кук нет;
--
--   хранение    — происшествия со статусом RESOLVED чистятся через 90
--                 дней (prune_incidents), записи защиты от перебора
--                 входа — через сутки (prune_auth_throttle), кабинет
--                 показывает выполненные рейсы за восемь недель
--                 (COMPLETED_WEEKS), что является окном показа, а не
--                 сроком удаления.
--
-- Пометка юриста осталась там, где нужен правовой выбор, а не факт:
-- механизм передачи за пределы ЕЭЗ и договоры с обработчиками (6.4),
-- полная таблица сроков хранения (8.4) и приоритетный язык (11.3).
-- ═══════════════════════════════════════════════════════════════════

do $$
declare
  v_doc uuid;
  v_marker_fi text := '[Kohta täydennetään juristin kanssa.]';
  v_marker_en text := '[This clause is to be completed with counsel.]';
begin

  insert into public.legal_documents (kind, version, status, effective_from)
  values (
    'PRIVACY',
    coalesce((select max(version) + 1 from public.legal_documents where kind = 'PRIVACY'), 1),
    'DRAFT',
    date '2026-09-18'
  )
  returning id into v_doc;

  insert into public.legal_clauses (document_id, locale, path, title, body) values

  -- ── 1. Rekisterinpitäjä ──────────────────────────────────────────
  (v_doc, 'fi', '{1}', 'Rekisterinpitäjä', null),
  (v_doc, 'fi', '{1,1}', null,
   'Tässä selosteessa kuvattujen tarkoitusten rekisterinpitäjä on Aivomaa Oy (Y-tunnus 3592993-6), Kankarepolku 5F B335, 00770 Helsinki, Suomi. Tietosuoja-asiat: admin@rahtis.eu.'),
  (v_doc, 'fi', '{1,2}', null,
   'Seloste koskee yritysten edustajia, palvelun käyttäjiä, kuljettajia sekä kuljetusten yhteyshenkilöitä. Oikeushenkilöä koskevat tiedot eivät välttämättä ole henkilötietoja, mutta sen työntekijöitä ja ammatinharjoittajia koskevat tiedot suojataan sovellettavan lain mukaisesti.'),
  (v_doc, 'fi', '{1,3}', null,
   'Tilaajat ja kuljetusliikkeet voivat itse määrittää omien työntekijöidensä ja yhteyshenkilöidensä tietojen käsittelyn tarkoitukset. Heidän velvollisuutensa eivät korvaa Aivomaa Oy:n velvollisuuksia.'),

  -- ── 2. Mitä tietoja käsitellään ──────────────────────────────────
  (v_doc, 'fi', '{2}', 'Mitä tietoja käsitellään', null),
  (v_doc, 'fi', '{2,1}', null,
   'Yritys- ja tilitystiedot: nimi, Y-tunnus, ALV-numero, osoitteet, laskutustiedot, pankkitili, verkkolaskuosoite, maksutiedot ja tieto hyväksytyistä ehdoista versioineen ja hyväksymisaikoineen.'),
  (v_doc, 'fi', '{2,2}', null,
   'Käyttäjätiedot: nimi, sähköpostiosoite, puhelinnumero, rooli ja yritys, jonka puolesta käyttäjä toimii. Kuljettajatiedot: nimi, puhelin- tai WhatsApp-numero, käytettävät kielet ja yhteys ajoneuvoon tai keikkaan. Nämä tiedot syöttää työnantaja tai kuljetusliike.'),
  (v_doc, 'fi', '{2,3}', null,
   'Kuljetustiedot: pisteiden osoitteet ja koordinaatit, aikataulut, kuorman tiedot, lähettäjän ja vastaanottajan yhteystiedot pisteillä, suorittajan nimeäminen sekä tilauksen vaiheet ja muutosloki tekijöineen ja aikoineen.'),
  (v_doc, 'fi', '{2,4}', null,
   'Pisteen kuittauksen sijainti: kun kuljettaja merkitsee pisteen ohitetuksi, selain voi antaa laitteen sijainnin. Tallennetaan yksi piste kuittaushetkeltä ja sen tarkkuus metreinä. Kyse ei ole jatkuvasta seurannasta: sijaintia ei kysytä eikä tallenneta muulloin, ja jos selain ei anna sijaintia, piste merkitään ohitetuksi ilman koordinaattia. Sijainti näkyy kyseisen tilauksen tilaajalle ja ylläpitäjälle.'),
  (v_doc, 'fi', '{2,5}', null,
   'Asiakirjat ja aineistot: rahtikirjat, lastaus-, purku- ja vauriokuvat, allekirjoitukset, yrityksen luvat ja vakuutustodistukset sekä muut tilaukseen liitetyt todisteet. Aineisto voi sisältää yhteyshenkilöiden tietoja, ajoneuvojen rekisteritunnuksia ja kuvia ihmisistä.'),
  (v_doc, 'fi', '{2,6}', null,
   'Tekniset tiedot: kirjautumiset, tilojen muutokset, lähetetyt viestit ja niiden tila, häiriömerkinnät sekä kirjautumisen väärinkäyttöä rajoittavat tiedot. Palvelu ei käytä analytiikka- tai markkinointievästeitä: tunnistautumattomalle kävijälle ei aseteta yhtään evästettä, kirjautuminen asettaa istuntoevästeen ja kielen vaihtaminen kielivalintaa muistavan evästeen.'),

  -- ── 3. Mistä tiedot tulevat ──────────────────────────────────────
  (v_doc, 'fi', '{3}', 'Mistä tiedot tulevat', null),
  (v_doc, 'fi', '{3,1}', null,
   'Tiedot saadaan henkilöltä itseltään, yritykseltä, jonka puolesta hän toimii, tilaajalta, kuljetusliikkeeltä, tilauksen suorittamiseen osallistuvilta sekä palvelussa tehdyistä toimista ja asiakirjoista. Yritysten rekisteritiedot tarkistetaan julkisista rekistereistä.'),

  -- ── 4. Käyttötarkoitukset ja oikeusperusteet ─────────────────────
  (v_doc, 'fi', '{4}', 'Käyttötarkoitukset ja oikeusperusteet', null),
  (v_doc, 'fi', '{4,1}', null,
   'Käyttöoikeus, asiointi yritysten edustajien kanssa, kuljetusten järjestäminen ja seuranta, yhteydenpito, asiakirjojen välittäminen ja suorituksen osoittaminen: Aivomaa Oy:n ja kyseisten yritysten oikeutettu etu ylläpitää ja dokumentoida liikesuhdetta, tarpeellisuus ja asianosaisten oikeudet arvioiden. Jos henkilö on itse sopimuksen osapuoli, tarvittavia tietoja voidaan käsitellä hänen sopimuksensa tekemiseksi tai täyttämiseksi.'),
  (v_doc, 'fi', '{4,2}', null,
   'Kirjanpito, laskutus ja lakisääteisten vaatimusten täyttäminen: Aivomaa Oy:n lakisääteinen velvoite. Sopimus yrityksen kanssa ei tee sen jokaisesta työntekijästä sopimuksen osapuolta.'),
  (v_doc, 'fi', '{4,3}', null,
   'Turvallisuus, käyttöoikeuksien hallinta, väärinkäytösten estäminen, maksutietojen tarkistaminen, häiriöiden selvittäminen ja vaatimuksilta puolustautuminen: Aivomaa Oy:n ja tilausten osapuolten oikeutettu etu, oikeuksien tasapaino huomioiden.'),
  (v_doc, 'fi', '{4,4}', null,
   'Vapaaehtoiseen käsittelyyn, joka edellyttää suostumusta, se pyydetään erikseen ja yksilöityyn tarkoitukseen. Suostumuksen voi peruuttaa, mikä ei vaikuta sitä ennen tehdyn käsittelyn laillisuuteen. Ehtojen hyväksyminen tai puhelinnumeron syöttäminen työnantajan toimesta ei ole yleinen suostumus sijaintitietoon, markkinointiin tai tietojen antamiseen tekoälypalveluille.'),
  (v_doc, 'fi', '{4,5}', null,
   'Yrityksen tunnistamiseen, yhteydenpitoon, tilauksen suorittamiseen ja lakisääteiseen kirjanpitoon tarvittavat tiedot ovat edellytys kyseisille toiminnoille. Ilman niitä rekisteröinti, työn suorittaminen tai tilitykset eivät ole mahdollisia.'),

  -- ── 5. Kenelle tietoja luovutetaan ───────────────────────────────
  (v_doc, 'fi', '{5}', 'Kenelle tietoja luovutetaan', null),
  (v_doc, 'fi', '{5,1}', null,
   'Kuljetuksen osapuolille annetaan roolin edellyttämät tiedot: suorittajalle toimeksianto, osoitteet ja tarvittavat yhteystiedot, tilaajalle oman tilauksensa eteneminen ja asiakirjat. Pääsyä muiden yritysten tietoihin ja muihin tilauksiin ei synny pelkästä rekisteröitymisestä.'),
  (v_doc, 'fi', '{5,2}', null,
   'Palvelun tekniset toimittajat käsittelevät tietoja Aivomaa Oy:n lukuun: Vercel Inc. (sovellusalusta; palvelinfunktiot ajetaan Pariisin alueella), Supabase (tietokanta, kirjautuminen ja tiedostojen tallennus; projekti AWS:n Pariisin alueella), TomTom (osoite-ehdotukset ja raskaan kaluston reititys), MapTiler (kartan taustakuvat käyttäjän selaimeen) ja Resend (sähköpostin toimitus).'),
  (v_doc, 'fi', '{5,3}', null,
   'Osoite- ja reitityspalvelulle välitetään osoitteen teksti, pisteiden koordinaatit ja pyynnön tekniset tiedot koordinaattien ja etäisyyden selvittämiseksi. Muita henkilötietoja sinne ei välitetä. Karttapalvelulle välittyvät ne karttaruudut, jotka käyttäjän selain pyytää.'),
  (v_doc, 'fi', '{5,4}', null,
   'Kun WhatsApp-avustajaa käytetään, viestit kulkevat WhatsApp Business Platformin (Meta) kautta ja avustajan vastaukset muodostetaan Anthropicin kielimallilla; automaatio on toteutettu n8n-työkalulla. Näille välittyvät viestin sisältö ja ne keikan tiedot, jotka vastaukseen tarvitaan. Avustajan käyttö on vapaaehtoista, ja sama työ voidaan hoitaa kabinetissa.'),
  (v_doc, 'fi', '{5,5}', null,
   'Tietoja voidaan luovuttaa pankeille ja maksuliikenteeseen tilityksiä varten, ammattimaisille neuvonantajille ja vakuutusyhtiöille kyseisen asian hoitamiseksi sekä toimivaltaisille viranomaisille lainmukaisella perusteella. Luovutus rajataan tarpeelliseen.'),

  -- ── 6. Siirrot ETA-alueen ulkopuolelle ───────────────────────────
  (v_doc, 'fi', '{6}', 'Siirrot ETA-alueen ulkopuolelle', null),
  (v_doc, 'fi', '{6,1}', null,
   'Sovellusalusta ja tietokanta on määritetty ajettavaksi Euroopassa: palvelinfunktiot Pariisin alueella ja tietokanta sekä tiedostot AWS:n Pariisin alueella.'),
  (v_doc, 'fi', '{6,2}', null,
   'Osa toimittajista on sijoittautunut ETA-alueen ulkopuolelle tai voi käsitellä tietoja siellä. Näin on erityisesti WhatsApp-avustajan viestinvälityksessä ja kielimallissa sekä mahdollisessa etätuessa.'),
  (v_doc, 'fi', '{6,3}', null,
   'Siirto ETA-alueen ulkopuolelle on sallittu vain sovellettavan oikeudellisen mekanismin nojalla. Pelkkä tunnetun pilvipalvelun käyttö ei osoita vaatimusten täyttymistä.'),
  (v_doc, 'fi', '{6,4}', null, v_marker_fi),

  -- ── 7. Sijainti, viestit ja automaatio ───────────────────────────
  (v_doc, 'fi', '{7}', 'Sijainti, viestit ja automaatio', null),
  (v_doc, 'fi', '{7,1}', null,
   'Palvelu käyttää reittipisteiden koordinaatteja ja tilauksen tapahtumia. Laitteen sijainti kysytään vain siinä hetkessä, kun kuljettaja merkitsee pisteen ohitetuksi, ja siitä tallennetaan yksi piste tarkkuustietoineen. Sijainnin antaminen ratkaistaan selaimen luvalla; kieltäytyminen ei estä pisteen merkitsemistä eikä työn suorittamista.'),
  (v_doc, 'fi', '{7,2}', null,
   'WhatsApp-numero yhdistää kuljettajan oikeaan keikkaan. Viestien käsittelystä Metan palveluissa vastaa Meta omien ehtojensa mukaisesti; Aivomaa Oy tallentaa palveluun ne viestit ja liitteet, jotka liittyvät kyseiseen keikkaan.'),
  (v_doc, 'fi', '{7,3}', null,
   'Palvelussa ei tehdä pelkästään automaattiseen käsittelyyn perustuvia päätöksiä, joilla olisi henkilöä koskevia oikeusvaikutuksia tai vastaavalla tavalla merkittäviä vaikutuksia. Automaattiset tarkistukset koskevat kalustoa ja toimeksiantoja: ne rajaavat, mille ajoneuvoille keikka näkyy, sulkevat päätösikkunan määräajan kuluttua ja lähettävät ilmoituksia.'),

  -- ── 8. Säilytysajat ──────────────────────────────────────────────
  (v_doc, 'fi', '{8}', 'Säilytysajat', null),
  (v_doc, 'fi', '{8,1}', null,
   'Tietoja säilytetään vain niin kauan kuin kyseinen tarkoitus edellyttää, ottaen huomioon lakisääteinen kirjanpito, voimassa olevat sopimukset, mahdolliset vaatimukset ja oikeuksien puolustaminen. Käyttöoikeuden päättyminen ei tarkoita kaikkien tilitys- ja kuljetusasiakirjojen välitöntä poistamista.'),
  (v_doc, 'fi', '{8,2}', null,
   'Kirjanpitoaineisto säilytetään sovellettavan lain mukaiset ajat. Kuljetusasiakirjoissa otetaan lisäksi huomioon vaatimusten määräajat ja tarve osoittaa suoritus. Laskujen säilytysaikaa ei ilman erillistä perustetta laajenneta kaikkiin valokuviin, sijaintipisteisiin ja teknisiin lokeihin.'),
  (v_doc, 'fi', '{8,3}', null,
   'Teknisistä tiedoista on todennettavissa seuraava: ratkaistut häiriömerkinnät poistetaan 90 päivän kuluttua viimeisestä havainnosta, ja kirjautumisen väärinkäyttöä rajoittavat merkinnät poistetaan vuorokaudessa. Kabinetti näyttää valmiit keikat kahdeksalta viimeiseltä viikolta; kyseessä on näkymän rajaus, ei poistoaika.'),
  (v_doc, 'fi', '{8,4}', null, v_marker_fi),
  (v_doc, 'fi', '{8,5}', null,
   'Keskeneräiseen riitaan tai lakisääteiseen vaatimukseen tarvittavia tietoja voidaan säilyttää asian ratkaisemiseen ja määräajan päättymiseen asti. Pääsy niihin rajataan kyseiseen tarkoitukseen.'),

  -- ── 9. Rekisteröidyn oikeudet ────────────────────────────────────
  (v_doc, 'fi', '{9}', 'Rekisteröidyn oikeudet', null),
  (v_doc, 'fi', '{9,1}', null,
   'Laissa säädetyissä tilanteissa henkilöllä on oikeus saada tietoa ja pääsy omiin tietoihinsa, vaatia virheellisen tiedon oikaisua, poistamista tai käsittelyn rajoittamista, vastustaa oikeutettuun etuun perustuvaa käsittelyä ja saada tiedot siirrettävässä muodossa, kun tämän oikeuden edellytykset täyttyvät. Nämä oikeudet eivät ole ehdoton vaatimus poistaa asiakirjoja, joita on säilytettävä lain nojalla.'),
  (v_doc, 'fi', '{9,2}', null,
   'Pyyntö lähetetään osoitteeseen admin@rahtis.eu. Aivomaa Oy voi pyytää oikeasuhtaisen tunnistautumisen tietojen suojaamiseksi. Kuljettaja voi kääntyä suoraan Aivomaa Oy:n puoleen sen omasta käsittelystä; ensin työnantajalle osoitettu pyyntö ei ole käsittelyn edellytys.'),
  (v_doc, 'fi', '{9,3}', null,
   'Vastaus annetaan ilman aiheetonta viivytystä, tavallisesti kuukauden kuluessa. Jos laki sallii määräajan jatkamisen pyyntöjen monimutkaisuuden tai määrän vuoksi, jatkamisesta ja sen syistä kerrotaan säädetyssä ajassa. Kielteinen päätös perustellaan.'),
  (v_doc, 'fi', '{9,4}', null,
   'Henkilöllä on oikeus tehdä valitus valvontaviranomaiselle, Suomessa tietosuojavaltuutetun toimistolle: https://tietosuoja.fi/ilmoitus-tietosuojavaltuutetulle. Yhteydenotto Aivomaa Oy:hyn ei rajoita tätä oikeutta.'),

  -- ── 10. Tietoturva ───────────────────────────────────────────────
  (v_doc, 'fi', '{10}', 'Tietoturva', null),
  (v_doc, 'fi', '{10,1}', null,
   'Pääsy tietoihin on rajattu roolin mukaan, ja rajaus on toteutettu tietokannassa eikä vain käyttöliittymässä. Salaiset avaimet ovat vain palvelinpuolella. Asiakirjat annetaan määräaikaisella linkillä, joka vanhenee viidessä minuutissa.'),
  (v_doc, 'fi', '{10,2}', null,
   'Tilaaja ei näe kuljetusliikkeen henkilöstön yhteystietoja eikä kuljetusliike tilaajan laskutustietoja, ellei työ sitä edellytä. Kuljetusliike ei näe muiden kuljetusliikkeiden kalustoa eikä niiden sijaintia.'),
  (v_doc, 'fi', '{10,3}', null,
   'Käyttäjä ei saa luovuttaa tunnuksiaan sivullisille eikä ladata palveluun tarpeettomia tietoja. Toimien laajuus mitoitetaan tietojen luonteen ja riskien mukaan; mikään toimenpide ei tee tietojenkäsittelystä ehdottoman turvallista.'),

  -- ── 11. Selosteen muutokset ──────────────────────────────────────
  (v_doc, 'fi', '{11}', 'Selosteen muutokset', null),
  (v_doc, 'fi', '{11,1}', null,
   'Kun käsittely muuttuu, seloste päivitetään ja siinä kerrotaan versio ja päivämäärä. Olennaisista muutoksista ilmoitetaan niitä koskeville käyttäjille, ja jos suostumus tarvitaan, se pyydetään erikseen.'),
  (v_doc, 'fi', '{11,2}', null,
   'Seloste on saatavilla RAHTIS-sivuston Tietosuoja-linkistä. Aiemmat versiot ja niiden hyväksymistiedot säilytetään.'),
  (v_doc, 'fi', '{11,3}', null, v_marker_fi),

  -- ══ English ═════════════════════════════════════════════════════

  (v_doc, 'en', '{1}', 'Controller', null),
  (v_doc, 'en', '{1,1}', null,
   'The controller for the purposes described in this notice is Aivomaa Oy (business ID 3592993-6), Kankarepolku 5F B335, 00770 Helsinki, Finland. For data protection matters: admin@rahtis.eu.'),
  (v_doc, 'en', '{1,2}', null,
   'This notice concerns representatives of companies, users of the service, drivers and the contact persons of transports. Data concerning a legal person is not necessarily personal data, but data concerning its employees and self-employed operators is protected in accordance with applicable law.'),
  (v_doc, 'en', '{1,3}', null,
   'Shippers and carriers may themselves determine the purposes of processing the data of their own employees and contacts. Their obligations do not replace those of Aivomaa Oy.'),

  (v_doc, 'en', '{2}', 'What data is processed', null),
  (v_doc, 'en', '{2,1}', null,
   'Company and settlement data: name, business ID, VAT number, addresses, billing details, bank account, e-invoicing address, payment data, and the record of accepted terms with their version and time of acceptance.'),
  (v_doc, 'en', '{2,2}', null,
   'User data: name, email address, telephone number, role and the company the user acts for. Driver data: name, telephone or WhatsApp number, languages used and the link to a vehicle or a job. This data is entered by the employer or the carrier.'),
  (v_doc, 'en', '{2,3}', null,
   'Transport data: stop addresses and coordinates, schedules, cargo details, the contact details of the sender and the consignee at the stops, the naming of the performer, and the stages and change log of the order with authors and times.'),
  (v_doc, 'en', '{2,4}', null,
   'The position of a stop confirmation: when the driver marks a stop as passed, the browser may provide the device''s location. One point from the moment of confirmation is stored together with its accuracy in metres. This is not continuous tracking: the location is neither requested nor stored at any other time, and if the browser does not provide it, the stop is marked as passed without coordinates. The position is visible to the shipper of that order and to the operator.'),
  (v_doc, 'en', '{2,5}', null,
   'Documents and materials: consignment notes, loading, unloading and damage photographs, signatures, company licences and insurance certificates, and other evidence attached to the order. Such material may contain contact persons'' details, vehicle registrations and images of people.'),
  (v_doc, 'en', '{2,6}', null,
   'Technical data: sign-ins, status changes, messages sent and their delivery state, incident records, and the data used to limit abuse of sign-in. The service uses no analytics or marketing cookies: a visitor who is not signed in is given no cookie at all, signing in sets a session cookie, and switching language sets a cookie that remembers the choice.'),

  (v_doc, 'en', '{3}', 'Where the data comes from', null),
  (v_doc, 'en', '{3,1}', null,
   'Data is obtained from the person themselves, from the company they act for, from the shipper, from the carrier, from those taking part in performing the order, and from the actions and documents in the service. Company registration details are checked against public registers.'),

  (v_doc, 'en', '{4}', 'Purposes and legal bases', null),
  (v_doc, 'en', '{4,1}', null,
   'Access, dealing with the representatives of companies, arranging and following transports, communication, delivering documents and showing performance: the legitimate interest of Aivomaa Oy and of the companies concerned in conducting and documenting a business relationship, assessed for necessity and against the rights of those concerned. Where the person is themselves a party to the contract, the data needed may be processed to conclude or perform their contract.'),
  (v_doc, 'en', '{4,2}', null,
   'Accounting, invoicing and meeting statutory requirements: a legal obligation of Aivomaa Oy. A contract with a company does not make each of its employees a party to that contract.'),
  (v_doc, 'en', '{4,3}', null,
   'Security, access control, prevention of misuse, verification of payment details, investigation of incidents and defence of claims: the legitimate interests of Aivomaa Oy and of the parties to the orders, with the necessary balancing of rights.'),
  (v_doc, 'en', '{4,4}', null,
   'For optional processing that requires consent, consent is requested separately and for a specified purpose. Consent may be withdrawn, which does not affect the lawfulness of processing carried out before withdrawal. Accepting the terms, or an employer entering a telephone number, is not a general consent to location data, marketing or the disclosure of data to AI services.'),
  (v_doc, 'en', '{4,5}', null,
   'The data needed to identify a company, to communicate, to perform an order and for statutory accounting is a precondition for those functions. Without it, registration, performance of the work or settlement may not be possible.'),

  (v_doc, 'en', '{5}', 'To whom data is disclosed', null),
  (v_doc, 'en', '{5,1}', null,
   'The parties to a transport receive the data their role requires: the performer receives the job, the addresses and the necessary contacts; the shipper receives the progress and documents of its own order. Registration alone gives no access to the data of other companies or to other orders.'),
  (v_doc, 'en', '{5,2}', null,
   'The technical suppliers of the service process data on behalf of Aivomaa Oy: Vercel Inc. (application platform; server functions run in the Paris region), Supabase (database, authentication and file storage; the project is in the AWS Paris region), TomTom (address suggestions and heavy-vehicle routing), MapTiler (map background tiles to the user''s browser) and Resend (email delivery).'),
  (v_doc, 'en', '{5,3}', null,
   'The address and routing service receives the address text, the coordinates of the stops and the technical details of the request in order to resolve coordinates and compute distance. No other personal data is passed to it. The map service receives the map tiles requested by the user''s browser.'),
  (v_doc, 'en', '{5,4}', null,
   'When the WhatsApp assistant is used, messages travel through the WhatsApp Business Platform (Meta) and the assistant''s answers are produced with Anthropic''s language model; the automation is built with n8n. These receive the content of the message and the job data needed to answer it. Using the assistant is voluntary, and the same work can be done in the cabinet.'),
  (v_doc, 'en', '{5,5}', null,
   'Data may be disclosed to banks and payment infrastructure for settlements, to professional advisers and insurers for the matter concerned, and to competent authorities on a lawful basis. Disclosure is limited to what is necessary.'),

  (v_doc, 'en', '{6}', 'Transfers outside the EEA', null),
  (v_doc, 'en', '{6,1}', null,
   'The application platform and the database are configured to run in Europe: server functions in the Paris region, and the database and files in the AWS Paris region.'),
  (v_doc, 'en', '{6,2}', null,
   'Some suppliers are established outside the EEA or may process data there. That is so in particular for message delivery and the language model of the WhatsApp assistant, and for any remote support.'),
  (v_doc, 'en', '{6,3}', null,
   'A transfer outside the EEA is permitted only under an applicable legal mechanism. The mere use of a well-known cloud service does not demonstrate that the requirements are met.'),
  (v_doc, 'en', '{6,4}', null, v_marker_en),

  (v_doc, 'en', '{7}', 'Location, messages and automation', null),
  (v_doc, 'en', '{7,1}', null,
   'The service uses the coordinates of route stops and the events of an order. The device''s location is requested only at the moment the driver marks a stop as passed, and one point is stored together with its accuracy. Providing the location is decided by the browser''s permission; refusing it prevents neither marking the stop nor performing the work.'),
  (v_doc, 'en', '{7,2}', null,
   'A WhatsApp number links the driver to the right job. Meta is responsible for the processing of messages within its own services under its own terms; Aivomaa Oy stores in the service those messages and attachments that relate to the job concerned.'),
  (v_doc, 'en', '{7,3}', null,
   'The service makes no decisions based solely on automated processing that would produce legal effects concerning a person or similarly significantly affect them. The automatic checks concern equipment and jobs: they limit which vehicles a job is visible to, close the decision window when the deadline passes, and send notifications.'),

  (v_doc, 'en', '{8}', 'Retention', null),
  (v_doc, 'en', '{8,1}', null,
   'Data is retained no longer than the purpose concerned requires, taking into account statutory accounting, contracts in force, possible claims and the defence of rights. The ending of access does not mean the immediate deletion of all settlement and transport documents.'),
  (v_doc, 'en', '{8,2}', null,
   'Accounting material is retained for the periods required by applicable law. For transport documents, the time limits for claims and the need to show performance are also taken into account. The retention period for invoices is not extended, without a separate basis, to all photographs, position points and technical logs.'),
  (v_doc, 'en', '{8,3}', null,
   'The following can be verified about technical data: resolved incident records are deleted 90 days after they were last seen, and the records limiting abuse of sign-in are deleted within a day. The cabinet shows completed jobs for the last eight weeks; that is a limit on the view, not a deletion period.'),
  (v_doc, 'en', '{8,4}', null, v_marker_en),
  (v_doc, 'en', '{8,5}', null,
   'Data needed for a pending dispute or a statutory claim may be retained until the matter is resolved and the applicable period has passed. Access to it is limited to that purpose.'),

  (v_doc, 'en', '{9}', 'Rights of the data subject', null),
  (v_doc, 'en', '{9,1}', null,
   'In the situations provided by law, a person has the right to be informed and to access their own data, to have inaccurate data corrected, to request erasure or restriction of processing, to object to processing based on legitimate interest, and to receive data in a portable form where the conditions of that right are met. These rights are not an unconditional requirement to delete documents that must be retained by law.'),
  (v_doc, 'en', '{9,2}', null,
   'Requests are sent to admin@rahtis.eu. Aivomaa Oy may request proportionate verification of identity in order to protect the data. A driver may address Aivomaa Oy directly about its own processing; a prior request to the employer is not a precondition for handling it.'),
  (v_doc, 'en', '{9,3}', null,
   'A reply is given without undue delay, normally within one month. Where the law allows an extension because of the complexity or number of requests, the extension and its reasons are communicated within the prescribed period. A refusal is reasoned.'),
  (v_doc, 'en', '{9,4}', null,
   'A person has the right to lodge a complaint with a supervisory authority, in Finland the Office of the Data Protection Ombudsman: https://tietosuoja.fi/en/notification-to-the-data-protection-ombudsman. Contacting Aivomaa Oy does not limit that right.'),

  (v_doc, 'en', '{10}', 'Security', null),
  (v_doc, 'en', '{10,1}', null,
   'Access to data is restricted by role, and the restriction is enforced in the database rather than only in the interface. Secret keys exist only on the server side. Documents are served through a time-limited link that expires in five minutes.'),
  (v_doc, 'en', '{10,2}', null,
   'A shipper does not see the carrier''s personnel contact details, and a carrier does not see the shipper''s billing details, unless the work requires it. A carrier does not see other carriers'' vehicles or their locations.'),
  (v_doc, 'en', '{10,3}', null,
   'A user must not pass their credentials to outsiders or upload unnecessary data to the service. The extent of the measures is set according to the nature of the data and the risks; no measure makes processing absolutely secure.'),

  (v_doc, 'en', '{11}', 'Changes to this notice', null),
  (v_doc, 'en', '{11,1}', null,
   'When processing changes, this notice is updated and states its version and date. Material changes are notified to the users concerned, and where consent is required it is requested separately.'),
  (v_doc, 'en', '{11,2}', null,
   'The notice is available through the Privacy link on the RAHTIS site. Earlier versions and their acceptance records are retained.'),
  (v_doc, 'en', '{11,3}', null, v_marker_en);

  raise notice 'PRIVACY: черновик редакции % заведён', (select version from public.legal_documents where id = v_doc);
end;
$$;
