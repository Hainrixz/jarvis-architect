// Jarvis Panel — frontend.
// Plain ES module, no build step, no CDN. Loaded with CSP default-src 'self'.
// Rules this file keeps:
//   * Model output is NEVER passed to innerHTML. Markdown is rendered by
//     building DOM nodes and setting textContent.
//   * Every mutating request carries the header X-Jarvis-Panel: 1 (CSRF guard).
//   * API paths are relative ("api/...") so the panel also works behind a path prefix.

import { STRINGS, LANGS } from "./i18n.js";

/* ------------------------------------------------------------------ */
/* Small helpers                                                       */
/* ------------------------------------------------------------------ */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function safeStorage(kind) {
  return {
    get(k) { try { return window[kind].getItem(k); } catch { return null; } },
    set(k, v) { try { window[kind].setItem(k, v); } catch { /* private mode */ } },
    del(k) { try { window[kind].removeItem(k); } catch { /* ignore */ } },
  };
}
const local = safeStorage("localStorage");
const session = safeStorage("sessionStorage");

const KEY = {
  lang: "jarvis.panel.lang",
  theme: "jarvis.panel.theme",
  sessionId: "jarvis.panel.session_id",
  history: "jarvis.panel.history",
};

/** Create an element. attrs: {class, text, ...attributes}. Children: nodes or strings (as text). */
function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === "class") node.className = v;
    else if (k === "text") node.textContent = v;
    else node.setAttribute(k, v === true ? "" : String(v));
  }
  for (const c of children) if (c !== null && c !== undefined) node.append(c);
  return node;
}

const SVG_NS = "http://www.w3.org/2000/svg";
function icon(id, cls) {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("aria-hidden", "true");
  if (cls) svg.setAttribute("class", cls);
  const use = document.createElementNS(SVG_NS, "use");
  use.setAttribute("href", `#${id}`);
  svg.append(use);
  return svg;
}

const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");

/* ------------------------------------------------------------------ */
/* State                                                               */
/* ------------------------------------------------------------------ */

const VIEWS = ["chat", "tasks", "memory", "learning", "jobs", "approvals", "status"];
const MEMORY_ORDER = ["SOUL.md", "USER.md", "MEMORY.md", "TASKS.md", "LESSONS.md", "HEARTBEAT.md", "AGENTS.md", "TOOLS.md"];
const APPROVAL_TTL_MS = 5 * 60 * 1000;
const HEALTH_EVERY_MS = 20_000;
const APPROVALS_EVERY_MS = 10_000;
const TASKS_EVERY_MS = 30_000;
const HISTORY_CAP = 120;

const state = {
  lang: LANGS.includes(local.get(KEY.lang)) ? local.get(KEY.lang) : "es",
  theme: ["light", "dark"].includes(local.get(KEY.theme)) ? local.get(KEY.theme) : null,
  started: false,
  view: null,
  jarvisName: "Jarvis",
  health: null,
  healthOk: null,
  timers: { health: 0, approvals: 0, tick: 0, tasks: 0 },
  chat: {
    sessionId: session.get(KEY.sessionId) || null,
    history: loadHistory(),
    streaming: false,
    controller: null,
  },
  memory: { files: [], current: null, original: "", editable: false, dirty: false, saving: false },
  jobs: [],
  approvals: { items: [], renderedKey: "" },
  tasks: { data: null, filter: "open" },
  learning: { data: null, filter: "active" },
  log: [],
};

function loadHistory() {
  try {
    const raw = session.get(KEY.history);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter((m) => m && typeof m.text === "string") : [];
  } catch { return []; }
}
function saveHistory() {
  const h = state.chat.history.slice(-HISTORY_CAP);
  state.chat.history = h;
  session.set(KEY.history, JSON.stringify(h));
}

/* ------------------------------------------------------------------ */
/* i18n                                                                */
/* ------------------------------------------------------------------ */

function t(key, vars) {
  let s = STRINGS[state.lang]?.[key];
  if (s === undefined) s = STRINGS.es[key];
  if (s === undefined) return key;
  if (typeof s === "string" && vars) {
    s = s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
  }
  return s;
}

function applyI18n() {
  document.documentElement.lang = state.lang;
  for (const node of $$("[data-i18n]")) node.textContent = t(node.dataset.i18n);
  for (const node of $$("[data-i18n-aria]")) node.setAttribute("aria-label", t(node.dataset.i18nAria));

  const langBtn = $("#lang-toggle");
  langBtn.textContent = t("lang.short");
  langBtn.setAttribute("aria-label", t("lang.switch"));
  langBtn.title = t("lang.switch");
  $("#logout-btn").title = t("logout");

  $("#confirm-cancel").textContent = t("jobs.cancel");
  applyTheme();
  applyName();
  renderHealth();
  renderChips();
  updateSendButton();
  updateBadge();

  // Re-render whatever view is open so dynamic text switches language too.
  if (state.view === "memory") { renderMemoryList(); if (state.memory.current) renderMemoryHeader(); }
  if (state.view === "jobs") renderJobs();
  if (state.view === "tasks") renderTasks();
  if (state.view === "learning") renderLearning();
  updateTasksBadge();
  if (state.view === "approvals") { state.approvals.renderedKey = ""; renderApprovals(); }
  if (state.view === "status") { renderStats(); renderLog(); }
}

function toggleLang() {
  const i = LANGS.indexOf(state.lang);
  state.lang = LANGS[(i + 1) % LANGS.length];
  local.set(KEY.lang, state.lang);
  applyI18n();
}

/* ------------------------------------------------------------------ */
/* Theme                                                               */
/* ------------------------------------------------------------------ */

const prefersLight = window.matchMedia("(prefers-color-scheme: light)");
const resolvedTheme = () => state.theme || (prefersLight.matches ? "light" : "dark");

function applyTheme() {
  const root = document.documentElement;
  if (state.theme) root.dataset.theme = state.theme;
  else delete root.dataset.theme;
  const active = resolvedTheme();
  root.dataset.activeTheme = active;
  const btn = $("#theme-toggle");
  const label = active === "dark" ? t("theme.toLight") : t("theme.toDark");
  btn.setAttribute("aria-label", label);
  btn.title = label;
}

function toggleTheme() {
  state.theme = resolvedTheme() === "dark" ? "light" : "dark";
  local.set(KEY.theme, state.theme);
  applyTheme();
}

/* ------------------------------------------------------------------ */
/* Formatting                                                          */
/* ------------------------------------------------------------------ */

