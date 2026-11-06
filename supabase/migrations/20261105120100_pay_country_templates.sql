-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · шаблоны оплаты и суточных по странам (5.11.2026)
--
-- Шаблоны оператора (company_id is null) из docs/pay/seed-data.json —
-- цифры сверены с первоисточниками 2026-11-05. Перевозчик копирует
-- шаблон себе и правит. Не вполне законные схемы — с legality GREY или
-- NON_COMPLIANT: показываются рекомендательно, с предупреждением.
-- Не заведено (нет в первоисточниках): польские 60 zł с 2027, латвийский
-- законопроект о сверхурочных 50 %.
-- ═══════════════════════════════════════════════════════════════════

-- ── Наборы правил оплаты ───────────────────────────────────────────

insert into public.tes_rule_sets (
  company_id, name, valid_from, base_hourly_cents, daily_regular_minutes, overtime_basis,
  overtime1_minutes, overtime1_bps, overtime2_bps, night_start, night_end, night_cents, night_bps,
  saturday_bps, sunday_bps, holidays_as_sunday, min_paid_minutes, note, currency,
  country, template_code, legality, source_note, base_monthly_cents, min_monthly_cents, holiday_bps
) values (
  null, 'PL · Etat, transport krajowy (umowa o pracę)', date '2026-01-01', 3140, 480, 'DAY',
  1440, 5000, 10000, '22:00', '06:00', 572, 0,
  0, 0, false, 0, 'Pensja ≥ płaca minimalna 4 806 zł (2026); nadgodziny +50 % (+100 % w nocy, niedziele i święta — ustaw ręcznie); dodatek nocny 20 % stawki godzinowej z płacy minimalnej. Diety krajowe — osobny zestaw.', 'PLN',
  'PL', 'PL_KRAJ_ETAT', 'LEGAL', 'Dz.U. 2025 poz. 1242 (płaca minimalna); Kodeks pracy art. 151¹, 151⁸; ustawa o czasie pracy kierowców (Dz.U. 2022 poz. 1473).', 480600, 480600, 0
);

insert into public.tes_rule_sets (
  company_id, name, valid_from, base_hourly_cents, daily_regular_minutes, overtime_basis,
  overtime1_minutes, overtime1_bps, overtime2_bps, night_start, night_end, night_cents, night_bps,
  saturday_bps, sunday_bps, holidays_as_sunday, min_paid_minutes, note, currency,
  country, template_code, legality, source_note, base_monthly_cents, min_monthly_cents, holiday_bps
) values (
  null, 'PL · Etat, transport międzynarodowy (podstawa + dodatek)', date '2026-01-01', 3140, 480, 'DAY',
  1440, 5000, 10000, '22:00', '06:00', 572, 0,
  0, 0, false, 0, 'Podstawa ≥ płaca minimalna, a dodatek za dzień za granicą jest wynagrodzeniem (od 2022 to nie podróż służbowa): ulga PIT 20 € i ZUS 60 € dziennie. Dodatek — zestaw „Dodatek zagraniczny”. Przy kabotażu i cross-trade obowiązuje płaca minimalna kraju delegowania.', 'PLN',
  'PL', 'PL_MIEDZYNARODOWY', 'LEGAL', 'Ustawa o czasie pracy kierowców art. 21b, 26g; ustawa o PIT art. 21 ust. 1 pkt 23d; Dyrektywa (UE) 2020/1057.', 480600, 480600, 0
);

insert into public.tes_rule_sets (
  company_id, name, valid_from, base_hourly_cents, daily_regular_minutes, overtime_basis,
  overtime1_minutes, overtime1_bps, overtime2_bps, night_start, night_end, night_cents, night_bps,
  saturday_bps, sunday_bps, holidays_as_sunday, min_paid_minutes, note, currency,
  country, template_code, legality, source_note, base_monthly_cents, min_monthly_cents, holiday_bps
) values (
  null, 'EE · Töötasu + välislähetus', date '2026-04-01', 567, 480, 'DAY',
  1440, 5000, 5000, '22:00', '06:00', 0, 2500,
  0, 0, false, 0, 'Töötasu ≥ alammäär 946 € (alates 1.4.2026); öötöö +25 %, ületunnid +50 % (rahas), riigipüha +100 %. Päevaraha — eraldi komplekt (75 €/40 €).', 'EUR',
  'EE', 'EE_LAHETUS', 'LEGAL', 'VV määrus nr 36, RT I, 24.03.2026, 5; TLS § 44 lg 7, § 45; TuMS § 13 lg 3.', 94600, 94600, 10000
);

