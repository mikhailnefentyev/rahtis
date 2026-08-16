import React, { useState, useEffect, useRef } from "react";

// ============================================================
// RAHTI — биржа грузоперевозок (прототип)
// Матчинг + закрытие рейса с документами + отчётность/биллинг.
// Роли: Перевозчик, Заказчик, Админ (Aivomaa).
// Модель денег: посредник. Заказчик платит ставку -> вы платите
// перевозчику (ставка - комиссия). Комиссия = COMMISSION %.
// Тестовые данные, без бэкенда. Таймаут 15 мин ускорен до 30 сек.
// ============================================================

const C = {
  bg: "#0E1518", panel: "#152025", panel2: "#1B2A30", line: "#26383F",
  ice: "#5FD3C6", iceDim: "#2E6E68", text: "#E4EDEF", mut: "#7C939B", mut2: "#556970",
  warn: "#E8B44A", danger: "#E56A6A", ok: "#5FD3C6", violet: "#9B8CFF",
};
const REGIONS = ["Hanko", "Helsinki", "Turku", "Tampere", "Kotka", "Vaasa"];
const COMMISSION = 0.03;
const TIMEOUT_MS = 30_000;

const eur = (n) => "€" + n.toLocaleString("fi-FI");
let idc = 100;
const nid = () => "x" + ++idc;

// этапы прохождения рейса (обновляются из WhatsApp через n8n)
const TRIP_STEPS = ["Принял", "Забрал прицеп", "Загрузился", "В пути", "Выгрузился", "Сдал"];

const seedMe = { id: "t1", plate: "HKO-441", axles: 3, city: "Hanko", date: "12.11.2026", time: "07:00", driver: "Antti Nieminen", phone: "+358 40 111 2233", company: "Nieminen Kuljetus Oy" };

// автопарк моей компании-перевозчика (карточки внутри одного кабинета)
const seedFleet = [
  { id: "t1", plate: "HKO-441", driver: "Antti Nieminen", langs: ["FI", "EN"], whatsapp: "+358 40 111 2233", axles: 3, make: "Volvo FH", euro: "Euro 6", access: "APPROVED", city: "Hanko", date: "12.11.2026", time: "07:00" },
  { id: "t5", plate: "HKO-902", driver: "Pekka Laine", langs: ["FI", "EN", "RU"], whatsapp: "+358 40 333 4455", axles: 2, make: "Scania R450", euro: "Euro 5", access: "PENDING", city: "Helsinki", date: "13.11.2026", time: "10:00" },
];

// очередь модерации: заявки на регистрацию
const seedApplications = [
  { id: "a1", role: "shipper", company: "Aurora Logistics Oy", ytunnus: "3145678-2", email: "ops@auroralog.fi", status: "PENDING" },
  { id: "a2", role: "carrier", company: "Salo Kuljetus Oy", ytunnus: "2987654-1", email: "info@salokuljetus.fi", status: "PENDING" },
];

// стартовые рейтинги перевозчиков (по названию компании): [сумма звёзд, число оценок]
const seedRatings = {
  "Nieminen Kuljetus Oy": { sum: 42, n: 9 },
  "Koskinen Transport": { sum: 30, n: 7 },
  "Virtanen Logistics": { sum: 24, n: 6 },
};

const seedDone = [
  { id: "d1", type: "Перецеп полуприцепа", from: "Hanko", to: "Helsinki", when: "05.11.2026", pay: 480, company: "Baltic Freight Oy", carrier: "Nieminen Kuljetus Oy", plate: "HKO-441", status: "DONE", docs: ["CMR_0501.jpg"], damage: "Без повреждений", day: "Пн", rating: 5 },
  { id: "d2", type: "Кругорейс", from: "Turku", to: "Tampere → Turku", when: "06.11.2026", pay: 1240, company: "Nordic Cargo Ltd", carrier: "Koskinen Transport", plate: "TUR-208", status: "DONE", docs: ["CMR_0601.jpg", "damage_0601.jpg"], damage: "Царапина на борту прицепа", day: "Вт", rating: 4 },
  { id: "d3", type: "Перецеп полуприцепа", from: "Helsinki", to: "Kotka", when: "07.11.2026", pay: 390, company: "Baltic Freight Oy", carrier: "Nieminen Kuljetus Oy", plate: "HKO-441", status: "DONE", docs: ["CMR_0701.jpg"], damage: "Без повреждений", day: "Ср", rating: null },
];

const seedOrders = [
  {
    id: "o1", type: "Перецеп полуприцепа", ref: "BF-2026-0912",
    pickup: { kind: "Порт", place: "Hanko Port, Terminal 2", addr: "Satamakatu 1, 10900 Hanko", date: "12.11.2026", time: "08:00" },
    delivery: { company: "Helsinki Logistics Center", addr: "Tavaratie 5, 00700 Helsinki", contact: "Mika Virtanen", phone: "+358 40 700 1122", date: "12.11.2026", time: "14:00" },
    cont: null, ret: { where: "Hanko Port, Terminal 2", cargo: "без груза" }, extra: [],
    trailer: "Тент 13.6, 3 оси", km: 130, pay: 480, comment: "Пропуск в порт заказан на номер тягача. Пломба обязательна.",
    from: "Hanko", to: "Helsinki", when: "12.11.2026 08:00",
    company: "Baltic Freight Oy", status: "OPEN", offers: [], chosen: null, deadline: null, docs: [], damage: null, changelog: [],
  },
  {
    id: "o2", type: "Кругорейс", ref: "NC-2026-0413",
    pickup: { kind: "Терминал", place: "Turku Cargo Terminal", addr: "Terminaalikatu 3, 20200 Turku", date: "13.11.2026", time: "06:00" },
    delivery: { company: "Tampere Distribution Oy", addr: "Rahtitie 12, 33100 Tampere", contact: "Jaana Koski", phone: "+358 44 900 3344", date: "13.11.2026", time: "11:00" },
    cont: { addr: "Rahtitie 12, 33100 Tampere", company: "Tampere Distribution Oy", date: "13.11.2026", time: "13:00", ref: "NC-2026-0414" },
    ret: { where: "Turku Cargo Terminal", cargo: "с грузом" }, extra: [],
    trailer: "Рефрижератор 13.6", km: 320, pay: 1240, comment: "Температурный режим +2…+6°C. Обратная загрузка в Тампере.",
    from: "Turku", to: "Tampere → Turku", when: "13.11.2026 06:00",
    company: "Nordic Cargo Ltd", status: "OPEN", offers: [], chosen: null, deadline: null, docs: [], damage: null, changelog: [],
  },
];