function toDate(v) {
  if (v === null || v === undefined || v === "") return null;
  const d = typeof v === "number" ? new Date(v < 1e12 ? v * 1000 : v) : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function relTime(v) {
  const d = toDate(v);
  if (!d) return "";
  const diff = (d.getTime() - Date.now()) / 1000;
  const abs = Math.abs(diff);
  if (abs < 45) return t("time.now");
  const rtf = new Intl.RelativeTimeFormat(state.lang, { numeric: "auto" });
  const units = [["year", 31536000], ["month", 2592000], ["week", 604800], ["day", 86400], ["hour", 3600], ["minute", 60]];
  for (const [unit, secs] of units) {
    if (abs >= secs) return rtf.format(Math.round(diff / secs), unit);
  }
  return rtf.format(Math.round(diff), "second");
}

function absTime(v) {
  const d = toDate(v);
  if (!d) return "";
  return new Intl.DateTimeFormat(state.lang, { dateStyle: "medium", timeStyle: "short" }).format(d);
}

function logTime(v) {
  const d = toDate(v);
  if (!d) return typeof v === "string" ? v : "—";
  return new Intl.DateTimeFormat(state.lang, {
    month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).format(d);
}

function duration(totalSeconds) {
  const s = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const parts = [];
  if (d) parts.push(t("dur.d", { n: d }));
  if (h) parts.push(t("dur.h", { n: h }));
  if (m && parts.length < 2) parts.push(t("dur.m", { n: m }));
  if (!parts.length) parts.push(t("dur.s", { n: sec }));
  return parts.join(" ");
}

function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  return t("memory.size", { kb: (n / 1024).toFixed(n < 10240 ? 1 : 0) });
}

function countdown(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function clockTime(h, m) {
  const d = new Date(2000, 0, 1, h, m);
  return new Intl.DateTimeFormat(state.lang, { hour: "numeric", minute: "2-digit" }).format(d);
}

/** Turn a cron expression into plain words. Unknown shapes are shown as-is. */
function humanSchedule(schedule) {
  if (typeof schedule !== "string" || !schedule.trim()) return { text: "—", raw: "" };
  const src = schedule.trim();
  const aliases = { "@hourly": "0 * * * *", "@daily": "0 0 * * *", "@midnight": "0 0 * * *", "@weekly": "0 0 * * 0", "@monthly": "0 0 1 * *" };
  const cron = aliases[src.toLowerCase()] || src;
  const f = cron.split(/\s+/);
  if (f.length !== 5) return { text: src, raw: "" };
  const [m, h, dom, mon, dow] = f;
  const isNum = (x) => /^\d+$/.test(x);
  const all = (...xs) => xs.every((x) => x === "*");
  const out = (text) => ({ text, raw: src });
  let mm;

  if (all(m, h, dom, mon, dow)) return out(t("cron.everyMin"));
  if ((mm = m.match(/^\*\/(\d+)$/)) && all(h, dom, mon, dow)) return out(t("cron.everyNMin", { n: mm[1] }));
  if (isNum(m) && all(h, dom, mon, dow)) return out(t("cron.everyHour", { m }));
  if (isNum(m) && (mm = h.match(/^\*\/(\d+)$/)) && all(dom, mon, dow)) return out(t("cron.everyNHours", { n: mm[1] }));

  if (isNum(m) && isNum(h) && mon === "*" && +h < 24 && +m < 60) {
    const time = clockTime(+h, +m);
    if (dom === "*" && dow === "*") return out(t("cron.daily", { time }));
    if (dom === "*" && (dow === "1-5" || dow === "MON-FRI")) return out(t("cron.weekdays", { time }));
    if (dom === "*" && ["0,6", "6,0", "6,7", "6-7", "SAT,SUN"].includes(dow.toUpperCase())) return out(t("cron.weekends", { time }));
    if (dom === "*" && /^[0-7](,[0-7])*$/.test(dow)) {
      const names = t("cron.dayNames");
      let days = [...new Set(dow.split(",").map((d) => +d % 7))].map((d) => names[d]);
      if (state.lang === "es") days = days.map((d) => d.toLowerCase());
      let list = days.join(", ");
      try { list = new Intl.ListFormat(state.lang, { type: "conjunction" }).format(days); } catch { /* old browser */ }
      list = list.charAt(0).toUpperCase() + list.slice(1);
      return out(t("cron.days", { days: list, time }));
    }
    if (isNum(dom) && dow === "*") return out(t("cron.monthly", { d: dom, time }));
  }
  return { text: src, raw: "" };
}

/* ------------------------------------------------------------------ */
/* API                                                                 */
/* ------------------------------------------------------------------ */

class ApiError extends Error {
  constructor(status, body) {
    super(`HTTP ${status}`);
    this.status = status;
    this.body = body;
  }
}

async function api(path, { method = "GET", body, signal } = {}) {
  const headers = { Accept: "application/json" };
  if (method !== "GET" && method !== "HEAD") headers["X-Jarvis-Panel"] = "1";
  if (body !== undefined) headers["Content-Type"] = "application/json";
  let res;
  try {
    res = await fetch(path, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      credentials: "same-origin",
      cache: "no-store",
      signal,
    });
  } catch (e) {
    if (e && e.name === "AbortError") throw e;
    throw new ApiError(0, null);
  }
  let data = null;
  if ((res.headers.get("content-type") || "").includes("json")) {
    try { data = await res.json(); } catch { data = null; }
  }
  if (res.status === 401 && !path.startsWith("api/login")) showLogin();
  if (!res.ok) throw new ApiError(res.status, data);
  return data;
}

function errorText(e) {
  if (!(e instanceof ApiError)) return (e && e.message) || String(e);
  if (e.status === 0) return t("err.network");
  const b = e.body;
  // A 403 with its own code (lvl_raise, who_to_jarvis, not_a_file…) says why; a bare one does not.
  if (e.status === 403 && !(b && typeof b.error === "string" && b.error !== "forbidden" && b.message)) return t("err.forbidden");
  if (e.status === 413) return t("err.tooBig");
  // The server answers in Spanish; in other languages translate the known error codes.
  if (state.lang !== "es" && b && typeof b.error === "string") {
    const k = `err.code.${b.error}`;
    const tr = t(k);
    if (tr !== k) return tr;
  }
  // Server errors are {error: "<code>", message: "<human text>"}: show the human text first.
  const msg = b && (typeof b.message === "string" && b.message ? b.message
    : typeof b.error === "string" && !/^[a-z_]+$/.test(b.error) ? b.error : null);
  return msg || t("err.generic", { status: e.status });
}

/* ------------------------------------------------------------------ */
/* Toasts and confirm dialog                                           */
/* ------------------------------------------------------------------ */

function toast(message, kind = "info") {
  const node = el("div", { class: `toast${kind === "error" ? " toast-error" : ""}`, text: message });
  $("#toasts").append(node);
  const ttl = kind === "error" ? 6000 : 3500;
  setTimeout(() => {
    node.classList.add("is-leaving");
    setTimeout(() => node.remove(), 200);
  }, ttl);
}

function confirmDialog({ title, body, ok, cancel }) {
  const dialog = $("#confirm-dialog");
  if (typeof dialog.showModal !== "function") return Promise.resolve(window.confirm(`${title}\n\n${body}`));
  $("#confirm-title").textContent = title;
  $("#confirm-body").textContent = body;
  $("#confirm-ok").textContent = ok;
  $("#confirm-cancel").textContent = cancel || t("jobs.cancel");
  dialog.returnValue = "";
  return new Promise((resolve) => {
    dialog.addEventListener("close", () => resolve(dialog.returnValue === "ok"), { once: true });
    dialog.showModal();
    $("#confirm-cancel").focus();
  });
}

/* ------------------------------------------------------------------ */
/* Auth                                                                */
/* ------------------------------------------------------------------ */

function showLogin() {
  stopPolling();
  state.started = false;
  if (state.chat.controller) state.chat.controller.abort();
  $("#boot").hidden = true;
  $("#app").hidden = true;
  $("#login").hidden = false;
  $("#login-error").hidden = true;
  setTimeout(() => $("#login-password").focus(), 0);
}

async function onLogin(ev) {
  ev.preventDefault();
  const input = $("#login-password");
  const err = $("#login-error");
  const btn = $("#login-submit");
  if (!input.value) { input.focus(); return; }
  btn.disabled = true;
  err.hidden = true;
  try {
    await api("api/login", { method: "POST", body: { password: input.value } });
    input.value = "";
    startApp();
  } catch (e) {
    err.textContent = e.status === 401 ? t("login.bad") : e.status === 429 ? t("login.rate") : errorText(e);
    err.hidden = false;
    input.select();
  } finally {
    btn.disabled = false;
  }
}

async function onLogout() {
  if (state.memory.dirty && !(await confirmMemoryDiscard())) return;
  try { await api("api/logout", { method: "POST" }); } catch { /* still clear locally */ }
  // Don't leave the conversation behind on a shared computer.
  state.chat.history = [];
  saveHistory();
  setSessionId(null);
  $("#messages").replaceChildren();
  setEmptyVisible();
  setMemoryDirty(false);
  showLogin();
  toast(t("logout.done"));
}

/* ------------------------------------------------------------------ */
/* App start, polling, routing                                         */
/* ------------------------------------------------------------------ */

function startApp() {
  $("#boot").hidden = true;
  $("#login").hidden = true;
  $("#app").hidden = false;
  if (state.started) return;
  state.started = true;
  state.view = null;
  onRoute();
  refreshHealth();
  refreshApprovals();
  loadTasks({ quiet: true });
  startPolling();
}

function startPolling() {
  stopPolling();
  state.timers.health = setInterval(() => { if (!document.hidden) refreshHealth(); }, HEALTH_EVERY_MS);
  state.timers.approvals = setInterval(() => { if (!document.hidden) refreshApprovals(); }, APPROVALS_EVERY_MS);
  state.timers.tick = setInterval(tickCountdowns, 1000);
  state.timers.tasks = setInterval(() => { if (!document.hidden) loadTasks({ quiet: true }); }, TASKS_EVERY_MS);
}

function stopPolling() {
  clearInterval(state.timers.health);
  clearInterval(state.timers.approvals);
  clearInterval(state.timers.tick);
  clearInterval(state.timers.tasks);
}

function currentRoute() {
  const v = location.hash.replace(/^#\/?/, "").split(/[/?]/)[0];
  return VIEWS.includes(v) ? v : "chat";
}

let routing = false;
async function onRoute() {
  if (routing) return;
  const next = currentRoute();
  if (next === state.view) return;
  if (state.view === "memory" && state.memory.dirty) {
    routing = true;
    history.replaceState(null, "", "#/memory");
    const ok = await confirmMemoryDiscard();
    routing = false;
    if (!ok) return;
    history.replaceState(null, "", `#/${next}`);
  }
  showView(next);
}

function showView(name) {
  const first = state.view === null;
  state.view = name;
  for (const section of $$(".view")) section.hidden = section.dataset.view !== name;
  for (const link of $$(".nav-item")) {
    if (link.dataset.nav === name) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  }
  $("#main").dataset.active = name;
  document.title = `${t(`nav.${name}`)} · ${state.jarvisName}`;

  if (name === "chat") {
    scrollChatToBottom(true);
    if (finePointer.matches) $("#chat-input").focus({ preventScroll: true });
  } else if (!first) {
    const h = $(`.view[data-view="${name}"] .view-title`);
    if (h) { h.setAttribute("tabindex", "-1"); h.focus({ preventScroll: true }); }
  }
  if (name === "memory") loadMemoryList();
  if (name === "jobs") loadJobs();
  if (name === "tasks") { renderTasks(); loadTasks(); }
  if (name === "learning") { renderLearning(); loadLearning(); }
  if (name === "approvals") { state.approvals.renderedKey = ""; renderApprovals(); refreshApprovals(); }
  if (name === "status") { renderStats(); refreshHealth(); loadLog(); }
}

/* ------------------------------------------------------------------ */
/* Health                                                              */
/* ------------------------------------------------------------------ */

async function refreshHealth() {
  try {
    const h = await api("api/health");
    state.health = h;
    state.healthOk = !!(h && h.ok === true);
    if (h && typeof h.jarvis_name === "string" && h.jarvis_name.trim()) {
      state.jarvisName = h.jarvis_name.trim();
      applyName();
    }
  } catch {
    state.healthOk = false;
  }
  renderHealth();
  if (state.view === "status") renderStats();
}

function applyName() {
  $("#jarvis-name").textContent = state.jarvisName;
  $("#chat-input").placeholder = t("chat.placeholder", { name: state.jarvisName });
  if (state.view) document.title = `${t(`nav.${state.view}`)} · ${state.jarvisName}`;
}

function renderHealth() {
  const box = $("#health");
  const s = state.healthOk === null ? "checking" : state.healthOk ? "online" : "offline";
  box.dataset.state = s;
  $("#health-text").textContent = t(`health.${s}`);
  box.title = t(`health.${s}`);
}

/* ------------------------------------------------------------------ */
/* Chat                                                                */
/* ------------------------------------------------------------------ */

function renderChips() {
  const wrap = $("#chat-chips");
  wrap.replaceChildren();
  for (const text of t("chat.suggestions")) {
    const chip = el("button", { class: "chip", type: "button", text });
    chip.addEventListener("click", () => sendMessage(text));
    wrap.append(chip);
  }
}

function setEmptyVisible() {
  $("#chat-empty").hidden = $("#messages").children.length > 0;
}

function isNearBottom() {
  const s = $("#chat-scroll");
  return s.scrollHeight - s.scrollTop - s.clientHeight < 96;
}
function scrollChatToBottom(force = false) {
  const s = $("#chat-scroll");
  if (force || isNearBottom()) s.scrollTop = s.scrollHeight;
}

function whoLabel(role) {
  const wrap = el("div", { class: "msg-who" });
  if (role === "assistant") wrap.append(icon("i-mark"));
  wrap.append(role === "assistant" ? state.jarvisName : t("chat.you"));
  return wrap;
}

function appendUserMessage(text) {
  const li = el("li", { class: "msg msg-user" }, whoLabel("user"), el("div", { class: "msg-body", text }));
  $("#messages").append(li);
  setEmptyVisible();
}

function appendAssistantStatic(text) {
  const body = el("div", { class: "msg-body" });
  body.append(renderMarkdown(text));
  $("#messages").append(el("li", { class: "msg msg-assistant" }, whoLabel("assistant"), body));
  setEmptyVisible();
}

/** A streaming assistant bubble. Rendering is batched to one paint per frame. */
function createAssistantBubble() {
  const body = el("div", { class: "msg-body" });
  const li = el("li", { class: "msg msg-assistant", "aria-busy": "true" }, whoLabel("assistant"), body);
  body.append(el("span", { class: "msg-thinking", text: t("chat.thinking") }));
  $("#messages").append(li);
  setEmptyVisible();
  scrollChatToBottom(true);

  let pending = "";
  let frame = 0;

  const paint = (text, streaming) => {
    const stick = isNearBottom();
    if (!text && streaming) {
      body.replaceChildren(el("span", { class: "msg-thinking", text: t("chat.thinking") }));
    } else {
      body.replaceChildren(renderMarkdown(text));
      if (streaming) placeCaret(body);
    }
    if (stick) scrollChatToBottom(true);
  };

  return {
    update(text) {
      pending = text;
      if (!frame) frame = requestAnimationFrame(() => { frame = 0; paint(pending, true); });
    },
    finish(text) {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      if (text) paint(text, false);
      else body.replaceChildren();
      li.removeAttribute("aria-busy");
    },
    note(text) { body.append(el("p", { class: "msg-note", text })); scrollChatToBottom(); },
    error(text) { body.append(el("p", { class: "msg-error", role: "alert", text })); scrollChatToBottom(true); },
  };
}

function placeCaret(body) {
  let target = body.lastElementChild || body;
  if (target.tagName === "UL" || target.tagName === "OL") target = target.lastElementChild || target;
  else if (target.tagName === "PRE") target = target.firstElementChild || target;
  target.append(el("span", { class: "caret", "aria-hidden": "true" }));
}

function setStreaming(on) {
  state.chat.streaming = on;
  updateSendButton();
}

function updateSendButton() {
  const btn = $("#chat-send");
  const label = $("#chat-send-label");
  if (state.chat.streaming) {
    btn.dataset.mode = "stop";
    btn.disabled = false;
    label.textContent = t("chat.stop");
    btn.title = t("chat.stop");
  } else {
    btn.dataset.mode = "send";
    btn.disabled = !$("#chat-input").value.trim();
    label.textContent = t("chat.send");
    btn.title = t("chat.send");
  }
}

function autosize() {
  const input = $("#chat-input");
  input.style.height = "auto";
  input.style.height = `${Math.min(input.scrollHeight, 200)}px`;
}

function setSessionId(id) {
  state.chat.sessionId = id;
  if (id) session.set(KEY.sessionId, id);
  else session.del(KEY.sessionId);
}

/** Parse a text/event-stream body into JSON events. */
async function* readSSE(stream) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  const parse = (raw) => {
    let eventName = "";
    const data = [];
    for (const line of raw.split("\n")) {
      if (!line || line.startsWith(":")) continue;
      const i = line.indexOf(":");
      const field = i === -1 ? line : line.slice(0, i);
      let value = i === -1 ? "" : line.slice(i + 1);
      if (value.startsWith(" ")) value = value.slice(1);
      if (field === "data") data.push(value);
      else if (field === "event") eventName = value;
    }
    if (!data.length) return null;
    try {
      const obj = JSON.parse(data.join("\n"));
      if (obj && typeof obj === "object") {
        if (!obj.type && eventName) obj.type = eventName;
        return obj;
      }
    } catch { /* ignore malformed frame */ }
    return null;
  };
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");
      let idx;
      while ((idx = buf.indexOf("\n\n")) !== -1) {
        const ev = parse(buf.slice(0, idx));
        buf = buf.slice(idx + 2);
        if (ev) yield ev;
      }
    }
    buf += decoder.decode();
    if (buf.trim()) {
      const ev = parse(buf);
      if (ev) yield ev;
    }
  } finally {
    try { reader.releaseLock(); } catch { /* already released */ }
  }
}

