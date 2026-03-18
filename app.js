const STORAGE_KEY = "sc_mvp_v2_profiles";
const CHAT_KEY = "sc_chat_v1";

function nowMs() {
  return Date.now();
}

function clampInt(n, min, max) {
  const x = Number.isFinite(n) ? Math.trunc(n) : min;
  return Math.max(min, Math.min(max, x));
}

function readBet(inputEl, { min = 1, max = 1_000_000, fallback = 25 } = {}) {
  const raw = inputEl?.value;
  const n = raw === "" || raw == null ? fallback : Number(raw);
  const v = clampInt(Number.isFinite(n) ? n : fallback, min, max);
  if (inputEl && inputEl.value !== String(v)) inputEl.value = String(v);
  return v;
}

function formatInt(n) {
  return new Intl.NumberFormat("ru-RU").format(n);
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomSeed() {
  try {
    const buf = new Uint32Array(1);
    // В некоторых окружениях (редко) crypto может быть недоступен при file://.
    if (globalThis.crypto?.getRandomValues) {
      globalThis.crypto.getRandomValues(buf);
      return buf[0] >>> 0;
    }
  } catch {}
  return (Math.floor(Math.random() * 0xffffffff) >>> 0);
}

const SYMBOLS = [
  { id: "cherry", emoji: "🍒", w: 30 },
  { id: "lemon", emoji: "🍋", w: 26 },
  { id: "grape", emoji: "🍇", w: 22 },
  { id: "star", emoji: "⭐️", w: 14 },
  { id: "seven", emoji: "7️⃣", w: 8 },
  // Lines slot features:
  { id: "wild", emoji: "🃏", w: 6 },
  { id: "scatter", emoji: "🎈", w: 4 },
];

const PAYOUT_X3 = {
  cherry: 8,
  lemon: 6,
  grape: 10,
  star: 20,
  seven: 50,
};

const LINES_PAYOUT = {
  cherry: { 3: 4, 4: 7, 5: 12 },
  lemon: { 3: 3, 4: 5, 5: 9 },
  grape: { 3: 5, 4: 9, 5: 15 },
  star: { 3: 10, 4: 18, 5: 30 },
  seven: { 3: 18, 4: 35, 5: 70 },
  wild: { 3: 12, 4: 22, 5: 40 },
};

function pickWeighted(rng) {
  const total = SYMBOLS.reduce((s, x) => s + x.w, 0);
  const r = rng() * total;
  let acc = 0;
  for (const s of SYMBOLS) {
    acc += s.w;
    if (r <= acc) return s;
  }
  return SYMBOLS[0];
}

function defaultUser(username) {
  return {
    username,
    password: "", // MVP: локально. Для реального проекта нужен сервер и безопасное хранение.
    createdAt: nowMs(),
    balance: 1000,
    seed: randomSeed(),
    dailyClaimedAt: 0,
    stats: {
      classicSpins: 0,
      classicWon: 0,
      classicLost: 0,
      linesSpins: 0,
      linesWon: 0,
      linesLost: 0,
      minesGames: 0,
      minesWon: 0,
      minesLost: 0,
      minesBestCashout: 0,
    },
    payments: [], // [{id, type: 'topup_demo', coins, at}]
  };
}

function normalizeUser(raw, usernameFallback) {
  const base = defaultUser(usernameFallback || "Игрок");
  if (!raw || typeof raw !== "object") return base;
  const u = { ...base, ...raw };
  u.username = typeof u.username === "string" && u.username.trim() ? u.username : base.username;
  u.password = typeof u.password === "string" ? u.password : "";
  u.createdAt = Number.isFinite(u.createdAt) ? u.createdAt : base.createdAt;
  u.balance = clampInt(u.balance, 0, 1_000_000_000);
  u.seed = clampInt(u.seed, 0, 0xffffffff);
  u.dailyClaimedAt = clampInt(u.dailyClaimedAt, 0, 9e15);

  const st = raw.stats && typeof raw.stats === "object" ? raw.stats : {};
  u.stats = {
    classicSpins: clampInt(st.classicSpins ?? base.stats.classicSpins, 0, 1_000_000_000),
    classicWon: clampInt(st.classicWon ?? base.stats.classicWon, 0, 1_000_000_000),
    classicLost: clampInt(st.classicLost ?? base.stats.classicLost, 0, 1_000_000_000),
    linesSpins: clampInt(st.linesSpins ?? base.stats.linesSpins, 0, 1_000_000_000),
    linesWon: clampInt(st.linesWon ?? base.stats.linesWon, 0, 1_000_000_000),
    linesLost: clampInt(st.linesLost ?? base.stats.linesLost, 0, 1_000_000_000),
    minesGames: clampInt(st.minesGames ?? base.stats.minesGames, 0, 1_000_000_000),
    minesWon: clampInt(st.minesWon ?? base.stats.minesWon, 0, 1_000_000_000),
    minesLost: clampInt(st.minesLost ?? base.stats.minesLost, 0, 1_000_000_000),
    minesBestCashout: clampInt(st.minesBestCashout ?? base.stats.minesBestCashout, 0, 1_000_000_000),
  };

  u.payments = Array.isArray(raw.payments) ? raw.payments.slice(0, 200).filter((p) => p && typeof p === "object") : [];
  return u;
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) throw new Error("empty");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") throw new Error("bad");
    const usersRaw = parsed.users && typeof parsed.users === "object" ? parsed.users : {};
    const users = {};
    for (const [k, v] of Object.entries(usersRaw)) users[k] = normalizeUser(v, k);
    const currentUser = typeof parsed.currentUser === "string" ? parsed.currentUser : "Гость";
    const leaderboard = Array.isArray(parsed.leaderboard) ? parsed.leaderboard.slice(0, 10) : [];

    // миграция старого состояния v1 → в гостя
    if (parsed.balance != null || parsed.seed != null || parsed.dailyClaimedAt != null) {
      const guest = defaultUser("Гость");
      guest.balance = clampInt(parsed.balance ?? 1000, 0, 1_000_000_000);
      guest.seed = clampInt(parsed.seed ?? randomSeed(), 0, 0xffffffff);
      guest.dailyClaimedAt = clampInt(parsed.dailyClaimedAt ?? 0, 0, 9e15);
      if (parsed?.stats) {
        guest.stats.classicSpins = clampInt(parsed.stats.spins ?? 0, 0, 1_000_000_000);
        guest.stats.classicWon = clampInt(parsed.stats.won ?? 0, 0, 1_000_000_000);
        guest.stats.classicLost = clampInt(parsed.stats.lost ?? 0, 0, 1_000_000_000);
      }
      users["Гость"] = guest;
    }

    if (!users["Гость"]) users["Гость"] = defaultUser("Гость");

    return { users, currentUser, leaderboard };
  } catch {
    const users = { "Гость": defaultUser("Гость") };
    return { users, currentUser: "Гость", leaderboard: [] };
  }
}