export default function App() {
  const [role, setRole] = useState("carrier");
  const [orders, setOrders] = useState(seedOrders);
  const [done, setDone] = useState(seedDone);
  const [ratings, setRatings] = useState(seedRatings);
  const [fleet, setFleet] = useState(seedFleet);
  const [apps, setApps] = useState(seedApplications);
  const [carrierDocs, setCarrierDocs] = useState({ license: true, insurance: true }); // моя компания уже загрузила
  const [me] = useState(seedMe);
  const avgRating = (carrier) => { const r = ratings[carrier]; return r && r.n ? r.sum / r.n : null; };
  const [regionFilter, setRegionFilter] = useState("Все");
  const [feed, setFeed] = useState([{ t: "Стол заказов загружен. 2 активных заказа, 3 в архиве.", kind: "sys" }]);
  const [now, setNow] = useState(Date.now());
  const [closing, setClosing] = useState(null);
  const [nf, setNf] = useState({
    type: "Перецеп полуприцепа", ref: "",
    pickup: { kind: "Порт", place: "", addr: "", date: "", time: "" },
    delivery: { company: "", addr: "", contact: "", phone: "", date: "", time: "" },
    cont: null, ret: null, extra: [],
    trailer: "", km: "", pay: "", comment: "",
    from: "Hanko", to: "",
  });
  const tick = useRef();

  useEffect(() => { tick.current = setInterval(() => setNow(Date.now()), 250); return () => clearInterval(tick.current); }, []);

  useEffect(() => {
    setOrders((prev) => prev.map((o) => {
      if (o.deadline && now > o.deadline) {
        if (o.status === "REQUESTED") { log(`⏱ Таймаут 15 мин: «${o.type} ${o.from}→${o.to}» — заказчик не выбрал. Возврат на стол.`, "warn"); return { ...o, status: "OPEN", offers: [], chosen: null, deadline: null }; }
        if (o.status === "AWAIT_DRIVER") { log(`⏱ Таймаут 15 мин: водитель не подтвердил. Откат на стол.`, "warn"); return { ...o, status: "OPEN", offers: [], chosen: null, deadline: null }; }
      }
      return o;
    }));
    // eslint-disable-next-line
  }, [now]);

  const log = (t, kind = "sys") => setFeed((f) => [{ t, kind }, ...f].slice(0, 40));
  const notify = (to, msg) => log(`✉ → ${to}: ${msg}`, "notif");

  function takeOrder(o) {
    if (o.offers.length >= 3 || o.offers.find((of) => of.truckId === me.id)) return;
    setOrders((prev) => prev.map((x) => {
      if (x.id !== o.id) return x;
      const offers = [...x.offers, { truckId: me.id, plate: me.plate, axles: me.axles, driver: me.driver, phone: me.phone, carrier: me.company }];
      notify(x.company, `Отклик на «${x.type} ${x.from}→${x.to}»: ${me.plate}, ${me.axles} оси, ${me.driver}. Выбрать за 15 мин.`);
      return { ...x, status: "REQUESTED", offers, deadline: x.deadline || Date.now() + TIMEOUT_MS };
    }));
    log(`Вы откликнулись: «${o.type} ${o.from}→${o.to}». Ждём выбор заказчика.`, "me");
  }
  function chooseOffer(o, offer) {
    setOrders((prev) => prev.map((x) => {
      if (x.id !== o.id) return x;
      notify(offer.driver, `Заказчик выбрал вас на «${x.type} ${x.from}→${x.to}». Подтвердите (15 мин).`);
      x.offers.filter((of) => of.truckId !== offer.truckId).forEach((of) => notify(of.driver, `По «${x.type} ${x.from}→${x.to}» выбран другой перевозчик.`));
      return { ...x, status: "AWAIT_DRIVER", chosen: offer, deadline: Date.now() + TIMEOUT_MS };
    }));
    log(`Заказчик выбрал ${offer.plate}. Ждём подтверждение водителя.`, "sys");
  }
  function driverConfirm(o) {
    setOrders((prev) => prev.map((x) => {
      if (x.id !== o.id) return x;
      notify(x.company, `Водитель ${x.chosen.driver} (${x.chosen.plate}) подтвердил. Рейс в работе.`);
      notify(x.chosen.driver, `Работа закреплена: ${x.type}, ${x.from}→${x.to}, ${x.when}.`);
      return { ...x, status: "IN_PROGRESS", deadline: null };
    }));
    log(`✅ В работе: «${o.type} ${o.from}→${o.to}» за ${o.chosen.plate}.`, "ok");
  }
  function cancel(o, by) {
    setOrders((prev) => prev.map((x) => {
      if (x.id !== o.id) return x;
      notify(x.company, `Откат «${x.type} ${x.from}→${x.to}» (${by}). Груз на столе.`);
      if (x.chosen) notify(x.chosen.driver, `Откат «${x.type} ${x.from}→${x.to}».`);
      return { ...x, status: "OPEN", offers: [], chosen: null, deadline: null };
    }));
    log(`↩ Откат «${o.type} ${o.from}→${o.to}» (${by}).`, "danger");
  }
  function finishOrder(o, payload) {
    const rec = { id: o.id, type: o.type, from: o.from, to: o.to, when: o.when.split(" ")[0], pay: o.pay, company: o.company, carrier: o.chosen.carrier, plate: o.chosen.plate, status: "DONE", docs: payload.docs, damage: payload.damage || "Без повреждений", day: "Чт" };
    setDone((d) => [rec, ...d]);
    setOrders((prev) => prev.filter((x) => x.id !== o.id));
    notify(o.company, `Рейс «${o.type} ${o.from}→${o.to}» выполнен. Документы приложены (${payload.docs.length}). ${rec.damage}.`);
    log(`📄 Рейс закрыт: «${o.type}». CMR и фото отправлены заказчику ${o.company}.`, "ok");
    setClosing(null);
  }
  function submitApplication(role, data) {
    const a = { id: nid(), role, ...data, status: "PENDING" };
    setApps((p) => [a, ...p]);
    notify("Aivomaa (админ)", `Новая заявка (${role === "carrier" ? "перевозчик" : "заказчик"}): ${data.company}, Y-tunnus ${data.ytunnus}, ${data.email}.`);
    log(`📨 Заявка отправлена: ${data.company}. Ожидает проверки Aivomaa.`, "sys");
  }
  function decideApp(a, ok) {
    setApps((p) => p.map((x) => (x.id === a.id ? { ...x, status: ok ? "APPROVED" : "REJECTED" } : x)));
    if (ok) {
      notify(a.email, `Заявка одобрена. Коды доступа во вложении. ${a.role === "carrier" ? "Загрузите лицензию, страховку и карточки авто для допуска." : "Заполните реквизиты для активации."}`);
      log(`✅ Заявка ${a.company} одобрена. Высланы коды доступа.`, "ok");
    } else {
      notify(a.email, `Заявка отклонена. Свяжитесь с поддержкой Aivomaa.`);
      log(`✕ Заявка ${a.company} отклонена.`, "danger");
    }
  }
  function addTruck(data) {
    const t = { id: nid(), ...data, access: "PENDING" };
    setFleet((p) => [...p, t]);
    notify("Aivomaa (админ)", `Новая карточка авто на допуск: ${data.plate}, ${data.make}, ${data.axles} оси, ${data.euro}.`);
    log(`🚛 Карточка ${data.plate} добавлена. Отправлена на допуск.`, "sys");
  }
  function decideTruck(t, ok) {
    setFleet((p) => p.map((x) => (x.id === t.id ? { ...x, access: ok ? "APPROVED" : "REJECTED" } : x)));
    notify(me.company, `Машина ${t.plate}: ${ok ? "допущена к заказам" : "не допущена (проверьте документы)"}.`);
    log(ok ? `✅ ${t.plate} допущена к заказам.` : `✕ ${t.plate} не допущена.`, ok ? "ok" : "danger");
  }
  function rateTrip(rec, stars) {
    setDone((d) => d.map((r) => (r.id === rec.id ? { ...r, rating: stars } : r)));
    setRatings((prev) => {
      const cur = prev[rec.carrier] || { sum: 0, n: 0 };
      return { ...prev, [rec.carrier]: { sum: cur.sum + stars, n: cur.n + 1 } };
    });
    notify(rec.carrier, `Заказчик ${rec.company} оценил рейс «${rec.type} ${rec.from}→${rec.to}»: ${stars}★.`);
    log(`⭐ Оценка ${stars}★ выставлена перевозчику ${rec.carrier}.`, "ok");
  }
  const [chats, setChats] = useState({}); // orderId -> [{from:'driver'|'agent', text, at}]
  const [tripStep, setTripStep] = useState({}); // orderId -> индекс последнего этапа
  function chatTime() { return new Date().toLocaleTimeString("fi-FI", { hour: "2-digit", minute: "2-digit" }); }
  function pushMsg(orderId, from, text) {
    setChats((c) => ({ ...c, [orderId]: [...(c[orderId] || []), { from, text, at: chatTime() }] }));
  }
  // водитель отмечает этап -> обновляется статус, агент подтверждает, заказчику уведомление
  function driverStep(o, stepIdx) {
    const step = TRIP_STEPS[stepIdx];
    setTripStep((t) => ({ ...t, [o.id]: stepIdx }));
    pushMsg(o.id, "driver", step + " ✅");
    pushMsg(o.id, "agent", `Принято: «${step}» по заказу ${o.ref}. Спасибо!`);
    notify(o.company, `Заказ ${o.ref}: водитель отметил «${step}».`);
    log(`🚚 ${o.ref}: этап «${step}» (via WhatsApp/n8n).`, "notif");
  }
  // водитель задаёт вопрос -> агент (n8n) ищет ответ в данных заказа
  function driverAsk(o, q) {
    pushMsg(o.id, "driver", q);
    const ql = q.toLowerCase();
    let ans;
    if (ql.includes("телефон") || ql.includes("контакт") || ql.includes("звон")) ans = `Контакт на выгрузке: ${o.delivery.contact}, ${o.delivery.phone} (${o.delivery.company}).`;
    else if (ql.includes("адрес") || ql.includes("куда") || ql.includes("где")) ans = `Выгрузка: ${o.delivery.addr}. Забор: ${o.pickup.place || o.pickup.addr}.`;
    else if (ql.includes("врем") || ql.includes("график") || ql.includes("работ")) ans = `Время доставки по заказу: ${o.delivery.date} ${o.delivery.time}. Часы работы терминала уточняю в интернете…`;
    else if (ql.includes("возврат") || ql.includes("прицеп")) ans = o.ret ? `Возврат прицепа: ${o.ret.where}, ${o.ret.cargo}.` : "По этому заказу возврат прицепа не указан.";
    else if (ql.includes("груз") || ql.includes("темпер") || ql.includes("реж")) ans = o.comment ? `Из карточки заказа: ${o.comment}` : "Особых указаний по грузу нет.";
    else ans = `Уточняю по заказу ${o.ref}… Если вопрос срочный — подключаю живого диспетчера Aivomaa.`;
    setTimeout(() => pushMsg(o.id, "agent", ans), 400);
    log(`💬 ${o.ref}: вопрос водителя → агент (n8n) ответил из данных заказа.`, "notif");
  }
  function amendOrder(o, change) {
    setOrders((prev) => prev.map((x) => {
      if (x.id !== o.id) return x;
      const entry = { at: new Date().toLocaleTimeString("fi-FI", { hour: "2-digit", minute: "2-digit" }), text: change };
      return { ...x, changelog: [...(x.changelog || []), entry] };
    }));
    if (o.chosen) notify(o.chosen.driver, `⚠ Изменение маршрута по «${o.ref}»: ${change}. Проверьте детали в приложении.`);
    notify(o.company, `Корректировка «${o.ref}» сохранена и отправлена водителю.`);
    log(`✏ Корректировка «${o.ref}»: ${change}`, "warn");
  }
  function publish() {
    if (!nf.pickup.addr || !nf.delivery.addr || !nf.pay) { log("Заполните адрес забора, адрес выгрузки и ставку.", "warn"); return; }
    const km = Number(String(nf.km).replace(/\D/g, "")) || 0;
    const pay = Number(String(nf.pay).replace(/\D/g, "")) || 0;
    const o = {
      id: nid(), ...nf, km, pay,
      when: `${nf.pickup.date} ${nf.pickup.time}`.trim(),
      to: nf.to || nf.delivery.addr.split(",").pop().trim(),
      company: "Aivomaa Demo Oy", status: "OPEN", offers: [], chosen: null, deadline: null, docs: [], damage: null, changelog: [],
      ref: nf.ref || "ORD-" + Math.floor(Math.random() * 9000 + 1000),
    };
    setOrders((p) => [o, ...p]);
    log(`Опубликован «${o.type}» ${o.from}→${o.to} (${o.ref}). Рассылка машинам региона ${o.from}.`, "sys");
    notify(`машины в ${o.from}`, `Новый заказ ${o.ref}: ${o.type}, ${o.pickup.place || o.pickup.kind}→${o.delivery.company}, ${km} км, ${eur(pay)}.`);
    setNf({ ...nf, ref: "", pickup: { ...nf.pickup, place: "", addr: "", date: "", time: "" }, delivery: { company: "", addr: "", contact: "", phone: "", date: "", time: "" }, cont: null, ret: null, extra: [], km: "", pay: "", comment: "" });
  }

  const shown = orders.filter((o) => regionFilter === "Все" || o.from === regionFilter);

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "'Inter',system-ui,sans-serif" }}>
      <Style />
      <div style={{ borderBottom: `1px solid ${C.line}`, padding: "14px 22px", display: "flex", alignItems: "center", gap: 18, position: "sticky", top: 0, background: C.bg, zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <span className="mono" style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-1px", color: C.ice }}>RAHTI</span>
          <span style={{ fontSize: 11, color: C.mut, letterSpacing: "2px", textTransform: "uppercase" }}>Freight Desk · Suomi</span>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 4, background: C.panel, padding: 4, borderRadius: 10, border: `1px solid ${C.line}` }}>
          {[["carrier", "Перевозчик"], ["shipper", "Заказчик"], ["admin", "Админ · Aivomaa"], ["signup", "Регистрация"]].map(([k, l]) => (
            <button key={k} onClick={() => setRole(k)} className="btn" style={{ border: "none", background: role === k ? C.ice : "transparent", color: role === k ? "#062024" : C.mut, padding: "7px 14px" }}>{l}</button>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: (role === "admin" || role === "signup") ? "1fr" : "1fr 340px", gap: 18, padding: 22, maxWidth: (role === "admin" || role === "signup") ? 1080 : 1200, margin: "0 auto" }}>
        <div>
          {role === "carrier" && <CarrierView me={me} shown={shown} done={done} fleet={fleet} carrierDocs={carrierDocs} regionFilter={regionFilter} setRegionFilter={setRegionFilter} takeOrder={takeOrder} driverConfirm={driverConfirm} cancel={cancel} setClosing={setClosing} now={now} avgRating={avgRating} addTruck={addTruck} chats={chats} tripStep={tripStep} driverStep={driverStep} driverAsk={driverAsk} />}
          {role === "shipper" && <ShipperView orders={orders} done={done} nf={nf} setNf={setNf} publish={publish} chooseOffer={chooseOffer} cancel={cancel} now={now} avgRating={avgRating} rateTrip={rateTrip} amendOrder={amendOrder} tripStep={tripStep} />}
          {role === "admin" && <AdminView done={done} avgRating={avgRating} apps={apps} fleet={fleet} decideApp={decideApp} decideTruck={decideTruck} orders={orders} chats={chats} tripStep={tripStep} />}
          {role === "signup" && <SignupView submitApplication={submitApplication} />}
        </div>
        {role !== "admin" && role !== "signup" && <Feed feed={feed} />}
      </div>

      {closing && <CloseModal o={closing} onClose={() => setClosing(null)} onFinish={finishOrder} />}
    </div>
  );
}

