/*! netzwerk-karte 0.4.0 – Netzwerk-Topologie für Home Assistant (FRITZ!Box Tools, Mesh, eigene Geräte) */
const VERSION = "0.4.0";
const NAMES_KEY = "netzwerk-karte-namen";
const W = 1500;
const H = 880;
const COLORS = {
  wlan: "#2fd4ff",
  lan: "#ffa24a",
  mesh: "#a46bff",
  internet: "#33f0a8",
  offline: "#5b6478",
  bad: "#ff6b81",
};
const LABELS = { wlan: "WLAN", lan: "LAN", mesh: "Mesh", internet: "Internet", offline: "Offline" };
const OFFLINE = ["off", "not_home", "unavailable", "unknown", "disconnected", "false", "none"];
const PRESETS = [[22, 50], [78, 50], [50, 80], [22, 84], [78, 84], [50, 12]];
const ICONS = [
  [/iphone|pixel|galaxy|handy|phone/i, "mdi:cellphone"],
  [/ipad|tablet/i, "mdi:tablet"],
  [/\btv\b|fernseher|fire ?stick|chromecast/i, "mdi:television"],
  [/drucker|printer|laserjet|officejet/i, "mdi:printer"],
  [/\bnas\b|diskstation|qnap|synology/i, "mdi:nas"],
  [/\bcam\b|kamera|reolink|\bnvr\b|\bring\b/i, "mdi:cctv"],
  [/echo|alexa|homepod|sonos|speaker/i, "mdi:speaker-wireless"],
  [/klima|air ?con/i, "mdi:air-conditioner"],
  [/opnsense|pfsense|firewall/i, "mdi:firewall"],
  [/fritz.?box|router|repeater|accesspoint|access point/i, "mdi:router-wireless"],
  [/raspberry|raspi|\bpi\b/i, "mdi:raspberry-pi"],
  [/home ?assistant/i, "mdi:home-assistant"],
  [/\besp|shelly|tasmota|sonoff/i, "mdi:chip"],
  [/\bpc\b|laptop|notebook|desktop|macbook/i, "mdi:laptop"],
  [/waschmaschine|trockner|geschirr/i, "mdi:washing-machine"],
  [/saug|roborock|roomba/i, "mdi:robot-vacuum"],
];

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const list = (v) => (v == null ? [] : Array.isArray(v) ? v : [v]);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const iconFor = (name) => {
  for (const [re, ic] of ICONS) if (re.test(name)) return ic;
  return "mdi:devices";
};
const isOnline = (state) => !OFFLINE.includes(String(state).toLowerCase());
const since = (iso) => {
  const ms = Date.now() - new Date(iso).getTime();
  if (!isFinite(ms) || ms < 0) return "–";
  const h = Math.floor(ms / 3600000);
  const d = Math.floor(h / 24);
  return d > 0 ? `${d} T ${h % 24} Std` : `${h} Std ${Math.floor((ms % 3600000) / 60000)} Min`;
};

const ipToInt = (ip) => {
  const p = String(ip).trim().split(".");
  if (p.length !== 4) return null;
  let n = 0;
  for (const x of p) {
    const v = Number(x);
    if (!(v >= 0 && v <= 255) || x === "") return null;
    n = n * 256 + v;
  }
  return n;
};
const parseCidr = (c) => {
  const [base, bits = "32"] = String(c).trim().split("/");
  const l = Number(bits);
  return ipToInt(base) == null || !(l >= 0 && l <= 32) ? null : [ipToInt(base), l];
};
const inCidr = (ip, [base, l]) => {
  const a = ipToInt(ip);
  if (a == null) return false;
  const size = 2 ** (32 - l);
  return Math.floor(a / size) === Math.floor(base / size);
};
const normMac = (m) => (m ? String(m).toLowerCase().replace(/-/g, ":") : "");