async function sendMessage(raw) {
  const text = String(raw || "").trim();
  if (!text || state.chat.streaming) return;

  const input = $("#chat-input");
  input.value = "";
  autosize();

  appendUserMessage(text);
  state.chat.history.push({ role: "user", text });
  saveHistory();

  const bubble = createAssistantBubble();
  const controller = new AbortController();
  state.chat.controller = controller;
  setStreaming(true);

  let full = "";
  let failure = null;
  let aborted = false;

  try {
    const payload = { message: text };
    if (state.chat.sessionId) payload.session_id = state.chat.sessionId;
    let res;
    try {
      res = await fetch("api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "text/event-stream", "X-Jarvis-Panel": "1" },
        body: JSON.stringify(payload),
        credentials: "same-origin",
        cache: "no-store",
        signal: controller.signal,
      });
    } catch (e) {
      if (e && e.name === "AbortError") throw e;
      throw new ApiError(0, null);
    }
    if (res.status === 401) { showLogin(); throw new ApiError(401, null); }
    if (!res.ok || !res.body) {
      let data = null;
      try { data = await res.json(); } catch { /* not json */ }
      throw new ApiError(res.status, data);
    }
    for await (const ev of readSSE(res.body)) {
      if (ev.type === "delta" && typeof ev.text === "string") {
        full += ev.text;
        bubble.update(full);
      } else if (ev.type === "done") {
        if (typeof ev.session_id === "string" && ev.session_id) setSessionId(ev.session_id);
      } else if (ev.type === "error") {
        failure = typeof ev.message === "string" && ev.message ? ev.message : t("err.generic", { status: "SSE" });
      }
    }
  } catch (e) {
    if (e && e.name === "AbortError") aborted = true;
    else failure = errorText(e);
  } finally {
    bubble.finish(full);
    if (aborted) bubble.note(t("chat.stopped"));
    if (failure) bubble.error(t("chat.error", { msg: failure }));
    if (full) {
      state.chat.history.push({ role: "assistant", text: full });
      saveHistory();
    }
    state.chat.controller = null;
    setStreaming(false);
    if (finePointer.matches && state.view === "chat") input.focus({ preventScroll: true });
  }
}