function Style() {
  return <style>{`
    *{box-sizing:border-box}
    .mono{font-family:'JetBrains Mono','SF Mono',ui-monospace,monospace}
    button{cursor:pointer;font-family:inherit}
    .btn{border:1px solid ${C.line};background:${C.panel2};color:${C.text};padding:8px 14px;border-radius:8px;font-size:13px;font-weight:600;transition:.15s}
    .btn:hover{border-color:${C.ice}}
    .btn-primary{background:${C.ice};color:#062024;border-color:${C.ice}}
    .btn-primary:hover{filter:brightness(1.08)}
    .btn-danger{color:${C.danger};border-color:${C.iceDim}}
    .btn-danger:hover{border-color:${C.danger}}
    .btn:disabled{opacity:.35;cursor:not-allowed}
    .card{background:${C.panel};border:1px solid ${C.line};border-radius:14px}
    input,select,textarea{background:${C.bg};border:1px solid ${C.line};color:${C.text};padding:9px 11px;border-radius:8px;font-size:13px;font-family:inherit;width:100%}
    input:focus,select:focus,textarea:focus{outline:none;border-color:${C.ice}}
    table{width:100%;border-collapse:collapse}
    th{font-size:11px;letter-spacing:1px;text-transform:uppercase;color:${C.mut};text-align:left;padding:8px 10px;border-bottom:1px solid ${C.line};font-weight:600}
    td{padding:10px;border-bottom:1px solid ${C.line};font-size:13px;vertical-align:top}
    @keyframes slidein{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}
    .row-anim{animation:slidein .25s ease}
    @keyframes fade{from{opacity:0}to{opacity:1}}
  `}</style>;
}
function Feed({ feed }) {
  return (
    <div>
      <div className="card" style={{ padding: 16, position: "sticky", top: 78 }}>
        <div style={{ fontSize: 11, letterSpacing: "2px", textTransform: "uppercase", color: C.mut, marginBottom: 12 }}>Уведомления · n8n</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: "72vh", overflowY: "auto" }}>
          {feed.map((f, i) => (
            <div key={i} className="row-anim" style={{ fontSize: 12, lineHeight: 1.5, padding: "8px 10px", borderRadius: 8, background: C.bg, borderLeft: `2px solid ${f.kind === "notif" ? C.ice : f.kind === "warn" ? C.warn : f.kind === "danger" ? C.danger : f.kind === "ok" ? C.ok : f.kind === "me" ? C.iceDim : C.line}`, color: f.kind === "sys" ? C.mut : C.text }}>{f.t}</div>
          ))}
        </div>
      </div>
    </div>
  );
}
function Countdown({ deadline, now }) {
  if (!deadline) return null;
  const left = Math.max(0, deadline - now);
  const mins = Math.floor((left / TIMEOUT_MS) * 15);
  const secs = Math.floor((((left / TIMEOUT_MS) * 15) % 1) * 60);
  return <span className="mono" style={{ fontSize: 12, color: left < TIMEOUT_MS / 3 ? C.danger : C.warn }}>⏱ {mins}:{String(secs).padStart(2, "0")} до отката</span>;
}
function Badge({ status, step }) {
  const map = { OPEN: ["На столе", C.ice], REQUESTED: ["Есть отклики", C.warn], AWAIT_DRIVER: ["Ждём водителя", C.warn], IN_PROGRESS: ["В работе", C.violet], DONE: ["Выполнен", C.ok] };
  let [label, color] = map[status] || map.OPEN;
  if (status === "IN_PROGRESS" && step != null && TRIP_STEPS[step]) label = TRIP_STEPS[step];
  return <span style={{ fontSize: 11, fontWeight: 700, color, background: color + "1A", border: `1px solid ${color}44`, padding: "3px 9px", borderRadius: 20 }}>{label}</span>;
}
function Stars({ value, size = 13 }) {
  if (value == null) return <span style={{ fontSize: size - 1, color: C.mut2 }}>нет оценок</span>;
  const full = Math.round(value);
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
      <span style={{ fontSize: size, letterSpacing: "1px", color: C.warn }}>{"★".repeat(full)}<span style={{ color: C.line }}>{"★".repeat(5 - full)}</span></span>
      <span className="mono" style={{ fontSize: size - 1, color: C.warn, fontWeight: 700 }}>{value.toFixed(1)}</span>
    </span>
  );
}
function RateStars({ onRate }) {
  const [hover, setHover] = useState(0);
  return (
    <span style={{ display: "inline-flex", gap: 3 }}>
      {[1, 2, 3, 4, 5].map((s) => (
        <button key={s} onMouseEnter={() => setHover(s)} onMouseLeave={() => setHover(0)} onClick={() => onRate(s)}
          style={{ background: "none", border: "none", padding: 0, fontSize: 20, lineHeight: 1, color: s <= hover ? C.warn : C.mut2, transition: ".1s" }}>★</button>
      ))}
    </span>
  );
}
function Field({ label, children }) {
  return <label style={{ display: "block" }}><span style={{ fontSize: 11, color: C.mut, letterSpacing: "1px", display: "block", marginBottom: 5 }}>{label.toUpperCase()}</span>{children}</label>;
}
function Kv({ k, v }) {
  return <div style={{ display: "flex", gap: 8, fontSize: 13, marginBottom: 3 }}><span style={{ color: C.mut, minWidth: 70 }}>{k}</span><span>{v}</span></div>;
}
function Tabs({ tabs, active, set }) {
  return (
    <div style={{ display: "flex", gap: 4, marginBottom: 16, borderBottom: `1px solid ${C.line}`, flexWrap: "wrap" }}>
      {tabs.map(([k, l]) => (
        <button key={k} onClick={() => set(k)} className="btn" style={{ border: "none", background: "transparent", color: active === k ? C.ice : C.mut, borderBottom: active === k ? `2px solid ${C.ice}` : "2px solid transparent", borderRadius: 0, padding: "8px 14px" }}>{l}</button>
      ))}
    </div>
  );
}