function saveState(state) {
  // Важно: "Гость" не должен сохранять прогресс/баланс.
  // Сохраняем только зарегистрированные профили.
  const toSave =
    typeof globalThis.structuredClone === "function"
      ? globalThis.structuredClone(state)
      : JSON.parse(JSON.stringify(state));
  if (toSave?.users?.["Гость"]) {
    toSave.users["Гость"] = defaultUser("Гость");
  }
  if (toSave?.currentUser === "Гость") {
    // гарантируем, что гостевое состояние всегда "свежее"
    toSave.currentUser = "Гость";
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
}

const el = {
  userName: document.getElementById("userName"),
  balance: document.getElementById("balance"),
  bet: document.getElementById("bet"),
  r0: document.getElementById("r0"),
  r1: document.getElementById("r1"),
  r2: document.getElementById("r2"),
  spin: document.getElementById("spin"),
  auto: document.getElementById("auto"),
  seed: document.getElementById("seed"),
  status: document.getElementById("status"),
  claimDaily: document.getElementById("claimDaily"),
  dailyState: document.getElementById("dailyState"),
  dailyAmount: document.getElementById("dailyAmount"),
  leaderboard: document.getElementById("leaderboard"),
  submitScore: document.getElementById("submitScore"),
  reset: document.getElementById("reset"),
  openStore: document.getElementById("openStore"),
  openRules: document.getElementById("openRules"),
  openProfile: document.getElementById("openProfile"),
  modal: document.getElementById("modal"),
  modalTitle: document.getElementById("modalTitle"),
  modalBody: document.getElementById("modalBody"),

  tabClassic: document.getElementById("tabClassic"),
  tabLines: document.getElementById("tabLines"),
  tabMines: document.getElementById("tabMines"),
  gameClassic: document.getElementById("gameClassic"),
  gameLines: document.getElementById("gameLines"),
  gameMines: document.getElementById("gameMines"),

  betLines: document.getElementById("betLines"),
  linesCountLines: document.getElementById("linesCountLines"),
  spinLines: document.getElementById("spinLines"),
  autoLines: document.getElementById("autoLines"),
  statusLines: document.getElementById("statusLines"),
  linesReels: document.getElementById("linesReels"),
  linesSvg: document.getElementById("linesSvg"),
  linesWin: document.getElementById("linesWin"),
  linesWinMult: document.getElementById("linesWinMult"),
  linesWinAmount: document.getElementById("linesWinAmount"),
  linesWinMeta: document.getElementById("linesWinMeta"),

  betMines: document.getElementById("betMines"),
  minesCount: document.getElementById("minesCount"),
  startMines: document.getElementById("startMines"),
  cashoutMines: document.getElementById("cashoutMines"),
  minesStatus: document.getElementById("minesStatus"),
  minesGrid: document.getElementById("minesGrid"),

  chatList: document.getElementById("chatList"),
  chatInput: document.getElementById("chatInput"),
  chatSend: document.getElementById("chatSend"),
  tabPlinko: document.getElementById("tabPlinko"),
  gamePlinko: document.getElementById("gamePlinko"),
  canvasPlinko: document.getElementById("plinkoCanvas"),
  betPlinko: document.getElementById("betPlinko"),
  riskPlinko: document.getElementById("riskPlinko"),
  rowsPlinko: document.getElementById("rowsPlinko"),
  dropPlinko: document.getElementById("dropPlinko"),
  autoDropPlinko: document.getElementById("autoDropPlinko"),
  plinkoResult: document.getElementById("plinkoResult"),
};

let app = loadState();

function currentUser() {
  if (!app.users[app.currentUser]) {
    app.currentUser = "Гость";
    resetGuestInMemory();
  }
  return app.users[app.currentUser] || app.users["Гость"];
}

function resetGuestInMemory() {
  app.users["Гость"] = defaultUser("Гость");
}

// Гость не сохраняется: всегда сбрасываем гостя при старте в памяти,
// чтобы не подтягивать старые значения из localStorage.
resetGuestInMemory();

let rng = mulberry32(currentUser().seed);
let spinning = false;
let spinningLines = false;

let mines = {
  active: false,
  bet: 0,
  minesCount: 5,
  openedSafe: 0,
  mineSet: new Set(),
  openSet: new Set(),
};

let linesBonus = {
  active: false,
  remaining: 0,
  betPerLine: 25,
  linesCount: 20,
};

function loadChat() {
  try {
    const raw = localStorage.getItem(CHAT_KEY);
    const arr = JSON.parse(raw || "[]");
    return Array.isArray(arr) ? arr.slice(-60) : [];
  } catch {
    return [];
  }
}

function saveChat(items) {
  try {
    localStorage.setItem(CHAT_KEY, JSON.stringify(items.slice(-60)));
  } catch {}
}

let chat = loadChat();

function setStatus(text, kind = "") {
  el.status.textContent = text;
  el.status.classList.remove("good", "bad", "warn");
  if (kind) el.status.classList.add(kind);
}

function flashReels(kind) {
  for (const r of [el.r0, el.r1, el.r2]) {
    r.classList.remove("flashGood", "flashBad");
    r.classList.add(kind === "good" ? "flashGood" : "flashBad");
    setTimeout(() => r.classList.remove("flashGood", "flashBad"), 420);
  }
}

function setReelSpinning(on) {
  for (const r of [el.r0, el.r1, el.r2]) {
    r.classList.toggle("isSpinning", on);
    if (!on) r.classList.remove("isStopping");
  }
}

function stopReelAnim(reelEl) {
  reelEl.classList.remove("isSpinning");
  reelEl.classList.add("isStopping");
  setTimeout(() => reelEl.classList.remove("isStopping"), 260);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function getStrip(reelEl) {
  return reelEl.querySelector(".reelStrip");
}

function setReelStatic(reelEl, symbol) {
  const strip = getStrip(reelEl);
  if (!strip) return;
  strip.innerHTML = "";
  const node = document.createElement("div");
  node.className = "reelSymbol isCenter";
  node.textContent = symbol.emoji;
  strip.appendChild(node);
  strip.style.transform = "translateY(-50%)";
}

function fillStrip(stripEl, items) {
  stripEl.innerHTML = "";
  for (let i = 0; i < items.length; i++) {
    const n = document.createElement("div");
    n.className = "reelSymbol";
    n.textContent = items[i].emoji;
    stripEl.appendChild(n);
  }
}

function easeOutQuint(t) {
  return 1 - Math.pow(1 - t, 5);
}

function animateStripTo(stripEl, fromY, toY, durationMs) {
  return new Promise((resolve) => {
    const start = performance.now();
    function frame(now) {
      const p = Math.min(1, (now - start) / durationMs);
      const e = easeOutQuint(p);
      const y = fromY + (toY - fromY) * e;
      stripEl.style.transform = `translateY(calc(-50% + ${y}px))`;
      if (p < 1) requestAnimationFrame(frame);
      else resolve();
    }
    requestAnimationFrame(frame);
  });
}

async function animateReelStrip(reelEl, finalSymbol, { durationMs, spins }) {
  const strip = getStrip(reelEl);
  if (!strip) return;

  reelEl.classList.add("isSpinning");

  // Составляем ленту: много случайных + финальный в конце.
  const items = [];
  const total = clampInt(spins, 12, 80);
  for (let i = 0; i < total; i++) items.push(pickWeighted(rng));
  items.push(finalSymbol);

  fillStrip(strip, items);

  // измеряем высоту символа
  const first = strip.querySelector(".reelSymbol");
  const h = first ? first.getBoundingClientRect().height : 64;

  // Начинаем чуть выше центра, чтобы было движение сразу.
  const fromY = 0;
  const toY = -h * (items.length - 1);

  await animateStripTo(strip, fromY, toY, durationMs);

  // Оставляем только итоговый символ (чтобы DOM не пух).
  stopReelAnim(reelEl);
  setReelStatic(reelEl, finalSymbol);
}

function renderBalance() {
  const u = currentUser();
  el.balance.textContent = formatInt(u.balance);
}

function dailyBonusAmount() {
  // Легкая “прогрессия”: чем больше спинов — тем чуть выше бонус (но с потолком).
  const base = 250;
  const u = currentUser();
  const spins = u.stats.classicSpins + u.stats.linesSpins;
  const extra = Math.min(250, Math.floor(spins / 25) * 10);
  return base + extra;
}

function msUntilDaily() {
  const DAY = 24 * 60 * 60 * 1000;
  const u = currentUser();
  const next = (u.dailyClaimedAt ?? 0) + DAY;
  return Math.max(0, next - nowMs());
}

function renderDaily() {
  const amount = dailyBonusAmount();
  el.dailyAmount.textContent = `+${formatInt(amount)}`;
  const left = msUntilDaily();
  if (left === 0) {
    el.dailyState.textContent = "Доступно сейчас";
    el.claimDaily.disabled = false;
  } else {
    const hrs = Math.floor(left / 3600000);
    const mins = Math.floor((left % 3600000) / 60000);
    el.dailyState.textContent = `Доступно через ${hrs}ч ${mins}м`;
    el.claimDaily.disabled = true;
  }
}

function renderLeaderboard() {
  el.leaderboard.innerHTML = "";
  const items = [...app.leaderboard]
    .filter((x) => x && typeof x.name === "string" && Number.isFinite(x.score))
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  if (items.length === 0) {
    const li = document.createElement("li");
    li.innerHTML = `<div>Пусто</div><div class="small">Нажми “Записать результат”</div>`;
    el.leaderboard.appendChild(li);
    return;
  }

  for (const x of items) {
    const li = document.createElement("li");
    li.innerHTML = `<div>${escapeHtml(x.name)} — <span class="mono">${formatInt(x.score)}</span></div>
      <div class="small">спинов: ${formatInt(x.spins ?? 0)}, seed: ${String(x.seed ?? 0)}</div>`;
    el.leaderboard.appendChild(li);
  }
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[ch]));
}

function openModal(title, bodyHtml) {
  el.modalTitle.textContent = title;
  el.modalBody.innerHTML = bodyHtml;
  try {
    el.modal.showModal();
  } catch {
    // если dialog не поддерживается — fallback
    alert(`${title}\n\n${el.modalBody.textContent || ""}`);
  }
}