function stopStreaming() {
  if (state.chat.controller) state.chat.controller.abort();
}

function newConversation() {
  stopStreaming();
  setSessionId(null);
  state.chat.history = [];
  saveHistory();
  $("#messages").replaceChildren();
  setEmptyVisible();
  toast(t("chat.newDone"));
  $("#chat-input").focus({ preventScroll: true });
}

function restoreHistory() {
  for (const m of state.chat.history) {
    if (m.role === "user") appendUserMessage(m.text);
    else appendAssistantStatic(m.text);
  }
  setEmptyVisible();
}

/* ------------------------------------------------------------------ */
/* Safe markdown: **bold**, `code`, ``` fences, lists, headings.       */
/* Builds DOM nodes only. Never uses innerHTML.                        */
/* ------------------------------------------------------------------ */

function appendInline(parent, text) {
  for (const part of text.split(/(`[^`\n]+`)/g)) {
    if (!part) continue;
    if (part.length > 2 && part.startsWith("`") && part.endsWith("`")) {
      parent.append(el("code", { text: part.slice(1, -1) }));
      continue;
    }
    for (const piece of part.split(/(\*\*[^*\n]+?\*\*|__[^_\n]+?__)/g)) {
      if (!piece) continue;
      const bold = piece.length > 4 && ((piece.startsWith("**") && piece.endsWith("**")) || (piece.startsWith("__") && piece.endsWith("__")));
      parent.append(bold ? el("strong", { text: piece.slice(2, -2) }) : document.createTextNode(piece));
    }
  }
}

function renderMarkdown(src) {
  const frag = document.createDocumentFragment();
  const lines = String(src).replace(/\r\n?/g, "\n").split("\n");
  let para = [];
  let list = null;

  const flushPara = () => {
    if (!para.length) return;
    const p = el("p");
    para.forEach((ln, j) => { if (j) p.append(el("br")); appendInline(p, ln); });
    frag.append(p);
    para = [];
  };
  const flushList = () => { if (list) { frag.append(list.node); list = null; } };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const fence = line.match(/^\s*(```+|~~~+)\s*([\w+#.-]*)\s*$/);
    if (fence) {
      flushPara(); flushList();
      const marker = fence[1];
      const code = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith(marker)) { code.push(lines[i]); i++; }
      const pre = el("pre", { tabindex: "0" });
      if (fence[2]) pre.dataset.lang = fence[2];
      pre.append(el("code", { text: code.join("\n") }));
      frag.append(pre);
      continue;
    }

    if (!line.trim()) { flushPara(); flushList(); continue; }

    if (/^\s{0,3}([-*_])(\s*\1){2,}\s*$/.test(line)) { flushPara(); flushList(); frag.append(el("hr")); continue; }

    const heading = line.match(/^\s{0,3}#{1,6}\s+(.*)$/);
    if (heading) {
      flushPara(); flushList();
      const h = el("h3");
      appendInline(h, heading[1].replace(/\s#+\s*$/, ""));
      frag.append(h);
      continue;
    }

    const ul = line.match(/^\s*[-*+]\s+(.*)$/);
    const ol = line.match(/^\s*(\d{1,9})[.)]\s+(.*)$/);
    if (ul || ol) {
      flushPara();
      const type = ul ? "ul" : "ol";
      if (!list || list.type !== type) {
        flushList();
        list = { type, node: el(type) };
        if (ol && ol[1] !== "1") list.node.setAttribute("start", String(Number(ol[1])));
      }
      const item = el("li");
      appendInline(item, ul ? ul[1] : ol[2]);
      list.node.append(item);
      continue;
    }

    if (list && /^\s{2,}\S/.test(line)) {
      const last = list.node.lastElementChild;
      last.append(el("br"));
      appendInline(last, line.trim());
      continue;
    }

    flushList();
    para.push(line);
  }
  flushPara();
  flushList();
  return frag;
}

/* ------------------------------------------------------------------ */
/* Memory                                                              */
/* ------------------------------------------------------------------ */

async function loadMemoryList() {
  try {
    const files = await api("api/memory");
    const arr = Array.isArray(files) ? files : [];
    arr.sort((a, b) => {
      const ia = MEMORY_ORDER.indexOf(a.name), ib = MEMORY_ORDER.indexOf(b.name);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });
    state.memory.files = arr;
  } catch (e) {
    if (e.status !== 401) toast(errorText(e), "error");
    state.memory.files = [];
  }
  renderMemoryList();
  const wide = window.matchMedia("(min-width: 861px)").matches;
  if (!state.memory.current && wide && state.memory.files.length) openMemoryFile(state.memory.files[0].name);
}

function renderMemoryList() {
  const list = $("#memory-list");
  list.replaceChildren();
  if (!state.memory.files.length) {
    list.append(el("li", { class: "empty-card", text: t("memory.empty") }));
    return;
  }
  for (const f of state.memory.files) {
    const btn = el("button", { class: "file-btn", type: "button", "aria-current": state.memory.current === f.name ? "true" : null });
    btn.append(el("span", { class: "file-name", text: f.name }));
    btn.append(f.editable ? el("span") : icon("i-lock", "file-lock"));
    const descKey = `memory.desc.${f.name}`;
    const desc = t(descKey);
    if (desc !== descKey) btn.append(el("span", { class: "file-desc", text: desc }));
    const meta = [];
    if (f.updated_at) meta.push(t("memory.updated", { when: relTime(f.updated_at) }));
    if (typeof f.bytes === "number") meta.push(formatBytes(f.bytes));
    if (!f.editable) meta.push(t("memory.readonly"));
    if (meta.length) btn.append(el("span", { class: "file-meta", text: meta.join(" · ") }));
    btn.addEventListener("click", () => openMemoryFile(f.name));
    list.append(el("li", {}, btn));
  }
}

function confirmMemoryDiscard() {
  return confirmDialog({
    title: t("memory.unsaved"),
    body: t("memory.confirmDiscard", { name: state.memory.current || "" }),
    ok: t("memory.discard"),
    cancel: t("memory.keep"),
  }).then((ok) => {
    if (ok) setMemoryDirty(false);
    return ok;
  });
}

async function openMemoryFile(name) {
  if (state.memory.current === name && !$("#memory-editor").hidden) {
    $("#memory-grid").dataset.pane = "editor";
    return;
  }
  if (state.memory.dirty && !(await confirmMemoryDiscard())) return;
  try {
    const file = await api(`api/memory/${encodeURIComponent(name)}`);
    state.memory.current = file.name || name;
    state.memory.original = typeof file.content === "string" ? file.content : "";
    state.memory.editable = !!file.editable;
    setMemoryDirty(false);

    $("#memory-placeholder").hidden = true;
    $("#memory-editor").hidden = false;
    const ta = $("#memory-textarea");
    const pre = $("#memory-pre");
    ta.hidden = !state.memory.editable;
    pre.hidden = state.memory.editable;
    $("#memory-actions").hidden = !state.memory.editable;
    if (state.memory.editable) { ta.value = state.memory.original; ta.scrollTop = 0; }
    else { pre.textContent = state.memory.original; pre.scrollTop = 0; }
    renderMemoryHeader();
    renderMemoryList();
    $("#memory-grid").dataset.pane = "editor";
  } catch (e) {
    if (e.status !== 401) toast(errorText(e), "error");
  }
}

function renderMemoryHeader() {
  const name = state.memory.current;
  $("#memory-file-name").textContent = name;
  const tag = $("#memory-file-tag");
  tag.textContent = state.memory.editable ? t("memory.editable") : t("memory.readonly");
  tag.className = state.memory.editable ? "tag tag-accent" : "tag";
  const descKey = `memory.desc.${name}`;
  const desc = t(descKey);
  $("#memory-file-desc").textContent = desc === descKey ? "" : desc;
  $("#memory-readonly-note").hidden = state.memory.editable;
  $("#memory-textarea").setAttribute("aria-label", t("memory.editorLabel", { name }));
  $("#memory-pre").setAttribute("aria-label", t("memory.editorLabel", { name }));
  $("#memory-save").textContent = state.memory.saving ? t("memory.saving") : t("memory.save");
}

function setMemoryDirty(dirty) {
  state.memory.dirty = dirty;
  $("#memory-dirty").hidden = !dirty;
  $("#memory-save").disabled = !dirty || state.memory.saving;
  $("#memory-revert").disabled = !dirty || state.memory.saving;
}

async function saveMemory() {
  if (!state.memory.editable || !state.memory.dirty || state.memory.saving) return;
  const name = state.memory.current;
  const content = $("#memory-textarea").value;
  state.memory.saving = true;
  renderMemoryHeader();
  setMemoryDirty(true);
  try {
    await api(`api/memory/${encodeURIComponent(name)}`, { method: "PUT", body: { content } });
    state.memory.original = content;
    state.memory.saving = false;
    setMemoryDirty($("#memory-textarea").value !== content);
    toast(t("memory.saved"));
    loadMemoryList();
  } catch (e) {
    state.memory.saving = false;
    setMemoryDirty(true);
    if (e.status !== 401) toast(errorText(e), "error");
  } finally {
    renderMemoryHeader();
  }
}

/* ------------------------------------------------------------------ */
/* Jobs                                                                */
/* ------------------------------------------------------------------ */

async function loadJobs() {
  try {
    const jobs = await api("api/jobs");
    state.jobs = Array.isArray(jobs) ? jobs : [];
  } catch (e) {
    if (e.status !== 401) toast(errorText(e), "error");
    state.jobs = [];
  }
  renderJobs();
}

function statusTag(status) {
  if (!status) return null;
  const s = String(status).toLowerCase();
  let cls = "tag", label = String(status);
  if (/^(ok|success|succeeded|done|completed)$/.test(s)) { cls = "tag tag-ok"; label = t("jobs.st.ok"); }
  else if (/(error|fail|timeout|denied)/.test(s)) { cls = "tag tag-bad"; label = t("jobs.st.error"); }
  else if (/(running|started|queued)/.test(s)) { cls = "tag tag-warn"; label = t("jobs.st.running"); }
  return el("span", { class: cls, text: label });
}

function renderJobs() {
  const list = $("#jobs-list");
  list.replaceChildren();
  if (!state.jobs.length) {
    list.append(el("li", { class: "empty-card", text: t("jobs.empty") }));
    return;
  }
  for (const job of state.jobs) {
    const name = job.name || job.id || "—";
    const sched = humanSchedule(job.schedule);
    const card = el("li", { class: "card" });

    const top = el("div", { class: "card-top" }, el("h2", { class: "card-title", text: name }));
    const tag = statusTag(job.last_status);
    if (tag) top.append(tag);
    card.append(top);

    if (job.description) card.append(el("p", { class: "card-desc", text: String(job.description) }));

    const meta = el("div", { class: "card-meta" });
    const schedItem = el("span", { class: "card-meta-item" }, icon("i-jobs"), el("span", { class: "schedule", text: sched.text }));
    if (sched.raw) schedItem.append(el("span", { class: "schedule-raw", text: sched.raw }));
    meta.append(schedItem);
    const last = job.last_run
      ? el("span", { class: "card-meta-item", title: absTime(job.last_run), text: `${t("jobs.lastRun")}: ${relTime(job.last_run)}` })
      : el("span", { class: "card-meta-item", text: t("jobs.never") });
    meta.append(last);
    card.append(meta);

    const run = el("button", { class: "btn btn-primary btn-sm", type: "button" }, icon("i-play"), el("span", { text: t("jobs.runNow") }));
    run.addEventListener("click", () => runJob(job, run));
    card.append(el("div", { class: "card-actions" }, run));
    list.append(card);
  }
}

async function runJob(job, btn) {
  const name = job.name || job.id;
  const ok = await confirmDialog({
    title: t("jobs.confirmTitle", { name }),
    body: t("jobs.confirmBody"),
    ok: t("jobs.confirm"),
    cancel: t("jobs.cancel"),
  });
  if (!ok) return;
  const label = btn.querySelector("span");
  btn.disabled = true;
  label.textContent = t("jobs.running");
  try {
    await api(`api/jobs/${encodeURIComponent(job.id)}/run`, { method: "POST", body: { confirm: true } });
    toast(t("jobs.started", { name }));
    setTimeout(() => { if (state.view === "jobs") loadJobs(); }, 3000);
  } catch (e) {
    if (e.status !== 401) toast(errorText(e), "error");
  } finally {
    btn.disabled = false;
    label.textContent = t("jobs.runNow");
  }
}

/* ------------------------------------------------------------------ */
/* Approvals                                                           */
/* ------------------------------------------------------------------ */

function approvalTimes(a) {
  const created = toDate(a.created_at);
  let expires = toDate(a.expires_at);
  if (!expires && created) expires = new Date(created.getTime() + APPROVAL_TTL_MS);
  const total = created && expires ? Math.max(1000, expires - created) : APPROVAL_TTL_MS;
  const left = expires ? expires.getTime() - Date.now() : APPROVAL_TTL_MS;
  return { created, expires, total, left };
}

async function refreshApprovals() {
  try {
    const items = await api("api/approvals");
    state.approvals.items = Array.isArray(items) ? items : [];
  } catch {
    return; // keep last known list; health dot already shows connectivity
  }
  updateBadge();
  if (state.view === "approvals") renderApprovals();
}

function updateBadge() {
  const n = state.approvals.items.filter((a) => approvalTimes(a).left > 0).length;
  const badge = $("#approvals-badge");
  const link = $('.nav-item[data-nav="approvals"]');
  badge.hidden = n === 0;
  badge.textContent = n > 99 ? "99+" : String(n);
  badge.setAttribute("aria-hidden", "true");
  if (n) link.setAttribute("aria-label", `${t("nav.approvals")}, ${t("nav.badge", { n })}`);
  else link.removeAttribute("aria-label");
}

function previewText(p) {
  if (p === null || p === undefined) return "";
  if (typeof p === "string") return p;
  try { return JSON.stringify(p, null, 2); } catch { return String(p); }
}

function renderApprovals() {
  const items = state.approvals.items;
  const key = items.map((a) => a.id).join("|");
  if (key === state.approvals.renderedKey && $("#approvals-list").children.length) { tickCountdowns(); return; }
  state.approvals.renderedKey = key;

  const list = $("#approvals-list");
  list.replaceChildren();
  if (!items.length) {
    list.append(el("li", { class: "empty-card", text: t("approvals.empty") }));
    return;
  }
  for (const a of items) {
    const card = el("li", { class: "card", "data-approval": a.id });
    const top = el("div", { class: "card-top" }, el("h2", { class: "approval-action", text: String(a.action || a.id) }));
    card.append(top);
    if (a.created_at) {
      card.append(el("p", { class: "card-meta", title: absTime(a.created_at), text: t("approvals.requested", { when: relTime(a.created_at) }) }));
    }
    const prev = previewText(a.preview);
    if (prev) card.append(el("pre", { class: "approval-preview", tabindex: "0", "aria-label": t("approvals.preview"), text: prev }));

    const cd = el("div", { class: "countdown" },
      el("span", { class: "countdown-text", "data-countdown": "" }),
      el("div", { class: "countdown-track", "aria-hidden": "true" }, el("div", { class: "countdown-bar" })));
    card.append(cd);

    const reject = el("button", { class: "btn btn-ghost", type: "button", "data-decision": "reject", text: t("approvals.reject") });
    const approve = el("button", { class: "btn btn-primary", type: "button", "data-decision": "approve", text: t("approvals.approve") });
    reject.addEventListener("click", () => decide(a, "reject", card));
    approve.addEventListener("click", () => decide(a, "approve", card));
    card.append(el("div", { class: "card-actions" }, reject, approve));
    list.append(card);
  }
  tickCountdowns();
}

function tickCountdowns() {
  if (state.view !== "approvals") return;
  let changed = false;
  for (const a of state.approvals.items) {
    const card = $(`[data-approval="${CSS.escape(String(a.id))}"]`);
    if (!card) continue;
    const { total, left } = approvalTimes(a);
    const expired = left <= 0;
    const text = card.querySelector("[data-countdown]");
    text.textContent = expired ? t("approvals.expired") : t("approvals.expiresIn", { t: countdown(left) });
    const bar = card.querySelector(".countdown-bar");
    bar.style.transform = `scaleX(${Math.max(0, Math.min(1, left / total))})`;
    card.dataset.urgent = String(!expired && left < 60_000);
    if (card.dataset.expired !== String(expired)) {
      card.dataset.expired = String(expired);
      card.querySelector('[data-decision="approve"]').disabled = expired;
      changed = true;
    }
  }
  if (changed) updateBadge();
}

async function decide(a, decision, card) {
  const buttons = $$("button", card);
  buttons.forEach((b) => { b.disabled = true; });
  try {
    await api(`api/approvals/${encodeURIComponent(a.id)}`, { method: "POST", body: { decision } });
    toast(decision === "approve" ? t("approvals.approved") : t("approvals.rejected"));
    card.classList.add("is-leaving");
    setTimeout(() => {
      state.approvals.items = state.approvals.items.filter((x) => x.id !== a.id);
      state.approvals.renderedKey = "";
      updateBadge();
      renderApprovals();
    }, 190);
  } catch (e) {
    if (e.status === 409 || e.status === 404) {
      // 409 = expired / decided concurrently; 404 = no longer pending (decided elsewhere).
      toast(t("approvals.conflict"), "error");
      state.approvals.renderedKey = "";
      refreshApprovals();
    } else if (e.status !== 401) {
      toast(errorText(e), "error");
      buttons.forEach((b) => { b.disabled = false; });
      tickCountdowns();
    }
  }
}

/* ------------------------------------------------------------------ */
/* Pendientes (TASKS.md + autopilot)                                   */
/* ------------------------------------------------------------------ */

const TASK_FILTERS = {
  open: (t) => ["todo", "doing", "waiting", "blocked", "needs_ok"].includes(t.state),
  needs_ok: (t) => t.state === "needs_ok",
  inbox: (t) => t.state === "inbox",
  closed: (t) => t.state === "done" || t.state === "dropped",
};
const TASK_STATES = ["inbox", "todo", "doing", "waiting", "needs_ok", "blocked", "done", "dropped"];
const LEVELS = ["L0", "L1", "L2", "L3"];

/** "2026-10-08" or "2026-10-08T09:30" -> local Date (date-only means local midnight). */
function parseLocalDate(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/.exec(String(s || ""));
  if (!m) return null;
  return new Date(+m[1], +m[2] - 1, +m[3], m[4] ? +m[4] : 0, m[5] ? +m[5] : 0);
}
function isoDay(d) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function shortDate(s) {
  const d = parseLocalDate(s);
  if (!d) return String(s);
  const opts = { weekday: "short", day: "numeric", month: "short" };
  if (/T/.test(s)) Object.assign(opts, { hour: "2-digit", minute: "2-digit" });
  try { return d.toLocaleString(state.lang === "es" ? "es-MX" : "en-US", opts); } catch { return String(s); }
}
function isOverdue(t) {
  if (!t.due || TASK_FILTERS.closed(t)) return false;
  const d = parseLocalDate(t.due);
  if (!d) return false;
  if (!/T/.test(t.due)) d.setDate(d.getDate() + 1); // a date-only due is overdue from the next day
  return d.getTime() <= Date.now();
}
function money(n) {
  if (typeof n !== "number" || !Number.isFinite(n)) return t("pilot.noLog");
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
  } catch { return `$${n.toFixed(2)}`; }
}
/** run-job.sh stamps "2026-10-06T1013" (local time). */
function stampDate(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2})(\d{2})/.exec(String(s || ""));
  return m ? new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) : toDate(s);
}

