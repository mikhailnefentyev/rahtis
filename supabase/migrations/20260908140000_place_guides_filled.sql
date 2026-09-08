-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · справочник площадок переезжает в базу
--
-- Агент обещал подсказать площадку и молчал: инструмент place_guide
-- читает таблицу, а тридцать восемь портов жили в коде сайта. Обещание
-- без данных хуже отсутствия инструмента — человек спрашивает и уходит
-- ни с чем.
--
-- Источник тот же файл src/lib/routing/places.ts: адреса названы
-- оператором, координаты взяты из ответа геокодера на эти адреса. Строки
-- собраны из него, а не набраны заново, — расходиться им негде.
--
-- ЧЕГО ЗДЕСЬ НЕТ. Часов работы и порядка въезда. Их никто не собирал, и
-- выдумать их нельзя: водитель приедет к закрытым воротам по нашему
-- слову. Поэтому каждая строка прямо говорит, что этого в справочнике
-- нет, — иначе модель заполнит пробел сама.
--
-- Поиск ищет и по телу строки: в нём лежат слова, которыми площадку
-- называют диспетчеры, включая русские. Без этого «Вуосаари» не нашлось
-- бы ничего, а «Vuosaari» нашлось бы.
--
-- company_id пустой: это площадки платформы, они видны всем. Своя
-- инструкция компании кладётся сюда же с её company_id и в выдаче
-- становится выше общей.
-- ═══════════════════════════════════════════════════════════════════

delete from public.place_guides where company_id is null;