function applySpin(bet) {
  // 3 символа с одинаковым RNG (seed сохраняем в state; “Новый seed” меняет rng).
  const a = pickWeighted(rng);
  const b = pickWeighted(rng);
  const c = pickWeighted(rng);

  const isTriple = a.id === b.id && b.id === c.id;
  const mult = isTriple ? PAYOUT_X3[a.id] : 0;
  const payout = mult ? bet * mult : 0;
  return { a, b, c, isTriple, mult, payout };
}

function setReels(a, b, c) {
  setReelStatic(el.r0, a);
  setReelStatic(el.r1, b);
  setReelStatic(el.r2, c);
}

async function spinOnce({ bet }) {
  if (spinning) return;
  bet = clampInt(bet, 1, 1_000_000);
  const u = currentUser();
  if (u.balance < bet) {
    setStatus("Не хватает баланса. Пополните счёт или заберите бонус.", "warn");
    return;
  }

  spinning = true;
  el.spin.disabled = true;
  el.auto.disabled = true;

  u.balance -= bet;
  u.stats.classicSpins += 1;
  saveState(app);
  renderBalance();

  setStatus("Крутим…", "");

  const res = applySpin(bet);

  // Более плавная анимация в стиле “Money‑X”: лёгкий blur + стаггер остановки барабанов.
  setReelSpinning(true);
  await Promise.all([
    animateReelStrip(el.r0, res.a, { durationMs: 900, spins: 26 }),
    animateReelStrip(el.r1, res.b, { durationMs: 1060, spins: 32 }),
    animateReelStrip(el.r2, res.c, { durationMs: 1220, spins: 38 }),
  ]);
  setReelSpinning(false);

  if (res.payout > 0) {
    u.balance += res.payout;
    u.stats.classicWon += res.payout - bet;
    setStatus(`Выигрыш! ×${res.mult} → +${formatInt(res.payout)} монет (ставка ${formatInt(bet)}).`, "good");
    flashReels("good");
  } else {
    u.stats.classicLost += bet;
    setStatus(`Не повезло. −${formatInt(bet)} монет. Попробуй ещё раз или поменяй ставку.`, "bad");
    flashReels("bad");
  }

  saveState(app);
  renderBalance();
  renderDaily();

  spinning = false;
  el.spin.disabled = false;
  el.auto.disabled = false;
}

async function autoSpin10() {
  const bet = readBet(el.bet);
  for (let i = 0; i < 10; i++) {
    if (currentUser().balance < bet) break;
    await spinOnce({ bet });
    await new Promise((r) => setTimeout(r, 180));
  }
}

function claimDaily() {
  const left = msUntilDaily();
  if (left > 0) {
    setStatus("Вы уже забирали бонус сегодня. Попробуйте позже.", "warn");
    return;
  }
  const amount = dailyBonusAmount();
  const u = currentUser();
  u.balance += amount;
  u.dailyClaimedAt = nowMs();
  saveState(app);
  renderBalance();
  renderDaily();
  setStatus(`Ежедневный бонус получен: +${formatInt(amount)} монет.`, "good");
}

function newSeed() {
  const u = currentUser();
  u.seed = randomSeed();
  rng = mulberry32(u.seed);
  saveState(app);
  setStatus(`Seed обновлён: ${u.seed}. Теперь последовательность результатов будет другой.`, "");
}

function submitScore() {
  const u = currentUser();
  const name = (prompt("Имя в таблице (1–16 символов):", u.username || "Игрок") ?? "").trim();
  if (!name) return;
  const safeName = name.slice(0, 16);
  const score = u.balance;
  const spins = u.stats.classicSpins + u.stats.linesSpins;
  app.leaderboard.push({ name: safeName, score, spins, seed: u.seed, at: nowMs() });
  saveState(app);
  renderLeaderboard();
  setStatus("Результат записан в локальный топ.", "");
}

function resetAll() {
  if (!confirm("Сбросить прогресс? Баланс/топ/бонус будут обнулены.")) return;
  localStorage.removeItem(STORAGE_KEY);
  app = loadState();
  rng = mulberry32(currentUser().seed);
  setReels({ emoji: "?" }, { emoji: "?" }, { emoji: "?" });
  renderAll();
  setStatus("Сброшено. У тебя снова стартовый баланс.", "");
}

function openRules() {
  openModal(
    "Правила (MVP)",
    `
      <ul class="list">
        <li><b>Это social casino.</b> Игра идёт только на виртуальные монеты. <b>Вывода денег нет.</b></li>
        <li>Ставка списывается с баланса. При тройном совпадении выплата = ставка × множитель.</li>
        <li>Ежедневный бонус раз в 24 часа.</li>
        <li>Seed влияет на последовательность RNG. Можно нажать “Новый seed”.</li>
      </ul>
      <div class="callout">
        Если будешь публиковать — избегай обещаний “заработка”. Позиционирование: <b>развлечение</b>.
      </div>
    `
  );
}

function openStore() {
  const packs = [
    { id: "p1", coins: 5_000, price: "199₽ (плейсхолдер)" },
    { id: "p2", coins: 15_000, price: "499₽ (плейсхолдер)" },
    { id: "p3", coins: 40_000, price: "999₽ (плейсхолдер)" },
  ];

  openModal(
    "Магазин монет (пока демо)",
    `
      <p style="margin:0;color:var(--muted)">
        Сейчас это демо-кнопки (без оплаты). На следующем шаге подключим реальные платежи/подписку.
      </p>
      <div style="display:grid;gap:10px;margin-top:12px">
        ${packs
          .map(
            (p) => `
              <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;
                padding:10px 12px;border-radius:16px;border:1px solid var(--stroke);background:rgba(10,16,34,.35)">
                <div>
                  <div style="font-weight:800">+${formatInt(p.coins)} монет</div>
                  <div style="font-size:12px;color:var(--muted)">${p.price}</div>
                </div>
                <button class="btn btnPrimary" type="button" data-pack="${p.id}">Добавить</button>
              </div>
            `
          )
          .join("")}
      </div>
    `
  );

  // обработчик внутри модалки
  el.modalBody.querySelectorAll("button[data-pack]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-pack");
      const pack = packs.find((p) => p.id === id);
      if (!pack) return;
      const u = currentUser();
      u.balance += pack.coins;
      u.payments.unshift({ id: `demo_${Math.random().toString(16).slice(2)}`, type: "topup_demo", coins: pack.coins, at: nowMs() });
      saveState(app);
      renderBalance();
      setStatus(`Добавлено +${formatInt(pack.coins)} монет (демо).`, "good");
    });
  });
}

function openProfile() {
  const u = currentUser();
  const isGuest = u.username === "Гость";
  const spins = u.stats.classicSpins + u.stats.linesSpins;

  openModal(
    "Профиль",
    `
      <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;justify-content:space-between">
        <div>
          <div style="font-weight:900;font-size:18px">${escapeHtml(u.username)}</div>
          <div style="font-size:12px;color:var(--muted)">создан: ${new Date(u.createdAt).toLocaleString("ru-RU")}</div>
        </div>
        <div class="pill">
          <span class="pillLabel">Баланс</span>
          <span class="pillValue">${formatInt(u.balance)}</span>
          <span class="pillSuffix">монет</span>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px">
        <div style="padding:10px 12px;border-radius:16px;border:1px solid var(--stroke);background:rgba(10,16,34,.25)">
          <div style="font-weight:850">Статистика</div>
          <div style="margin-top:6px;font-size:13px;color:var(--text)">
            <div>Спины (всего): <span class="mono">${formatInt(spins)}</span></div>
            <div>Classic: <span class="mono">${formatInt(u.stats.classicSpins)}</span></div>
            <div>Lines: <span class="mono">${formatInt(u.stats.linesSpins)}</span></div>
            <div>Mines игр: <span class="mono">${formatInt(u.stats.minesGames)}</span></div>
            <div>Mines best cashout: <span class="mono">${formatInt(u.stats.minesBestCashout)}</span></div>
          </div>
        </div>
        <div style="padding:10px 12px;border-radius:16px;border:1px solid var(--stroke);background:rgba(10,16,34,.25)">
          <div style="font-weight:850">История пополнений (демо)</div>
          <div style="margin-top:6px;font-size:13px;color:var(--text);max-height:140px;overflow:auto">
            ${
              u.payments.length
                ? u.payments
                    .slice(0, 30)
                    .map((p) => `<div style="padding:6px 0;border-bottom:1px solid rgba(255,255,255,.08)">
                      <span class="mono">+${formatInt(p.coins)}</span> • ${new Date(p.at).toLocaleString("ru-RU")}
                    </div>`)
                    .join("")
                : `<div style="color:var(--muted)">Пока пусто. Открой “Магазин”.</div>`
            }
          </div>
        </div>
      </div>

      <div class="row" style="margin-top:12px">
        <button class="btn btnPrimary" type="button" id="authBtn">${isGuest ? "Регистрация / Вход" : "Сменить аккаунт"}</button>
        <button class="btn btnGhost" type="button" id="logoutBtn" ${isGuest ? "disabled" : ""}>Выйти</button>
      </div>
      <div class="callout">
        Сейчас аккаунты <b>локальные</b> (хранятся в браузере). Для настоящих профилей/платежей нужен сервер.
      </div>
    `
  );

  const authBtn = el.modalBody.querySelector("#authBtn");
  const logoutBtn = el.modalBody.querySelector("#logoutBtn");
  if (authBtn) authBtn.addEventListener("click", openAuth);
  if (logoutBtn) logoutBtn.addEventListener("click", () => {
    app.currentUser = "Гость";
    resetGuestInMemory();
    saveState(app);
    rng = mulberry32(currentUser().seed);
    renderAll();
    setStatus("Вы вышли. Сейчас профиль: Гость.", "");
    try { el.modal.close(); } catch {}
  });
}