async function loadTasks({ quiet = false } = {}) {
  try {
    const data = await api("api/tasks");
    state.tasks.data = data || null;
  } catch (e) {
    if (!quiet && e.status !== 401) toast(errorText(e), "error");
  }
  updateTasksBadge();
  if (state.view === "tasks") renderTasks();
}

function updateTasksBadge() {
  const n = state.tasks.data ? Number(state.tasks.data.needs_ok) || 0 : 0;
  const badge = $("#tasks-badge");
  const link = $('.nav-item[data-nav="tasks"]');
  badge.hidden = n === 0;
  badge.textContent = n > 99 ? "99+" : String(n);
  badge.setAttribute("aria-hidden", "true");
  if (n) link.setAttribute("aria-label", `${t("nav.tasks")}, ${t("nav.tasksBadge", { n })}`);
  else link.removeAttribute("aria-label");
}

function renderSegmented(root, options, current, onPick) {
  root.replaceChildren();
  for (const o of options) {
    const b = el("button", { class: "seg", type: "button", role: "tab", "aria-selected": String(o.key === current) },
      el("span", { text: o.label }), el("span", { class: "seg-count", text: String(o.count) }));
    b.addEventListener("click", () => onPick(o.key));
    root.append(b);
  }
}

function renderPilot() {
  const a = state.tasks.data && state.tasks.data.autopilot;
  const box = $("#pilot");
  const toggle = $("#pilot-toggle");
  if (!a) { box.hidden = true; return; }
  box.hidden = false;
  const mode = a.stopped ? "stopped" : a.paused ? "paused" : "on";
  box.dataset.state = mode;
  $("#pilot-title").textContent = t(`pilot.${mode}`);
  $("#pilot-sub").textContent = t(`pilot.${mode}Sub`);
  const stats = $("#pilot-stats");
  stats.replaceChildren();
  const stat = (label, value, cls, title) =>
    stats.append(el("div", { class: "pilot-stat" }, el("dt", { text: label }), el("dd", { class: cls || null, title: title || null, text: value })));
  if (a.last_run) {
    const when = stampDate(a.last_run.at);
    stat(t("pilot.lastRun"), `${when ? relTime(when) : a.last_run.at} · ${a.last_run.ok ? t("pilot.runOk") : t("pilot.runFail")}`, a.last_run.ok ? "ok" : "bad", when ? absTime(when) : null);
  } else {
    stat(t("pilot.lastRun"), a.has_run_log ? t("pilot.never") : t("pilot.noLog"));
  }
  stat(t("pilot.costToday"), a.cost_today === null ? t("pilot.noLog") : t("pilot.costSplit", { total: money(a.cost_today), pilot: money(a.autopilot_cost_today) }), "mono");
  stat(t("pilot.actionsToday"), String(a.actions_today ?? 0), "mono");
  toggle.hidden = !!a.stopped;
  toggle.className = a.paused ? "btn btn-primary btn-sm" : "btn btn-ghost btn-sm";
  toggle.replaceChildren(icon(a.paused ? "i-play" : "i-pause"), el("span", { text: a.paused ? t("pilot.resume") : t("pilot.pause") }));
}

