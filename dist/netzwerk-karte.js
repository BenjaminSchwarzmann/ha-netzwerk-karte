/*! netzwerk-karte 0.3.3 – Netzwerk-Topologie für Home Assistant (FRITZ!Box Tools, Mesh, eigene Geräte) */
const VERSION = "0.3.3";
const NAMES_KEY = "netzwerk-karte-namen";
const POS_KEY = "netzwerk-karte-positionen";
const OPT_KEY = "netzwerk-karte-optionen";
const W = 1500;
const H = 880;
const COLORS = {
  wlan: "#2fd4ff",
  lan: "#ffa24a",
  mesh: "#a46bff",
  internet: "#33f0a8",
  offline: "#5b6478",
  dhcp: "#ff9f43",
  bad: "#ff6b81",
};
const LABELS = { wlan: "WLAN", lan: "LAN", mesh: "Mesh", internet: "Internet", offline: "Offline", dhcp: "Nur DHCP-Lease" };
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
const leaseFields = (r) => {
  const st = r.state;
  return {
    ip: String(r.address || r.ip || r["ip-address"] || ""),
    mac: normMac(r.hwaddr || r.mac || r["hw-address"] || ""),
    host: String(r.hostname || "").replace(/\.$/, ""),
    iface: r.if_descr || r.if_name || r.interface || "",
    active: st == null || st === 0 || st === "0" || /^(default|assigned)$/i.test(String(st)),
  };
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
  .node.lease circle.ring { stroke-dasharray: 5 3; }
  .node.hid { opacity: .4; }
  .legend .ver { margin-right: auto; opacity: .55; }
  .legend [data-toggle] { cursor: pointer; padding: 2px 10px; border: 1px solid rgba(90,140,255,.3); border-radius: 999px; }
  .legend [data-toggle]:hover { border-color: var(--c); }
  .legend [data-toggle].inactive { opacity: .55; text-decoration: line-through; }
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
    this._pos = {};
    this._opts = {};
    this._showHidden = false;
    this._vb = { x: 0, y: 0, w: W, h: H };
    this._inet = { px: 750, py: 70 };
    this._cur = {};
    this._els = {};
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
        const vb = this._vb;
        const dy = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaY;
        this._zoomAt(vb.x + ((e.clientX - rect.left) * vb.w) / rect.width, vb.y + ((e.clientY - rect.top) * vb.h) / rect.height, Math.exp(-dy * 0.0015));
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
      const ne = e.button === 0 && this._config && this._config.drag_nodes !== false && t.closest ? t.closest("[data-node]") : null;
      const nid = ne ? ne.dataset.node : "";
      // Wichtig: Der Zeiger wird erst beim tatsächlichen Ziehen "gefangen", nicht schon beim Drücken.
      // Sonst landet der folgende Klick auf dem Container statt auf dem Knoten.
      if (nid && this._cur[nid]) {
        const kids = nid.startsWith("h:")
          ? ((this._m && this._m.devices) || []).filter((d) => d.hub === nid.slice(2)).map((d) => `d:${d.key}`).filter((k) => this._cur[k])
          : [];
        this._drag = {
          kind: "node", id: e.pointerId, x: e.clientX, y: e.clientY, moved: false, sc, nid,
          ox: this._cur[nid].x, oy: this._cur[nid].y, last: null,
          kids: kids.map((k) => ({ nid: k, x: this._cur[k].x, y: this._cur[k].y })),
        };
      } else {
        this._drag = { kind: "pan", id: e.pointerId, x: e.clientX, y: e.clientY, vx: this._view.x, vy: this._view.y, moved: false, sc };
      }
    });
    r.addEventListener("pointermove", (e) => {
      const d = this._drag;
      if (!d || e.pointerId !== d.id) return;
      if (e.buttons === 0) return this._endDrag(); // Taste wurde außerhalb losgelassen
      const dx = e.clientX - d.x;
      const dy = e.clientY - d.y;
      if (!d.moved) {
        if (Math.hypot(dx, dy) < 4) return;
        d.moved = true;
        d.sc.classList.add("drag");
        try {
          d.sc.setPointerCapture(d.id);
        } catch (err) {
          /* ignorieren */
        }
      }
      const rect = d.sc.querySelector("svg").getBoundingClientRect();
      const vb = this._vb;
      if (d.kind === "node") {
        const k = this._view.k;
        const nx = clamp(d.ox + (dx * vb.w) / rect.width / k, -6000, 8000);
        const ny = clamp(d.oy + (dy * vb.h) / rect.height / k, -6000, 8000);
        this._moveTo(d.nid, nx, ny);
        d.kids.forEach((kd) => this._moveTo(kd.nid, kd.x + (nx - d.ox), kd.y + (ny - d.oy)));
        d.last = { x: nx, y: ny };
        return;
      }
      this._view.x = d.vx + (dx * vb.w) / rect.width;
      this._view.y = d.vy + (dy * vb.h) / rect.height;
      this._applyView();
    });
    r.addEventListener("pointerup", () => this._endDrag());
    r.addEventListener("pointercancel", () => this._endDrag());
    r.addEventListener("dblclick", (e) => {
      const t = e.target;
      if (!t.closest || !t.closest(".scroll")) return;
      const ne = t.closest("[data-node]");
      if (ne) this._persist(POS_KEY, "_pos", ne.dataset.node, null); // Position dieses Knotens zurücksetzen
      else if (!t.closest(".node")) this._zoomBy("reset");
    });
  }

  _endDrag() {
    const d = this._drag;
    if (!d) return;
    d.sc.classList.remove("drag");
    this._drag = null;
    if (d.moved) {
      this._suppress = true;
      setTimeout(() => (this._suppress = false), 0);
      if (d.kind === "node" && d.last) this._commitMove(d);
    }
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
      show_ip: true,
      drag_nodes: true,
      label_mode: "auto",
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
    if (!this._namesLoaded) this._loadStores();
    this._update();
  }

  // Eigene Gerätenamen und Knotenpositionen: pro Benutzer in Home Assistant gespeichert
  // (frontend/set_user_data), zusätzlich als Kopie im Browser.
  async _loadStores() {
    if (this._namesLoaded || this._namesLoading) return;
    this._namesLoading = true;
    const load = async (key) => {
      let remote = null;
      let local = null;
      try {
        const r = await this._hass.callWS({ type: "frontend/get_user_data", key });
        remote = r && r.value;
      } catch (err) {
        /* Speicher nicht erreichbar: nur lokale Kopie nutzen */
      }
      try {
        local = JSON.parse(localStorage.getItem(key) || "null");
      } catch (err) {
        /* ignorieren */
      }
      return { ...(local || {}), ...(remote || {}) };
    };
    this._names = await load(NAMES_KEY);
    this._pos = await load(POS_KEY);
    this._opts = await load(OPT_KEY);
    this._namesLoaded = true;
    this._namesLoading = false;
    this._key = "";
    this._update();
  }

  // Einen Eintrag setzen (value null oder "" löscht ihn), sofort neu zeichnen und danach speichern
  async _persist(storeKey, prop, key, value) {
    const next = { ...this[prop] };
    if (value == null || value === "") delete next[key];
    else next[key] = value;
    this[prop] = next;
    try {
      localStorage.setItem(storeKey, JSON.stringify(next));
    } catch (err) {
      /* ignorieren */
    }
    this._key = "";
    this._update();
    try {
      // Erst den aktuellen Stand holen, damit Änderungen von anderen Geräten nicht überschrieben werden
      const r = await this._hass.callWS({ type: "frontend/get_user_data", key: storeKey });
      const cur = (r && r.value) || {};
      const merged = { ...next };
      for (const [k, v] of Object.entries(cur)) if (k !== key && !(k in merged)) merged[k] = v;
      await this._hass.callWS({ type: "frontend/set_user_data", key: storeKey, value: merged });
      if (JSON.stringify(merged) !== JSON.stringify(this[prop])) {
        this[prop] = merged;
        this._key = "";
        this._update();
      }
    } catch (err) {
      console.warn("netzwerk-karte: Daten konnten nicht in Home Assistant gespeichert werden", err);
    }
  }

  async _setName(key, label) {
    const clean = String(label || "").trim().slice(0, 60);
    this._closeMenu(true);
    this._pending = false;
    await this._persist(NAMES_KEY, "_names", key, clean);
  }

  _commitMove(d) {
    const round = (v) => Math.round(v * 10) / 10;
    if (d.nid.startsWith("h:")) {
      this._persist(POS_KEY, "_pos", d.nid, { x: round(d.last.x), y: round(d.last.y) });
      return;
    }
    const dev = ((this._m && this._m.devices) || []).find((x) => `d:${x.key}` === d.nid);
    const hub = dev && this._cur[`h:${dev.hub}`];
    if (!hub) return;
    this._persist(POS_KEY, "_pos", d.nid, { hub: dev.hub, dx: round(d.last.x - hub.x), dy: round(d.last.y - hub.y) });
  }

  async _resetLayout() {
    if (!Object.keys(this._pos).length) return;
    if (!window.confirm("Alle gespeicherten Positionen zurücksetzen?")) return;
    this._pos = {};
    try {
      localStorage.removeItem(POS_KEY);
    } catch (err) {
      /* ignorieren */
    }
    this._key = "";
    this._update();
    try {
      await this._hass.callWS({ type: "frontend/set_user_data", key: POS_KEY, value: {} });
    } catch (err) {
      /* ignorieren */
    }
  }

  // Knoten live verschieben: Position, Beschriftung und Linien direkt im DOM anpassen
  _moveTo(id, x, y) {
    this._cur[id] = { x, y };
    const e = this._els[id];
    if (!e) return;
    const f = (v) => v.toFixed(1);
    if (e.node) e.node.setAttribute("transform", `translate(${f(x)} ${f(y)})`);
    e.labs.forEach((l) =>
      l.setAttribute("transform", `translate(${f(x + Number(l.dataset.dx))} ${f(y + Number(l.dataset.dy))})${l.dataset.rot ? ` rotate(${l.dataset.rot})` : ""}`)
    );
    e.a.forEach((l) => {
      l.setAttribute("x1", f(x));
      l.setAttribute("y1", f(y));
    });
    e.b.forEach((l) => {
      l.setAttribute("x2", f(x));
      l.setAttribute("y2", f(y));
    });
  }

  _indexEls() {
    const els = {};
    const get = (id) => (els[id] = els[id] || { node: null, labs: [], a: [], b: [] });
    this._root.querySelectorAll("[data-node]").forEach((n) => (get(n.dataset.node).node = n));
    this._root.querySelectorAll("[data-lab]").forEach((n) => get(n.dataset.lab).labs.push(n));
    this._root.querySelectorAll("line[data-a]").forEach((l) => {
      get(l.dataset.a).a.push(l);
      get(l.dataset.b).b.push(l);
    });
    this._els = els;
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
    const tg = t.closest("[data-toggle]");
    if (tg) return this._toggle(tg.dataset.toggle);
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
    if (act === "hide" || act === "unhide") {
      this._closeMenu(true);
      return this._persist(OPT_KEY, "_opts", `hide:${key}`, act === "hide" ? "1" : null);
    }
    if (act === "more") {
      this._closeMenu();
      this._moreInfo(b.dataset.entity);
    }
  }

  _toggle(name) {
    if (name === "hidden") {
      this._showHidden = !this._showHidden;
      this._key = "";
      this._update();
    } else if (name === "leases") {
      const visible = this._m ? this._m.leasesVisible : true;
      this._persist(OPT_KEY, "_opts", "leases", visible ? "hide" : "show");
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
      ["Quelle", a.source_type || (d.lease ? "OPNsense DHCP-Lease" : "")],
      ["Entität", d.entity],
      ["Zuletzt geändert", st && st.last_changed ? new Date(st.last_changed).toLocaleString(lang) : ""],
    ].filter((r) => r[1] !== "" && r[1] != null);
    const skip = ["friendly_name", "icon", "entity_picture", "ip", "ip_address", "mac", "mac_address", "host_name", "source_type", "connected_to", "supported_features"];
    const extra = Object.entries(a)
      .filter(([k, v]) => !skip.includes(k) && v !== "" && v != null)
      .map(([k, v]) => [k, typeof v === "object" ? JSON.stringify(v) : String(v)]);
    const lr = this._config.leases && this._config.leases.entity
      ? this._leaseRows().find((r) => {
          const f = leaseFields(r);
          return (d.mac && f.mac === d.mac) || (d.ip && f.ip === d.ip);
        })
      : null;
    const fmt = (k, v) => {
      if (Array.isArray(v)) return v.join(", ");
      if (typeof v === "object") return JSON.stringify(v);
      if (/expir|cltt|^expire$/i.test(k) && Number(v) > 1e9) return new Date(Number(v) * 1000).toLocaleString(lang);
      return String(v);
    };
    const leaseRows = lr
      ? [
          ["Lease-Typ", Array.isArray(lr.is_reserved) && lr.is_reserved.length ? "Statisch (Reservierung)" : "Dynamisch"],
          ...Object.entries(lr)
            .filter(([k, v]) => k !== "is_reserved" && v !== "" && v != null && !(Array.isArray(v) && !v.length))
            .map(([k, v]) => [k, fmt(k, v)]),
        ]
      : [];
    const table = (r) => `<table>${r.map((x) => `<tr><td>${esc(x[0])}</td><td>${esc(x[1])}</td></tr>`).join("")}</table>`;
    const html = `<div class="mh">${esc(d.name)}</div>${table(rows)}
      ${extra.length ? `<table><tr class="sep"><td colspan="2">WEITERE ATTRIBUTE</td></tr>${extra.map((x) => `<tr><td>${esc(x[0])}</td><td>${esc(x[1])}</td></tr>`).join("")}</table>` : ""}
      ${leaseRows.length ? `<table><tr class="sep"><td colspan="2">DHCP-LEASE (OPNSENSE)</td></tr>${leaseRows.map((x) => `<tr><td>${esc(x[0])}</td><td>${esc(x[1])}</td></tr>`).join("")}</table>` : ""}
      <div class="row"><button data-act="rename">Umbenennen</button><button data-act="${d.hidden ? "unhide" : "hide"}">${d.hidden ? "Einblenden" : "Ausblenden"}</button>${d.entity ? `<button data-act="more" data-entity="${esc(d.entity)}">Entität öffnen</button>` : ""}</div>`;
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
    if (a === "layout") this._resetLayout();
    else if (a === "reset") {
      this._view = { k: 1, x: 0, y: 0 };
      this._applyView();
    } else this._zoomAt(this._vb.x + this._vb.w / 2, this._vb.y + this._vb.h / 2, a === "in" ? 1.25 : 0.8);
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

  _leaseRows() {
    const lc = this._config.leases;
    const a = lc && lc.entity ? this._hass.states[lc.entity]?.attributes?.[lc.attribute || "rows"] : null;
    return Array.isArray(a) ? a : [];
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
        fixed: main ? true : h.x != null && h.y != null,
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
    // DHCP-Leases aus OPNsense (Kea): Clients ohne passenden Tracker zusätzlich anzeigen
    const lc = c.leases && c.leases.entity ? c.leases : null;
    const lopt = this._opts.leases;
    const leasesVisible = lopt === "hide" ? false : lopt === "show" ? true : !(lc && lc.show === false);
    let leaseCount = 0;
    if (lc) {
      const lincl = list(lc.include).map((r) => new RegExp(r, "i"));
      const lexcl = list(lc.exclude).map((r) => new RegExp(r, "i"));
      const known = new Set();
      for (const d of devs.values()) {
        if (d.mac) known.add(d.mac);
        if (d.ip) known.add(d.ip);
      }
      const seen = new Set();
      for (const r of this._leaseRows()) {
        const f = leaseFields(r);
        if (!f.active || (!f.ip && !f.mac)) continue;
        if ((f.ip && hubIps.has(f.ip)) || (f.mac && hubMacs.has(f.mac))) continue;
        if ((f.mac && known.has(f.mac)) || (f.ip && known.has(f.ip))) continue;
        const key = f.mac || `lease:${f.ip}`;
        const custom = this._names[key] || "";
        const hay = `${f.host} ${f.ip} ${f.mac}`;
        if (lincl.length && !lincl.some((x) => x.test(hay))) continue;
        if (lexcl.some((x) => x.test(hay)) && !custom) continue;
        if (seen.has(key)) continue;
        seen.add(key);
        leaseCount++;
        if (!leasesVisible) continue;
        devs.set(key, {
          entity: "", key, orig: f.host || f.mac || f.ip, custom: !!custom, ip: f.ip, mac: f.mac,
          name: custom || f.host || f.mac || f.ip, hub: assign(null, f.ip, f.iface).id,
          connection: "dhcp", online: true, icon: iconFor(f.host), lease: true,
        });
      }
    }
    // Einzeln ausgeblendete Geräte (Infofenster → Ausblenden)
    let hiddenCount = 0;
    for (const [k, dv] of [...devs]) {
      if (this._opts[`hide:${dv.key}`] !== "1") continue;
      hiddenCount++;
      if (this._showHidden) dv.hidden = true;
      else devs.delete(k);
    }
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
    return { hubs, devices, stats, internet, leaseCount, leasesVisible, hiddenCount, showHidden: !!this._showHidden };
  }

  _layout(m) {
    const cfg = this._config;
    const showIp = cfg.show_ip !== false;
    const maxN = cfg.max_name_length;
    const TWO_PI = Math.PI * 2;
    const byHub = {};
    m.devices.forEach((d) => (byHub[d.hub] = byHub[d.hub] || []).push(d));
    const hubById = Object.fromEntries(m.hubs.map((h) => [h.id, h]));
    const MAIN = m.hubs[0];
    const labelSize = (d) => {
      const ip = showIp ? d.ip || "" : "";
      const tl = Math.min(d.name.length, maxN);
      return { ip, w: Math.round(Math.max(tl * 6.3, ip.length * 5.6) + 16), h: ip ? 32 : 20 };
    };

    // 1. Ringgröße je Router. Viele Geräte: Beschriftungen werden radial (längs der Verbindungslinie) gedreht,
    //    dann genügt ein Ring mit Abstand von etwa einer Beschriftungshöhe zwischen den Knoten.
    m.hubs.forEach((h) => {
      const n = (byHub[h.id] || []).length;
      h.radial = cfg.label_mode === "radial" || (cfg.label_mode !== "horizontal" && n > 10);
      const r = n ? clamp((n * (h.radial ? 44 : 58)) / TWO_PI, h.radial ? 120 : 110, 520) : 0;
      h.count = n;
      h.ring = { n, r, outer: r };
      h.squash = h.radial ? 0.92 : 0.85;
    });

    // 2. Positionen der Router: gespeichert > fest konfiguriert > automatisch
    m.hubs.forEach((h) => {
      const sp = this._pos["h:" + h.id];
      h.pin = true;
      if (sp && isFinite(sp.x) && isFinite(sp.y)) {
        h.px = sp.x;
        h.py = sp.y;
      } else if (h.fixed) {
        h.px = (h.x / 100) * W;
        h.py = (h.y / 100) * H;
      } else h.pin = false;
    });
    const INET = { px: MAIN.px, py: MAIN.py - 230 };
    this._inet = INET;
    const pseudo = { px: INET.px, py: INET.py, pin: true, ring: { n: 0, r: 0 }, radial: false, fixedReach: 150 };
    const reach = (h) => h.fixedReach ?? (h.ring.n ? h.ring.r + (h.radial ? 24 + 150 : 60) : 60);
    const ANG = [190, -10, 90, 150, 30, -90, 125, 55];
    let k = 0;
    m.hubs.forEach((h) => {
      if (h.pin) return;
      const a = ((ANG[k % ANG.length] + Math.floor(k / ANG.length) * 22) * Math.PI) / 180;
      const dist = Math.max(320, reach(MAIN) * 0.6 + reach(h) * 0.75 + 150);
      h.px = MAIN.px + Math.cos(a) * dist;
      h.py = MAIN.py + Math.sin(a) * dist * 0.8;
      k++;
    });
    // Überlappende Cluster auseinanderschieben (nur automatisch platzierte Router)
    const relax = [...m.hubs, pseudo];
    for (let it = 0; it < 150; it++) {
      let moved = false;
      for (let i = 0; i < relax.length; i++) {
        for (let j = i + 1; j < relax.length; j++) {
          const a = relax[i];
          const b = relax[j];
          if (a.pin && b.pin) continue;
          const dx = b.px - a.px;
          const dy = (b.py - a.py) / 0.85;
          const dist = Math.hypot(dx, dy) || 0.01;
          const need = reach(a) + reach(b) - 30;
          if (dist >= need) continue;
          const push = need - dist;
          const ux = dx / dist;
          const uy = (dy / dist) * 0.85;
          const fa = a.pin ? 0 : b.pin ? 1 : 0.5;
          const fb = b.pin ? 0 : a.pin ? 1 : 0.5;
          a.px -= ux * push * fa;
          a.py -= uy * push * fa;
          b.px += ux * push * fb;
          b.py += uy * push * fb;
          moved = true;
        }
      }
      if (!moved) break;
    }

    // 3. Geräte auf einem Ring um ihren Router
    const dir = (a, b) => Math.atan2(b.py - a.py, b.px - a.px);
    const near = (a, b, t) => {
      let d = Math.abs(a - b) % TWO_PI;
      if (d > Math.PI) d = TWO_PI - d;
      return d < t;
    };
    m.hubs.forEach((h) => {
      const ds = byHub[h.id] || [];
      const n = ds.length;
      const forb = []; // Richtungen zu Nachbarn freihalten
      if (!h.main) forb.push([dir(h, hubById[h.parent] || MAIN), 0.9]);
      m.hubs.forEach((o) => {
        if (o !== h && !o.main && (hubById[o.parent] || MAIN) === h) forb.push([dir(h, o), 0.5]);
      });
      if (h.main) forb.push([dir(h, INET), 0.5]);
      let slots = [];
      for (let total = Math.max(n, 1); total <= n + 48; total++) {
        slots = [];
        for (let j = 0; j < total; j++) {
          const a = -Math.PI / 2 + (TWO_PI * j) / total;
          if (!forb.some(([f, t]) => near(a, f, t))) slots.push(a);
        }
        if (slots.length >= n) break;
      }
      ds.forEach((d, i) => {
        const a = slots[Math.min(slots.length - 1, Math.floor((i * slots.length) / Math.max(n, 1)))];
        d.px = h.px + Math.cos(a) * h.ring.r;
        d.py = h.py + Math.sin(a) * h.ring.r * h.squash;
        d.a = a;
        d.hubRef = h;
        const sd = this._pos["d:" + d.key];
        if (sd && sd.hub === h.id && isFinite(sd.dx) && isFinite(sd.dy)) {
          d.px = h.px + sd.dx;
          d.py = h.py + sd.dy;
        }
      });
    });

    // 4. Beschriftungen: Hindernisse sammeln (Knoten, Router-Beschriftungen)
    const obs = [];
    const box = (x0, y0, x1, y1) => obs.push({ x0, y0, x1, y1 });
    box(INET.px - 30, INET.py - 30, INET.px + 190, INET.py + 30);
    m.hubs.forEach((h) => {
      const rr = h.main ? 32 : 26;
      box(h.px - rr - 3, h.py - rr - 3, h.px + rr + 3, h.py + rr + 3);
      const y0 = h.main ? 56 : 50;
      const sub = `${h.ssid ? `${h.ssid} · ` : ""}${h.count} Geräte`;
      const ww = Math.max(h.name.length * 8.4, sub.length * 6.2, showIp && h.ip ? h.ip.length * 5.8 : 0) + 8;
      box(h.px - ww / 2, h.py + y0 - 14, h.px + ww / 2, h.py + y0 + (showIp && h.ip ? 36 : 20));
    });
    m.devices.forEach((d) => box(d.px - 20, d.py - 20, d.px + 20, d.py + 20));

    // 4a. Radiale Beschriftungen (dichte Router): längs der Linie nach außen, immer aufrecht lesbar
    m.devices.forEach((d) => {
      if (!d.hubRef.radial) return;
      const { ip, w, h } = labelSize(d);
      const ang = Math.atan2(d.py - d.hubRef.py, d.px - d.hubRef.px);
      let deg = (ang * 180) / Math.PI;
      let side = "start";
      if (deg > 90 || deg < -90) {
        deg += deg > 0 ? -180 : 180;
        side = "end";
      }
      const ox = side === "start" ? 24 : -24;
      d.lab = { mode: "radial", side, ox, oy: 0, rot: deg, ip, w, h };
      const ax = side === "start" ? ox : ox - w;
      const rad = (deg * Math.PI) / 180;
      const cs = Math.cos(rad);
      const sn = Math.sin(rad);
      const pts = [[ax, -h / 2], [ax + w, -h / 2], [ax + w, h / 2], [ax, h / 2]].map(([x, y]) => [d.px + x * cs - y * sn, d.py + x * sn + y * cs]);
      box(Math.min(...pts.map((q) => q[0])), Math.min(...pts.map((q) => q[1])), Math.max(...pts.map((q) => q[0])), Math.max(...pts.map((q) => q[1])));
    });

    // 4b. Waagerechte Beschriftungen (wenige Geräte): beste freie Lage suchen
    const hit = (r) => obs.reduce((n, o) => n + (r.x0 < o.x1 + 2 && r.x1 > o.x0 - 2 && r.y0 < o.y1 + 2 && r.y1 > o.y0 - 2 ? 1 : 0), 0);
    [...m.devices]
      .filter((d) => !d.hubRef.radial)
      .sort((a, b) => a.hub.localeCompare(b.hub) || (a.a ?? 0) - (b.a ?? 0))
      .forEach((d) => {
        const ang = Math.atan2(d.py - d.hubRef.py, d.px - d.hubRef.px);
        const c = Math.cos(ang);
        const s = Math.sin(ang);
        const { ip, w, h } = labelSize(d);
        const below = 35;
        const above = -(11 + h);
        const C = (side, ox, oy) => ({ side, ox, oy });
        const vert = s > 0 ? [C("middle", 0, below), C("middle", 0, above)] : [C("middle", 0, above), C("middle", 0, below)];
        const rt = [C("start", 24, 2), C("start", 24, -14), C("start", 24, 18)];
        const lf = [C("end", -24, 2), C("end", -24, -14), C("end", -24, 18)];
        const cands =
          c > 0.35 ? [rt[0], ...vert, lf[0], rt[1], rt[2], lf[1], lf[2]]
          : c < -0.35 ? [lf[0], ...vert, rt[0], lf[1], lf[2], rt[1], rt[2]]
          : [...vert, rt[0], lf[0], rt[1], lf[1], rt[2], lf[2]];
        let best = null;
        let bestN = Infinity;
        for (const cd of cands) {
          const x0 = cd.side === "start" ? d.px + cd.ox : cd.side === "end" ? d.px + cd.ox - w : d.px - w / 2;
          const y0 = d.py + cd.oy - 12;
          const rect = { x0, y0, x1: x0 + w, y1: y0 + h };
          const n = hit(rect);
          if (n < bestN) {
            best = { cd, rect };
            bestN = n;
            if (n === 0) break;
          }
        }
        d.lab = { mode: "flat", side: best.cd.side, ox: best.cd.ox, oy: best.cd.oy, ip, w, h };
        obs.push(best.rect);
      });

    // 5. Zeichenfläche an den Inhalt anpassen (Koordinaten bleiben stabil, nur der Ausschnitt ändert sich)
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    obs.forEach((o) => {
      x0 = Math.min(x0, o.x0);
      y0 = Math.min(y0, o.y0);
      x1 = Math.max(x1, o.x1);
      y1 = Math.max(y1, o.y1);
    });
    const mg = 40;
    let vx = x0 - mg;
    let vy = y0 - mg;
    let vw = x1 - x0 + 2 * mg;
    let vh = y1 - y0 + 2 * mg;
    if (vw < 1100) {
      vx -= (1100 - vw) / 2;
      vw = 1100;
    }
    if (vh < 640) {
      vy -= (640 - vh) / 2;
      vh = 640;
    }
    this._vb = { x: vx, y: vy, w: vw, h: vh };
  }

  _radialPill(d, L) {
    const max = this._config.max_name_length;
    const t = d.name.length > max ? `${d.name.slice(0, max - 1)}…` : d.name;
    const ax = L.side === "start" ? L.ox : L.ox - L.w;
    const rot = L.rot.toFixed(1);
    return `<g class="lab" data-lab="d:${esc(d.key)}" data-dx="0" data-dy="0" data-rot="${rot}" transform="translate(${d.px.toFixed(1)} ${d.py.toFixed(1)}) rotate(${rot})">
      <rect class="pill" x="${ax}" y="${-L.h / 2}" width="${L.w}" height="${L.h}" rx="6" fill="rgba(8,16,40,.82)" stroke="rgba(130,160,255,.35)"/>
      <text class="name" x="${ax + L.w / 2}" y="${L.ip ? -2 : 4}" text-anchor="middle" fill="#dfe8ff" font-size="12">${esc(t)}</text>
      ${L.ip ? `<text class="ip" x="${ax + L.w / 2}" y="11" text-anchor="middle" fill="#8ea3d4" font-size="10">${esc(L.ip)}</text>` : ""}</g>`;
  }

  _pill(text, x, y, anchor, lab = "", ox = 0, oy = 0, ip = "") {
    const max = this._config.max_name_length;
    const t = text.length > max ? `${text.slice(0, max - 1)}…` : text;
    const two = !!ip;
    const w = Math.round(Math.max(t.length * 6.3, two ? ip.length * 5.6 : 0) + 16);
    const ax = anchor === "start" ? 0 : anchor === "end" ? -w : -w / 2;
    const h = two ? 32 : 20;
    return `<g class="lab" data-lab="${esc(lab)}" data-dx="${ox.toFixed(1)}" data-dy="${oy.toFixed(1)}" transform="translate(${x.toFixed(1)} ${y.toFixed(1)})">
      <rect class="pill" x="${ax}" y="-12" width="${w}" height="${h}" rx="6" fill="rgba(8,16,40,.82)" stroke="rgba(130,160,255,.35)"/>
      <text class="name" x="${ax + w / 2}" y="2" text-anchor="middle" fill="#dfe8ff" font-size="12">${esc(t)}</text>
      ${two ? `<text class="ip" x="${ax + w / 2}" y="15" text-anchor="middle" fill="#8ea3d4" font-size="10">${esc(ip)}</text>` : ""}</g>`;
  }

  _draw(m) {
    this._layout(m);
    this._cur = {};
    m.hubs.forEach((h) => (this._cur[`h:${h.id}`] = { x: h.px, y: h.py }));
    m.devices.forEach((d) => (this._cur[`d:${d.key}`] = { x: d.px, y: d.py }));
    const main = m.hubs[0];
    const hubById = Object.fromEntries(m.hubs.map((h) => [h.id, h]));
    let links = "";
    let nodes = "";
    let labels = "";

    const line = (x1, y1, x2, y2, color, online, width, la = "", lb = "") =>
      `<line data-a="${esc(la)}" data-b="${esc(lb)}" x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"
        stroke="${online ? color : COLORS.offline}" stroke-width="${online ? width : 1.2}" stroke-linecap="round"
        ${online ? `class="flow" opacity=".85"` : `stroke-dasharray="2 6" opacity=".5"`}/>`;

    const node = (x, y, icon, color, online, entity, r, extra = "", hubId = "", devKey = "", nid = "") => `
      <g class="node ${online ? "" : "off"} ${extra}" style="--c:${color}" transform="translate(${x.toFixed(1)} ${y.toFixed(1)})" ${nid ? `data-node="${esc(nid)}"` : ""}
         ${hubId ? `data-hub="${esc(hubId)}" tabindex="0" role="button"` : devKey ? `data-dev="${esc(devKey)}" ${entity ? `data-entity="${esc(entity)}"` : ""} tabindex="0" role="button"` : entity ? `data-entity="${esc(entity)}" tabindex="0" role="button"` : ""}>
        <circle class="ring" r="${r}" fill="#0c1530" stroke="${color}" stroke-width="2"/>
        <foreignObject x="${-r}" y="${-r}" width="${r * 2}" height="${r * 2}"><div xmlns="http://www.w3.org/1999/xhtml"><ha-icon icon="${esc(icon)}"></ha-icon></div></foreignObject>
      </g>`;

    // Internet
    const ix = this._inet.px;
    const iy = this._inet.py;
    links += line(ix, iy, main.px, main.py, COLORS.internet, m.internet.online, 2, "i:net", `h:${main.id}`);
    nodes += node(ix, iy, "mdi:earth", m.internet.online ? COLORS.internet : COLORS.bad, true, m.internet.entity, 26);
    labels += `<text class="hubname" x="${ix + 38}" y="${iy + 5}" fill="#f4f7ff" font-size="14" font-weight="700">${m.internet.online ? "Internet online" : "Internet offline"}</text>`;

    // Verbindungen Hub -> Parent
    m.hubs.slice(1).forEach((h) => {
      const p = hubById[h.parent] || main;
      links += line(p.px, p.py, h.px, h.py, COLORS[h.link] || COLORS.mesh, h.online, 3, `h:${p.id}`, `h:${h.id}`);
    });
    // Geräte
    m.devices.forEach((d) => {
      links += line(d.hubRef.px, d.hubRef.py, d.px, d.py, COLORS[d.connection] || COLORS.wlan, d.online, 1.6, `h:${d.hubRef.id}`, `d:${d.key}`);
    });

    const showIp = this._config.show_ip !== false;
    m.hubs.forEach((h) => {
      nodes += node(h.px, h.py, h.icon, h.main ? COLORS.wlan : COLORS[h.link] || COLORS.mesh, h.online, h.entity, h.main ? 32 : 26, "hub", h.links.length || h.entity ? h.id : "", "", `h:${h.id}`);
      const y0 = h.main ? 56 : 50;
      labels += `<g class="lab" data-lab="h:${esc(h.id)}" data-dx="0" data-dy="0" transform="translate(${h.px.toFixed(1)} ${h.py.toFixed(1)})">
        <text class="hubname" x="0" y="${y0}" text-anchor="middle" fill="#f4f7ff" font-size="14" font-weight="700">${esc(h.name)}</text>
        <text class="count" x="0" y="${y0 + 16}" text-anchor="middle" fill="#8ea3d4" font-size="11">${esc(h.ssid ? `${h.ssid} · ` : "")}${h.count} Geräte</text>
        ${showIp && h.ip ? `<text class="count" x="0" y="${y0 + 31}" text-anchor="middle" fill="#8ea3d4" font-size="10">${esc(h.ip)}</text>` : ""}</g>`;
    });
    m.devices.forEach((d) => {
      const color = d.online ? COLORS[d.connection] || COLORS.wlan : COLORS.offline;
      nodes += node(d.px, d.py, d.icon, color, d.online, d.entity, 17, `${d.lease ? "lease " : ""}${d.hidden ? "hid" : ""}`, "", d.key, `d:${d.key}`);
      const L = d.lab;
      labels += L.mode === "radial" ? this._radialPill(d, L) : this._pill(d.name, d.px + L.ox, d.py + L.oy, L.side, `d:${d.key}`, L.ox, L.oy, L.ip);
    });

    const empty = m.devices.length
      ? ""
      : `<text class="empty" x="${this._vb.x + this._vb.w / 2}" y="${this._vb.y + this._vb.h - 60}" text-anchor="middle" fill="#8ea3d4" font-size="15">Keine Geräte gefunden. Prüfe die FRITZ!Box-Tools-Integration oder trage Geräte unter „devices“ ein.</text>`;

    const c = this._config;
    const chip = m.internet.online ? COLORS.internet : COLORS.bad;
    const tiles = m.stats
      .map(
        (t) => `<div class="tile" ${t.entity ? `data-entity="${esc(t.entity)}"` : ""}>
          <div class="k"><ha-icon icon="${esc(t.icon)}"></ha-icon>${esc(t.name)}</div>
          <div class="v">${esc(t.value)}<span class="u">${esc(t.unit)}</span></div></div>`
      )
      .join("");
    const chips = ["wlan", "lan", "mesh", "internet", "offline"].map((k) => `<span style="--c:${COLORS[k]}"><b></b>${LABELS[k]}</span>`);
    if (c.leases && c.leases.entity) {
      chips.push(
        `<span data-toggle="leases" class="${m.leasesVisible ? "" : "inactive"}" style="--c:${COLORS.dhcp}" role="button" tabindex="0" title="Klicken zum Ein- oder Ausblenden"><b></b>${LABELS.dhcp} (${m.leaseCount})</span>`
      );
    }
    if (m.hiddenCount) {
      chips.push(
        `<span data-toggle="hidden" class="${m.showHidden ? "" : "inactive"}" style="--c:${COLORS.offline}" role="button" tabindex="0" title="Einzeln ausgeblendete Geräte anzeigen"><b></b>Ausgeblendet (${m.hiddenCount})</span>`
      );
    }
    const legend = `<span class="ver">v${VERSION}</span>${chips.join("")}`;

    this._root.innerHTML = `<style>${STYLE}</style>
      <ha-card>
        <header>
          <div class="brand"><div class="logo"><ha-icon icon="mdi:lan"></ha-icon></div>
            <div><h1>${esc(c.title)}</h1><div class="sub">${esc(c.subtitle)}</div></div></div>
          <span class="chip" style="--c:${chip}"><i></i>${m.internet.online ? "Internet online" : "Internet offline"}</span>
        </header>
        ${tiles ? `<div class="stats">${tiles}</div>` : ""}
        <div class="legend">${legend}</div>
        <div class="wrap"><div class="scroll"><svg viewBox="${this._vb.x.toFixed(0)} ${this._vb.y.toFixed(0)} ${this._vb.w.toFixed(0)} ${this._vb.h.toFixed(0)}" role="img" aria-label="Netzwerk-Topologie">
          <g id="vp">${links}${nodes}${labels}${empty}</g></svg></div>
          ${c.zoom === "off" ? "" : `<div class="zoom"><button data-zoom="in" title="Vergrößern">+</button><button data-zoom="out" title="Verkleinern">−</button><button data-zoom="reset" title="Ansicht zurücksetzen">⟲</button>${c.drag_nodes === false ? "" : `<button data-zoom="layout" title="Gespeicherte Positionen zurücksetzen">▦</button>`}</div>`}</div>
      </ha-card>`;
    this._indexEls();
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