function openAuth() {
  openModal(
    "Регистрация / Вход (локально)",
    `
      <div style="display:grid;gap:10px">
        <div style="padding:10px 12px;border-radius:16px;border:1px solid var(--stroke);background:rgba(10,16,34,.25)">
          <div style="font-weight:850">Регистрация</div>
          <div style="display:grid;gap:8px;margin-top:8px">
            <input id="regUser" class="input" placeholder="Логин (3–16)" />
            <input id="regPass" class="input" placeholder="Пароль (3–32)" type="password" />
            <button id="regBtn" class="btn btnPrimary" type="button">Создать аккаунт</button>
          </div>
        </div>

        <div style="padding:10px 12px;border-radius:16px;border:1px solid var(--stroke);background:rgba(10,16,34,.25)">
          <div style="font-weight:850">Вход</div>
          <div style="display:grid;gap:8px;margin-top:8px">
            <input id="logUser" class="input" placeholder="Логин" />
            <input id="logPass" class="input" placeholder="Пароль" type="password" />
            <button id="logBtn" class="btn btnSecondary" type="button">Войти</button>
          </div>
        </div>
      </div>
      <div class="callout">
        Это MVP: пароли хранятся в браузере. Для реального продукта так делать нельзя.
      </div>
    `
  );

  const regBtn = el.modalBody.querySelector("#regBtn");
  const logBtn = el.modalBody.querySelector("#logBtn");

  regBtn?.addEventListener("click", () => {
    const user = (el.modalBody.querySelector("#regUser")?.value ?? "").trim();
    const pass = (el.modalBody.querySelector("#regPass")?.value ?? "").trim();
    if (user.length < 3 || user.length > 16) return alert("Логин должен быть 3–16 символов.");
    if (pass.length < 3 || pass.length > 32) return alert("Пароль должен быть 3–32 символа.");
    if (app.users[user]) return alert("Такой логин уже существует.");

    const u = defaultUser(user);
    u.password = pass;
    // переносим баланс гостя, чтобы не было “обнуления”
    const guest = app.users["Гость"];
    if (guest && guest.username === "Гость") {
      u.balance = guest.balance;
      u.seed = guest.seed;
      u.dailyClaimedAt = guest.dailyClaimedAt;
      u.stats.classicSpins = guest.stats.classicSpins;
      u.stats.classicWon = guest.stats.classicWon;
      u.stats.classicLost = guest.stats.classicLost;
      u.stats.linesSpins = guest.stats.linesSpins;
      u.stats.linesWon = guest.stats.linesWon;
      u.stats.linesLost = guest.stats.linesLost;
      u.stats.minesGames = guest.stats.minesGames;
      u.stats.minesWon = guest.stats.minesWon;
      u.stats.minesLost = guest.stats.minesLost;
      u.stats.minesBestCashout = guest.stats.minesBestCashout;
      u.payments = (guest.payments || []).slice(0);
    }

    app.users[user] = u;
    app.currentUser = user;
    saveState(app);
    rng = mulberry32(currentUser().seed);
    renderAll();
    setStatus(`Аккаунт создан. Привет, ${user}!`, "good");
    try { el.modal.close(); } catch {}
  });

  logBtn?.addEventListener("click", () => {
    const user = (el.modalBody.querySelector("#logUser")?.value ?? "").trim();
    const pass = (el.modalBody.querySelector("#logPass")?.value ?? "").trim();
    const u = app.users[user];
    if (!u) return alert("Аккаунт не найден.");
    if (u.password !== pass) return alert("Неверный пароль.");
    app.currentUser = user;
    saveState(app);
    rng = mulberry32(currentUser().seed);
    renderAll();
    setStatus(`С возвращением, ${user}.`, "");
    try { el.modal.close(); } catch {}
  });
}

function setActiveTab(tabId) {
  const map = [
    { tab: el.tabClassic, panel: el.gameClassic, id: "classic" },
    { tab: el.tabLines, panel: el.gameLines, id: "lines" },
    { tab: el.tabMines, panel: el.gameMines, id: "mines" },
    { tab: el.tabPlinko,  panel: el.gamePlinko,  id: "plinko" }
  ];
  for (const x of map) {
    const on = x.id === tabId;
    x.tab.classList.toggle("isActive", on);
    x.tab.setAttribute("aria-selected", on ? "true" : "false");
    x.panel.classList.toggle("isHidden", !on);
  }

  if (tabId === "plinko") {
    // гарантируем инициализацию и отрисовку при открытии вкладки
    initPlinko();
    try {
      rebuildPlinkoBoard();
    } catch {}
    requestAnimationFrame(() => {
      try { drawPlinko(); } catch {}
    });
  }
}

function renderUserName() {
  el.userName.textContent = currentUser().username;
}

// -------- Lines slots (5x3, 3 линии) --------
function rollSymbol() {
  return pickWeighted(rng);
}

function makeLinesGrid() {
  const grid = [[], [], []];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 5; c++) grid[r][c] = rollSymbol();
  return grid;
}

let lineReelEls = [];
const PAYLINES_20 = [
  // rows per column (0=top,1=mid,2=bot)
  [1, 1, 1, 1, 1], // 1 mid
  [0, 0, 0, 0, 0], // 2 top
  [2, 2, 2, 2, 2], // 3 bot
  [0, 1, 2, 1, 0], // 4 V
  [2, 1, 0, 1, 2], // 5 ^ (inverted V)
  [0, 0, 1, 0, 0], // 6 top dip
  [2, 2, 1, 2, 2], // 7 bot bump
  [1, 0, 0, 0, 1], // 8
  [1, 2, 2, 2, 1], // 9
  [0, 1, 1, 1, 0], // 10
  [2, 1, 1, 1, 2], // 11
  [0, 1, 2, 2, 2], // 12 diag down then flat
  [2, 1, 0, 0, 0], // 13 diag up then flat
  [0, 0, 0, 1, 2], // 14 flat then down
  [2, 2, 2, 1, 0], // 15 flat then up
  [1, 0, 1, 2, 1], // 16 zigzag
  [1, 2, 1, 0, 1], // 17 zigzag
  [0, 1, 0, 1, 0], // 18 alternating top/mid
  [2, 1, 2, 1, 2], // 19 alternating bot/mid
  [0, 2, 0, 2, 0], // 20 hard zigzag
];

function initLinesReels() {
  if (!el.linesReels) return;
  el.linesReels.innerHTML = "";
  lineReelEls = [];
  for (let c = 0; c < 5; c++) {
    const reel = document.createElement("div");
    reel.className = "lineReel";
    reel.setAttribute("data-col", String(c));
    const strip = document.createElement("div");
    strip.className = "lineStrip";
    reel.appendChild(strip);
    el.linesReels.appendChild(reel);
    lineReelEls.push(reel);
  }

  initPaylinesSvg();
}