insert into public.tes_rule_sets (
  company_id, name, valid_from, base_hourly_cents, daily_regular_minutes, overtime_basis,
  overtime1_minutes, overtime1_bps, overtime2_bps, night_start, night_end, night_cents, night_bps,
  saturday_bps, sunday_bps, holidays_as_sunday, min_paid_minutes, note, currency,
  country, template_code, legality, source_note, base_monthly_cents, min_monthly_cents, holiday_bps
) values (
  null, 'LV · Alga + darba brauciens', date '2026-01-01', 464, 480, 'DAY',
  1440, 10000, 10000, '22:00', '06:00', 0, 5000,
  0, 0, false, 0, 'Alga ≥ minimālā 780 € (2026); nakts darbs +50 %, virsstundas un svētku dienas +100 % (grozījumi par 50 % nav pieņemti). Dienas nauda — atsevišķs komplekts, ne vairāk kā 70 % no (alga + dienas nauda).', 'EUR',
  'LV', 'LV_DARBA_BRAUCIENS', 'LEGAL', 'MK noteikumi Nr. 656 (Nr. 680 redakcijā); Darba likums 67., 68. p.; MK noteikumi Nr. 969 42. p.', 78000, 78000, 10000
);

insert into public.tes_rule_sets (
  company_id, name, valid_from, base_hourly_cents, daily_regular_minutes, overtime_basis,
  overtime1_minutes, overtime1_bps, overtime2_bps, night_start, night_end, night_cents, night_bps,
  saturday_bps, sunday_bps, holidays_as_sunday, min_paid_minutes, note, currency,
  country, template_code, legality, source_note, base_monthly_cents, min_monthly_cents, holiday_bps
) values (
  null, 'LT · Alga ≥ 1,65 MMA + dienpinigiai', date '2026-01-01', 1163, 480, 'DAY',
  1440, 5000, 10000, '22:00', '06:00', 0, 5000,
  0, 0, false, 0, 'Nustatytas atlyginimas ≥ 1,65 MMA (1 902,45 € 2026) — visi dienpinigiai neapmokestinami. Naktinis darbas ×1,5, viršvalandžiai ×1,5 (naktį ×2), švenčių diena ×2.', 'EUR',
  'LT', 'LT_165_MMA', 'LEGAL', 'LRV nutarimas Nr. 99 p. 2.5; Nr. 700 (MMA 1 153 €); Darbo kodeksas 144 str.', 190245, 115300, 10000
);

insert into public.tes_rule_sets (
  company_id, name, valid_from, base_hourly_cents, daily_regular_minutes, overtime_basis,
  overtime1_minutes, overtime1_bps, overtime2_bps, night_start, night_end, night_cents, night_bps,
  saturday_bps, sunday_bps, holidays_as_sunday, min_paid_minutes, note, currency,
  country, template_code, legality, source_note, base_monthly_cents, min_monthly_cents, holiday_bps
) values (
  null, 'LT · Alga = MMA + dienpinigiai', date '2026-01-01', 705, 480, 'DAY',
  1440, 5000, 10000, '22:00', '06:00', 0, 5000,
  0, 0, false, 0, 'Teisėta, bet brangiau: kai atlyginimas < 1,65 MMA, neapmokestinami tik dienpinigiai iki 50 % atlyginimo, likusi dalis apmokestinama kaip darbo užmokestis.', 'EUR',
  'LT', 'LT_MMA', 'LEGAL', 'LRV nutarimas Nr. 99 p. 2.5; GPMĮ 17 str. 1 d. 5 p.', 115300, 115300, 10000
);

insert into public.tes_rule_sets (
  company_id, name, valid_from, base_hourly_cents, daily_regular_minutes, overtime_basis,
  overtime1_minutes, overtime1_bps, overtime2_bps, night_start, night_end, night_cents, night_bps,
  saturday_bps, sunday_bps, holidays_as_sunday, min_paid_minutes, note, currency,
  country, template_code, legality, source_note, base_monthly_cents, min_monthly_cents, holiday_bps
) values (
  null, 'NO · Godsoverenskomsten (allmenngjort minstelønn)', date '2026-11-06', 24450, 450, 'DAY',
  1440, 5000, 5000, null, null, 0, 0,
  0, 0, false, 0, 'Allmenngjort minstelønn for godstransport over 2,5 t — gjelder også utenlandske sjåfører i Norge (kabotasje). Fyll inn tillegg etter egen avtale.', 'NOK',
  'NO', 'NO_GODS', 'LEGAL', 'FOR-2026-10-22-2232 — https://lovdata.no/dokument/SF/forskrift/2026-10-22-2232', null, null, 0
);