const STYLE = `
  :host { display: block; }
  ha-card {
    position: relative; overflow: hidden; padding: 20px 20px 16px; color: #e8efff;
    border-radius: 18px; border: 1px solid rgba(80, 130, 255, .22);
    background: radial-gradient(1200px 520px at 50% 38%, #12254f 0%, #0a1330 55%, #070c20 100%);
    font-family: "Segoe UI", system-ui, -apple-system, Roboto, sans-serif;
  }
  header { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
  .brand { display: flex; align-items: center; gap: 14px; }
  .logo { width: 46px; height: 46px; border-radius: 12px; display: grid; place-items: center;
    border: 1px solid rgba(47, 212, 255, .55); background: rgba(47, 212, 255, .08); color: ${COLORS.wlan}; }
  h1 { margin: 0; font-size: 26px; font-weight: 700; letter-spacing: .2em;
    background: linear-gradient(90deg, ${COLORS.wlan}, ${COLORS.mesh}); -webkit-background-clip: text; background-clip: text; color: transparent; }
  .sub { font-size: 12px; letter-spacing: .12em; color: #8ea3d4; margin-top: 2px; }
  .chip { display: inline-flex; align-items: center; gap: 8px; padding: 6px 14px; border-radius: 999px; font-size: 12px; font-weight: 600;
    letter-spacing: .08em; border: 1px solid var(--c); color: var(--c); background: rgba(255,255,255,.04); }
  .chip i { width: 8px; height: 8px; border-radius: 50%; background: var(--c); box-shadow: 0 0 8px var(--c); }
  .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(128px, 1fr)); gap: 10px; margin: 16px 0 6px; }
  .tile { padding: 10px 12px; border-radius: 12px; background: rgba(20, 34, 72, .55); border: 1px solid rgba(90, 140, 255, .22); cursor: pointer; }
  .tile .k { display: flex; align-items: center; gap: 6px; font-size: 11px; letter-spacing: .08em; color: #8ea3d4; white-space: nowrap; }
  .tile .k ha-icon { --mdc-icon-size: 15px; color: ${COLORS.wlan}; }
  .tile .v { margin-top: 4px; font-size: 22px; font-weight: 700; }
  .tile .u { font-size: 12px; font-weight: 500; color: #8ea3d4; margin-left: 4px; }
  .legend { display: flex; justify-content: flex-end; gap: 16px; flex-wrap: wrap; font-size: 11px; color: #8ea3d4; margin: 10px 4px 0; }
  .legend span { display: inline-flex; align-items: center; gap: 6px; }
  .legend b { display: inline-block; width: 18px; height: 3px; border-radius: 2px; background: var(--c); }
  .wrap { position: relative; }
  .scroll { overflow-x: auto; cursor: grab; touch-action: pan-y; user-select: none; }
  .scroll.drag { cursor: grabbing; }
  .zoom { position: absolute; right: 8px; bottom: 8px; display: flex; gap: 6px; z-index: 2; }
  .zoom button { width: 30px; height: 30px; border-radius: 8px; border: 1px solid rgba(90,140,255,.35);
    background: rgba(20,34,72,.75); color: #cfe0ff; font-size: 16px; line-height: 1; cursor: pointer; }
  .zoom button:hover { border-color: ${COLORS.wlan}; }
  .menu { position: absolute; z-index: 5; min-width: 220px; padding: 6px; border-radius: 12px; background: #0c1733;
    border: 1px solid rgba(90,140,255,.45); box-shadow: 0 10px 30px rgba(0,0,0,.5); }
  .menu .mh { padding: 6px 10px 8px; font-size: 11px; letter-spacing: .08em; color: #8ea3d4; }
  .menu a, .menu button { display: block; width: 100%; box-sizing: border-box; text-align: left; padding: 8px 10px;
    border-radius: 8px; color: #e8efff; text-decoration: none; font: inherit; font-size: 13px; background: none; border: 0; cursor: pointer; }
  .menu a:hover, .menu button:hover { background: rgba(47,212,255,.12); }
  .menu .mh2 { padding: 0 10px 8px; font-size: 12px; color: #8ea3d4; }
  .menu input { width: 100%; box-sizing: border-box; padding: 8px 10px; border-radius: 8px; font: inherit; font-size: 13px;
    color: #e8efff; background: #070d1f; border: 1px solid rgba(90,140,255,.45); outline: none; }
  .menu input:focus { border-color: ${COLORS.wlan}; }
  .menu .row { display: flex; gap: 6px; margin-top: 8px; }
  .menu .row button { text-align: center; border: 1px solid rgba(90,140,255,.35); }
  .menu.info { min-width: 300px; max-width: 420px; max-height: 85%; overflow: auto; }
  .menu table { width: 100%; border-collapse: collapse; font-size: 12px; margin: 0 0 6px; }
  .menu td { padding: 3px 10px; vertical-align: top; word-break: break-word; }
  .menu td:first-child { color: #8ea3d4; white-space: nowrap; padding-right: 4px; }
  .menu .sep td { padding-top: 10px; font-size: 10px; letter-spacing: .1em; color: #6f84b8; }
  svg { display: block; width: 100%; min-width: 680px; height: auto; }
  .node { cursor: pointer; outline: none; }
  .node circle.ring { filter: drop-shadow(0 0 6px var(--c)); transition: transform .15s; transform-box: fill-box; transform-origin: center; }
  .node:hover circle.ring, .node:focus-visible circle.ring { transform: scale(1.12); }
  .node.off { opacity: .55; }
  .node foreignObject div { display: grid; place-items: center; width: 100%; height: 100%; color: var(--c); }
  .node ha-icon { --mdc-icon-size: 20px; }
  .node.hub ha-icon { --mdc-icon-size: 30px; }
  .pill { fill: rgba(8, 16, 40, .82); stroke: rgba(130, 160, 255, .35); }
  .name { fill: #dfe8ff; font-size: 12px; font-family: inherit; }
  .hubname { fill: #f4f7ff; font-size: 14px; font-weight: 700; letter-spacing: .06em; }
  .count { fill: #8ea3d4; font-size: 11px; }
  .flow { stroke-dasharray: 3 9; animation: flow 1.6s linear infinite; }
  @keyframes flow { to { stroke-dashoffset: -24; } }
  .empty { fill: #8ea3d4; font-size: 15px; }
  @media (prefers-reduced-motion: reduce) { .flow { animation: none; } .node circle.ring { transition: none; } }
`;