function setLinesStatic(col, symbols3) {
  const reel = lineReelEls[col];
  if (!reel) return;
  const strip = reel.querySelector(".lineStrip");
  strip.innerHTML = "";
  for (let r = 0; r < 3; r++) {
    const n = document.createElement("div");
    n.className = "lineSymbol";
    n.textContent = symbols3[r].emoji;
    n.setAttribute("data-row", String(r));
    strip.appendChild(n);
  }
  strip.style.transform = "translateY(-50%)";
}

function clearLinesHighlights() {
  el.linesSvg?.querySelectorAll(".payline").forEach((x) => x.classList.remove("isWin", "isActive"));
  for (const reel of lineReelEls) reel?.querySelectorAll(".lineSymbol.isWin").forEach((n) => n.classList.remove("isWin"));
}

function setLinesOverlayVisible(visible) {
  if (!el.linesSvg) return;
  el.linesSvg.classList.toggle("isHiddenLines", !visible);
}

function hideLinesWin() {
  el.linesWin?.classList.add("isHidden");
  el.linesWin?.classList.remove("pop");
}

function showLinesWin({ mult, amount, meta }) {
  if (!el.linesWin || !el.linesWinMult || !el.linesWinAmount || !el.linesWinMeta) return;
  el.linesWinMult.textContent = `${Number(mult).toFixed(2)}×`;
  el.linesWinAmount.textContent = formatInt(amount);
  el.linesWinMeta.textContent = meta;
  el.linesWin.classList.remove("isHidden");
  el.linesWin.classList.remove("pop");
  void el.linesWin.offsetWidth;
  el.linesWin.classList.add("pop");
}

function setPaylineState(idx, state) {
  const node = el.linesSvg?.querySelector(`.payline[data-idx="${idx}"]`);
  if (!node) return;
  node.classList.toggle("isActive", state === "active");
  node.classList.toggle("isWin", state === "win");
}

function initPaylinesSvg() {
  if (!el.linesSvg) return;
  el.linesSvg.innerHTML = "";
  const x = [10, 30, 50, 70, 90];
  const y = [20, 50, 80];

  for (let i = 0; i < PAYLINES_20.length; i++) {
    const rows = PAYLINES_20[i];
    const points = rows.map((r, col) => `${x[col]},${y[r]}`).join(" ");
    const pl = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
    pl.setAttribute("points", points);
    pl.setAttribute("class", "payline");
    pl.setAttribute("data-idx", String(i));
    el.linesSvg.appendChild(pl);
  }
}

async function animateLineReel(col, final3, { durationMs, spins }) {
  const reel = lineReelEls[col];
  if (!reel) return;
  const strip = reel.querySelector(".lineStrip");

  reel.classList.add("isSpinning");

  const items = [];
  const total = clampInt(spins, 18, 90);
  for (let i = 0; i < total; i++) items.push(pickWeighted(rng));
  items.push(final3[0], final3[1], final3[2]);

  strip.innerHTML = "";
  for (const s of items) {
    const n = document.createElement("div");
    n.className = "lineSymbol";
    n.textContent = s.emoji;
    strip.appendChild(n);
  }

  const first = strip.querySelector(".lineSymbol");
  const h = first ? first.getBoundingClientRect().height : 64;

  const fromY = 0;
  // хотим, чтобы в окне остались последние 3 символа (final3)
  const toY = -h * (items.length - 3);
  await animateStripTo(strip, fromY, toY, durationMs);

  reel.classList.remove("isSpinning");
  reel.classList.add("isStopping");
  setTimeout(() => reel.classList.remove("isStopping"), 260);

  setLinesStatic(col, final3);
}

function lineWinMultiplier(symbolId, count) {
  const table = LINES_PAYOUT[symbolId];
  return table ? table[count] ?? 0 : 0;
}

function evalLine(lineSymbols) {
  // Scatter не участвует в линиях. Wild заменяет любой символ.
  const isWild = (s) => s?.id === "wild";
  const isScatter = (s) => s?.id === "scatter";

  // базовый символ: первый не-wild и не-scatter
  let base = null;
  for (const s of lineSymbols) {
    if (!isWild(s) && !isScatter(s)) {
      base = s;
      break;
    }
  }
  // если линия состоит только из wild/scatter — считаем как wild-линию (scatter как "разрыв")
  if (!base) base = { id: "wild" };

  let count = 0;
  for (const s of lineSymbols) {
    if (isScatter(s)) break; // scatter не заменяем и не считаем в линию
    if (isWild(s) || s.id === base.id) count++;
    else break;
  }
  if (count >= 3) return { id: base.id, count, mult: lineWinMultiplier(base.id, count) };
  return { id: base.id, count, mult: 0 };
}

async function spinLinesOnce({ bet }) {
  if (spinningLines) return;
  const inBonus = linesBonus.active && linesBonus.remaining > 0;
  const betPerLine = inBonus ? linesBonus.betPerLine : clampInt(bet, 1, 1_000_000);
  const linesCount = inBonus ? linesBonus.linesCount : clampInt(Number(el.linesCountLines?.value ?? 20), 1, 20);
  const totalBet = betPerLine * linesCount;
  const u = currentUser();
  if (!inBonus && u.balance < totalBet) {
    el.statusLines.textContent = "Не хватает баланса. Пополните счёт или заберите бонус.";
    el.statusLines.classList.remove("good", "bad", "warn");
    el.statusLines.classList.add("warn");
    return;
  }

  spinningLines = true;
  el.spinLines.disabled = true;
  el.autoLines.disabled = true;

  if (!inBonus) u.balance -= totalBet;
  u.stats.linesSpins += 1;
  saveState(app);
  renderBalance();

  el.statusLines.textContent = inBonus ? `Бонус: бесплатные спины (${linesBonus.remaining})…` : "Крутим…";
  el.statusLines.classList.remove("good", "bad", "warn");

  clearLinesHighlights();
  hideLinesWin();
  // во время спина линии не показываем вообще
  setLinesOverlayVisible(false);

  const grid = makeLinesGrid();
  const finals = [];
  for (let c = 0; c < 5; c++) finals[c] = [grid[0][c], grid[1][c], grid[2][c]];

  await Promise.all([
    animateLineReel(0, finals[0], { durationMs: 920, spins: 28 }),
    animateLineReel(1, finals[1], { durationMs: 1040, spins: 34 }),
    animateLineReel(2, finals[2], { durationMs: 1160, spins: 40 }),
    animateLineReel(3, finals[3], { durationMs: 1280, spins: 46 }),
    animateLineReel(4, finals[4], { durationMs: 1400, spins: 52 }),
  ]);

  // Scatter count (в любом месте)
  const scatterCount = grid.flat().filter((s) => s?.id === "scatter").length;

  // считаем выигрыш по активным линиям
  let totalMult = 0;
  const winLines = [];
  for (let i = 0; i < linesCount; i++) {
    const pattern = PAYLINES_20[i];
    const lineSyms = pattern.map((row, col) => grid[row][col]);
    const res = evalLine(lineSyms);
    if (res.mult > 0) {
      totalMult += res.mult;
      winLines.push({ idx: i, pattern, count: res.count });
    }
  }
  // В бонусе все выплаты x2
  const bonusPay = inBonus ? 2 : 1;
  const linePayout = totalMult > 0 ? betPerLine * totalMult * bonusPay : 0;

  // Scatter: 2 = +5x от ставки (totalBet), 3+ = +7x и 15 FS (или +10 FS ретриггер в бонусе)
  let scatterPayout = 0;
  let awardedSpins = 0;
  if (scatterCount === 2) scatterPayout = totalBet * 5 * bonusPay;
  if (scatterCount >= 3) {
    scatterPayout = totalBet * 7 * bonusPay;
    if (inBonus) awardedSpins = 10;
    else awardedSpins = 15;
  }

  const payout = linePayout + scatterPayout;

  if (payout > 0) {
    u.balance += payout;
    if (!inBonus) u.stats.linesWon += payout - totalBet;
    else u.stats.linesWon += payout;

    // подсветка выигравших линий + символов
    for (const w of winLines) {
      setPaylineState(w.idx, "win");
      for (let c = 0; c < w.count; c++) {
        const row = w.pattern[c];
        const reel = lineReelEls[c];
        const node = reel?.querySelector(`.lineSymbol[data-row="${row}"]`);
        node?.classList.add("isWin");
      }
    }

    // показываем линии только после спина и только выигравшие
    setLinesOverlayVisible(true);

    const parts = [];
    if (linePayout > 0) parts.push(`линии +${formatInt(linePayout)}`);
    if (scatterPayout > 0) parts.push(`scatter(${scatterCount}) +${formatInt(scatterPayout)}`);
    el.statusLines.textContent = `Выигрыш: +${formatInt(payout)} монет${parts.length ? ` (${parts.join(", ")})` : ""}.`;
    el.statusLines.classList.add("good");
    showLinesWin({
      mult: totalMult + (scatterPayout ? (scatterCount === 2 ? 5 : 7) : 0),
      amount: payout,
      meta: `${inBonus ? "BONUS x2 • " : ""}линий: ${linesCount} • ставка/линия: ${formatInt(betPerLine)} • всего: ${formatInt(totalBet)} • scatter: ${scatterCount}`,
    });
  } else {
    if (!inBonus) u.stats.linesLost += totalBet;
    // на проигрыше линии не показываем
    setLinesOverlayVisible(false);
    el.statusLines.textContent = `Нет выигрыша. −${formatInt(totalBet)} монет.`;
    el.statusLines.classList.add("bad");
  }

  // Бонус логика (запуск/ретриггер/счётчик)
  if (scatterCount >= 3) {
    if (!inBonus) {
      linesBonus.active = true;
      linesBonus.remaining = 15;
      linesBonus.betPerLine = betPerLine;
      linesBonus.linesCount = linesCount;
    } else {
      linesBonus.remaining += 10;
    }
  }
  if (inBonus) {
    linesBonus.remaining = Math.max(0, linesBonus.remaining - 1);
    if (linesBonus.remaining === 0) {
      linesBonus.active = false;
    }
  }

  // UI: в бонусе фиксируем ставку/линии
  if (el.betLines) el.betLines.disabled = linesBonus.active;
  if (el.linesCountLines) el.linesCountLines.disabled = linesBonus.active;
  document.querySelectorAll('.chip[data-bet-target="betLines"]').forEach((x) => (x.disabled = linesBonus.active));

  saveState(app);
  renderBalance();
  renderDaily();

  spinningLines = false;
  el.spinLines.disabled = false;
  el.autoLines.disabled = false;
}