async function togglePilot() {
  const a = state.tasks.data && state.tasks.data.autopilot;
  if (!a) return;
  const resume = !!a.paused;
  if (resume) {
    const ok = await confirmDialog({ title: t("pilot.confirmTitle"), body: t("pilot.confirmBody"), ok: t("pilot.confirmOk"), cancel: t("jobs.cancel") });
    if (!ok) return;
  }
  const btn = $("#pilot-toggle");
  btn.disabled = true;
  try {
    const next = await api("api/autopilot", { method: "POST", body: resume ? { action: "resume", confirm: true } : { action: "pause" } });
    if (state.tasks.data) state.tasks.data.autopilot = next;
    toast(resume ? t("pilot.resumeDone") : t("pilot.pauseDone"));
    renderPilot();
  } catch (e) {
    if (e.status !== 401) toast(errorText(e), "error");
  } finally {
    btn.disabled = false;
  }
}

function taskSort(a, b) {
  const rank = (x) => (x.state === "needs_ok" ? 0 : isOverdue(x) ? 1 : x.due ? 2 : 3);
  return rank(a) - rank(b)
    || String(a.due || "9999").localeCompare(String(b.due || "9999"))
    || (Number(a.prio) || 9) - (Number(b.prio) || 9)
    || a.id.localeCompare(b.id);
}

function renderTasks() {
  renderPilot();
  const data = state.tasks.data;
  const list = $("#tasks-list");
  list.replaceChildren();
  const tasks = data && Array.isArray(data.tasks) ? data.tasks : [];
  const filterRoot = $("#tasks-filter");
  filterRoot.hidden = !(data && data.exists);
  if (data && data.exists) {
    renderSegmented(filterRoot,
      Object.keys(TASK_FILTERS).map((k) => ({ key: k, label: t(`tasks.f.${k}`), count: tasks.filter(TASK_FILTERS[k]).length })),
      state.tasks.filter,
      (k) => { state.tasks.filter = k; renderTasks(); });
  }
  if (!data || !data.exists) {
    list.append(el("li", { class: "empty-card", text: t("tasks.noFile") }));
  } else {
    const shown = tasks.filter(TASK_FILTERS[state.tasks.filter]).sort(taskSort);
    if (!shown.length) list.append(el("li", { class: "empty-card", text: t("tasks.empty") }));
    for (const task of shown) list.append(taskCard(task));
  }
  const errs = data && Array.isArray(data.errors) ? data.errors : [];
  $("#tasks-errors").hidden = !errs.length;
  renderRawErrors($("#tasks-errors-list"), errs);
}

function renderRawErrors(root, errs) {
  root.replaceChildren();
  for (const e of errs) {
    root.append(el("li", { class: "raw-item" },
      el("span", { class: "raw-meta", text: `${t("tasks.errorLine", { n: e.line })} · ${e.reason || ""}` }),
      el("code", { class: "raw-line", text: e.raw })));
  }
}

function stateTagClass(s) {
  if (s === "needs_ok") return "tag tag-bad";
  if (s === "blocked") return "tag tag-warn";
  if (s === "done") return "tag tag-ok";
  if (s === "doing") return "tag tag-accent";
  return "tag";
}