class NetzwerkKarte extends HTMLElement {
  constructor() {
    super();
    this._root = this.attachShadow({ mode: "open" });
    this._key = "";
    this._view = { k: 1, x: 0, y: 0 };
    this._drag = null;
    this._suppress = false;
    this._names = {};
    this._pending = false;
    const r = this._root;
    r.addEventListener("click", (e) => this._onClick(e));
    r.addEventListener("keydown", (e) => {
      if (e.target && e.target.tagName === "INPUT") {
        if (e.key === "Enter") this._saveInput(e.target);
        else if (e.key === "Escape") this._closeMenu();
        return;
      }
      if (e.key === "Escape") this._closeMenu();
      else if (e.key === "Enter" || e.key === " ") this._onClick(e);
    });
    r.addEventListener("contextmenu", (e) => {
      const n = e.target.closest ? e.target.closest("[data-dev]") : null;
      if (!n) return;
      e.preventDefault();
      this._openRename(n.dataset.dev);
    });
    r.addEventListener(
      "wheel",
      (e) => {
        if (!this._config || this._config.zoom === "off") return;
        const sc = e.target.closest ? e.target.closest(".scroll") : null;
        if (!sc || (this._config.zoom === "ctrl" && !e.ctrlKey)) return;
        e.preventDefault();
        const rect = sc.querySelector("svg").getBoundingClientRect();
        const dy = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaY;
        this._zoomAt(((e.clientX - rect.left) * W) / rect.width, ((e.clientY - rect.top) * H) / rect.height, Math.exp(-dy * 0.0015));
      },
      { passive: false }
    );
    r.addEventListener("mousedown", (e) => {
      if (e.button === 1 && e.target.closest && e.target.closest(".scroll")) e.preventDefault();
    });
    r.addEventListener("pointerdown", (e) => {
      if (e.pointerType !== "mouse" || (e.button !== 0 && e.button !== 1)) return;
      const t = e.target;
      const sc = t.closest ? t.closest(".scroll") : null;
      if (!sc || t.closest(".zoom") || t.closest(".menu")) return;
      this._drag = { id: e.pointerId, x: e.clientX, y: e.clientY, vx: this._view.x, vy: this._view.y, moved: false, sc };
      if (sc.setPointerCapture) sc.setPointerCapture(e.pointerId);
    });
    r.addEventListener("pointermove", (e) => {
      const d = this._drag;
      if (!d || e.pointerId !== d.id) return;
      const dx = e.clientX - d.x;
      const dy = e.clientY - d.y;
      if (!d.moved && Math.hypot(dx, dy) < 4) return;
      d.moved = true;
      d.sc.classList.add("drag");
      const rect = d.sc.querySelector("svg").getBoundingClientRect();
      this._view.x = d.vx + (dx * W) / rect.width;
      this._view.y = d.vy + (dy * H) / rect.height;
      this._applyView();
    });
    const end = () => {
      const d = this._drag;
      if (!d) return;
      d.sc.classList.remove("drag");
      if (d.moved) {
        this._suppress = true;
        setTimeout(() => (this._suppress = false), 0);
      }
      this._drag = null;
    };
    r.addEventListener("pointerup", end);
    r.addEventListener("pointercancel", end);
    r.addEventListener("dblclick", (e) => {
      const t = e.target;
      if (t.closest && t.closest(".scroll") && !t.closest(".node")) this._zoomBy("reset");
    });
  }