async function autoLines10() {
  const bet = readBet(el.betLines);
  const linesCount = clampInt(Number(el.linesCountLines?.value ?? 20), 1, 20);
  const totalBet = clampInt(bet, 1, 1_000_000) * linesCount;
  for (let i = 0; i < 10; i++) {
    if (currentUser().balance < totalBet) break;
    await spinLinesOnce({ bet });
    await new Promise((r) => setTimeout(r, 180));
  }
}

// -------- Mines (5x5) --------
function minesResetUI() {
  el.minesGrid.innerHTML = "";
  for (let i = 0; i < 25; i++) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "mineCell";
    b.textContent = "";
    b.setAttribute("data-idx", String(i));
    b.addEventListener("click", () => onMineClick(i, b));
    el.minesGrid.appendChild(b);
  }
}

function minesMultiplier(openedSafe, minesCount) {
  // MVP: простая таблица (не “казино-идеальная”), но ощущается как рост.
  const base = 1.0 + openedSafe * (0.12 + minesCount * 0.01);
  return Math.max(1.0, Math.min(15.0, Math.round(base * 100) / 100));
}

function startMines() {
  const bet = clampInt(Number(el.betMines.value), 1, 1_000_000);
  const minesCount = clampInt(Number(el.minesCount.value), 1, 24);
  const u = currentUser();
  if (u.balance < bet) {
    el.minesStatus.textContent = "Не хватает баланса. Пополните счёт или заберите бонус.";
    el.minesStatus.classList.remove("good", "bad", "warn");
    el.minesStatus.classList.add("warn");
    return;
  }

  u.balance -= bet;
  u.stats.minesGames += 1;
  saveState(app);
  renderBalance();

  mines.active = true;
  mines.bet = bet;
  mines.minesCount = minesCount;
  mines.openedSafe = 0;
  mines.mineSet = new Set();
  mines.openSet = new Set();

  // размещаем мины
  while (mines.mineSet.size < minesCount) {
    mines.mineSet.add(clampInt(Math.floor(rng() * 25), 0, 24));
  }

  minesResetUI();
  el.cashoutMines.disabled = true;
  el.minesStatus.classList.remove("good", "bad", "warn");
  el.minesStatus.textContent = `Игра началась. Ставка ${formatInt(bet)}. Открыто: 0. Множитель: ×1.00`;
  renderDaily();
}

function revealAllMines() {
  el.minesGrid.querySelectorAll(".mineCell").forEach((node) => {
    const idx = Number(node.getAttribute("data-idx"));
    if (!Number.isFinite(idx)) return;
    if (mines.mineSet.has(idx)) {
      node.classList.add("isOpen", "isBoom");
      node.textContent = "💣";
    } else if (mines.openSet.has(idx)) {
      node.classList.add("isOpen", "isSafe");
      node.textContent = "💎";
    }
    node.disabled = true;
  });
}

function onMineClick(idx, btn) {
  if (!mines.active) return;
  if (mines.openSet.has(idx)) return;
  mines.openSet.add(idx);

  if (mines.mineSet.has(idx)) {
    btn.classList.add("isOpen", "isBoom");
    btn.textContent = "💣";
    el.minesStatus.classList.remove("good", "warn");
    el.minesStatus.classList.add("bad");
    el.minesStatus.textContent = `Бум. Вы проиграли ставку ${formatInt(mines.bet)}.`;
    currentUser().stats.minesLost += mines.bet;
    mines.active = false;
    el.cashoutMines.disabled = true;
    revealAllMines();
    saveState(app);
    return;
  }

  mines.openedSafe += 1;
  btn.classList.add("isOpen", "isSafe");
  btn.textContent = "💎";
  btn.disabled = true;

  const mult = minesMultiplier(mines.openedSafe, mines.minesCount);
  el.minesStatus.classList.remove("bad", "warn");
  el.minesStatus.classList.add("good");
  el.minesStatus.textContent = `Безопасно! Открыто: ${mines.openedSafe}. Текущий множитель: ×${mult}`;
  el.cashoutMines.disabled = false;
}

function cashoutMines() {
  if (!mines.active) return;
  const mult = minesMultiplier(mines.openedSafe, mines.minesCount);
  const payout = Math.floor(mines.bet * mult);
  const u = currentUser();
  u.balance += payout;
  u.stats.minesWon += Math.max(0, payout - mines.bet);
  u.stats.minesBestCashout = Math.max(u.stats.minesBestCashout, payout);
  saveState(app);
  renderBalance();

  el.minesStatus.classList.remove("bad", "warn");
  el.minesStatus.classList.add("good");
  el.minesStatus.textContent = `Забрали: +${formatInt(payout)} монет (×${mult}).`;
  mines.active = false;
  el.cashoutMines.disabled = true;
  revealAllMines();
}

function renderAll() {
  renderUserName();
  renderBalance();
  renderDaily();
  renderLeaderboard();
  el.spin.disabled = false;
  el.auto.disabled = false;
  el.spinLines.disabled = false;
  el.autoLines.disabled = false;
  minesResetUI();
  renderChat();
}

function renderChat() {
  if (!el.chatList) return;
  el.chatList.innerHTML = "";
  const items = (chat || []).slice(-60);
  for (const m of items) {
    const wrap = document.createElement("div");
    wrap.className = "chatMsg";
    const who = typeof m.user === "string" ? m.user : "Гость";
    const when = Number.isFinite(m.at) ? new Date(m.at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }) : "";
    const text = typeof m.text === "string" ? m.text : "";
    wrap.innerHTML = `
      <div class="chatMeta">
        <div><b>${escapeHtml(who)}</b></div>
        <div class="mono">${escapeHtml(when)}</div>
      </div>
      <div class="chatText">${escapeHtml(text)}</div>
    `;
    el.chatList.appendChild(wrap);
  }
  el.chatList.scrollTop = el.chatList.scrollHeight;
}

function sendChat() {
  const text = (el.chatInput?.value ?? "").trim();
  if (!text) return;
  const user = currentUser().username || "Гость";
  chat.push({ id: `m_${Math.random().toString(16).slice(2)}`, user, text: text.slice(0, 200), at: nowMs() });
  chat = chat.slice(-60);
  saveChat(chat);
  if (el.chatInput) el.chatInput.value = "";
  renderChat();
}

// events
el.spin?.addEventListener("click", () => spinOnce({ bet: readBet(el.bet) }));
el.auto?.addEventListener("click", autoSpin10);
el.seed?.addEventListener("click", newSeed);
el.claimDaily?.addEventListener("click", claimDaily);
el.submitScore?.addEventListener("click", submitScore);
el.reset?.addEventListener("click", resetAll);
el.openRules?.addEventListener("click", openRules);
el.openStore?.addEventListener("click", openStore);
el.openProfile?.addEventListener("click", openProfile);