insert into public.place_guides (place_key, locale, title, body) values
  ('hanko-port', 'fi', 'Hangon satama', 'Portin osoite: Korsmaninkatu 6, 10900 Hanko (Suomi).
Koordinaatit: 59.824178, 22.96404.
Haetaan myös nimillä: порт, ханко, hanko, hangon, satama, port, korsmaninkatu.
Aukioloaikoja ja porttiohjeita ei ole kirjattu tähän hakemistoon — kysy operaattorilta.'),
  ('hanko-port', 'en', 'Hangon satama', 'Gate address: Korsmaninkatu 6, 10900 Hanko (Finland).
Coordinates: 59.824178, 22.96404.
Also found by: порт, ханко, hanko, hangon, satama, port, korsmaninkatu.
Opening hours and gate instructions are not recorded in this directory — ask the operator.'),
  ('helsinki-vuosaari', 'fi', 'Helsinki · Vuosaari', 'Portin osoite: Satamakaari 24, 00980 Helsinki (Suomi).
Koordinaatit: 60.213578, 25.172049.
Haetaan myös nimillä: хельсинки, вуосаари, helsinki, vuosaari, nordsjö, nordsjo, satama, port, порт, satamakaari, rahti.
Aukioloaikoja ja porttiohjeita ei ole kirjattu tähän hakemistoon — kysy operaattorilta.'),
  ('helsinki-vuosaari', 'en', 'Helsinki · Vuosaari', 'Gate address: Satamakaari 24, 00980 Helsinki (Finland).
Coordinates: 60.213578, 25.172049.
Also found by: хельсинки, вуосаари, helsinki, vuosaari, nordsjö, nordsjo, satama, port, порт, satamakaari, rahti.
Opening hours and gate instructions are not recorded in this directory — ask the operator.'),
  ('helsinki-lansisatama', 'fi', 'Helsinki · Länsisatama', 'Portin osoite: Tyynenmerenkatu 8, 00220 Helsinki (Suomi).
Koordinaatit: 60.149625, 24.916633.
Haetaan myös nimillä: хельсинки, лянсисатама, западный, helsinki, länsisatama, lansisatama, länsiterminaali, lansiterminaali, jätkäsaari, jatkasaari, tyynenmerenkatu, tallink, silja, таллинк, eckerö, eckero, ekerö, ekero, экерё, экере, satama, port, порт.
Aukioloaikoja ja porttiohjeita ei ole kirjattu tähän hakemistoon — kysy operaattorilta.'),
  ('helsinki-lansisatama', 'en', 'Helsinki · Länsisatama', 'Gate address: Tyynenmerenkatu 8, 00220 Helsinki (Finland).
Coordinates: 60.149625, 24.916633.
Also found by: хельсинки, лянсисатама, западный, helsinki, länsisatama, lansisatama, länsiterminaali, lansiterminaali, jätkäsaari, jatkasaari, tyynenmerenkatu, tallink, silja, таллинк, eckerö, eckero, ekerö, ekero, экерё, экере, satama, port, порт.
Opening hours and gate instructions are not recorded in this directory — ask the operator.'),
  ('helsinki-etelasatama', 'fi', 'Helsinki · Eteläsatama', 'Portin osoite: Olympiaranta 1, 00140 Helsinki (Suomi).
Koordinaatit: 60.160774, 24.957726.
Haetaan myös nimillä: хельсинки, этеля, этелясатама, южный, helsinki, eteläsatama, etelasatama, olympiaterminaali, olympiaranta, olympia, олимпия, tallink, silja, таллинк, силья, satama, port, порт.
Aukioloaikoja ja porttiohjeita ei ole kirjattu tähän hakemistoon — kysy operaattorilta.'),
  ('helsinki-etelasatama', 'en', 'Helsinki · Eteläsatama', 'Gate address: Olympiaranta 1, 00140 Helsinki (Finland).
Coordinates: 60.160774, 24.957726.
Also found by: хельсинки, этеля, этелясатама, южный, helsinki, eteläsatama, etelasatama, olympiaterminaali, olympiaranta, olympia, олимпия, tallink, silja, таллинк, силья, satama, port, порт.
Opening hours and gate instructions are not recorded in this directory — ask the operator.'),
  ('helsinki-katajanokka', 'fi', 'Helsinki · Katajanokka', 'Portin osoite: Katajanokanlaituri 8, 00160 Helsinki (Suomi).
Koordinaatit: 60.163838, 24.96835.
Haetaan myös nimillä: хельсинки, катаянокка, helsinki, katajanokka, katajanokan, katajanokanlaituri, viking, line, викинг, satama, port, порт.
Aukioloaikoja ja porttiohjeita ei ole kirjattu tähän hakemistoon — kysy operaattorilta.'),
  ('helsinki-katajanokka', 'en', 'Helsinki · Katajanokka', 'Gate address: Katajanokanlaituri 8, 00160 Helsinki (Finland).
Coordinates: 60.163838, 24.96835.
Also found by: хельсинки, катаянокка, helsinki, katajanokka, katajanokan, katajanokanlaituri, viking, line, викинг, satama, port, порт.
Opening hours and gate instructions are not recorded in this directory — ask the operator.'),
  ('rauma-port', 'fi', 'Rauman satama', 'Portin osoite: Hakunintie 28, 26100 Rauma (Suomi).
Koordinaatit: 61.129872, 21.466139.
Haetaan myös nimillä: порт, раума, rauma, rauman, satama, port, hakunintie.
Aukioloaikoja ja porttiohjeita ei ole kirjattu tähän hakemistoon — kysy operaattorilta.'),
  ('rauma-port', 'en', 'Rauman satama', 'Gate address: Hakunintie 28, 26100 Rauma (Finland).
Coordinates: 61.129872, 21.466139.
Also found by: порт, раума, rauma, rauman, satama, port, hakunintie.
Opening hours and gate instructions are not recorded in this directory — ask the operator.'),
  ('kotka-hietanen', 'fi', 'Kotka · Hietanen', 'Portin osoite: Murtajantie 2, 48100 Kotka (Suomi).
Koordinaatit: 60.479838, 26.942221.
Haetaan myös nimillä: порт, котка, хиетанен, kotka, hietanen, satama, port, murtajantie.
Aukioloaikoja ja porttiohjeita ei ole kirjattu tähän hakemistoon — kysy operaattorilta.'),
  ('kotka-hietanen', 'en', 'Kotka · Hietanen', 'Gate address: Murtajantie 2, 48100 Kotka (Finland).
Coordinates: 60.479838, 26.942221.
Also found by: порт, котка, хиетанен, kotka, hietanen, satama, port, murtajantie.
Opening hours and gate instructions are not recorded in this directory — ask the operator.'),
  ('naantali-port', 'fi', 'Naantalin satama', 'Portin osoite: Satamatie 13, 21100 Naantali (Suomi).
Koordinaatit: 60.457947, 22.043417.
Haetaan myös nimillä: порт, наантали, naantali, satama, port, satamatie.
Aukioloaikoja ja porttiohjeita ei ole kirjattu tähän hakemistoon — kysy operaattorilta.'),
  ('naantali-port', 'en', 'Naantalin satama', 'Gate address: Satamatie 13, 21100 Naantali (Finland).
Coordinates: 60.457947, 22.043417.
Also found by: порт, наантали, naantali, satama, port, satamatie.
Opening hours and gate instructions are not recorded in this directory — ask the operator.'),
  ('turku-viking', 'fi', 'Turku · Viking Line', 'Portin osoite: Kuninkaantie, 20100 Turku (Suomi).
Koordinaatit: 60.433165, 22.222195.
Haetaan myös nimillä: турку, викинг, turku, viking, line, satama, порт, port.
Aukioloaikoja ja porttiohjeita ei ole kirjattu tähän hakemistoon — kysy operaattorilta.'),
  ('turku-viking', 'en', 'Turku · Viking Line', 'Gate address: Kuninkaantie, 20100 Turku (Finland).
Coordinates: 60.433165, 22.222195.
Also found by: турку, викинг, turku, viking, line, satama, порт, port.
Opening hours and gate instructions are not recorded in this directory — ask the operator.'),
  ('turku-silja', 'fi', 'Turku · Silja Line', 'Portin osoite: Linnankatu 91, 20100 Turku (Suomi).
Koordinaatit: 60.435567, 22.217776.
Haetaan myös nimillä: турку, силья, сильялайн, turku, silja, tallink, line, satama, порт, port.
Aukioloaikoja ja porttiohjeita ei ole kirjattu tähän hakemistoon — kysy operaattorilta.'),
  ('turku-silja', 'en', 'Turku · Silja Line', 'Gate address: Linnankatu 91, 20100 Turku (Finland).
Coordinates: 60.435567, 22.217776.
Also found by: турку, силья, сильялайн, turku, silja, tallink, line, satama, порт, port.
Opening hours and gate instructions are not recorded in this directory — ask the operator.'),
  ('hamina-port', 'fi', 'HaminaKotka · Hamina', 'Portin osoite: Hiirenkarintie, 49460 Hamina (Suomi).
Koordinaatit: 60.539762, 27.161054.
Haetaan myös nimillä: хамина, hamina, haminakotka, satama, порт, port, hiirenkarintie.
Aukioloaikoja ja porttiohjeita ei ole kirjattu tähän hakemistoon — kysy operaattorilta.'),
  ('hamina-port', 'en', 'HaminaKotka · Hamina', 'Gate address: Hiirenkarintie, 49460 Hamina (Finland).
Coordinates: 60.539762, 27.161054.
Also found by: хамина, hamina, haminakotka, satama, порт, port, hiirenkarintie.
Opening hours and gate instructions are not recorded in this directory — ask the operator.'),
  ('pori-mantyluoto', 'fi', 'Pori · Mäntyluoto', 'Portin osoite: Merisatamantie 4, 28880 Pori (Suomi).
Koordinaatit: 61.592165, 21.493232.
Haetaan myös nimillä: пори, мянтылуото, pori, mantyluoto, mäntyluoto, satama, порт, port, merisatamantie.
Aukioloaikoja ja porttiohjeita ei ole kirjattu tähän hakemistoon — kysy operaattorilta.'),
  ('pori-mantyluoto', 'en', 'Pori · Mäntyluoto', 'Gate address: Merisatamantie 4, 28880 Pori (Finland).
Coordinates: 61.592165, 21.493232.
Also found by: пори, мянтылуото, pori, mantyluoto, mäntyluoto, satama, порт, port, merisatamantie.
Opening hours and gate instructions are not recorded in this directory — ask the operator.'),
  ('vaasa-wasaline', 'fi', 'Vaasa · Wasaline', 'Portin osoite: Laivanvarustajankatu 6, 65170 Vaasa (Suomi).
Koordinaatit: 63.087635, 21.557295.
Haetaan myös nimillä: вааса, васа, васалайн, vaasa, vasa, wasaline, vaskiluoto, vasklot, kvarken, merenkurkku, satama, порт, port.
Aukioloaikoja ja porttiohjeita ei ole kirjattu tähän hakemistoon — kysy operaattorilta.'),
  ('vaasa-wasaline', 'en', 'Vaasa · Wasaline', 'Gate address: Laivanvarustajankatu 6, 65170 Vaasa (Finland).
Coordinates: 63.087635, 21.557295.
Also found by: вааса, васа, васалайн, vaasa, vasa, wasaline, vaskiluoto, vasklot, kvarken, merenkurkku, satama, порт, port.
Opening hours and gate instructions are not recorded in this directory — ask the operator.'),
  ('kokkola-port', 'fi', 'Kokkolan satama', 'Portin osoite: Satamatie 330, 67900 Kokkola (Suomi).
Koordinaatit: 63.843609, 23.058471.
Haetaan myös nimillä: коккола, kokkola, karleby, satama, порт, port, satamatie.
Aukioloaikoja ja porttiohjeita ei ole kirjattu tähän hakemistoon — kysy operaattorilta.'),
  ('kokkola-port', 'en', 'Kokkolan satama', 'Gate address: Satamatie 330, 67900 Kokkola (Finland).
Coordinates: 63.843609, 23.058471.
Also found by: коккола, kokkola, karleby, satama, порт, port, satamatie.
Opening hours and gate instructions are not recorded in this directory — ask the operator.'),
  ('oulu-oritkari', 'fi', 'Oulu · Oritkari', 'Portin osoite: Poikkimaantie 16, 90400 Oulu (Suomi).
Koordinaatit: 64.991073, 25.426792.
Haetaan myös nimillä: оулу, оритькари, oulu, uleaborg, oritkari, satama, порт, port, poikkimaantie.
Aukioloaikoja ja porttiohjeita ei ole kirjattu tähän hakemistoon — kysy operaattorilta.'),
  ('oulu-oritkari', 'en', 'Oulu · Oritkari', 'Gate address: Poikkimaantie 16, 90400 Oulu (Finland).
Coordinates: 64.991073, 25.426792.
Also found by: оулу, оритькари, oulu, uleaborg, oritkari, satama, порт, port, poikkimaantie.
Opening hours and gate instructions are not recorded in this directory — ask the operator.'),
  ('kemi-ajos', 'fi', 'Kemi · Ajos', 'Portin osoite: Ajoksentie 708, 94900 Kemi (Suomi).
Koordinaatit: 65.668129, 24.529924.
Haetaan myös nimillä: кеми, айос, kemi, ajos, satama, порт, port, ajoksentie.
Aukioloaikoja ja porttiohjeita ei ole kirjattu tähän hakemistoon — kysy operaattorilta.'),
  ('kemi-ajos', 'en', 'Kemi · Ajos', 'Gate address: Ajoksentie 708, 94900 Kemi (Finland).
Coordinates: 65.668129, 24.529924.
Also found by: кеми, айос, kemi, ajos, satama, порт, port, ajoksentie.
Opening hours and gate instructions are not recorded in this directory — ask the operator.'),
  ('umea-holmsund', 'fi', 'Umeå · Holmsund', 'Portin osoite: Blå vägen 4, 913 32 Holmsund (Ruotsi).
Koordinaatit: 63.681067, 20.339712.
Haetaan myös nimillä: умео, умеа, холмсунд, umea, holmsund, wasaline, kvarken, hamn, satama, порт, port.
Aukioloaikoja ja porttiohjeita ei ole kirjattu tähän hakemistoon — kysy operaattorilta.'),
  ('umea-holmsund', 'en', 'Umeå · Holmsund', 'Gate address: Blå vägen 4, 913 32 Holmsund (Sweden).
Coordinates: 63.681067, 20.339712.
Also found by: умео, умеа, холмсунд, umea, holmsund, wasaline, kvarken, hamn, satama, порт, port.
Opening hours and gate instructions are not recorded in this directory — ask the operator.'),
  ('stockholm-varta', 'fi', 'Stockholm · Värtahamnen', 'Portin osoite: Hamnpirsvägen 10, 115 41 Stockholm (Ruotsi).
Koordinaatit: 59.351467, 18.112716.
Haetaan myös nimillä: стокгольм, вярта, вяртахамнен, stockholm, varta, vartahamnen, tallink, silja, hamn, порт, port.
Aukioloaikoja ja porttiohjeita ei ole kirjattu tähän hakemistoon — kysy operaattorilta.'),
  ('stockholm-varta', 'en', 'Stockholm · Värtahamnen', 'Gate address: Hamnpirsvägen 10, 115 41 Stockholm (Sweden).
Coordinates: 59.351467, 18.112716.
Also found by: стокгольм, вярта, вяртахамнен, stockholm, varta, vartahamnen, tallink, silja, hamn, порт, port.
Opening hours and gate instructions are not recorded in this directory — ask the operator.'),
  ('stockholm-tegelvik', 'fi', 'Stockholm · Tegelvikshamn', 'Portin osoite: Stadsgården, Tegelvikshamn, 116 30 Stockholm (Ruotsi).
Koordinaatit: 59.316, 18.0958.
Haetaan myös nimillä: стокгольм, стадсгорден, тегельвик, викинг, stockholm, stadsgarden, tegelvik, tegelvikshamn, viking, line, hamn, порт, port.
Aukioloaikoja ja porttiohjeita ei ole kirjattu tähän hakemistoon — kysy operaattorilta.'),
  ('stockholm-tegelvik', 'en', 'Stockholm · Tegelvikshamn', 'Gate address: Stadsgården, Tegelvikshamn, 116 30 Stockholm (Sweden).
Coordinates: 59.316, 18.0958.
Also found by: стокгольм, стадсгорден, тегельвик, викинг, stockholm, stadsgarden, tegelvik, tegelvikshamn, viking, line, hamn, порт, port.
Opening hours and gate instructions are not recorded in this directory — ask the operator.'),
  ('kapellskar', 'fi', 'Kapellskär', 'Portin osoite: Västra Kapellskär 8, 760 15 Gräddö (Ruotsi).
Koordinaatit: 59.722722, 19.061172.
Haetaan myös nimillä: капельскар, капельшер, kapellskar, graddo, finnlines, hamn, порт, port.
Aukioloaikoja ja porttiohjeita ei ole kirjattu tähän hakemistoon — kysy operaattorilta.'),
  ('kapellskar', 'en', 'Kapellskär', 'Gate address: Västra Kapellskär 8, 760 15 Gräddö (Sweden).
Coordinates: 59.722722, 19.061172.
Also found by: капельскар, капельшер, kapellskar, graddo, finnlines, hamn, порт, port.
Opening hours and gate instructions are not recorded in this directory — ask the operator.'),
  ('stockholm-norvik', 'fi', 'Stockholm Norvik · Nynäshamn', 'Portin osoite: Norvikvägen 18, 149 45 Nynäshamn (Ruotsi).
Koordinaatit: 58.937555, 17.9745.
Haetaan myös nimillä: норвик, нюнесхамн, norvik, nynashamn, hutchison, hamn, порт, port, container, kontti.
Aukioloaikoja ja porttiohjeita ei ole kirjattu tähän hakemistoon — kysy operaattorilta.'),
  ('stockholm-norvik', 'en', 'Stockholm Norvik · Nynäshamn', 'Gate address: Norvikvägen 18, 149 45 Nynäshamn (Sweden).
Coordinates: 58.937555, 17.9745.
Also found by: норвик, нюнесхамн, norvik, nynashamn, hutchison, hamn, порт, port, container, kontti.
Opening hours and gate instructions are not recorded in this directory — ask the operator.'),
  ('goteborg-portentry', 'fi', 'Göteborg · Port Entry', 'Portin osoite: Ytterhamnsvägen 1, 418 78 Göteborg (Ruotsi).
Koordinaatit: 57.701867, 11.858883.
Haetaan myös nimillä: гётеборг, гетеборг, goteborg, gothenburg, entry, apm, skandiahamnen, hamn, порт, port, container, kontti.
Aukioloaikoja ja porttiohjeita ei ole kirjattu tähän hakemistoon — kysy operaattorilta.'),
  ('goteborg-portentry', 'en', 'Göteborg · Port Entry', 'Gate address: Ytterhamnsvägen 1, 418 78 Göteborg (Sweden).
Coordinates: 57.701867, 11.858883.
Also found by: гётеборг, гетеборг, goteborg, gothenburg, entry, apm, skandiahamnen, hamn, порт, port, container, kontti.
Opening hours and gate instructions are not recorded in this directory — ask the operator.'),
  ('goteborg-stena-dk', 'fi', 'Göteborg · Stena Danmarksterminalen', 'Portin osoite: Emigrantvägen 20, 413 27 Göteborg (Ruotsi).
Koordinaatit: 57.701187, 11.946307.
Haetaan myös nimillä: гётеборг, гетеборг, стена, goteborg, gothenburg, stena, danmarksterminalen, emigrantvagen, hamn, порт, port.
Aukioloaikoja ja porttiohjeita ei ole kirjattu tähän hakemistoon — kysy operaattorilta.'),
  ('goteborg-stena-dk', 'en', 'Göteborg · Stena Danmarksterminalen', 'Gate address: Emigrantvägen 20, 413 27 Göteborg (Sweden).
Coordinates: 57.701187, 11.946307.
Also found by: гётеборг, гетеборг, стена, goteborg, gothenburg, stena, danmarksterminalen, emigrantvagen, hamn, порт, port.
Opening hours and gate instructions are not recorded in this directory — ask the operator.'),
  ('helsingborg-gate', 'fi', 'Helsingborg · Central Gate', 'Portin osoite: Massgodsleden 4, 252 28 Helsingborg (Ruotsi).
Koordinaatit: 56.028709, 12.700896.
Haetaan myös nimillä: хельсингборг, helsingborg, gate, hamn, порт, port, container, kontti, massgodsleden.
Aukioloaikoja ja porttiohjeita ei ole kirjattu tähän hakemistoon — kysy operaattorilta.'),
  ('helsingborg-gate', 'en', 'Helsingborg · Central Gate', 'Gate address: Massgodsleden 4, 252 28 Helsingborg (Sweden).
Coordinates: 56.028709, 12.700896.
Also found by: хельсингборг, helsingborg, gate, hamn, порт, port, container, kontti, massgodsleden.
Opening hours and gate instructions are not recorded in this directory — ask the operator.'),
  ('malmo-finnlines', 'fi', 'Malmö · Finnlines', 'Portin osoite: Lappögatan 3B, 211 24 Malmö (Ruotsi).
Koordinaatit: 55.629423, 13.008892.
Haetaan myös nimillä: мальмё, мальме, malmo, finnlines, norra, hamnen, hamn, порт, port, lappogatan.
Aukioloaikoja ja porttiohjeita ei ole kirjattu tähän hakemistoon — kysy operaattorilta.'),
  ('malmo-finnlines', 'en', 'Malmö · Finnlines', 'Gate address: Lappögatan 3B, 211 24 Malmö (Sweden).
Coordinates: 55.629423, 13.008892.
Also found by: мальмё, мальме, malmo, finnlines, norra, hamnen, hamn, порт, port, lappogatan.
Opening hours and gate instructions are not recorded in this directory — ask the operator.'),
  ('trelleborg-port', 'fi', 'Trelleborgs hamn', 'Portin osoite: Norra Nyhamnsgatan 1A, 231 61 Trelleborg (Ruotsi).
Koordinaatit: 55.373539, 13.142069.
Haetaan myös nimillä: треллеборг, trelleborg, hamn, порт, port, rostock, travemunde, nyhamnsgatan.
Aukioloaikoja ja porttiohjeita ei ole kirjattu tähän hakemistoon — kysy operaattorilta.'),
  ('trelleborg-port', 'en', 'Trelleborgs hamn', 'Gate address: Norra Nyhamnsgatan 1A, 231 61 Trelleborg (Sweden).
Coordinates: 55.373539, 13.142069.
Also found by: треллеборг, trelleborg, hamn, порт, port, rostock, travemunde, nyhamnsgatan.
Opening hours and gate instructions are not recorded in this directory — ask the operator.'),
  ('stromstad-colorline', 'fi', 'Strömstad · Color Line', 'Portin osoite: Torskholmen, 452 31 Strömstad (Ruotsi).
Koordinaatit: 58.935797, 11.170935.
Haetaan myös nimillä: стрёмстад, стремстад, stromstad, color, line, torskholmen, hamn, порт, port.
Aukioloaikoja ja porttiohjeita ei ole kirjattu tähän hakemistoon — kysy operaattorilta.'),
  ('stromstad-colorline', 'en', 'Strömstad · Color Line', 'Gate address: Torskholmen, 452 31 Strömstad (Sweden).
Coordinates: 58.935797, 11.170935.
Also found by: стрёмстад, стремстад, stromstad, color, line, torskholmen, hamn, порт, port.
Opening hours and gate instructions are not recorded in this directory — ask the operator.'),
  ('oslo-yilport', 'fi', 'Oslo · Yilport, Sjursøya', 'Portin osoite: Sjursøya 9, 0193 Oslo (Norja).
Koordinaatit: 59.888232, 10.755263.
Haetaan myös nimillä: осло, шурсёйа, сюрсойа, oslo, yilport, sjursoya, havn, порт, port, container, kontti.
Aukioloaikoja ja porttiohjeita ei ole kirjattu tähän hakemistoon — kysy operaattorilta.'),
  ('oslo-yilport', 'en', 'Oslo · Yilport, Sjursøya', 'Gate address: Sjursøya 9, 0193 Oslo (Norway).
Coordinates: 59.888232, 10.755263.
Also found by: осло, шурсёйа, сюрсойа, oslo, yilport, sjursoya, havn, порт, port, container, kontti.
Opening hours and gate instructions are not recorded in this directory — ask the operator.'),
  ('oslo-colorline', 'fi', 'Oslo · Color Line, Hjortnes', 'Portin osoite: Filipstadveien 16, 0250 Oslo (Norja).
Koordinaatit: 59.909079, 10.713785.
Haetaan myös nimillä: осло, колорлайн, хьортнес, oslo, color, line, hjortnes, filipstad, filipstadveien, kiel, havn, порт, port.
Aukioloaikoja ja porttiohjeita ei ole kirjattu tähän hakemistoon — kysy operaattorilta.'),
  ('oslo-colorline', 'en', 'Oslo · Color Line, Hjortnes', 'Gate address: Filipstadveien 16, 0250 Oslo (Norway).
Coordinates: 59.909079, 10.713785.
Also found by: осло, колорлайн, хьортнес, oslo, color, line, hjortnes, filipstad, filipstadveien, kiel, havn, порт, port.
Opening hours and gate instructions are not recorded in this directory — ask the operator.'),
  ('oslo-vippetangen', 'fi', 'Oslo · Vippetangen', 'Portin osoite: Akershusstranda 31, 0150 Oslo (Norja).
Koordinaatit: 59.90293, 10.74314.
Haetaan myös nimillä: осло, виппетанген, oslo, vippetangen, dfds, stena, akershusstranda, havn, порт, port.
Aukioloaikoja ja porttiohjeita ei ole kirjattu tähän hakemistoon — kysy operaattorilta.'),
  ('oslo-vippetangen', 'en', 'Oslo · Vippetangen', 'Gate address: Akershusstranda 31, 0150 Oslo (Norway).
Coordinates: 59.90293, 10.74314.
Also found by: осло, виппетанген, oslo, vippetangen, dfds, stena, akershusstranda, havn, порт, port.
Opening hours and gate instructions are not recorded in this directory — ask the operator.'),
  ('larvik-colorline', 'fi', 'Larvik · Color Line', 'Portin osoite: Revet 8, 3263 Larvik (Norja).
Koordinaatit: 59.040573, 10.047404.
Haetaan myös nimillä: ларвик, larvik, color, line, revet, hirtshals, havn, порт, port.
Aukioloaikoja ja porttiohjeita ei ole kirjattu tähän hakemistoon — kysy operaattorilta.'),
  ('larvik-colorline', 'en', 'Larvik · Color Line', 'Gate address: Revet 8, 3263 Larvik (Norway).
Coordinates: 59.040573, 10.047404.
Also found by: ларвик, larvik, color, line, revet, hirtshals, havn, порт, port.
Opening hours and gate instructions are not recorded in this directory — ask the operator.'),
  ('kristiansand-colorline', 'fi', 'Kristiansand · Color Line', 'Portin osoite: Vestre Strandgate 31, 4611 Kristiansand (Norja).
Koordinaatit: 58.144565, 7.991197.
Haetaan myös nimillä: кристиансанн, kristiansand, color, line, havn, порт, port.
Aukioloaikoja ja porttiohjeita ei ole kirjattu tähän hakemistoon — kysy operaattorilta.'),
  ('kristiansand-colorline', 'en', 'Kristiansand · Color Line', 'Gate address: Vestre Strandgate 31, 4611 Kristiansand (Norway).
Coordinates: 58.144565, 7.991197.
Also found by: кристиансанн, kristiansand, color, line, havn, порт, port.
Opening hours and gate instructions are not recorded in this directory — ask the operator.'),
  ('sandefjord-colorline', 'fi', 'Sandefjord · Color Line', 'Portin osoite: Strandpromenaden 20, 3210 Sandefjord (Norja).
Koordinaatit: 59.126944, 10.228017.
Haetaan myös nimillä: сандефьорд, sandefjord, color, line, stromstad, havn, порт, port.
Aukioloaikoja ja porttiohjeita ei ole kirjattu tähän hakemistoon — kysy operaattorilta.'),
  ('sandefjord-colorline', 'en', 'Sandefjord · Color Line', 'Gate address: Strandpromenaden 20, 3210 Sandefjord (Norway).
Coordinates: 59.126944, 10.228017.
Also found by: сандефьорд, sandefjord, color, line, stromstad, havn, порт, port.
Opening hours and gate instructions are not recorded in this directory — ask the operator.'),
  ('frederikshavn-dfds', 'fi', 'Frederikshavn · DFDS', 'Portin osoite: Færgehavnsvej 31, 9900 Frederikshavn (Tanska).
Koordinaatit: 57.43459, 10.537014.
Haetaan myös nimillä: фредериксхавн, frederikshavn, dfds, faergehavnsvej, havn, порт, port.
Aukioloaikoja ja porttiohjeita ei ole kirjattu tähän hakemistoon — kysy operaattorilta.'),
  ('frederikshavn-dfds', 'en', 'Frederikshavn · DFDS', 'Gate address: Færgehavnsvej 31, 9900 Frederikshavn (Denmark).
Coordinates: 57.43459, 10.537014.
Also found by: фредериксхавн, frederikshavn, dfds, faergehavnsvej, havn, порт, port.
Opening hours and gate instructions are not recorded in this directory — ask the operator.'),
  ('frederikshavn-stena', 'fi', 'Frederikshavn · Stena Line', 'Portin osoite: Færgehavnsvej 10, 9900 Frederikshavn (Tanska).
Koordinaatit: 57.434581, 10.54364.
Haetaan myös nimillä: фредериксхавн, стена, frederikshavn, stena, line, havn, порт, port.
Aukioloaikoja ja porttiohjeita ei ole kirjattu tähän hakemistoon — kysy operaattorilta.'),
  ('frederikshavn-stena', 'en', 'Frederikshavn · Stena Line', 'Gate address: Færgehavnsvej 10, 9900 Frederikshavn (Denmark).
Coordinates: 57.434581, 10.54364.
Also found by: фредериксхавн, стена, frederikshavn, stena, line, havn, порт, port.
Opening hours and gate instructions are not recorded in this directory — ask the operator.'),
  ('hirtshals-colorline', 'fi', 'Hirtshals · Color Line', 'Portin osoite: Dalsagervej 5, 9850 Hirtshals (Tanska).
Koordinaatit: 57.576132, 9.986374.
Haetaan myös nimillä: хиртсхальс, hirtshals, color, line, dalsagervej, havn, порт, port.
Aukioloaikoja ja porttiohjeita ei ole kirjattu tähän hakemistoon — kysy operaattorilta.'),
  ('hirtshals-colorline', 'en', 'Hirtshals · Color Line', 'Gate address: Dalsagervej 5, 9850 Hirtshals (Denmark).
Coordinates: 57.576132, 9.986374.
Also found by: хиртсхальс, hirtshals, color, line, dalsagervej, havn, порт, port.
Opening hours and gate instructions are not recorded in this directory — ask the operator.'),
  ('kobenhavn-dfds', 'fi', 'København · DFDS', 'Portin osoite: Dampfærgevej 30, 2100 København Ø (Tanska).
Koordinaatit: 55.70116, 12.595405.
Haetaan myös nimillä: копенгаген, kobenhavn, copenhagen, dfds, dampfaergevej, havn, порт, port.
Aukioloaikoja ja porttiohjeita ei ole kirjattu tähän hakemistoon — kysy operaattorilta.'),
  ('kobenhavn-dfds', 'en', 'København · DFDS', 'Gate address: Dampfærgevej 30, 2100 København Ø (Denmark).
Coordinates: 55.70116, 12.595405.
Also found by: копенгаген, kobenhavn, copenhagen, dfds, dampfaergevej, havn, порт, port.
Opening hours and gate instructions are not recorded in this directory — ask the operator.'),
  ('esbjerg-dfds', 'fi', 'Esbjerg · DFDS', 'Portin osoite: Zodiakvej 5, 6700 Esbjerg (Tanska).
Koordinaatit: 55.453823, 8.488956.
Haetaan myös nimillä: эсбьерг, esbjerg, dfds, zodiakvej, immingham, havn, порт, port.
Aukioloaikoja ja porttiohjeita ei ole kirjattu tähän hakemistoon — kysy operaattorilta.'),
  ('esbjerg-dfds', 'en', 'Esbjerg · DFDS', 'Gate address: Zodiakvej 5, 6700 Esbjerg (Denmark).
Coordinates: 55.453823, 8.488956.
Also found by: эсбьерг, esbjerg, dfds, zodiakvej, immingham, havn, порт, port.
Opening hours and gate instructions are not recorded in this directory — ask the operator.');


-- ── Поиск заглядывает и в тело ─────────────────────────────────────

create or replace function public.agent_place_guide(
  p_conversation_id uuid,
  p_token uuid,
  p_query text
)
returns table (place_key text, title text, body text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_ctx public.conversations;
begin
  v_ctx := app.agent_context(p_conversation_id, p_token);

  return query
  select g.place_key, g.title, g.body
  from public.place_guides g
  where (g.company_id is null or g.company_id = v_ctx.company_id)
    and (
      g.place_key ilike '%' || btrim(p_query) || '%'
      or g.title ilike '%' || btrim(p_query) || '%'
      /*
       * И по телу: там лежат слова, которыми площадку называют
       * диспетчеры, включая русские. Иначе «Вуосаари» не находит
       * ничего, а «Vuosaari» находит.
       */
      or g.body ilike '%' || btrim(p_query) || '%'
    )
  order by (g.company_id is not null) desc, g.place_key
  limit 10;
end;
$$;

revoke all on function public.agent_place_guide(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.agent_place_guide(uuid, uuid, text) to agent, service_role;