  setConfig(config) {
    if (!config || typeof config !== "object") throw new Error("Ungültige Konfiguration");
    this._config = {
      title: "Netzwerk",
      subtitle: "LAN · WLAN · Mesh",
      auto_discover: true,
      show_offline: false,
      zoom: "wheel",
      device_click: "info",
      include: [],
      exclude: [],
      default_connection: "wlan",
      max_name_length: 20,
      hubs: [],
      devices: [],
      overrides: {},
      stats: [],
      ...config,
      main: { name: "Router", x: 50, y: 34, ...(config.main || {}) },
    };
    this._key = "";
    this._update();
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._namesLoaded) this._loadNames();
    this._update();
  }

  // Eigene Gerätenamen: pro Benutzer in Home Assistant gespeichert (frontend/set_user_data),
  // zusätzlich als Kopie im Browser. Schlüssel ist die MAC-Adresse, sonst die Entity-ID.
  async _loadNames() {
    if (this._namesLoaded || this._namesLoading) return;
    this._namesLoading = true;
    let remote = null;
    let local = null;
    try {
      const r = await this._hass.callWS({ type: "frontend/get_user_data", key: NAMES_KEY });
      remote = r && r.value;
    } catch (err) {
      /* Speicher nicht erreichbar: nur lokale Kopie nutzen */
    }
    try {
      local = JSON.parse(localStorage.getItem(NAMES_KEY) || "null");
    } catch (err) {
      /* ignorieren */
    }
    this._names = { ...(local || {}), ...(remote || {}) };
    this._namesLoaded = true;
    this._namesLoading = false;
    this._key = "";
    this._update();
  }

  async _setName(key, label) {
    const clean = String(label || "").trim().slice(0, 60);
    const next = { ...this._names };
    if (clean) next[key] = clean;
    else delete next[key];
    this._names = next;
    try {
      localStorage.setItem(NAMES_KEY, JSON.stringify(next));
    } catch (err) {
      /* ignorieren */
    }
    this._closeMenu(true);
    this._pending = false;
    this._key = "";
    this._update();
    try {
      // Erst den aktuellen Stand holen, damit Änderungen von anderen Geräten nicht überschrieben werden
      const r = await this._hass.callWS({ type: "frontend/get_user_data", key: NAMES_KEY });
      const cur = (r && r.value) || {};
      const merged = { ...next };
      for (const [k, v] of Object.entries(cur)) if (k !== key && !(k in merged)) merged[k] = v;
      await this._hass.callWS({ type: "frontend/set_user_data", key: NAMES_KEY, value: merged });
      if (JSON.stringify(merged) !== JSON.stringify(this._names)) {
        this._names = merged;
        this._key = "";
        this._update();
      }
    } catch (err) {
      console.warn("netzwerk-karte: Namen konnten nicht in Home Assistant gespeichert werden", err);
    }
  }

  getCardSize() {
    return 9;
  }

  static getStubConfig() {
    return { title: "Netzwerk" };
  }

  _moreInfo(entityId) {
    this.dispatchEvent(new CustomEvent("hass-more-info", { bubbles: true, composed: true, detail: { entityId } }));
  }

  _onClick(e) {
    if (this._suppress) {
      this._suppress = false;
      return;
    }
    const t = e.target && e.target.closest ? e.target : null;
    if (!t) return;
    const z = t.closest("[data-zoom]");
    if (z) return this._zoomBy(z.dataset.zoom);
    const menu = t.closest(".menu");
    if (menu) {
      const b = t.closest("[data-act]");
      if (b) return this._menuAct(b, menu);
      if (t.closest("a")) return this._closeMenu(); // der Link öffnet sich über das Anker-Element selbst
      return;
    }
    const dev = t.closest("[data-dev]");
    if (dev) return this._devClick(dev);
    const hub = t.closest("[data-hub]");
    if (hub) return this._hubClick(hub);
    this._closeMenu();
    const el = t.closest("[data-entity]");
    if (el && el.dataset.entity) this._moreInfo(el.dataset.entity);
  }

  _menuAct(b, menu) {
    const act = b.dataset.act;
    const key = menu.dataset.dev;
    if (act === "save") return this._saveInput(menu.querySelector("input"));
    if (act === "reset") return this._setName(key, "");
    if (act === "rename") return this._openRename(key);
    if (act === "more") {
      this._closeMenu();
      this._moreInfo(b.dataset.entity);
    }
  }

  _saveInput(input) {
    const menu = input && input.closest ? input.closest(".menu") : null;
    if (menu) this._setName(menu.dataset.dev, input.value);
  }

  _devEl(key) {
    return [...this._root.querySelectorAll("[data-dev]")].find((n) => n.dataset.dev === key);
  }

  _showMenu(html, anchor, cls = "", dev = "") {
    this._closeMenu(true);
    const wrap = this._root.querySelector(".wrap");
    if (!wrap || !anchor) return null;
    const menu = document.createElement("div");
    menu.className = `menu ${cls}`.trim();
    if (dev) menu.dataset.dev = dev;
    menu.innerHTML = html;
    wrap.appendChild(menu);
    const nr = anchor.getBoundingClientRect();
    const wr = wrap.getBoundingClientRect();
    const left = Math.max(4, Math.min(nr.right - wr.left + 8, wr.width - menu.offsetWidth - 8));
    const top = Math.max(4, Math.min(nr.top - wr.top, wr.height - menu.offsetHeight - 8));
    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
    return menu;
  }

  _devClick(el) {
    this._closeMenu();
    const d = this._m && this._m.devices.find((x) => x.key === el.dataset.dev);
    if (!d) return;
    if (this._config.device_click === "more-info" && d.entity) return this._moreInfo(d.entity);
    this._openInfo(d, el);
  }

  _openInfo(d, el) {
    const st = d.entity ? this._hass.states[d.entity] : null;
    const a = (st && st.attributes) || {};
    const lang = this._hass.locale?.language || "de";
    const hub = this._m.hubs.find((h) => h.id === d.hub);
    const rows = [
      ["Status", d.online ? "Online" : "Offline"],
      ["IP-Adresse", d.ip || a.ip || a.ip_address || ""],
      ["MAC-Adresse", d.mac || a.mac || a.mac_address || ""],
      ["Hostname", a.host_name || ""],
      ["Verbunden mit", hub ? `${hub.name}${hub.ssid ? ` (${hub.ssid})` : ""}` : ""],
      ["Verbindung", LABELS[d.connection] || d.connection],
      ["Zugangspunkt laut Router", a.connected_to || ""],
      ["Ursprünglicher Name", d.custom ? d.orig : ""],
      ["Quelle", a.source_type || ""],
      ["Entität", d.entity],
      ["Zuletzt geändert", st && st.last_changed ? new Date(st.last_changed).toLocaleString(lang) : ""],
    ].filter((r) => r[1] !== "" && r[1] != null);
    const skip = ["friendly_name", "icon", "entity_picture", "ip", "ip_address", "mac", "mac_address", "host_name", "source_type", "connected_to", "supported_features"];
    const extra = Object.entries(a)
      .filter(([k, v]) => !skip.includes(k) && v !== "" && v != null)
      .map(([k, v]) => [k, typeof v === "object" ? JSON.stringify(v) : String(v)]);
    const table = (r) => `<table>${r.map((x) => `<tr><td>${esc(x[0])}</td><td>${esc(x[1])}</td></tr>`).join("")}</table>`;
    const html = `<div class="mh">${esc(d.name)}</div>${table(rows)}
      ${extra.length ? `<table><tr class="sep"><td colspan="2">WEITERE ATTRIBUTE</td></tr>${extra.map((x) => `<tr><td>${esc(x[0])}</td><td>${esc(x[1])}</td></tr>`).join("")}</table>` : ""}
      <div class="row"><button data-act="rename">Umbenennen</button>${d.entity ? `<button data-act="more" data-entity="${esc(d.entity)}">Entität öffnen</button>` : ""}</div>`;
    this._showMenu(html, el, "info", d.key);
  }

  _openRename(key) {
    const d = this._m && this._m.devices.find((x) => x.key === key);
    const el = this._devEl(key);
    if (!d || !el) return;
    const menu = this._showMenu(
      `<div class="mh">NAME ÄNDERN</div>${d.custom ? `<div class="mh2">Original: ${esc(d.orig)}</div>` : ""}
       <input type="text" maxlength="60" value="${esc(d.name)}" placeholder="${esc(d.orig)}" aria-label="Neuer Name" />
       <div class="row"><button data-act="save">Speichern</button>${d.custom ? `<button data-act="reset">Zurücksetzen</button>` : ""}</div>`,
      el,
      "edit",
      key
    );
    const inp = menu && menu.querySelector("input");
    if (inp) {
      inp.focus();
      inp.select();
    }
  }

  _hubClick(el) {
    this._closeMenu();
    const h = this._m && this._m.hubs.find((x) => x.id === el.dataset.hub);
    if (!h) return;
    const n = h.links.length + (h.entity ? 1 : 0);
    if (!n) return;
    if (n === 1 && h.links.length === 1) {
      window.open(h.links[0].url, "_blank", "noopener,noreferrer");
      return;
    }
    if (n === 1) return this._moreInfo(h.entity);
    const items =
      h.links
        .map((l) => `<a href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">${esc(l.name)}</a>`)
        .join("") + (h.entity ? `<button data-act="more" data-entity="${esc(h.entity)}">Details anzeigen</button>` : "");
    this._showMenu(`<div class="mh">${esc(h.name)}</div>${items}`, el);
  }

  _closeMenu(quiet) {
    const m = this._root.querySelector(".menu");
    if (m) m.remove();
    if (!quiet && this._pending) {
      this._pending = false;
      this._update();
    }
  }

  _applyView() {
    const g = this._root.querySelector("#vp");
    const v = this._view;
    if (g) g.setAttribute("transform", `translate(${v.x.toFixed(1)} ${v.y.toFixed(1)}) scale(${v.k.toFixed(3)})`);
  }

  _zoomAt(ux, uy, f) {
    const v = this._view;
    const k = clamp(v.k * f, 0.4, 6);
    const r = k / v.k;
    v.x = ux - (ux - v.x) * r;
    v.y = uy - (uy - v.y) * r;
    v.k = k;
    this._applyView();
  }

  _zoomBy(a) {
    if (a === "reset") {
      this._view = { k: 1, x: 0, y: 0 };
      this._applyView();
    } else this._zoomAt(W / 2, H / 2, a === "in" ? 1.25 : 0.8);
  }

  _update() {
    if (!this._config || !this._hass) return;
    const model = this._model();
    const key = JSON.stringify(model);
    if (key === this._key) return;
    if (this._root.querySelector(".menu.edit")) {
      this._pending = true; // erst nach dem Schließen des Eingabefelds neu zeichnen
      return;
    }
    this._key = key;
    this._m = model;
    this._draw(model);
  }

  _model() {
    const c = this._config;
    const st = this._hass.states;
    const lang = this._hass.locale?.language || "de";

    const hubLinks = (h, main) => {
      const ok = (l) => l && /^https?:\/\//i.test(String(l.url || ""));
      if (Array.isArray(h.links)) return h.links.filter(ok).map((l) => ({ name: l.name || l.url, url: String(l.url) }));
      const out = [];
      if (h.url) out.push({ name: main ? "Weboberfläche" : "Einstellungen", url: String(h.url) });
      else if (h.ip && !main) out.push({ name: "FRITZ!Box-Einstellungen", url: `http://${h.ip}` });
      if (h.gateway) out.push({ name: "OPNsense", url: `https://${h.gateway}` });
      return out.filter(ok);
    };
    const mkHub = (h, i, main) => {
      const p = PRESETS[i % PRESETS.length];
      const name = h.name || (main ? "Router" : `Hub ${i + 1}`);
      return {
        id: main ? "main" : h.id || slug(name),
        name,
        match: main ? [] : list(h.match ?? name).map((x) => String(x).toLowerCase()),
        parent: main ? null : h.parent || "main",
        link: main ? "lan" : h.link || "lan",
        x: main ? h.x : h.x ?? p[0],
        y: main ? h.y : h.y ?? p[1],
        entity: h.entity || null,
        icon: h.icon || (iconFor(name) !== "mdi:devices" ? iconFor(name) : main ? "mdi:router-wireless" : "mdi:router-wireless"),
        ssid: h.ssid || "",
        ip: h.ip || "",
        mac: normMac(h.mac),
        subnets: list(h.subnet).map(parseCidr).filter(Boolean),
        links: hubLinks(h, main),
        main,
      };
    };
    const hubs = [mkHub(c.main, 0, true), ...c.hubs.map((h, i) => mkHub(h, i, false))];

    // Tracker-Index nach MAC (Status der Router selbst, Duplikate)
    const trackerByMac = {};
    for (const [eid, s] of Object.entries(st)) {
      if (!eid.startsWith("device_tracker.")) continue;
      const mac = normMac(s.attributes?.mac || s.attributes?.mac_address);
      if (mac) trackerByMac[mac] = trackerByMac[mac] || eid;
    }
    hubs.forEach((h) => {
      if (!h.entity && h.mac && trackerByMac[h.mac]) h.entity = trackerByMac[h.mac];
      h.online = h.entity ? isOnline(st[h.entity]?.state) : true;
    });

    const findHub = (key) => {
      if (key == null || key === "") return hubs[0];
      const k = String(key).toLowerCase();
      return (
        hubs.find((h) => h.id === k || h.name.toLowerCase() === k) ||
        hubs.slice(1).find((h) => h.match.some((x) => k.includes(x))) ||
        hubs[0]
      );
    };
    // Reihenfolge: erzwungen > IP-Subnetz (längstes Präfix) > connected_to > Hauptknoten
    const assign = (forced, ip, via) => {
      if (forced != null && forced !== "") return findHub(forced);
      if (ip) {
        let best = null;
        let bl = -1;
        for (const h of hubs) for (const cidr of h.subnets) if (cidr[1] > bl && inCidr(ip, cidr)) { best = h; bl = cidr[1]; }
        if (best) return best;
      }
      return findHub(via);
    };

    const hubIps = new Set(hubs.map((h) => h.ip).filter(Boolean));
    const hubMacs = new Set(hubs.map((h) => h.mac).filter(Boolean));
    const devs = new Map();
    const override = (eid, name, mac) => c.overrides[eid] || c.overrides[name] || (mac && c.overrides[mac]) || {};
    const incl = c.include.map((r) => new RegExp(r, "i"));
    const excl = c.exclude.map((r) => new RegExp(r, "i"));

    if (c.auto_discover) {
      for (const [eid, s] of Object.entries(st)) {
        if (!eid.startsWith("device_tracker.")) continue;
        const a = s.attributes || {};
        const ip = a.ip || a.ip_address || a.ipv4 || "";
        if (!("connected_to" in a) && !ip) continue;
        const mac = normMac(a.mac || a.mac_address);
        if ((ip && hubIps.has(ip)) || (mac && hubMacs.has(mac))) continue;
        const name = a.friendly_name || a.host_name || eid;
        const hay = `${name} ${eid} ${ip} ${mac}`;
        if (incl.length && !incl.some((r) => r.test(hay))) continue;
        const key = mac || eid;
        const custom = this._names[key] || "";
        if (excl.some((r) => r.test(hay)) && !custom) continue;
        const o = override(eid, name, mac);
        if (o.hidden) continue;
        const online = isOnline(s.state);
        if (!online && !c.show_offline) continue;
        const dev = {
          entity: eid, key, orig: name, custom: !!custom, ip, mac, name: custom || o.name || name,
          hub: assign(o.hub, ip, a.connected_to).id,
          connection: o.connection || c.default_connection, online, icon: o.icon || iconFor(name),
        };
        const old = devs.get(key);
        if (!old || (dev.online && !old.online)) devs.set(key, dev);
      }
    }
    c.devices.forEach((d) => {
      const s = d.entity ? st[d.entity] : null;
      const name = d.name || s?.attributes?.friendly_name || d.entity || "Gerät";
      const ip = d.ip || s?.attributes?.ip || "";
      if (d.entity) for (const [k, v] of devs) if (v.entity === d.entity) devs.delete(k);
      const key = d.entity || `manual:${name}`;
      const custom = this._names[key] || "";
      devs.set(key, {
        entity: d.entity || "", key, orig: name, custom: !!custom, ip, mac: normMac(s?.attributes?.mac), name: custom || name,
        hub: assign(d.hub, ip, null).id, connection: d.connection || c.default_connection,
        online: d.entity ? isOnline(s?.state) : true, icon: d.icon || iconFor(name),
      });
    });
    const devices = [...devs.values()].sort((a, b) => a.hub.localeCompare(b.hub) || a.name.localeCompare(b.name));

    const stats = c.stats.map((t) => {
      const s = st[t.entity];
      const v = s?.state;
      let value = "–";
      let unit = t.unit ?? s?.attributes?.unit_of_measurement ?? "";
      if (s && !["unknown", "unavailable"].includes(v)) {
        if (s.attributes?.device_class === "timestamp" || /^\d{4}-\d\d-\d\dT/.test(v)) {
          value = since(v);
          unit = "";
        } else if (!isNaN(parseFloat(v)) && t.format !== "text") {
          const n = parseFloat(v) * (t.multiply ?? 1);
          value = n.toLocaleString(lang, { maximumFractionDigits: t.decimals ?? (Math.abs(n) >= 100 ? 0 : 1) });
        } else value = v;
      }
      return {
        entity: t.entity, name: t.name || s?.attributes?.friendly_name || t.entity, value, unit,
        icon: t.icon || s?.attributes?.icon || "mdi:information-outline",
      };
    });

    const internet = { online: c.internet_entity ? isOnline(st[c.internet_entity]?.state) : true, entity: c.internet_entity || "" };
    return { hubs, devices, stats, internet };
  }

  _layout(m) {
    const byHub = {};
    m.devices.forEach((d) => (byHub[d.hub] = byHub[d.hub] || []).push(d));
    const hubById = Object.fromEntries(m.hubs.map((h) => [h.id, h]));
    m.hubs.forEach((h) => {
      h.px = clamp((h.x / 100) * W, 80, W - 80);
      h.py = clamp((h.y / 100) * H, 80, H - 80);
    });
    const dir = (a, b) => Math.atan2(b.py - a.py, b.px - a.px);
    const near = (a, b, t) => {
      let d = Math.abs(a - b) % (2 * Math.PI);
      if (d > Math.PI) d = 2 * Math.PI - d;
      return d < t;
    };
    m.hubs.forEach((h) => {
      const ds = byHub[h.id] || [];
      const n = ds.length;
      h.count = n;
      // Richtungen zu Nachbarn freihalten, damit sich Beschriftungen nicht überlagern
      const forb = [];
      if (!h.main) forb.push([dir(h, hubById[h.parent] || m.hubs[0]), 0.9]);
      m.hubs.forEach((o) => {
        if (o !== h && !o.main && (hubById[o.parent] || m.hubs[0]) === h) forb.push([dir(h, o), 0.5]);
      });
      if (h.main) forb.push([dir(h, { px: 120, py: 100 }), 0.5]);
      let slots = [];
      for (let total = Math.max(n, 1); total <= n + 48; total++) {
        slots = [];
        for (let j = 0; j < total; j++) {
          const a = -Math.PI / 2 + (2 * Math.PI * j) / total;
          if (!forb.some(([f, t]) => near(a, f, t))) slots.push(a);
        }
        if (slots.length >= n) break;
      }
      const r = clamp(110 + n * 9, 120, 250);
      ds.forEach((d, i) => {
        const a = slots[Math.min(slots.length - 1, Math.floor((i * slots.length) / Math.max(n, 1)))];
        const rr = n > 10 && i % 2 ? r + 45 : r;
        d.px = clamp(h.px + Math.cos(a) * rr, 50, W - 50);
        d.py = clamp(h.py + Math.sin(a) * rr * 0.82, 44, H - 44);
        d.a = a;
        d.hubRef = h;
      });
    });
  }

  _pill(text, x, y, anchor) {
    const max = this._config.max_name_length;
    const t = text.length > max ? `${text.slice(0, max - 1)}…` : text;
    const w = Math.round(t.length * 6.3 + 16);
    const ax = anchor === "start" ? 0 : anchor === "end" ? -w : -w / 2;
    return `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)})">
      <rect class="pill" x="${ax}" y="-10" width="${w}" height="20" rx="6" fill="rgba(8,16,40,.82)" stroke="rgba(130,160,255,.35)"/>
      <text class="name" x="${ax + w / 2}" y="4" text-anchor="middle" fill="#dfe8ff" font-size="12">${esc(t)}</text></g>`;
  }

  _draw(m) {
    this._layout(m);
    const main = m.hubs[0];
    const hubById = Object.fromEntries(m.hubs.map((h) => [h.id, h]));
    let links = "";
    let nodes = "";
    let labels = "";

    const line = (x1, y1, x2, y2, color, online, width) =>
      `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"
        stroke="${online ? color : COLORS.offline}" stroke-width="${online ? width : 1.2}" stroke-linecap="round"
        ${online ? `class="flow" opacity=".85"` : `stroke-dasharray="2 6" opacity=".5"`}/>`;

    const node = (x, y, icon, color, online, entity, r, extra = "", hubId = "", devKey = "") => `
      <g class="node ${online ? "" : "off"} ${extra}" style="--c:${color}" transform="translate(${x.toFixed(1)} ${y.toFixed(1)})"
         ${hubId ? `data-hub="${esc(hubId)}" tabindex="0" role="button"` : devKey ? `data-dev="${esc(devKey)}" ${entity ? `data-entity="${esc(entity)}"` : ""} tabindex="0" role="button"` : entity ? `data-entity="${esc(entity)}" tabindex="0" role="button"` : ""}>
        <circle class="ring" r="${r}" fill="#0c1530" stroke="${color}" stroke-width="2"/>
        <foreignObject x="${-r}" y="${-r}" width="${r * 2}" height="${r * 2}"><div xmlns="http://www.w3.org/1999/xhtml"><ha-icon icon="${esc(icon)}"></ha-icon></div></foreignObject>
      </g>`;

    // Internet
    const ix = 120;
    const iy = 100;
    links += line(ix, iy, main.px, main.py, COLORS.internet, m.internet.online, 2);
    nodes += node(ix, iy, "mdi:earth", m.internet.online ? COLORS.internet : COLORS.bad, true, m.internet.entity, 26);
    labels += `<text class="hubname" x="${ix + 38}" y="${iy + 5}" fill="#f4f7ff" font-size="14" font-weight="700">${m.internet.online ? "Internet online" : "Internet offline"}</text>`;

    // Verbindungen Hub -> Parent
    m.hubs.slice(1).forEach((h) => {
      const p = hubById[h.parent] || main;
      links += line(p.px, p.py, h.px, h.py, COLORS[h.link] || COLORS.mesh, h.online, 3);
    });
    // Geräte
    m.devices.forEach((d) => {
      links += line(d.hubRef.px, d.hubRef.py, d.px, d.py, COLORS[d.connection] || COLORS.wlan, d.online, 1.6);
    });

    m.hubs.forEach((h) => {
      nodes += node(h.px, h.py, h.icon, h.main ? COLORS.wlan : COLORS[h.link] || COLORS.mesh, h.online, h.entity, h.main ? 32 : 26, "hub", h.links.length || h.entity ? h.id : "");
      labels += `<text class="hubname" x="${h.px}" y="${h.py + (h.main ? 56 : 50)}" text-anchor="middle" fill="#f4f7ff" font-size="14" font-weight="700">${esc(h.name)}</text>
        <text class="count" x="${h.px}" y="${h.py + (h.main ? 72 : 66)}" text-anchor="middle" fill="#8ea3d4" font-size="11">${esc(h.ssid ? `${h.ssid} · ` : "")}${h.count} Geräte</text>`;
    });
    m.devices.forEach((d) => {
      const color = d.online ? COLORS[d.connection] || COLORS.wlan : COLORS.offline;
      nodes += node(d.px, d.py, d.icon, color, d.online, d.entity, 17, "", "", d.key);
      const c = Math.cos(d.a);
      const s = Math.sin(d.a);
      const w = Math.min(d.name.length, this._config.max_name_length) * 6.3 + 16;
      let side = c > 0.35 ? "start" : c < -0.35 ? "end" : "middle";
      if (side === "start" && d.px + 24 + w > W - 6) side = "end";
      else if (side === "end" && d.px - 24 - w < 6) side = "start";
      if (side === "middle") labels += this._pill(d.name, d.px, d.py + (s > 0 ? 36 : -30), "middle");
      else labels += this._pill(d.name, d.px + (side === "start" ? 24 : -24), d.py + 2, side);
    });

    const empty = m.devices.length
      ? ""
      : `<text class="empty" x="${W / 2}" y="${H - 70}" text-anchor="middle" fill="#8ea3d4" font-size="15">Keine Geräte gefunden. Prüfe die FRITZ!Box-Tools-Integration oder trage Geräte unter „devices“ ein.</text>`;

    const c = this._config;
    const chip = m.internet.online ? COLORS.internet : COLORS.bad;
    const tiles = m.stats
      .map(
        (t) => `<div class="tile" ${t.entity ? `data-entity="${esc(t.entity)}"` : ""}>
          <div class="k"><ha-icon icon="${esc(t.icon)}"></ha-icon>${esc(t.name)}</div>
          <div class="v">${esc(t.value)}<span class="u">${esc(t.unit)}</span></div></div>`
      )
      .join("");
    const legend = ["wlan", "lan", "mesh", "internet", "offline"]
      .map((k) => `<span style="--c:${COLORS[k]}"><b></b>${LABELS[k]}</span>`)
      .join("");

    this._root.innerHTML = `<style>${STYLE}</style>
      <ha-card>
        <header>
          <div class="brand"><div class="logo"><ha-icon icon="mdi:lan"></ha-icon></div>
            <div><h1>${esc(c.title)}</h1><div class="sub">${esc(c.subtitle)}</div></div></div>
          <span class="chip" style="--c:${chip}"><i></i>${m.internet.online ? "Internet online" : "Internet offline"}</span>
        </header>
        ${tiles ? `<div class="stats">${tiles}</div>` : ""}
        <div class="legend">${legend}</div>
        <div class="wrap"><div class="scroll"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Netzwerk-Topologie">
          <g id="vp">${links}${nodes}${labels}${empty}</g></svg></div>
          ${c.zoom === "off" ? "" : `<div class="zoom"><button data-zoom="in" title="Vergrößern">+</button><button data-zoom="out" title="Verkleinern">−</button><button data-zoom="reset" title="Zurücksetzen">⟲</button></div>`}</div>
      </ha-card>`;
    this._applyView();
  }
}

if (!customElements.get("netzwerk-karte")) customElements.define("netzwerk-karte", NetzwerkKarte);
window.customCards = window.customCards || [];
window.customCards.push({
  type: "netzwerk-karte",
  name: "Netzwerk-Karte",
  description: "Topologie von FRITZ!Box, Mesh-Repeatern und Geräten mit animierten Verbindungen",
});
console.info(`%c NETZWERK-KARTE %c v${VERSION} `, "background:#2fd4ff;color:#070c20;font-weight:700", "background:#12254f;color:#e8efff");