el.tabClassic?.addEventListener("click", () => setActiveTab("classic"));
el.tabLines?.addEventListener("click", () => setActiveTab("lines"));
el.tabMines?.addEventListener("click", () => setActiveTab("mines"));
el.tabPlinko?.addEventListener("click", () => setActiveTab("plinko"));
el.spinLines?.addEventListener("click", () => spinLinesOnce({ bet: readBet(el.betLines) }));
el.autoLines?.addEventListener("click", autoLines10);
el.linesCountLines?.addEventListener("change", () => {
  clearLinesHighlights();
  // не показываем фоновые линии — только выигравшие после спина
  setLinesOverlayVisible(false);
  hideLinesWin();
});

el.startMines?.addEventListener("click", startMines);
el.cashoutMines?.addEventListener("click", cashoutMines);

el.chatSend?.addEventListener("click", sendChat);
el.chatInput?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    sendChat();
  }
});

// быстрые "чипы" ставки
document.querySelectorAll(".chip[data-bet-target][data-bet]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const targetId = btn.getAttribute("data-bet-target");
    const bet = clampInt(Number(btn.getAttribute("data-bet")), 1, 1_000_000);
    const input = document.getElementById(targetId);
    if (input) input.value = String(bet);
  });
});

function initApp() {
  // boot
  setReels(SYMBOLS[0], SYMBOLS[1], SYMBOLS[2]);
  initLinesReels();
  {
    const g = makeLinesGrid();
    for (let c = 0; c < 5; c++) setLinesStatic(c, [g[0][c], g[1][c], g[2][c]]);
  }
  minesResetUI();
  initPlinko();
  setActiveTab("classic");
  renderAll();
  setStatus("Готово. Если хочешь — забери ежедневный бонус и крути.", "");
  setInterval(renderDaily, 15_000);
}

try {
  initApp();
} catch (e) {
  try {
    setStatus(`Ошибка инициализации: ${e?.message || e}.`, "warn");
  } catch {}
  console.error(e);
}

window.addEventListener("error", (e) => {
  try {
    setStatus(`Ошибка: ${e?.message || "что-то пошло не так"}. Обнови страницу.`, "warn");
  } catch {}
});

window.addEventListener("unhandledrejection", (e) => {
  try {
    setStatus(`Ошибка: ${e?.reason?.message || "ошибка промиса"}. Обнови страницу.`, "warn");
  } catch {}
});

// ==================== PLINKO ====================
let plinko = {
  canvas: null,
  ctx: null,
  pegs: [],
  buckets: [],
  ball: null,
  isAnimating: false,
  autoDropsLeft: 0,
  rows: 12,
  risk: "medium",
  multipliers: [],
  chances: [],
  lastBucketIdx: -1,
  inited: false,
  pegRadius: 7,
  ballRadius: 7,
  gravity: 0.28,
  bounce: 0.62
};

function computePlinkoChances(multipliers, risk) {
  // Чем выше множитель — тем меньше шанс.
  // Risk регулирует "крутизну" падения вероятности.
  const kByRisk = { easy: 1.15, medium: 1.35, hard: 1.6, extreme: 1.9 };
  const k = kByRisk[risk] ?? 1.35;

  const raw = multipliers.map((m) => 1 / Math.pow(Math.max(0.2, m), k));
  const sum = raw.reduce((a, b) => a + b, 0) || 1;
  let probs = raw.map((w) => w / sum);

  // Минимальный шанс 0.01% для каждой корзины, чтобы не выглядело "0%".
  const floor = 0.0001; // 0.01%
  probs = probs.map((p) => Math.max(floor, p));
  const sum2 = probs.reduce((a, b) => a + b, 0) || 1;
  probs = probs.map((p) => p / sum2);
  return probs;
}

function sampleIndexByChances(chances) {
  const r = rng();
  let acc = 0;
  for (let i = 0; i < chances.length; i++) {
    acc += chances[i];
    if (r <= acc) return i;
  }
  return chances.length - 1;
}

function initPlinko() {
  if (plinko.inited) return;
  if (!el.canvasPlinko || !el.dropPlinko || !el.autoDropPlinko) return;

  plinko.canvas = el.canvasPlinko;
  plinko.ctx = plinko.canvas.getContext("2d");
  if (!plinko.ctx) return;
  plinko.canvas.width = 720;
  plinko.canvas.height = 580;

  // Слушатели изменений настроек
  el.riskPlinko?.addEventListener("change", rebuildPlinkoBoard);
  el.rowsPlinko?.addEventListener("change", rebuildPlinkoBoard);
  el.dropPlinko.addEventListener("click", () => dropBall(false));
  el.autoDropPlinko.addEventListener("click", () => {
    if (plinko.autoDropsLeft > 0) return;
    plinko.autoDropsLeft = 10;
    autoDrop();
  });

  rebuildPlinkoBoard(); // Первая сборка доски
  plinko.inited = true;
}

function rebuildPlinkoBoard() {
  plinko.risk = el.riskPlinko?.value || "medium";
  plinko.rows = clampInt(Number(el.rowsPlinko?.value ?? 12), 8, 16);

  // Генерация пинов
  plinko.pegs = [];
  // Пирамида: 1..rows пинов, по центру.
  const marginX = 64;
  const bottomCols = plinko.rows; // внизу rows пинов
  const spacingX = (plinko.canvas.width - marginX * 2) / Math.max(1, bottomCols - 1); // шире и контролируемо
  const spacingY = Math.min(44, (plinko.canvas.height - 160) / (plinko.rows + 1));
  const centerX = plinko.canvas.width / 2;
  const topY = 118; // ниже

  for (let row = 0; row < plinko.rows; row++) {
    const colsThisRow = row + 1;
    const rowWidth = (colsThisRow - 1) * spacingX;
    const startX = centerX - rowWidth / 2;
    const y = topY + row * spacingY;
    for (let col = 0; col < colsThisRow; col++) {
      plinko.pegs.push({
        x: startX + col * spacingX,
        y
      });
    }
  }

  // Генерация множителей
  plinko.multipliers = generateMultipliers(plinko.rows, plinko.risk);
  plinko.chances = computePlinkoChances(plinko.multipliers, plinko.risk);
  plinko.buckets = [];
  const bucketWidth = plinko.canvas.width / plinko.multipliers.length;
  for (let i = 0; i < plinko.multipliers.length; i++) {
    plinko.buckets.push({
      x: i * bucketWidth + bucketWidth / 2,
      mult: plinko.multipliers[i],
      chance: plinko.chances[i],
    });
  }

  drawPlinko();
}

function generateMultipliers(rows, risk) {
  const count = rows + 1; // корзин = рядов + 1
  const center = Math.floor(count / 2);

  // Дискретные множители. Реально зависят от сложности и числа рядов:
  // - чем выше риск, тем выше максимум и тем агрессивнее рост к краям
  // - чем больше рядов, тем больше "ступенек" (используем больше значений)
  const ladders = {
    easy:    { ladder: [0.2, 0.5, 1, 2, 5, 10, 25],           curve: 1.25 },
    medium:  { ladder: [0.2, 0.5, 1, 2, 5, 10, 25, 125],       curve: 1.45 },
    hard:    { ladder: [0.2, 0.5, 1, 2, 5, 10, 25, 125, 1000], curve: 1.70 },
    extreme: { ladder: [0.2, 0.5, 1, 2, 5, 10, 25, 125, 1000], curve: 2.05 },
  };
  const cfg = ladders[risk] || ladders.medium;
  const ladder = cfg.ladder;
  const curve = cfg.curve;

  const mults = new Array(count).fill(ladder[0]);

  // Насколько глубоко используем лестницу (больше рядов → ближе к максимуму).
  // Например, на 8 рядах мы не обязаны доходить до 1000× даже на hard.
  const reachByRows = clampInt(rows, 8, 16);
  const reach = (reachByRows - 8) / 8; // 0..1
  const maxIndex = Math.max(1, Math.min(ladder.length - 1, Math.round(1 + reach * (ladder.length - 2))));

  for (let i = 0; i < count; i++) {
    const dist = Math.abs(i - center);
    const t = center === 0 ? 0 : dist / center; // 0 в центре, 1 на краю
    const eased = Math.pow(t, curve);
    const idx = Math.min(maxIndex, Math.round(eased * maxIndex));
    mults[i] = ladder[idx];
  }
  return mults;
}