-- ── Суточные ───────────────────────────────────────────────────────

do $$
declare
  v_set uuid;
begin
  insert into public.allowance_rule_sets (company_id, name, country, template_code, valid_from, currency, rule, params, legality, source_note)
  values (null, 'PL · Dieta krajowa i ryczałt za nocleg', 'PL', 'PL_DIETA_KRAJOWA', date '2026-01-01', 'PLN', 'PL_DOMESTIC', '{"day_cents":4500,"lodging_cents":6750,"cab_lodging":false}'::jsonb, 'LEGAL', 'Rozp. MPiPS 29.01.2013, consolidated text Dz.U. 2023 poz. 2190, § 7 ust. 1, § 8 ust. 1, 3, 4 — https://api.sejm.gov.pl/eli/acts/DU/2023/2190/text.pdf. Ryczałt za nocleg: 150 % of dieta, only for a stay of at least 6 h between 21:00 and 07:00 (§ 8 ust. 3-4). Noc w kabinie z miejscem do spania — bez ryczałtu (przełącznik cab_lodging).')
  returning id into v_set;

  insert into public.allowance_rule_sets (company_id, name, country, template_code, valid_from, currency, rule, params, legality, source_note)
  values (null, 'PL · Dodatek zagraniczny (wynagrodzenie, ulga 20 €/60 €)', 'PL', 'PL_DODATEK_ZAGRANICZNY', date '2026-01-01', 'PLN', 'PL_INTERNATIONAL', '{"day_cents":5000,"day_currency":"EUR","pit_relief_cents":2000,"zus_relief_cents":6000,"zus_floor_cents":942000}'::jsonb, 'LEGAL', 'Od 2022 kierowca w transporcie międzynarodowym nie jest w podróży służbowej (UCPK art. 21b): dodatek to wynagrodzenie. Zwolnienie PIT do 20 € za dzień za granicą (art. 21 ust. 1 pkt 23d), ZUS: podstawa minus 60 € za dzień, nie niżej niż przeciętne wynagrodzenie 9 420 zł (UCPK art. 26g). Kwota dodatku — przykład, ustaw swoją.')
  returning id into v_set;

  insert into public.allowance_rule_sets (company_id, name, country, template_code, valid_from, currency, rule, params, legality, source_note)
  values (null, 'PL · Dniówka (stawka dzienna)', 'PL', 'PL_DNIOWKA', date '2026-01-01', 'PLN', 'PL_INTERNATIONAL', '{"day_cents":45000,"day_currency":"PLN","pit_relief_cents":2000,"zus_relief_cents":6000,"zus_floor_cents":942000}'::jsonb, 'GREY', 'Stawka dzienna jest legalna tylko wtedy, gdy cała przechodzi przez listę płac (PIT/ZUS), a podstawa ≥ płaca minimalna. Jeśli na pasku jest tylko płaca minimalna, a reszta jako „diety” wolne od podatku ponad ulgę 20 €/60 € — to niezgodne z prawem. Kalkulator orientacyjny.')
  returning id into v_set;

  insert into public.allowance_rule_sets (company_id, name, country, template_code, valid_from, currency, rule, params, legality, source_note)
  values (null, 'PL · „Minimalna + diety” (stary model)', 'PL', 'PL_DIETY_STARE', date '2026-01-01', 'PLN', 'GENERIC', '{}'::jsonb, 'NON_COMPLIANT', 'Stawki diet zagranicznych z rozporządzenia z 2013 r. (Dz.U. 2022 poz. 2302). Od 2022 w transporcie międzynarodowym takie „diety” są wynagrodzeniem: traktowanie ich jako wolnych od podatku ponad 20 €/60 € dziennie jest niezgodne z prawem, a przy delegowaniu nie liczą się do płacy minimalnej. Tylko orientacyjnie.')
  returning id into v_set;
  insert into public.allowance_rates (rule_set_id, country, currency, day_cents, hotel_limit_cents) values
    (v_set, 'DE', 'EUR', 4900, 17000),
    (v_set, 'FR', 'EUR', 5500, 20000),
    (v_set, 'NL', 'EUR', 5000, 15000),
    (v_set, 'BE', 'EUR', 5500, 20000),
    (v_set, 'LU', 'EUR', 5500, 20000),
    (v_set, 'AT', 'EUR', 5700, 15000),
    (v_set, 'IT', 'EUR', 5300, 19200),
    (v_set, 'ES', 'EUR', 5000, 20000),
    (v_set, 'PT', 'EUR', 4900, 15000),
    (v_set, 'DK', 'DKK', 44600, 143000),
    (v_set, 'SE', 'SEK', 51000, 200000),
    (v_set, 'NO', 'NOK', 49600, 165000),
    (v_set, 'FI', 'EUR', 5300, 18000),
    (v_set, 'EE', 'EUR', 4500, 11000),
    (v_set, 'LT', 'EUR', 4500, 15000),
    (v_set, 'LV', 'EUR', 5700, 13200),
    (v_set, 'CZ', 'EUR', 4100, 12000),
    (v_set, 'SK', 'EUR', 4700, 13200),
    (v_set, 'HU', 'EUR', 4400, 14300),
    (v_set, 'SI', 'EUR', 4500, 14300),
    (v_set, 'HR', 'EUR', 4200, 12500),
    (v_set, 'RO', 'EUR', 4200, 11000),
    (v_set, 'BG', 'EUR', 4000, 12000),
    (v_set, 'IE', 'EUR', 5200, 16000);

  insert into public.allowance_rule_sets (company_id, name, country, template_code, valid_from, currency, rule, params, legality, source_note)
  values (null, 'EE · Välislähetuse päevaraha 75 € / 40 €', 'EE', 'EE_PAEVARAHA', date '2026-01-01', 'EUR', 'EE_ABROAD', '{"first_days":15,"first_cents":7500,"later_cents":4000}'::jsonb, 'LEGAL', 'TuMS § 13 lg 3 p 1: maksuvaba 75 € päevas lähetuse esimesel 15 päeval (kuni 15 päeva kuus), edasi 40 €; miinimum 40 € (VV määrus nr 110 § 3). Siseriiklik päevaraha ei ole maksuvaba.')
  returning id into v_set;

  insert into public.allowance_rule_sets (company_id, name, country, template_code, valid_from, currency, rule, params, legality, source_note)
  values (null, 'LV · Dienas nauda (MK 969), līdz 70 %', 'LV', 'LV_DIENAS_NAUDA', date '2026-01-01', 'EUR', 'LV_TRIP', '{"cap_bps":7000}'::jsonb, 'LEGAL', 'MK noteikumi Nr. 969 (12.10.2010) 1. pielikums, wording MK 19.11.2019 Nr. 555 as amended by MK 14.09.2021 Nr. 637 (in force 21.09.2021); consolidated version 18.08.2026 — https://likumi.lv/ta/id/220013. 42. p.: dienas nauda mēnesī ≤ 70 % no (aprēķinātā alga + dienas nauda). Iekšzemē 8 € (21.2. p.).')
  returning id into v_set;
  insert into public.allowance_rates (rule_set_id, country, currency, day_cents, hotel_limit_cents) values
    (v_set, 'DE', 'EUR', 5000, 18000),
    (v_set, 'FR', 'EUR', 6000, 25000),
    (v_set, 'NL', 'EUR', 6000, 22000),
    (v_set, 'BE', 'EUR', 6000, 25000),
    (v_set, 'LU', 'EUR', 6000, 28000),
    (v_set, 'AT', 'EUR', 5000, 20000),
    (v_set, 'CH', 'EUR', 6000, null),
    (v_set, 'IT', 'EUR', 6000, 30000),
    (v_set, 'ES', 'EUR', 5000, 18000),
    (v_set, 'PT', 'EUR', 5000, 20000),
    (v_set, 'DK', 'EUR', 6000, null),
    (v_set, 'SE', 'EUR', 5000, 26000),
    (v_set, 'NO', 'EUR', 6500, null),
    (v_set, 'FI', 'EUR', 5500, 22000),
    (v_set, 'EE', 'EUR', 4000, 12000),
    (v_set, 'LT', 'EUR', 3000, 12000),
    (v_set, 'PL', 'EUR', 3500, 15000),
    (v_set, 'CZ', 'EUR', 4000, 17000),
    (v_set, 'SK', 'EUR', 3500, 16000),
    (v_set, 'HU', 'EUR', 3500, 16000),
    (v_set, 'SI', 'EUR', 3500, 13000),
    (v_set, 'HR', 'EUR', 4000, 13000),
    (v_set, 'RO', 'EUR', 3500, 15000),
    (v_set, 'BG', 'EUR', 3500, 15000),
    (v_set, 'GB', 'EUR', 6500, null),
    (v_set, 'IE', 'EUR', 6000, 26000),
    (v_set, 'LV', 'EUR', 800, null);

  insert into public.allowance_rule_sets (company_id, name, country, template_code, valid_from, currency, rule, params, legality, source_note)
  values (null, 'LT · Dienpinigiai (Nr. 526), 1,65 MMA / 50 %', 'LT', 'LT_DIENPINIGIAI', date '2026-01-01', 'EUR', 'LT_ABROAD', '{"coef_bps":16500,"mma_cents":115300,"half_bps":5000}'::jsonb, 'LEGAL', 'LRV nutarimas Nr. 526 (2004-04-29), ''Maksimalių dienpinigių dydžių sąrašas'' and ''Gyvenamojo ploto nuomos išlaidų normų sąrašas'', wording of Nr. 504 (2023-06-28) in force 2023-08-01; consolidated version 2026-10-01..2027-06-30 — https://www.e-tar.lt/portal/lt/legalAct/TAR.E356C85AC1C6/asr. Neapmokestinami visi, jei atlyginimas ≥ 1,65 MMA; kitaip — iki 50 % atlyginimo (Nr. 99 p. 2.5). Šalies viduje 28 € — kai komandiruotė ilgesnė nei viena diena.')
  returning id into v_set;
  insert into public.allowance_rates (rule_set_id, country, currency, day_cents, hotel_limit_cents) values
    (v_set, 'DE', 'EUR', 6200, 22000),
    (v_set, 'FR', 'EUR', 6900, 18800),
    (v_set, 'NL', 'EUR', 6400, 19000),
    (v_set, 'BE', 'EUR', 6100, 22000),
    (v_set, 'LU', 'EUR', 6100, 28000),
    (v_set, 'AT', 'EUR', 6900, 19000),
    (v_set, 'CH', 'EUR', 8000, 29000),
    (v_set, 'IT', 'EUR', 6300, 18800),
    (v_set, 'ES', 'EUR', 5800, 20000),
    (v_set, 'PT', 'EUR', 5600, 15500),
    (v_set, 'DK', 'EUR', 8000, 20000),
    (v_set, 'SE', 'EUR', 7000, 21000),
    (v_set, 'NO', 'EUR', 7000, 25000),
    (v_set, 'FI', 'EUR', 6900, 17400),
    (v_set, 'EE', 'EUR', 4700, 14500),
    (v_set, 'LV', 'EUR', 4400, 14500),
    (v_set, 'PL', 'EUR', 4800, 16500),
    (v_set, 'CZ', 'EUR', 5000, 19500),
    (v_set, 'SK', 'EUR', 5300, 16500),
    (v_set, 'HU', 'EUR', 4800, 18500),
    (v_set, 'SI', 'EUR', 5200, 19000),
    (v_set, 'HR', 'EUR', 4500, 16500),
    (v_set, 'RO', 'EUR', 3500, 16000),
    (v_set, 'BG', 'EUR', 3900, 16000),
    (v_set, 'GB', 'EUR', 6700, 25000),
    (v_set, 'IE', 'EUR', 6900, 17400),
    (v_set, 'LT', 'EUR', 2800, 14500);

  insert into public.allowance_rule_sets (company_id, name, country, template_code, valid_from, currency, rule, params, legality, source_note)
  values (null, 'SE · Traktamente (inrikes 300 kr)', 'SE', 'SE_TRAKTAMENTE', date '2026-01-01', 'SEK', 'GENERIC', '{}'::jsonb, 'LEGAL', 'Skatteverket, belopp 2026: heldag 300 kr, halvdag 150, nattraktamente 150. Kräver övernattning > 50 km från bostaden. Utrikes normalbelopp — fyll i själv.')
  returning id into v_set;
  insert into public.allowance_rates (rule_set_id, country, currency, day_cents, hotel_limit_cents) values
    (v_set, 'SE', 'SEK', 30000, null);

  insert into public.allowance_rule_sets (company_id, name, country, template_code, valid_from, currency, rule, params, legality, source_note)
  values (null, 'DK · Kostgodtgørelse 625 kr/døgn', 'DK', 'DK_KOSTGODTGORELSE', date '2026-01-01', 'DKK', 'GENERIC', '{}'::jsonb, 'LEGAL', 'Skattefri kostgodtgørelse 2026: 625 kr pr. døgn. For lastbilchauffører er arbejdsstedet køretøjet — ingen logi-standardsats.')
  returning id into v_set;
  insert into public.allowance_rates (rule_set_id, country, currency, day_cents, hotel_limit_cents) values
    (v_set, 'DK', 'DKK', 62500, null);

end;
$$;