function taskCard(task) {
  const li = el("li", { class: "task", "data-state": task.state, "data-task": task.id });
  const main = el("div", { class: "task-main" });
  main.append(el("div", { class: "task-top" },
    el("span", { class: "task-id", text: task.id }),
    el("span", { class: "task-title", text: task.title })));
  const tags = el("div", { class: "task-tags" });
  tags.append(el("span", { class: stateTagClass(task.state), text: t(`tasks.st.${task.state}`) }));
  tags.append(el("span", { class: `tag tag-who-${task.who}`, text: t(`tasks.who.${task.who}`) }));
  tags.append(el("span", { class: "tag tag-lvl", title: t(`tasks.lvl.${task.lvl}`), text: task.lvl }));
  const meta = [];
  if (task.due) meta.push(el("span", { class: isOverdue(task) ? "task-meta overdue" : "task-meta", text: t(isOverdue(task) ? "tasks.overdue" : "tasks.due", { d: shortDate(task.due) }) }));
  if (task.next) meta.push(el("span", { class: "task-meta", text: t("tasks.next", { d: shortDate(task.next) }) }));
  if (task.prio) meta.push(el("span", { class: "task-meta", text: t("tasks.prio", { n: task.prio }) }));
  if (task.dep) meta.push(el("span", { class: "task-meta mono", text: t("tasks.dep", { id: task.dep }) }));
  if (task.tries && Number(task.tries) > 0) meta.push(el("span", { class: "task-meta", text: t("tasks.tries", { n: task.tries }) }));
  for (const m of meta) tags.append(m);
  main.append(tags);
  if (task.state === "needs_ok") main.append(el("p", { class: "task-hint", text: t("tasks.needsOkHint", { id: task.id }) }));
  else if (task.state === "inbox" && /^email:untrusted/.test(task.src || "")) main.append(el("p", { class: "task-hint", text: t("tasks.fromUntrusted") }));
  li.append(main);

  const actions = el("div", { class: "task-actions" });
  const stateSel = el("select", { class: "select", "aria-label": t("tasks.stateLabel", { id: task.id }) });
  for (const s of TASK_STATES) stateSel.append(el("option", { value: s, selected: s === task.state, text: t(`tasks.st.${s}`) }));
  stateSel.addEventListener("change", () => patchTask(task, { state: stateSel.value }, li));
  actions.append(stateSel);

  const idx = LEVELS.indexOf(task.lvl);
  if (idx > 0) {
    const lvlSel = el("select", { class: "select select-narrow", "aria-label": t("tasks.lvlLabel", { id: task.id }), title: t("tasks.lvlLabel", { id: task.id }) });
    for (const l of LEVELS.slice(0, idx + 1)) lvlSel.append(el("option", { value: l, selected: l === task.lvl, text: l }));
    lvlSel.addEventListener("change", () => patchTask(task, { lvl: lvlSel.value }, li));
    actions.append(lvlSel);
  }

  if (!TASK_FILTERS.closed(task)) {
    const snooze = el("select", { class: "select", "aria-label": t("tasks.snoozeLabel", { id: task.id }) });
    snooze.append(el("option", { value: "", text: t("tasks.snooze") }));
    snooze.append(el("option", { value: "1", text: t("tasks.snoozeTomorrow") }));
    snooze.append(el("option", { value: "7", text: t("tasks.snoozeWeek") }));
    if (task.next) snooze.append(el("option", { value: "clear", text: t("tasks.clearNext") }));
    snooze.addEventListener("change", () => {
      const v = snooze.value;
      if (!v) return;
      let next = null;
      if (v !== "clear") { const d = new Date(); d.setDate(d.getDate() + Number(v)); next = isoDay(d); }
      patchTask(task, { next }, li);
    });
    actions.append(snooze);
    if (task.state === "inbox") {
      const confirm = el("button", { class: "btn btn-ghost btn-sm", type: "button" }, icon("i-check"), el("span", { text: t("tasks.confirmInbox") }));
      confirm.addEventListener("click", () => patchTask(task, { state: "todo" }, li));
      actions.append(confirm);
    }
    const done = el("button", { class: "btn btn-primary btn-sm", type: "button" }, icon("i-check"), el("span", { text: t("tasks.markDone") }));
    done.addEventListener("click", () => patchTask(task, { state: "done" }, li));
    actions.append(done);
  }
  li.append(actions);
  return li;
}

async function patchTask(task, patch, li) {
  const data = state.tasks.data;
  if (!data) return;
  const controls = $$("button, select", li);
  controls.forEach((c) => { c.disabled = true; });
  try {
    const r = await api(`api/tasks/${encodeURIComponent(task.id)}`, { method: "POST", body: { patch, base_mtime: data.mtime_ms, base_sha: data.sha } });
    toast(t("tasks.saved", { id: task.id }));
    if (r && r.task) {
      const i = data.tasks.findIndex((x) => x.id === task.id);
      if (i !== -1) data.tasks[i] = r.task;
      data.mtime_ms = r.mtime_ms;
      data.sha = r.sha;
      data.needs_ok = data.tasks.filter((x) => x.state === "needs_ok").length;
    }
    updateTasksBadge();
    renderTasks();
  } catch (e) {
    if (e.status === 409) { toast(t("tasks.conflict"), "error"); loadTasks(); }
    else {
      if (e.status !== 401) toast(errorText(e), "error");
      renderTasks();
    }
  }
}

/* ------------------------------------------------------------------ */
/* Aprendizajes (LESSONS.md + learned skills)                          */
/* ------------------------------------------------------------------ */

async function loadLearning() {
  try {
    state.learning.data = await api("api/learning");
  } catch (e) {
    if (e.status !== 401) toast(errorText(e), "error");
  }
  if (state.view === "learning") renderLearning();
}

function renderLearning() {
  const data = state.learning.data;
  // Skills
  const sl = $("#skills-list");
  sl.replaceChildren();
  const skills = data && Array.isArray(data.skills) ? data.skills : [];
  if (!skills.length) sl.append(el("li", { class: "empty-card", text: t("learning.skillsEmpty") }));
  for (const s of skills) sl.append(skillCard(s));

  // Lessons
  const lessons = data && data.lessons;
  const ll = $("#lessons-list");
  ll.replaceChildren();
  const filterRoot = $("#lessons-filter");
  filterRoot.hidden = !(lessons && lessons.exists);
  if (!lessons || !lessons.exists) {
    ll.append(el("li", { class: "empty-card", text: t("learning.noFile") }));
  } else {
    renderSegmented(filterRoot,
      ["active", "review", "retired"].map((k) => ({ key: k, label: t(`learning.f.${k}`), count: (lessons[k] || []).length })),
      state.learning.filter,
      (k) => { state.learning.filter = k; renderLearning(); });
    const items = lessons[state.learning.filter] || [];
    if (!items.length) ll.append(el("li", { class: "empty-card", text: t("learning.lessonsEmpty") }));
    for (const l of items) ll.append(lessonCard(l));
  }
  const errs = lessons && Array.isArray(lessons.errors) ? lessons.errors : [];
  $("#lessons-errors").hidden = !errs.length;
  renderRawErrors($("#lessons-errors-list"), errs);

  // Digest
  const dg = data && data.digest;
  $("#digest").hidden = !dg;
  if (dg) {
    $("#digest-name").textContent = dg.name;
    $("#digest-pre").textContent = dg.content;
  }
}

function skillCard(s) {
  const card = el("li", { class: "card skill-card", "data-reverted": String(!!s.reverted) });
  const tag = s.reverted
    ? el("span", { class: "tag", text: t("learning.reverted") })
    : s.probation
      ? el("span", { class: "tag tag-warn", title: t("learning.probationHint"), text: t("learning.probation") })
      : el("span", { class: "tag tag-ok", text: t("learning.live") });
  card.append(el("div", { class: "card-top" }, el("h3", { class: "card-title mono", text: s.name }), tag));
  if (s.summary) card.append(el("p", { class: "card-desc", text: s.summary }));
  const meta = el("div", { class: "card-meta" });
  if (s.promoted_at) meta.append(el("span", { class: "card-meta-item", title: absTime(s.promoted_at), text: t(s.improved ? "learning.improved" : "learning.created", { when: relTime(s.promoted_at) }) }));
  if (s.reverted && s.reverted_at) meta.append(el("span", { class: "card-meta-item", title: absTime(s.reverted_at), text: t("learning.revertedAt", { when: relTime(s.reverted_at) }) }));
  if (s.commit) meta.append(el("span", { class: "card-meta-item mono", text: s.commit.slice(0, 8) }));
  if (s.probation && !s.reverted) meta.append(el("span", { class: "card-meta-item", text: t("learning.probationHint") }));
  card.append(meta);
  if (!s.reverted) {
    const undo = el("button", { class: "btn btn-ghost btn-sm", type: "button" }, icon("i-undo"), el("span", { text: t("learning.undo") }));
    undo.addEventListener("click", () => revertSkill(s, undo));
    card.append(el("div", { class: "card-actions" }, undo));
  }
  return card;
}