function SignupView({ submitApplication }) {
  const [role, setRole] = useState("carrier");
  const [f, setF] = useState({ company: "", ytunnus: "", email: "" });
  const [sent, setSent] = useState(false);
  const ok = f.company && /^\d{7}-\d$/.test(f.ytunnus) && /\S+@\S+\.\S+/.test(f.email);
  const submit = () => { submitApplication(role, f); setSent(true); };

  if (sent) return (
    <div className="card" style={{ padding: 34, maxWidth: 520, margin: "40px auto", textAlign: "center" }}>
      <div style={{ fontSize: 40, marginBottom: 10 }}>📨</div>
      <h2 style={{ fontSize: 18, margin: "0 0 8px" }}>Заявка отправлена</h2>
      <p style={{ color: C.mut, fontSize: 14, lineHeight: 1.6, margin: 0 }}>
        Aivomaa проверит {f.company} (Y-tunnus {f.ytunnus}) по реестру и вышлет коды доступа на {f.email}.
        {role === "carrier" ? " После входа загрузите лицензию, страховку и карточки авто — и мы дадим допуск к заказам." : " После входа заполните реквизиты для активации."}
      </p>
      <button className="btn" style={{ marginTop: 20 }} onClick={() => { setSent(false); setF({ company: "", ytunnus: "", email: "" }); }}>Отправить ещё одну</button>
    </div>
  );

  return (
    <div className="card" style={{ padding: 28, maxWidth: 520, margin: "20px auto" }}>
      <h2 style={{ fontSize: 20, fontWeight: 800, margin: "0 0 6px" }}>Заявка на регистрацию</h2>
      <p style={{ color: C.mut, fontSize: 13, margin: "0 0 20px" }}>Открытой регистрации нет. Мы проверяем каждую компанию вручную и высылаем коды доступа.</p>

      <div style={{ display: "flex", gap: 4, background: C.bg, padding: 4, borderRadius: 10, border: `1px solid ${C.line}`, marginBottom: 20 }}>
        {[["carrier", "Я перевозчик"], ["shipper", "Я заказчик"]].map(([k, l]) => (
          <button key={k} className="btn" onClick={() => setRole(k)} style={{ flex: 1, border: "none", background: role === k ? C.ice : "transparent", color: role === k ? "#062024" : C.mut }}>{l}</button>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Field label="Название компании"><input placeholder="Nieminen Kuljetus Oy" value={f.company} onChange={(e) => setF({ ...f, company: e.target.value })} /></Field>
        <Field label="Y-tunnus (бизнес-ID)"><input placeholder="1234567-8" value={f.ytunnus} onChange={(e) => setF({ ...f, ytunnus: e.target.value })} />{f.ytunnus && !/^\d{7}-\d$/.test(f.ytunnus) && <span style={{ fontSize: 11, color: C.danger }}>Формат: 7 цифр, дефис, контрольная цифра</span>}</Field>
        <Field label="Email"><input placeholder="ops@company.fi" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
      </div>

      <div style={{ background: C.bg, border: `1px solid ${C.line}`, borderRadius: 10, padding: 14, margin: "18px 0", fontSize: 12, color: C.mut, lineHeight: 1.6 }}>
        {role === "carrier"
          ? "После одобрения: вход в кабинет → загрузка лицензии и страховки → карточки авто (водитель, языки, WhatsApp, оси, марка, Euro-класс) → допуск по каждой машине."
          : "После одобрения: вход в кабинет → заполнение реквизитов → публикация заказов."}
      </div>

      <button className="btn btn-primary" style={{ width: "100%" }} disabled={!ok} onClick={submit}>Отправить заявку в Aivomaa</button>
      {!ok && <div style={{ fontSize: 11, color: C.mut2, marginTop: 8, textAlign: "center" }}>Заполните название, корректный Y-tunnus и email</div>}
    </div>
  );
}
function CarrierView({ me, shown, done, fleet, carrierDocs, regionFilter, setRegionFilter, takeOrder, driverConfirm, cancel, setClosing, now, avgRating, addTruck, chats, tripStep, driverStep, driverAsk }) {
  const hasApproved = fleet.some((t) => t.access === "APPROVED");
  const [tab, setTab] = useState("desk");
  const myDone = done.filter((d) => d.carrier === me.company);
  return (
    <>
      <div className="card" style={{ padding: 18, marginBottom: 18, display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
        <div><div style={{ fontSize: 11, color: C.mut, letterSpacing: "1px" }}>МОЯ ТЕХНИКА</div><div className="mono" style={{ fontSize: 20, fontWeight: 800, color: C.ice, marginTop: 4 }}>{me.plate}</div><div style={{ marginTop: 6 }}><Stars value={avgRating(me.company)} /></div></div>
        <div style={{ borderLeft: `1px solid ${C.line}`, paddingLeft: 20 }}>
          <Kv k="Тягач" v={`${me.axles} оси`} /><Kv k="Свободен" v={`${me.city} · ${me.date} ${me.time}`} /><Kv k="Водитель" v={`${me.driver} · ${me.phone}`} />
        </div>
      </div>
      <Tabs tabs={[["desk", "Стол заказов"], ["fleet", "Мой автопарк"], ["report", "Отчёт за неделю"]]} active={tab} set={setTab} />

      {tab === "desk" && !hasApproved && (
        <div className="card" style={{ padding: 30, textAlign: "center" }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>🔒</div>
          <h2 style={{ fontSize: 16, margin: "0 0 8px" }}>Нет допуска к заказам</h2>
          <p style={{ color: C.mut, fontSize: 13, lineHeight: 1.6, margin: "0 auto", maxWidth: 380 }}>
            Чтобы видеть стол заказов и откликаться, нужна хотя бы одна допущенная машина. Добавьте карточку авто во вкладке «Мой автопарк» — Aivomaa проверит документы и даст допуск.
          </p>
        </div>
      )}
      {tab === "desk" && hasApproved && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Активные заказы</h2>
            <select value={regionFilter} onChange={(e) => setRegionFilter(e.target.value)} style={{ width: 160 }}><option>Все</option>{REGIONS.map((r) => <option key={r}>{r}</option>)}</select>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {shown.length === 0 && <div className="card" style={{ padding: 30, textAlign: "center", color: C.mut, fontSize: 13 }}>Нет заказов в этом регионе.</div>}
            {shown.map((o) => {
              const mine = o.offers.find((of) => of.truckId === me.id);
              const chosenMe = o.chosen && o.chosen.truckId === me.id;
              return (
                <div key={o.id} className="card row-anim" style={{ padding: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                    <div>
                      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}><span style={{ fontSize: 15, fontWeight: 700 }}>{o.type}</span><Badge status={o.status} step={tripStep[o.id]} /><span className="mono" style={{ fontSize: 12, color: C.mut2 }}>{o.ref}</span></div>
                      <div className="mono" style={{ fontSize: 14, color: C.ice, marginTop: 6 }}>{o.from} → {o.to}</div>
                      <div style={{ fontSize: 13, color: C.mut, marginTop: 6 }}>{o.trailer} · {o.km} км · <span style={{ color: C.text, fontWeight: 700 }}>{eur(o.pay)}</span>{o.km ? <span style={{ color: C.mut2 }}> · €{(o.pay / o.km).toFixed(2)}/км</span> : null}</div>
                      <div style={{ fontSize: 12, color: C.mut2, marginTop: 4 }}>{o.company}</div>
                    </div>
                    <div style={{ textAlign: "right", minWidth: 150 }}>
                      {(o.status === "OPEN" || (o.status === "REQUESTED" && !mine)) && <button className="btn btn-primary" onClick={() => takeOrder(o)} disabled={o.offers.length >= 3}>{o.offers.length >= 3 ? "Мест нет 3/3" : "Беру"}</button>}
                      {o.status === "REQUESTED" && mine && <div style={{ fontSize: 12, color: C.warn }}>Ждём выбор · {o.offers.length}/3</div>}
                      {o.status === "AWAIT_DRIVER" && chosenMe && <div style={{ display: "flex", flexDirection: "column", gap: 6 }}><button className="btn btn-primary" onClick={() => driverConfirm(o)}>Подтвердить</button><button className="btn btn-danger" onClick={() => cancel(o, "водитель")}>Отказаться</button></div>}
                      {o.status === "AWAIT_DRIVER" && !chosenMe && <div style={{ fontSize: 12, color: C.mut }}>Выбран другой</div>}
                      {o.status === "IN_PROGRESS" && chosenMe && <button className="btn btn-primary" onClick={() => setClosing(o)}>Закрыть рейс</button>}
                    </div>
                  </div>

                  {/* детальный маршрут: свёрнут на OPEN, развёрнут когда рейс мой */}
                  <details style={{ marginTop: 12 }} open={chosenMe || o.status === "IN_PROGRESS"}>
                    <summary style={{ cursor: "pointer", fontSize: 12, color: C.mut, listStyle: "none" }}>▸ Маршрут и детали</summary>
                    <div style={{ marginTop: 12 }}><RouteBlock o={o} /></div>
                    {o.comment && <div style={{ marginTop: 12, fontSize: 12, color: C.mut, background: C.bg, border: `1px solid ${C.line}`, borderRadius: 8, padding: "8px 10px" }}>💬 {o.comment}</div>}
                  </details>

                  {o.changelog && o.changelog.length > 0 && chosenMe && (
                    <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.warn}44` }}>
                      <div style={{ fontSize: 11, color: C.warn, letterSpacing: "1px", marginBottom: 6 }}>⚠ ИЗМЕНЕНИЯ ОТ ЗАКАЗЧИКА</div>
                      {o.changelog.map((c, i) => <div key={i} style={{ fontSize: 12, color: C.text, marginBottom: 3 }}><span className="mono" style={{ color: C.mut2 }}>{c.at}</span> · {c.text}</div>)}
                    </div>
                  )}

                  {(o.status === "REQUESTED" || o.status === "AWAIT_DRIVER") && <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.line}` }}><Countdown deadline={o.deadline} now={now} /></div>}
                  {o.status === "IN_PROGRESS" && chosenMe && <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.line}`, fontSize: 12, color: C.violet }}>Рейс в работе. После выгрузки — «Закрыть рейс»: приложите CMR и фото.</div>}
                  {o.status === "IN_PROGRESS" && chosenMe && <TripProgress o={o} step={tripStep[o.id]} onStep={driverStep} chat={chats[o.id] || []} onAsk={driverAsk} />}
                </div>
              );
            })}
          </div>
        </>
      )}

      {tab === "fleet" && <FleetView fleet={fleet} carrierDocs={carrierDocs} addTruck={addTruck} me={me} avgRating={avgRating} />}

      {tab === "report" && <><WeekReport rows={myDone} who="carrier" title="Мои выполненные рейсы за неделю" /><CarrierByMachine rows={myDone} /></>}
    </>
  );
}

function TripProgress({ o, step = -1, onStep, chat, onAsk }) {
  const [q, setQ] = useState("");
  const next = step + 1;
  const quick = ["Где выгрузка?", "Телефон получателя?", "Время доставки?", "Куда возврат прицепа?"];
  return (
    <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${C.line}` }}>
      {/* степпер */}
      <div style={{ fontSize: 11, color: C.mut, letterSpacing: "1px", marginBottom: 10 }}>ПРОХОЖДЕНИЕ РЕЙСА · через WhatsApp</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
        {TRIP_STEPS.map((s, i) => {
          const done = i <= step, isNext = i === next;
          return (
            <button key={s} className="btn" disabled={!isNext} onClick={() => onStep(o, i)}
              style={{ padding: "5px 10px", fontSize: 12, borderColor: done ? C.ok : isNext ? C.ice : C.line, color: done ? C.ok : isNext ? C.ice : C.mut2, background: done ? C.ok + "1A" : C.panel2, opacity: !done && !isNext ? .5 : 1 }}>
              {done ? "✓ " : ""}{s}
            </button>
          );
        })}
      </div>

      {/* whatsapp-чат с агентом */}
      <div style={{ background: "#0B1F1A", border: `1px solid ${C.iceDim}`, borderRadius: 12, padding: 12, marginTop: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <span style={{ width: 8, height: 8, borderRadius: 8, background: "#25D366" }} />
          <span style={{ fontSize: 12, fontWeight: 700 }}>Агент Aivomaa</span>
          <span style={{ fontSize: 11, color: C.mut }}>· WhatsApp · заказ {o.ref}</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 200, overflowY: "auto", marginBottom: 10 }}>
          {chat.length === 0 && <div style={{ fontSize: 12, color: C.mut2, textAlign: "center", padding: "8px 0" }}>Отметьте этап или задайте вопрос — агент (n8n) ответит из данных заказа.</div>}
          {chat.map((m, i) => (
            <div key={i} style={{ alignSelf: m.from === "driver" ? "flex-end" : "flex-start", maxWidth: "80%", background: m.from === "driver" ? "#075E54" : C.panel2, color: C.text, borderRadius: 10, padding: "7px 10px", fontSize: 13 }}>
              {m.text}
              <span style={{ fontSize: 10, color: C.mut2, marginLeft: 8 }}>{m.at}</span>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 8 }}>
          {quick.map((qq) => <button key={qq} className="btn" style={{ padding: "4px 9px", fontSize: 11 }} onClick={() => onAsk(o, qq)}>{qq}</button>)}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <input placeholder="Написать агенту…" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && q.trim()) { onAsk(o, q); setQ(""); } }} />
          <button className="btn btn-primary" onClick={() => { if (q.trim()) { onAsk(o, q); setQ(""); } }}>➤</button>
        </div>
      </div>
    </div>
  );
}
function euroColor(e) { return e === "Euro 6" ? C.ok : e === "Euro 5" ? C.warn : C.danger; }
function accessBadge(a) {
  const m = { APPROVED: ["Допущена", C.ok], PENDING: ["На проверке", C.warn], REJECTED: ["Отклонена", C.danger], DRAFT: ["Черновик", C.mut] };
  const [l, c] = m[a] || m.DRAFT;
  return <span style={{ fontSize: 11, fontWeight: 700, color: c, background: c + "1A", border: `1px solid ${c}44`, padding: "3px 9px", borderRadius: 20 }}>{l}</span>;
}
function FleetView({ fleet, carrierDocs, addTruck, me, avgRating }) {
  const [adding, setAdding] = useState(false);
  const [t, setT] = useState({ plate: "", driver: "", langs: "FI, EN", whatsapp: "", axles: "3", make: "", euro: "Euro 6", city: "Hanko", date: "", time: "" });
  const canAdd = t.plate && t.driver && t.whatsapp && t.make;
  const submit = () => { addTruck({ ...t, axles: Number(t.axles), langs: t.langs.split(",").map((x) => x.trim()).filter(Boolean) }); setAdding(false); setT({ plate: "", driver: "", langs: "FI, EN", whatsapp: "", axles: "3", make: "", euro: "Euro 6", city: "Hanko", date: "", time: "" }); };

  return (
    <>
      {/* документы компании */}
      <div className="card" style={{ padding: 18, marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: C.mut, letterSpacing: "1px", marginBottom: 12 }}>ДОКУМЕНТЫ КОМПАНИИ · {me.company}</div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <DocChip label="Лицензия перевозчика" ok={carrierDocs.license} />
          <DocChip label="Страховка (CMR/ответственность)" ok={carrierDocs.insurance} />
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Карточки авто · {fleet.length}</h2>
        <button className="btn btn-primary" onClick={() => setAdding((v) => !v)}>{adding ? "Свернуть" : "+ Добавить машину"}</button>
      </div>

      {adding && (
        <div className="card" style={{ padding: 18, marginBottom: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label="Госномер"><input placeholder="HKO-441" value={t.plate} onChange={(e) => setT({ ...t, plate: e.target.value })} /></Field>
            <Field label="Водитель"><input placeholder="Antti Nieminen" value={t.driver} onChange={(e) => setT({ ...t, driver: e.target.value })} /></Field>
            <Field label="Языки (через запятую)"><input placeholder="FI, EN, RU" value={t.langs} onChange={(e) => setT({ ...t, langs: e.target.value })} /></Field>
            <Field label="WhatsApp / телефон"><input placeholder="+358 40 111 2233" value={t.whatsapp} onChange={(e) => setT({ ...t, whatsapp: e.target.value })} /></Field>
            <Field label="Осей тягача"><select value={t.axles} onChange={(e) => setT({ ...t, axles: e.target.value })}><option>2</option><option>3</option><option>4</option></select></Field>
            <Field label="Марка / модель"><input placeholder="Volvo FH" value={t.make} onChange={(e) => setT({ ...t, make: e.target.value })} /></Field>
            <Field label="Эко-класс"><select value={t.euro} onChange={(e) => setT({ ...t, euro: e.target.value })}><option>Euro 6</option><option>Euro 5</option><option>Euro 4</option></select></Field>
            <Field label="База (город)"><select value={t.city} onChange={(e) => setT({ ...t, city: e.target.value })}>{REGIONS.map((r) => <option key={r}>{r}</option>)}</select></Field>
          </div>
          <button className="btn btn-primary" style={{ marginTop: 14, width: "100%" }} disabled={!canAdd} onClick={submit}>Добавить · отправить на допуск</button>
          {!canAdd && <div style={{ fontSize: 11, color: C.mut2, marginTop: 8, textAlign: "center" }}>Заполните номер, водителя, WhatsApp и марку</div>}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {fleet.map((v) => (
          <div key={v.id} className="card row-anim" style={{ padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <span className="mono" style={{ fontSize: 17, fontWeight: 800, color: C.ice }}>{v.plate}</span>
                  {accessBadge(v.access)}
                  <span style={{ fontSize: 11, fontWeight: 700, color: euroColor(v.euro), border: `1px solid ${euroColor(v.euro)}55`, borderRadius: 6, padding: "2px 7px" }}>{v.euro}</span>
                </div>
                <div style={{ fontSize: 14, marginTop: 8 }}>{v.make} · <span style={{ color: C.mut }}>{v.axles} оси</span></div>
                <div style={{ fontSize: 13, color: C.mut, marginTop: 4 }}>{v.driver} · {v.langs.join("/")} · <span className="mono">{v.whatsapp}</span></div>
                <div style={{ marginTop: 6 }}><Stars value={avgRating(me.company)} size={12} /></div>
              </div>
              {v.access === "PENDING" && <div style={{ fontSize: 12, color: C.warn, maxWidth: 160, textAlign: "right" }}>Aivomaa проверяет документы и карточку</div>}
              {v.access === "REJECTED" && <div style={{ fontSize: 12, color: C.danger, maxWidth: 160, textAlign: "right" }}>Не допущена — проверьте документы и отправьте снова</div>}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
function DocChip({ label, ok }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, background: C.bg, border: `1px solid ${ok ? C.iceDim : C.line}`, borderRadius: 8, padding: "10px 12px", fontSize: 13 }}>
      <span style={{ color: ok ? C.ok : C.mut }}>{ok ? "✓" : "○"}</span>
      <span>{label}</span>
      <span style={{ fontSize: 11, color: C.mut2 }}>{ok ? "загружено" : "не загружено"}</span>
    </div>
  );
}
function CarrierByMachine({ rows }) {
  const byM = groupSum(rows, "plate");
  const carrierGets = (p) => Math.round(p * (1 - COMMISSION));
  if (rows.length === 0) return null;
  return (
    <div className="card" style={{ padding: 18, marginTop: 16 }}>
      <h2 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 12px" }}>По моим машинам</h2>
      <table>
        <thead><tr><th>Машина</th><th>Рейсов</th><th>Валовая</th><th>К выплате</th></tr></thead>
        <tbody>
          {byM.map((m) => (
            <tr key={m.key}>
              <td className="mono" style={{ fontWeight: 700, color: C.ice }}>{m.key}</td>
              <td className="mono">{m.count}</td>
              <td className="mono" style={{ color: C.mut }}>{eur(m.sum)}</td>
              <td className="mono" style={{ fontWeight: 700 }}>{eur(carrierGets(m.sum))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
// точка маршрута с иконкой
function RoutePoint({ icon, color, title, lines }) {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
      <div style={{ width: 22, height: 22, borderRadius: 6, background: color + "22", border: `1px solid ${color}66`, color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, flexShrink: 0, marginTop: 1 }}>{icon}</div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 11, color: C.mut, letterSpacing: ".5px", textTransform: "uppercase" }}>{title}</div>
        {lines.filter(Boolean).map((l, i) => <div key={i} style={{ fontSize: 13, color: i === 0 ? C.text : C.mut, marginTop: i === 0 ? 2 : 1 }}>{l}</div>)}
      </div>
    </div>
  );
}
function RouteBlock({ o }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, position: "relative" }}>
      <RoutePoint icon="▲" color={C.ice} title={`Забор · ${o.pickup.kind}`} lines={[o.pickup.place, o.pickup.addr, `${o.pickup.date} ${o.pickup.time}`]} />
      {o.extra && o.extra.map((e, i) => <RoutePoint key={i} icon="◆" color={C.warn} title={e.kind === "load" ? "Доп. загрузка" : "Доп. выгрузка"} lines={[e.company, e.addr, `${e.date || ""} ${e.time || ""}`]} />)}
      <RoutePoint icon="▼" color={C.violet} title="Выгрузка" lines={[o.delivery.company, o.delivery.addr, o.delivery.contact ? `${o.delivery.contact} · ${o.delivery.phone}` : "", `Доставка: ${o.delivery.date} ${o.delivery.time}`]} />
      {o.cont && <RoutePoint icon="»" color={C.ice} title={`Продолжение · заказ ${o.cont.ref || ""}`} lines={[o.cont.company, o.cont.addr, `Загрузка: ${o.cont.date} ${o.cont.time}`]} />}
      {o.ret && <RoutePoint icon="↩" color={C.mut} title="Возврат прицепа" lines={[o.ret.where, o.ret.cargo]} />}
    </div>
  );
}
function OrderForm({ nf, setNf, publish }) {
  const setP = (k, v) => setNf({ ...nf, pickup: { ...nf.pickup, [k]: v } });
  const setD = (k, v) => setNf({ ...nf, delivery: { ...nf.delivery, [k]: v } });
  const addExtra = (kind) => setNf({ ...nf, extra: [...nf.extra, { kind, company: "", addr: "", date: "", time: "" }] });
  const setExtra = (i, k, v) => setNf({ ...nf, extra: nf.extra.map((e, j) => (j === i ? { ...e, [k]: v } : e)) });
  const delExtra = (i) => setNf({ ...nf, extra: nf.extra.filter((_, j) => j !== i) });
  const kmPay = nf.km && nf.pay ? "€" + (Number(String(nf.pay).replace(/\D/g, "")) / Number(String(nf.km).replace(/\D/g, ""))).toFixed(2) + "/км" : "";

  return (
    <div className="card" style={{ padding: 18, marginBottom: 18 }}>
      <h2 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 16px" }}>Новый заказ</h2>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 18 }}>
        <Field label="Тип"><select value={nf.type} onChange={(e) => setNf({ ...nf, type: e.target.value })}><option>Перецеп полуприцепа</option><option>Кругорейс</option><option>Груз в один конец</option></select></Field>
        <Field label="Номер заказа"><input placeholder="BF-2026-0912" value={nf.ref} onChange={(e) => setNf({ ...nf, ref: e.target.value })} /></Field>
      </div>

      {/* ЗАБОР */}
      <SectionTitle color={C.ice}>▲ Откуда забираем</SectionTitle>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 18 }}>
        <Field label="Тип места"><select value={nf.pickup.kind} onChange={(e) => setP("kind", e.target.value)}><option>Порт</option><option>Терминал</option><option>Парковка</option><option>Адрес</option></select></Field>
        <Field label="Название места"><input placeholder="Hanko Port, Terminal 2" value={nf.pickup.place} onChange={(e) => setP("place", e.target.value)} /></Field>
        <Field label="Адрес"><input placeholder="Satamakatu 1, 10900 Hanko" value={nf.pickup.addr} onChange={(e) => setP("addr", e.target.value)} /></Field>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Field label="Дата"><input placeholder="12.11.2026" value={nf.pickup.date} onChange={(e) => setP("date", e.target.value)} /></Field>
          <Field label="Время"><input placeholder="08:00" value={nf.pickup.time} onChange={(e) => setP("time", e.target.value)} /></Field>
        </div>
      </div>

      {/* ВЫГРУЗКА */}
      <SectionTitle color={C.violet}>▼ Где выгрузка</SectionTitle>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 8 }}>
        <Field label="Компания"><input placeholder="Helsinki Logistics Center" value={nf.delivery.company} onChange={(e) => setD("company", e.target.value)} /></Field>
        <Field label="Адрес"><input placeholder="Tavaratie 5, 00700 Helsinki" value={nf.delivery.addr} onChange={(e) => setD("addr", e.target.value)} /></Field>
        <Field label="Контакт"><input placeholder="Mika Virtanen" value={nf.delivery.contact} onChange={(e) => setD("contact", e.target.value)} /></Field>
        <Field label="Телефон"><input placeholder="+358 40 700 1122" value={nf.delivery.phone} onChange={(e) => setD("phone", e.target.value)} /></Field>
        <Field label="Дата доставки"><input placeholder="12.11.2026" value={nf.delivery.date} onChange={(e) => setD("date", e.target.value)} /></Field>
        <Field label="Время доставки"><input placeholder="14:00" value={nf.delivery.time} onChange={(e) => setD("time", e.target.value)} /></Field>
      </div>

      {/* доп.точки */}
      {nf.extra.map((e, i) => (
        <div key={i} style={{ background: C.bg, border: `1px solid ${C.warn}44`, borderRadius: 10, padding: 12, margin: "10px 0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: C.warn, fontWeight: 700 }}>◆ {e.kind === "load" ? "Доп. загрузка" : "Доп. выгрузка"}</span>
            <button className="btn" style={{ padding: "2px 8px", fontSize: 12 }} onClick={() => delExtra(i)}>Удалить</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <input placeholder="Компания" value={e.company} onChange={(ev) => setExtra(i, "company", ev.target.value)} />
            <input placeholder="Адрес" value={e.addr} onChange={(ev) => setExtra(i, "addr", ev.target.value)} />
            <input placeholder="Дата" value={e.date} onChange={(ev) => setExtra(i, "date", ev.target.value)} />
            <input placeholder="Время" value={e.time} onChange={(ev) => setExtra(i, "time", ev.target.value)} />
          </div>
        </div>
      ))}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
        <button className="btn" onClick={() => addExtra("load")}>+ Доп. загрузка</button>
        <button className="btn" onClick={() => addExtra("unload")}>+ Доп. выгрузка</button>
      </div>

      {/* продолжение */}
      {nf.cont ? (
        <div style={{ background: C.bg, border: `1px solid ${C.line}`, borderRadius: 10, padding: 12, marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: C.ice, fontWeight: 700 }}>» Продолжение рейса</span>
            <button className="btn" style={{ padding: "2px 8px", fontSize: 12 }} onClick={() => setNf({ ...nf, cont: null })}>Убрать</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <input placeholder="Компания" value={nf.cont.company} onChange={(e) => setNf({ ...nf, cont: { ...nf.cont, company: e.target.value } })} />
            <input placeholder="Номер заказа" value={nf.cont.ref} onChange={(e) => setNf({ ...nf, cont: { ...nf.cont, ref: e.target.value } })} />
            <input placeholder="Адрес загрузки" value={nf.cont.addr} onChange={(e) => setNf({ ...nf, cont: { ...nf.cont, addr: e.target.value } })} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <input placeholder="Дата" value={nf.cont.date} onChange={(e) => setNf({ ...nf, cont: { ...nf.cont, date: e.target.value } })} />
              <input placeholder="Время" value={nf.cont.time} onChange={(e) => setNf({ ...nf, cont: { ...nf.cont, time: e.target.value } })} />
            </div>
          </div>
        </div>
      ) : <button className="btn" style={{ marginBottom: 12 }} onClick={() => setNf({ ...nf, cont: { company: "", ref: "", addr: "", date: "", time: "" } })}>+ Добавить продолжение рейса</button>}

      {/* возврат прицепа */}
      {nf.ret ? (
        <div style={{ background: C.bg, border: `1px solid ${C.line}`, borderRadius: 10, padding: 12, marginBottom: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: C.mut, fontWeight: 700 }}>↩ Возврат прицепа</span>
            <button className="btn" style={{ padding: "2px 8px", fontSize: 12 }} onClick={() => setNf({ ...nf, ret: null })}>Убрать</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 8 }}>
            <input placeholder="Куда возвращать" value={nf.ret.where} onChange={(e) => setNf({ ...nf, ret: { ...nf.ret, where: e.target.value } })} />
            <select value={nf.ret.cargo} onChange={(e) => setNf({ ...nf, ret: { ...nf.ret, cargo: e.target.value } })}><option value="без груза">без груза</option><option value="с грузом">с грузом</option></select>
          </div>
        </div>
      ) : <button className="btn" style={{ marginBottom: 18, display: "block" }} onClick={() => setNf({ ...nf, ret: { where: "", cargo: "без груза" } })}>+ Возврат прицепа</button>}

      {/* прицеп, км, ставка */}
      <SectionTitle color={C.text}>Груз и оплата</SectionTitle>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 10, marginBottom: 12 }}>
        <Field label="Прицеп"><input placeholder="Тент 13.6, 3 оси" value={nf.trailer} onChange={(e) => setNf({ ...nf, trailer: e.target.value })} /></Field>
        <Field label="Пробег, км"><input placeholder="130" value={nf.km} onChange={(e) => setNf({ ...nf, km: e.target.value })} /></Field>
        <Field label={`Ставка ${kmPay}`}><input placeholder="€480" value={nf.pay} onChange={(e) => setNf({ ...nf, pay: e.target.value })} /></Field>
      </div>
      <Field label="Комментарий к заказу"><textarea rows={2} placeholder="Пропуск в порт, пломба, температурный режим…" value={nf.comment} onChange={(e) => setNf({ ...nf, comment: e.target.value })} /></Field>

      <button className="btn btn-primary" style={{ marginTop: 16, width: "100%" }} onClick={publish}>Опубликовать · рассылка машинам региона</button>
    </div>
  );
}
function SectionTitle({ children, color }) {
  return <div style={{ fontSize: 12, fontWeight: 700, color, letterSpacing: ".5px", marginBottom: 10, paddingBottom: 6, borderBottom: `1px solid ${C.line}` }}>{children}</div>;
}
function ShipperView({ orders, done, nf, setNf, publish, chooseOffer, cancel, now, avgRating, rateTrip, amendOrder, tripStep }) {
  const [tab, setTab] = useState("orders");
  const [amend, setAmend] = useState(null);
  const myCompany = "Baltic Freight Oy";
  const myDone = done.filter((d) => d.company === myCompany);
  return (
    <>
      <Tabs tabs={[["orders", "Мои заказы"], ["report", "Отчёт за неделю"]]} active={tab} set={setTab} />
      {tab === "orders" && (
        <>
          <OrderForm nf={nf} setNf={setNf} publish={publish} />
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 14px" }}>Активные заказы</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {orders.map((o) => (
              <div key={o.id} className="card row-anim" style={{ padding: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
                  <div>
                    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                      <span style={{ fontSize: 15, fontWeight: 700 }}>{o.type}</span>
                      <Badge status={o.status} step={tripStep && tripStep[o.id]} />
                      <span className="mono" style={{ fontSize: 12, color: C.mut2 }}>{o.ref}</span>
                    </div>
                    <div style={{ fontSize: 13, color: C.mut, marginTop: 6 }}>{o.trailer} · {o.km} км · <span style={{ color: C.text, fontWeight: 700 }}>{eur(o.pay)}</span> {o.km ? <span style={{ color: C.mut2 }}>· €{(o.pay / o.km).toFixed(2)}/км</span> : null}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <Countdown deadline={o.deadline} now={now} />
                    {(o.status === "REQUESTED" || o.status === "AWAIT_DRIVER") && <div><button className="btn btn-danger" style={{ marginTop: 8 }} onClick={() => cancel(o, "заказчик")}>Отменить</button></div>}
                    {o.status === "IN_PROGRESS" && <div><button className="btn" style={{ marginTop: 8, borderColor: C.warn, color: C.warn }} onClick={() => setAmend(o)}>✏ Корректировать</button></div>}
                  </div>
                </div>

                <RouteBlock o={o} />

                {o.comment && <div style={{ marginTop: 12, fontSize: 12, color: C.mut, background: C.bg, border: `1px solid ${C.line}`, borderRadius: 8, padding: "8px 10px" }}>💬 {o.comment}</div>}

                {o.changelog && o.changelog.length > 0 && (
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.line}` }}>
                    <div style={{ fontSize: 11, color: C.warn, letterSpacing: "1px", marginBottom: 6 }}>ИЗМЕНЕНИЯ ПОСЛЕ СТАРТА</div>
                    {o.changelog.map((c, i) => <div key={i} style={{ fontSize: 12, color: C.mut, marginBottom: 3 }}><span className="mono" style={{ color: C.mut2 }}>{c.at}</span> · {c.text}</div>)}
                  </div>
                )}

                {o.status === "REQUESTED" && (
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.line}` }}>
                    <div style={{ fontSize: 11, color: C.mut, letterSpacing: "1px", marginBottom: 8 }}>ОТКЛИКИ · {o.offers.length}/3 — выберите машину</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {[...o.offers].sort((a, b) => (avgRating(b.carrier) || 0) - (avgRating(a.carrier) || 0)).map((of) => (
                        <div key={of.truckId} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, background: C.bg, padding: "10px 12px", borderRadius: 8, border: `1px solid ${C.line}` }}>
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <span className="mono" style={{ color: C.ice, fontWeight: 700 }}>{of.plate}</span>
                              <Stars value={avgRating(of.carrier)} />
                            </div>
                            <div style={{ color: C.mut, fontSize: 13, marginTop: 3 }}>{of.axles} оси · {of.driver} · {of.phone}</div>
                            <div style={{ color: C.mut2, fontSize: 12, marginTop: 2 }}>{of.carrier}</div>
                          </div>
                          <button className="btn btn-primary" onClick={() => chooseOffer(o, of)}>Выбрать</button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {o.status === "IN_PROGRESS" && <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.line}`, fontSize: 13, color: C.violet }}>Рейс в работе{tripStep && tripStep[o.id] != null ? ` · этап: ${TRIP_STEPS[tripStep[o.id]]}` : ""}. Можно корректировать маршрут — водитель получит уведомление. По завершении придёт CMR и фото.</div>}
              </div>
            ))}
          </div>
        </>
      )}
      {tab === "report" && <WeekReport rows={myDone} who="shipper" title={`Отчёт по рейсам · ${myCompany}`} rateTrip={rateTrip} avgRating={avgRating} />}
      {amend && <AmendModal o={amend} onClose={() => setAmend(null)} onSave={(txt) => { amendOrder(amend, txt); setAmend(null); }} />}
    </>
  );
}

function AmendModal({ o, onClose, onSave }) {
  const [mode, setMode] = useState("addload");
  const [txt, setTxt] = useState("");
  const presets = { addload: "Добавлена загрузка: ", addunload: "Добавлена выгрузка: ", changetime: "Изменено время: ", changeaddr: "Изменён адрес: " };
  const full = presets[mode] + txt;
  return (
    <div style={{ position: "fixed", inset: 0, background: "#000A", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, animation: "fade .15s", padding: 20 }} onClick={onClose}>
      <div className="card" style={{ padding: 22, width: 460, maxWidth: "100%" }} onClick={(e) => e.stopPropagation()}>
        <h2 style={{ fontSize: 17, fontWeight: 700, margin: "0 0 4px" }}>Корректировка заказа</h2>
        <div className="mono" style={{ fontSize: 13, color: C.ice, marginBottom: 4 }}>{o.ref}</div>
        <p style={{ fontSize: 12, color: C.mut, margin: "0 0 16px" }}>Рейс уже в работе. После сохранения водитель {o.chosen ? `${o.chosen.driver} (${o.chosen.plate})` : ""} получит уведомление.</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
          {[["addload", "+ Загрузка"], ["addunload", "+ Выгрузка"], ["changetime", "Время"], ["changeaddr", "Адрес"]].map(([k, l]) => (
            <button key={k} className="btn" onClick={() => setMode(k)} style={{ borderColor: mode === k ? C.warn : C.line, color: mode === k ? C.warn : C.text }}>{l}</button>
          ))}
        </div>
        <textarea rows={3} placeholder="Детали: адрес, компания, время…" value={txt} onChange={(e) => setTxt(e.target.value)} style={{ marginBottom: 8 }} />
        <div style={{ fontSize: 12, color: C.mut, background: C.bg, border: `1px solid ${C.line}`, borderRadius: 8, padding: "8px 10px", marginBottom: 16 }}>Водителю уйдёт: <span style={{ color: C.warn }}>{full}</span></div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn" style={{ flex: 1 }} onClick={onClose}>Отмена</button>
          <button className="btn btn-primary" style={{ flex: 2 }} disabled={!txt} onClick={() => onSave(full)}>Сохранить · уведомить водителя</button>
        </div>
      </div>
    </div>
  );
}

function WeekReport({ rows, who, title, rateTrip }) {
  const total = rows.reduce((s, r) => s + r.pay, 0);
  const carrierGets = (p) => Math.round(p * (1 - COMMISSION));
  const isShipper = who === "shipper";
  return (
    <div className="card" style={{ padding: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4, flexWrap: "wrap", gap: 8 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>{title}</h2>
        <span style={{ fontSize: 12, color: C.mut }}>Неделя 45 · 03–09.11.2026</span>
      </div>
      <div style={{ fontSize: 12, color: C.mut, marginBottom: 16 }}>{rows.length} рейсов</div>
      {rows.length === 0 ? <div style={{ color: C.mut, fontSize: 13, padding: "10px 0" }}>За эту неделю рейсов нет.</div> : (
        <table>
          <thead><tr><th>День</th><th>Рейс</th><th>Маршрут</th>{isShipper && <th>Перевозчик</th>}<th>{who === "carrier" ? "К выплате" : "Сумма"}</th><th>Документы</th>{isShipper && <th>Оценка</th>}</tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="mono" style={{ color: C.mut }}>{r.day}</td>
                <td>{r.type}</td>
                <td className="mono" style={{ color: C.ice }}>{r.from} → {r.to}</td>
                {isShipper && <td style={{ color: C.mut }}>{r.carrier}</td>}
                <td style={{ fontWeight: 700 }}>{who === "carrier" ? eur(carrierGets(r.pay)) : eur(r.pay)}</td>
                <td>{r.docs.map((d) => <span key={d} className="mono" style={{ fontSize: 11, color: C.mut, display: "inline-block", background: C.bg, border: `1px solid ${C.line}`, borderRadius: 5, padding: "2px 6px", marginRight: 4, marginBottom: 3 }}>{d}</span>)}<div style={{ fontSize: 11, color: r.damage.includes("Без") ? C.mut2 : C.warn, marginTop: 3 }}>{r.damage}</div></td>
                {isShipper && <td>{r.rating != null ? <span style={{ color: C.warn, fontSize: 14 }}>{"★".repeat(r.rating)}<span style={{ color: C.line }}>{"★".repeat(5 - r.rating)}</span></span> : <RateStars onRate={(s) => rateTrip(r, s)} />}</td>}
                {who === "carrier" && null}
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {rows.length > 0 && (
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 16, paddingTop: 14, borderTop: `1px solid ${C.line}` }}>
          <span style={{ color: C.mut }}>Итого за неделю:</span>
          <span className="mono" style={{ fontWeight: 800, color: C.ice, fontSize: 16 }}>{who === "carrier" ? eur(carrierGets(total)) : eur(total)}</span>
        </div>
      )}
      <div style={{ fontSize: 11, color: C.mut2, marginTop: 14 }}>n8n: этот отчёт формируется автоматически каждый понедельник и приходит на почту.</div>
    </div>
  );
}

function TripDetails({ rows, mode }) {
  // mode: 'client' (сумма=ставка) | 'carrier' (показываем ставку+к выплате) | 'machine'
  return (
    <div style={{ marginTop: 10, background: C.bg, border: `1px solid ${C.line}`, borderRadius: 8, padding: "6px 10px" }}>
      <table>
        <thead><tr><th>День</th><th>Рейс</th><th>Маршрут</th>{mode === "client" && <th>Перевозчик · машина</th>}{mode !== "client" && <th>Заказчик</th>}<th>Сумма</th><th>Оценка</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="mono" style={{ color: C.mut }}>{r.day}</td>
              <td>{r.type}</td>
              <td className="mono" style={{ color: C.ice }}>{r.from} → {r.to}</td>
              {mode === "client" && <td style={{ color: C.mut }}>{r.carrier} · <span className="mono">{r.plate}</span></td>}
              {mode !== "client" && <td style={{ color: C.mut }}>{r.company}</td>}
              <td className="mono" style={{ fontWeight: 700 }}>{eur(r.pay)}</td>
              <td>{r.rating != null ? <span style={{ color: C.warn }}>{"★".repeat(r.rating)}</span> : <span style={{ color: C.mut2, fontSize: 11 }}>—</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function AdminView({ done, avgRating, apps, fleet, decideApp, decideTruck, orders, chats, tripStep }) {
  const [tab, setTab] = useState("moderation");
  const [openRow, setOpenRow] = useState(null);
  const byClient = groupSum(done, "company");
  const byCarrier = groupSum(done, "carrier");
  const byMachine = groupSum(done, "plate");
  const gross = done.reduce((s, r) => s + r.pay, 0);
  const payout = Math.round(gross * (1 - COMMISSION));
  const margin = gross - payout;
  const pendingApps = apps.filter((a) => a.status === "PENDING");
  const pendingTrucks = fleet.filter((t) => t.access === "PENDING");
  const queue = pendingApps.length + pendingTrucks.length;
  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 20 }}>
        <Stat label="Очередь модерации" value={queue} color={queue ? C.warn : C.mut} />
        <Stat label="Выручка · счета" value={eur(gross)} color={C.ice} />
        <Stat label="Выплаты перевозчикам" value={eur(payout)} color={C.violet} />
        <Stat label={`Ваша маржа · ${COMMISSION * 100}%`} value={eur(margin)} color={C.ok} />
      </div>
      <Tabs tabs={[["moderation", `Модерация${queue ? " · " + queue : ""}`], ["dispatch", "Диспетчер · WhatsApp"], ["daily", "Счета заказчикам"], ["weekly", "Выплаты перевозчикам"]]} active={tab} set={setTab} />

      {tab === "moderation" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="card" style={{ padding: 18 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 14px" }}>Заявки на регистрацию · {pendingApps.length}</h2>
            {pendingApps.length === 0 ? <div style={{ color: C.mut, fontSize: 13 }}>Новых заявок нет.</div> : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {pendingApps.map((a) => (
                  <div key={a.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, background: C.bg, border: `1px solid ${C.line}`, borderRadius: 10, padding: "12px 14px", flexWrap: "wrap" }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontWeight: 700 }}>{a.company}</span>
                        <span style={{ fontSize: 11, color: a.role === "carrier" ? C.violet : C.ice, border: `1px solid ${C.line}`, borderRadius: 6, padding: "1px 7px" }}>{a.role === "carrier" ? "перевозчик" : "заказчик"}</span>
                      </div>
                      <div style={{ fontSize: 13, color: C.mut, marginTop: 4 }}>Y-tunnus <span className="mono">{a.ytunnus}</span> · {a.email}</div>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button className="btn btn-danger" onClick={() => decideApp(a, false)}>Отклонить</button>
                      <button className="btn btn-primary" onClick={() => decideApp(a, true)}>Одобрить · выслать коды</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card" style={{ padding: 18 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 14px" }}>Машины на допуск · {pendingTrucks.length}</h2>
            {pendingTrucks.length === 0 ? <div style={{ color: C.mut, fontSize: 13 }}>Машин на проверке нет.</div> : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {pendingTrucks.map((v) => (
                  <div key={v.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, background: C.bg, border: `1px solid ${C.line}`, borderRadius: 10, padding: "12px 14px", flexWrap: "wrap" }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span className="mono" style={{ fontWeight: 800, color: C.ice }}>{v.plate}</span>
                        <span style={{ fontSize: 11, color: euroColor(v.euro) }}>{v.euro}</span>
                      </div>
                      <div style={{ fontSize: 13, color: C.mut, marginTop: 4 }}>{v.make} · {v.axles} оси · {v.driver} · {v.langs.join("/")} · <span className="mono">{v.whatsapp}</span></div>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button className="btn btn-danger" onClick={() => decideTruck(v, false)}>Не допускать</button>
                      <button className="btn btn-primary" onClick={() => decideTruck(v, true)}>Дать допуск</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "dispatch" && (
        <div className="card" style={{ padding: 18 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 4px" }}>Диспетчерский пульт · рейсы в работе</h2>
          <p style={{ fontSize: 12, color: C.mut, margin: "0 0 16px" }}>Водители общаются по WhatsApp, n8n распознаёт статусы и отвечает на вопросы из данных заказа. Здесь агент видит всё и подключается при сложных вопросах.</p>
          {orders.filter((o) => o.status === "IN_PROGRESS").length === 0 ? (
            <div style={{ color: C.mut, fontSize: 13 }}>Сейчас нет рейсов в работе. Доведите заказ до статуса «В работе» в роли перевозчика.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {orders.filter((o) => o.status === "IN_PROGRESS").map((o) => (
                <div key={o.id} style={{ background: C.bg, border: `1px solid ${C.line}`, borderRadius: 12, padding: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span className="mono" style={{ color: C.ice, fontWeight: 700 }}>{o.ref}</span>
                      <Badge status={o.status} step={tripStep && tripStep[o.id]} />
                      <span style={{ color: C.mut, fontSize: 13 }}>· {o.type} · {o.chosen?.driver} ({o.chosen?.plate})</span>
                    </div>
                  </div>
                  {/* мини-степпер */}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 10 }}>
                    {TRIP_STEPS.map((s, i) => (
                      <span key={s} style={{ fontSize: 11, padding: "3px 8px", borderRadius: 20, border: `1px solid ${(tripStep && tripStep[o.id] != null && i <= tripStep[o.id]) ? C.ok : C.line}`, color: (tripStep && tripStep[o.id] != null && i <= tripStep[o.id]) ? C.ok : C.mut2 }}>{s}</span>
                    ))}
                  </div>
                  {/* лог диалога */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 5, maxHeight: 160, overflowY: "auto" }}>
                    {(chats[o.id] || []).length === 0 ? <div style={{ fontSize: 12, color: C.mut2 }}>Пока нет сообщений от водителя.</div> :
                      (chats[o.id] || []).map((m, i) => (
                        <div key={i} style={{ fontSize: 12, color: m.from === "driver" ? C.text : C.ice }}>
                          <span className="mono" style={{ color: C.mut2 }}>{m.at}</span> <b>{m.from === "driver" ? o.chosen?.driver : "агент"}:</b> {m.text}
                        </div>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "daily" && (
        <div className="card" style={{ padding: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Ежедневная сводка по заказчикам</h2>
            <button className="btn">↓ Выгрузить для счетов</button>
          </div>
          <table>
            <thead><tr><th></th><th>Заказчик</th><th>Рейсов</th><th>К оплате (счёт)</th><th>Статус</th></tr></thead>
            <tbody>
              {byClient.map((c) => (
                <React.Fragment key={c.key}>
                  <tr onClick={() => setOpenRow(openRow === "c" + c.key ? null : "c" + c.key)} style={{ cursor: "pointer" }}>
                    <td style={{ color: C.mut, width: 20 }}>{openRow === "c" + c.key ? "▾" : "▸"}</td>
                    <td style={{ fontWeight: 600 }}>{c.key}</td>
                    <td className="mono">{c.count}</td>
                    <td className="mono" style={{ fontWeight: 700, color: C.ice }}>{eur(c.sum)}</td>
                    <td><span style={{ fontSize: 11, color: C.warn, background: C.warn + "1A", border: `1px solid ${C.warn}44`, padding: "2px 8px", borderRadius: 20 }}>Счёт не выставлен</span></td>
                  </tr>
                  {openRow === "c" + c.key && <tr><td colSpan={5} style={{ padding: 0, border: "none" }}><TripDetails rows={c.rows} mode="client" /></td></tr>}
                </React.Fragment>
              ))}
            </tbody>
          </table>
          <div style={{ fontSize: 12, color: C.mut, marginTop: 14 }}>Клик по заказчику — детализация рейсов со стоимостью. n8n: сводка уходит вам на почту каждое утро в 07:00.</div>
        </div>
      )}

      {tab === "weekly" && (
        <div className="card" style={{ padding: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Еженедельные выплаты перевозчикам</h2>
            <button className="btn">↓ Выгрузить для выплат</button>
          </div>
          <table>
            <thead><tr><th></th><th>Перевозчик</th><th>Рейтинг</th><th>Рейсов</th><th>Валовая ставка</th><th>Комиссия {COMMISSION * 100}%</th><th>К выплате</th></tr></thead>
            <tbody>
              {byCarrier.map((c) => {
                const comm = Math.round(c.sum * COMMISSION);
                return (
                  <React.Fragment key={c.key}>
                    <tr onClick={() => setOpenRow(openRow === "w" + c.key ? null : "w" + c.key)} style={{ cursor: "pointer" }}>
                      <td style={{ color: C.mut, width: 20 }}>{openRow === "w" + c.key ? "▾" : "▸"}</td>
                      <td style={{ fontWeight: 600 }}>{c.key}</td>
                      <td><Stars value={avgRating(c.key)} /></td>
                      <td className="mono">{c.count}</td>
                      <td className="mono" style={{ color: C.mut }}>{eur(c.sum)}</td>
                      <td className="mono" style={{ color: C.ok }}>−{eur(comm)}</td>
                      <td className="mono" style={{ fontWeight: 700, color: C.violet }}>{eur(c.sum - comm)}</td>
                    </tr>
                    {openRow === "w" + c.key && <tr><td colSpan={7} style={{ padding: 0, border: "none" }}><TripDetails rows={c.rows} mode="carrier" /></td></tr>}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
          <div style={{ fontSize: 12, color: C.mut, marginTop: 14 }}>Клик по перевозчику — его рейсы. n8n: отчёт формируется каждый понедельник и уходит вам + счёт-основание каждому перевозчику.</div>

          <h2 style={{ fontSize: 15, fontWeight: 700, margin: "22px 0 12px" }}>Разрез по машинам</h2>
          <table>
            <thead><tr><th>Машина</th><th>Перевозчик</th><th>Рейсов</th><th>Сумма</th></tr></thead>
            <tbody>
              {byMachine.map((m) => (
                <tr key={m.key}>
                  <td className="mono" style={{ fontWeight: 700, color: C.ice }}>{m.key}</td>
                  <td style={{ color: C.mut }}>{m.rows[0].carrier}</td>
                  <td className="mono">{m.count}</td>
                  <td className="mono" style={{ fontWeight: 700, color: C.violet }}>{eur(m.sum)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
function Stat({ label, value, color }) {
  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ fontSize: 11, color: C.mut, letterSpacing: "1px", textTransform: "uppercase" }}>{label}</div>
      <div className="mono" style={{ fontSize: 26, fontWeight: 800, color, marginTop: 8 }}>{value}</div>
    </div>
  );
}
function groupSum(rows, key) {
  const m = {};
  rows.forEach((r) => { if (!m[r[key]]) m[r[key]] = { key: r[key], count: 0, sum: 0, rows: [] }; m[r[key]].count++; m[r[key]].sum += r.pay; m[r[key]].rows.push(r); });
  return Object.values(m).sort((a, b) => b.sum - a.sum);
}

function CloseModal({ o, onClose, onFinish }) {
  const [docs, setDocs] = useState([]);
  const [hasDamage, setHasDamage] = useState(false);
  const [damageText, setDamageText] = useState("");
  const addDoc = (label) => setDocs((d) => d.includes(label) ? d.filter((x) => x !== label) : [...d, label]);
  return (
    <div style={{ position: "fixed", inset: 0, background: "#000A", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, animation: "fade .15s", padding: 20 }} onClick={onClose}>
      <div className="card" style={{ padding: 22, width: 460, maxWidth: "100%", maxHeight: "90vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
        <h2 style={{ fontSize: 17, fontWeight: 700, margin: "0 0 4px" }}>Закрытие рейса</h2>
        <div className="mono" style={{ fontSize: 13, color: C.ice, marginBottom: 18 }}>{o.type} · {o.from} → {o.to}</div>

        <div style={{ fontSize: 11, color: C.mut, letterSpacing: "1px", marginBottom: 8 }}>ДОКУМЕНТЫ (ФОТО)</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
          {["CMR / накладная", "Фото загрузки", "Фото выгрузки"].map((l) => (
            <button key={l} className="btn" onClick={() => addDoc(l)} style={{ borderColor: docs.includes(l) ? C.ice : C.line, color: docs.includes(l) ? C.ice : C.text }}>{docs.includes(l) ? "✓ " : "+ "}{l}</button>
          ))}
        </div>
        {docs.length > 0 && <div style={{ fontSize: 12, color: C.mut, marginBottom: 16 }}>Приложено: {docs.length} фото (в реальной версии — камера / галерея телефона)</div>}

        <div style={{ fontSize: 11, color: C.mut, letterSpacing: "1px", marginBottom: 8 }}>ПОВРЕЖДЕНИЯ ПРИЦЕПА / ГРУЗА</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <button className="btn" onClick={() => setHasDamage(false)} style={{ flex: 1, borderColor: !hasDamage ? C.ice : C.line, color: !hasDamage ? C.ice : C.text }}>Без повреждений</button>
          <button className="btn" onClick={() => setHasDamage(true)} style={{ flex: 1, borderColor: hasDamage ? C.warn : C.line, color: hasDamage ? C.warn : C.text }}>Есть повреждения</button>
        </div>
        {hasDamage && (
          <>
            <textarea rows={2} placeholder="Опишите повреждение (напр.: скол на левом борту прицепа)" value={damageText} onChange={(e) => setDamageText(e.target.value)} style={{ marginBottom: 8 }} />
            <button className="btn" onClick={() => addDoc("Фото повреждения")} style={{ marginBottom: 16, borderColor: docs.includes("Фото повреждения") ? C.warn : C.line, color: docs.includes("Фото повреждения") ? C.warn : C.text }}>{docs.includes("Фото повреждения") ? "✓ " : "+ "}Фото повреждения</button>
          </>
        )}

        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
          <button className="btn" style={{ flex: 1 }} onClick={onClose}>Отмена</button>
          <button className="btn btn-primary" style={{ flex: 2 }} disabled={docs.length === 0}
            onClick={() => onFinish(o, { docs: docs.map((d, i) => "IMG_" + o.id + "_" + i + ".jpg"), damage: hasDamage ? (damageText || "Есть повреждения") : "Без повреждений" })}>
            Закрыть рейс · отправить заказчику
          </button>
        </div>
        {docs.length === 0 && <div style={{ fontSize: 11, color: C.mut2, marginTop: 10, textAlign: "center" }}>Приложите хотя бы CMR, чтобы закрыть рейс</div>}
      </div>
    </div>
  );
}