function drawPlinko() {
  const c = plinko.ctx;
  c.clearRect(0, 0, plinko.canvas.width, plinko.canvas.height);

  // Пины
  for (let p of plinko.pegs) {
    c.beginPath();
    c.arc(p.x, p.y, plinko.pegRadius, 0, Math.PI * 2);
    c.fillStyle = "#a78bfa";
    c.fill();
    c.strokeStyle = "#6ee7ff";
    c.lineWidth = 3;
    c.stroke();
  }

  // Корзины
  const bucketWidth = plinko.canvas.width / plinko.buckets.length;
  const fontSize = clampInt(Math.floor(Math.min(14, Math.max(10, bucketWidth * 0.22))), 10, 14);
  c.font = `800 ${fontSize}px ${getComputedStyle(document.body).fontFamily}`;
  c.textAlign = "center";
  c.textBaseline = "alphabetic";
  for (let b of plinko.buckets) {
    const color = b.mult >= 50 ? "#ff4d4d" : (b.mult >= 5 ? "#ffd56e" : "#46f0a3");
    c.fillStyle = color;
    const label = b.mult < 1 ? `${b.mult.toFixed(1)}×` : `${Math.round(b.mult)}×`;
    c.fillText(label, b.x, plinko.canvas.height - 24);

    // проценты (если хватает места)
    if (bucketWidth >= 34) {
      c.save();
      c.globalAlpha = 0.85;
      c.fillStyle = "rgba(170,177,216,.85)";
      const pct = `${(b.chance * 100).toFixed(b.chance * 100 < 1 ? 2 : 1)}%`;
      c.font = `700 ${Math.max(9, fontSize - 3)}px ${getComputedStyle(document.body).fontFamily}`;
      c.fillText(pct, b.x, plinko.canvas.height - 8);
      c.restore();
      // вернуть основной шрифт
      c.font = `800 ${fontSize}px ${getComputedStyle(document.body).fontFamily}`;
      c.fillStyle = color;
    }
  }

  // Подсветка последней корзины
  if (plinko.lastBucketIdx >= 0) {
    c.save();
    c.globalAlpha = 0.22;
    c.fillStyle = "#6ee7ff";
    c.fillRect(plinko.lastBucketIdx * bucketWidth, plinko.canvas.height - 78, bucketWidth, 58);
    c.restore();
  }

  // Шарик
  if (plinko.ball) {
    c.shadowBlur = 20;
    c.shadowColor = "#ffd56e";
    c.beginPath();
    c.arc(plinko.ball.x, plinko.ball.y, plinko.ball.radius, 0, Math.PI * 2);
    c.fillStyle = "#ffd56e";
    c.fill();
    c.shadowBlur = 0;
  }
}

function dropBall(isAuto = false) {
  if (plinko.isAnimating) return;

  const bet = readBet(el.betPlinko);
  const u = currentUser();
  if (u.balance < bet) {
    el.plinkoResult.innerHTML = `<span style="color:var(--bad)">Недостаточно монет!</span>`;
    return;
  }

  u.balance -= bet;
  saveState(app);
  renderBalance();

  plinko.isAnimating = true;
  el.plinkoResult.textContent = "";

  // Выбираем целевую корзину по шансам (большие иксы — реже)
  const targetIdx = sampleIndexByChances(plinko.chances || computePlinkoChances(plinko.multipliers, plinko.risk));
  const bucketWidth = plinko.canvas.width / plinko.multipliers.length;
  // цель — не строго центр, а случайно внутри корзины (чтобы визуально было правдоподобнее)
  const inset = Math.min(10, bucketWidth * 0.18);
  const targetX = targetIdx * bucketWidth + inset + rng() * Math.max(1, bucketWidth - inset * 2);

  // Стартовая позиция — строго по центру над пиком пирамиды
  const startX = plinko.canvas.width / 2;

  plinko.ball = {
    x: startX,
    y: 40,
    vx: 0,
    vy: 1.4 + rng() * 0.6,
    radius: plinko.ballRadius,
    bet: bet,
    lastX: startX,
    lastY: 40,
    stuckFrames: 0,
    targetX
  };

  // микрошум, чтобы не было детерминированного перекоса вправо/влево
  plinko.ball.vx = (rng() - 0.5) * 0.18;

  animateBall();
}

function animateBall() {
  if (!plinko.ball) return;

  const b = plinko.ball;
  // несколько подшагов за кадр, чтобы меньше "застревало"
  const steps = 2;
  for (let s = 0; s < steps; s++) {
    // анти-залип сверху
    if (b.y < 35 && b.vy < 0.2) b.vy = 1.2;

    b.vy += plinko.gravity / steps;

    // мягко "подруливаем" к выбранной корзине, чтобы визуально соответствовало шансам
    if (Number.isFinite(b.targetX)) {
      const dxT = b.targetX - b.x;
      b.vx += (dxT * 0.00055); // очень мягко
      b.vx = Math.max(-3.4, Math.min(3.4, b.vx));
    }
    b.x += b.vx / steps;
    b.y += b.vy / steps;

    // Столкновения
    for (let p of plinko.pegs) {
      const dx = b.x - p.x;
      const dy = b.y - p.y;
      const dist = Math.hypot(dx, dy);
      const minDist = b.radius + plinko.pegRadius; // радиус шара + радиус пина
      if (dist > 0 && dist < minDist) {
        const nx = dx / dist;
        const ny = dy / dist;

        // вытолкнуть шар из пина
        const overlap = (minDist - dist) + 0.8;
        b.x += nx * overlap;
        b.y += ny * overlap;

        // толчок: вниз + боковой.
        // Если удар почти в центр пина (nx≈0), выбираем сторону случайно — иначе появляется перекос.
        let side;
        if (Math.abs(nx) < 0.06) side = rng() < 0.5 ? -1 : 1;
        else side = nx > 0 ? 1 : -1;

        b.vx = (b.vx * 0.22) + side * (0.55 + rng() * 0.85);
        // ограничим разгон в сторону, чтобы не улетал в край
        b.vx = Math.max(-3.2, Math.min(3.2, b.vx));

        b.vy = Math.max(0.60, Math.abs(b.vy) * 0.22 + 0.60);
      }
    }
  }

  // анти-застревание между пинами: если почти не двигается несколько кадров — пинок вниз
  const moved = Math.hypot(b.x - (b.lastX ?? b.x), b.y - (b.lastY ?? b.y));
  if (moved < 0.18) b.stuckFrames = (b.stuckFrames ?? 0) + 1;
  else b.stuckFrames = 0;
  b.lastX = b.x;
  b.lastY = b.y;
  if (b.stuckFrames > 10) {
    b.stuckFrames = 0;
    b.y += 2.2;
    b.vy = Math.max(b.vy, 1.4);
    b.vx += (rng() - 0.5) * 2.2;
  }

  // Стены
  if (b.x < 25) { b.x = 25; b.vx = Math.abs(b.vx) * 0.75; }
  if (b.x > plinko.canvas.width - 25) { b.x = plinko.canvas.width - 25; b.vx = -Math.abs(b.vx) * 0.75; }

  // Достигли дна
  if (b.y > plinko.canvas.height - 66) {
    let idx = Math.floor(b.x / (plinko.canvas.width / plinko.multipliers.length));
    idx = clampInt(idx, 0, plinko.multipliers.length - 1);
    plinko.lastBucketIdx = idx;

    const mult = plinko.multipliers[idx];
    const win = Math.floor(b.bet * mult);

    if (win > 0) {
      currentUser().balance += win;
      saveState(app);
      renderBalance();
      el.plinkoResult.innerHTML = `+${formatInt(win)} (${mult.toFixed(1)}×)`;
      if (mult >= 20) el.plinkoResult.style.color = "var(--good)";
      else if (mult < 0.5) el.plinkoResult.style.color = "var(--bad)";
      else el.plinkoResult.style.color = "";
    } else {
      el.plinkoResult.innerHTML = `0 (${mult.toFixed(1)}×)`;
      el.plinkoResult.style.color = "var(--muted)";
    }

    plinko.ball = null;
    plinko.isAnimating = false;
    drawPlinko();
    return;
  }

  drawPlinko();
  requestAnimationFrame(animateBall);
}

function autoDrop() {
  if (plinko.autoDropsLeft <= 0) return;
  plinko.autoDropsLeft--;
  dropBall(true);
  setTimeout(() => {
    if (plinko.autoDropsLeft > 0 && !plinko.isAnimating) autoDrop();
  }, 1400);
}