async function revertSkill(s, btn) {
  const ok = await confirmDialog({ title: t("learning.undoTitle", { name: s.name }), body: t("learning.undoBody"), ok: t("learning.undoOk"), cancel: t("jobs.cancel") });
  if (!ok) return;
  btn.disabled = true;
  try {
    await api(`api/learning/skills/${encodeURIComponent(s.name)}/revert`, { method: "POST", body: { confirm: true } });
    toast(t("learning.undoDone", { name: s.name }));
  } catch (e) {
    if (e.status !== 401) toast(errorText(e), "error");
  } finally {
    btn.disabled = false;
    loadLearning();
  }
}

function lessonCard(l) {
  const li = el("li", { class: "lesson", "data-section": l.section });
  const main = el("div", { class: "lesson-main" });
  main.append(el("p", { class: "lesson-rule", text: l.rule }));
  const meta = el("div", { class: "lesson-meta" });
  meta.append(el("span", { class: "mono", text: l.id }));
  if (l.scope) meta.append(el("span", { text: t("learning.scope", { s: l.scope }) }));
  if (l.src) meta.append(el("span", { class: "mono", text: l.src }));
  if (l.date) meta.append(el("span", { text: shortDate(l.date) }));
  if (typeof l.uses === "number") meta.append(el("span", { text: t("learning.uses", { n: l.uses }) }));
  main.append(meta);
  if (l.section === "review") main.append(el("p", { class: "task-hint", text: t("learning.reviewHint") }));
  li.append(main);
  const actions = el("div", { class: "task-actions" });
  if (l.section !== "retired") {
    const b = el("button", { class: "btn btn-ghost btn-sm", type: "button", text: t("learning.retire") });
    b.addEventListener("click", () => moveLesson(l, "retire", li));
    actions.append(b);
  }
  if (l.section !== "active") {
    const b = el("button", { class: "btn btn-primary btn-sm", type: "button", text: t("learning.activate") });
    b.addEventListener("click", () => moveLesson(l, "activate", li));
    actions.append(b);
  }
  li.append(actions);
  return li;
}

async function moveLesson(l, op, li) {
  const lessons = state.learning.data && state.learning.data.lessons;
  if (!lessons) return;
  $$("button", li).forEach((b) => { b.disabled = true; });
  try {
    await api(`api/learning/lessons/${encodeURIComponent(l.id)}/${op}`, { method: "POST", body: { base_mtime: lessons.mtime_ms, base_sha: lessons.sha } });
    toast(t(op === "retire" ? "learning.retired" : "learning.activated", { id: l.id }));
  } catch (e) {
    if (e.status === 409) toast(t("learning.conflict"), "error");
    else if (e.status !== 401) toast(errorText(e), "error");
  }
  loadLearning();
}

/* ------------------------------------------------------------------ */
/* Status + audit log                                                  */
/* ------------------------------------------------------------------ */

function renderStats() {
  const h = state.health || {};
  const healthDd = $("#st-health");
  const s = state.healthOk === null ? "checking" : state.healthOk ? "online" : "offline";
  healthDd.textContent = t(`health.${s}`);
  healthDd.className = s === "online" ? "ok" : s === "offline" ? "bad" : "";
  $("#st-runtime").textContent = h.runtime ? String(h.runtime) : "—";
  $("#st-adapter").textContent = h.adapter ? String(h.adapter) : "—";
  $("#st-version").textContent = h.version ? String(h.version) : "—";
  $("#st-uptime").textContent = typeof h.uptime_s === "number" ? duration(h.uptime_s) : "—";
}

async function loadLog() {
  try {
    const data = await api("api/log?limit=100");
    state.log = Array.isArray(data) ? data : Array.isArray(data?.lines) ? data.lines : Array.isArray(data?.items) ? data.items : [];
  } catch (e) {
    if (e.status !== 401) toast(errorText(e), "error");
    state.log = [];
  }
  renderLog();
}

const pick = (obj, keys) => {
  for (const k of keys) {
    const v = obj?.[k];
    if (v !== undefined && v !== null && v !== "") return typeof v === "object" ? JSON.stringify(v) : String(v);
  }
  return "";
};

function renderLog() {
  const body = $("#log-body");
  body.replaceChildren();
  $("#log-empty").hidden = state.log.length > 0;
  for (const raw of state.log.slice(0, 100)) {
    const e = raw && typeof raw === "object" ? raw : { action: String(raw) };
    const time = pick(e, ["ts", "time", "timestamp", "at", "date"]);
    let action = pick(e, ["action", "event", "type", "op"]);
    if (!action && e.method) action = `${e.method} ${e.path || ""}`.trim();
    const detail = pick(e, ["target", "name", "file", "job", "id", "path", "decision", "message", "detail"]);
    let result = pick(e, ["result", "status", "outcome", "decision"]);
    if (!result && typeof e.ok === "boolean") result = e.ok ? "ok" : "error";
    const resClass = /^(ok|success|succeeded|approved|done|2\d\d)$/i.test(result) ? "res-ok"
      : /(error|fail|denied|reject|forbidden|[45]\d\d)/i.test(result) ? "res-bad" : "";
    const tr = el("tr", {},
      el("td", { title: absTime(time) || null, text: logTime(time) }),
      el("td", { text: action || "—" }),
      el("td", { class: "detail", text: detail || "—" }),
      el("td", { class: resClass, text: result || "—" }));
    body.append(tr);
  }
}

/* ------------------------------------------------------------------ */
/* Wiring                                                              */
/* ------------------------------------------------------------------ */

function bindEvents() {
  $("#login-form").addEventListener("submit", onLogin);
  $("#theme-toggle").addEventListener("click", toggleTheme);
  $("#lang-toggle").addEventListener("click", toggleLang);
  prefersLight.addEventListener?.("change", applyTheme);
  window.addEventListener("hashchange", onRoute);

  // Chat
  const input = $("#chat-input");
  $("#composer").addEventListener("submit", (ev) => {
    ev.preventDefault();
    if (state.chat.streaming) stopStreaming();
    else sendMessage(input.value);
  });
  input.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter" && !ev.shiftKey && !ev.isComposing && ev.keyCode !== 229) {
      ev.preventDefault();
      if (!state.chat.streaming) sendMessage(input.value);
    } else if (ev.key === "Escape" && state.chat.streaming) {
      stopStreaming();
    }
  });
  input.addEventListener("input", () => { autosize(); updateSendButton(); });
  $("#chat-new").addEventListener("click", newConversation);

  // Memory
  const ta = $("#memory-textarea");
  ta.addEventListener("input", () => setMemoryDirty(ta.value !== state.memory.original));
  ta.addEventListener("keydown", (ev) => {
    if ((ev.metaKey || ev.ctrlKey) && ev.key.toLowerCase() === "s") { ev.preventDefault(); saveMemory(); }
  });
  $("#memory-save").addEventListener("click", saveMemory);
  $("#memory-revert").addEventListener("click", () => {
    ta.value = state.memory.original;
    setMemoryDirty(false);
    ta.focus();
  });
  $("#memory-back").addEventListener("click", () => {
    $("#memory-grid").dataset.pane = "list";
    const current = $('.file-btn[aria-current="true"]');
    if (current) current.focus();
  });

  // Pendientes / Aprendizajes
  $("#tasks-refresh").addEventListener("click", () => loadTasks());
  $("#pilot-toggle").addEventListener("click", togglePilot);
  $("#learning-refresh").addEventListener("click", () => loadLearning());

  // Status
  $("#status-refresh").addEventListener("click", () => { refreshHealth(); loadLog(); });

  // Sign out (only shown when the panel has a password).
  $("#logout-btn").addEventListener("click", onLogout);

  // Guard against losing work.
  window.addEventListener("beforeunload", (ev) => {
    if (state.memory.dirty || state.chat.streaming) { ev.preventDefault(); ev.returnValue = ""; }
  });

  // Catch up right away when the tab comes back.
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && state.started) { refreshHealth(); refreshApprovals(); loadTasks({ quiet: true }); }
  });
}

async function boot() {
  bindEvents();
  applyI18n();
  restoreHistory();
  updateSendButton();

  let s = { authenticated: false, auth_required: false };
  try {
    s = (await api("api/session")) || s;
  } catch (e) {
    if (e.status === 401) return; // api() already showed the login screen
    // Server unreachable: still show the app; the status dot will say "offline".
  }
  $("#logout-btn").hidden = !s.auth_required;
  if (s.auth_required && !s.authenticated) showLogin();
  else startApp();
}

boot();
