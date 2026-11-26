/*! netzwerk-karte 0.4.2 – Netzwerk-Topologie für Home Assistant (FRITZ!Box Tools, Mesh, eigene Geräte) */
const VERSION = "0.4.2";
const NAMES_KEY = "netzwerk-karte-namen";
const POS_KEY = "netzwerk-karte-positionen";
const OPT_KEY = "netzwerk-karte-optionen";
const POS3_KEY = "netzwerk-karte-positionen3d";
const W = 1500;
const H = 880;
const COLORS = {
  wlan: "#2fd4ff",
  lan: "#ffa24a",
  mesh: "#a46bff",
  internet: "#33f0a8",
  offline: "#5b6478",
  dhcp: "#ff9f43",
  hit: "#ffd60a",
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

const hexA = (hex, a) => {
  const n = parseInt(String(hex).slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};
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
  .scroll svg { display: block; width: 100%; min-width: 680px; height: auto; }
  .searchbox .sicon { width: 18px; height: 18px; min-width: 0; flex: none; }
  .node { cursor: pointer; outline: none; }
  .node circle.ring { filter: drop-shadow(0 0 6px var(--c)); transition: transform .15s; transform-box: fill-box; transform-origin: center; }
  .node:hover circle.ring, .node:focus-visible circle.ring { transform: scale(1.12); }
  .node.off { opacity: .55; }
  .node.lease circle.ring { stroke-dasharray: 5 3; }
  .node.hid { opacity: .4; }
  .legend .ver { margin-right: auto; opacity: .55; }
  .mode { display: inline-flex; padding: 3px; border-radius: 999px; background: rgba(12,26,60,.9); border: 1px solid rgba(90,140,255,.35); }
  .mode button { border: 0; background: none; color: #a0b9eb; font: 600 13px inherit; padding: 6px 16px; border-radius: 999px; cursor: pointer; }
  .mode button.on { background: ${COLORS.wlan}; color: #06102a; }
  .stage3d { position: relative; width: 100%; aspect-ratio: 1.8 / 1; min-height: 380px; }
  .stage3d canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; cursor: grab; touch-action: none; }
  .stage3d.drag canvas { cursor: grabbing; }
  header { gap: 12px 14px; }
  .searchbox { position: relative; flex: 1 1 300px; max-width: 520px; min-width: 0; display: flex; align-items: center; }
  .searchbox .sicon { position: absolute; left: 16px; color: #a0b9eb; pointer-events: none; }
  .sinput { width: 100%; box-sizing: border-box; height: 46px; padding: 0 44px; border-radius: 999px; border: 1px solid rgba(90,140,255,.4);
    background: rgba(10,22,52,.92); color: #f0f4ff; font: 500 15px inherit; outline: none; }
  .sinput::placeholder { color: #6f84b8; }
  .sinput:focus, .searchbox.has .sinput { border-color: ${COLORS.hit}; box-shadow: 0 0 0 1px rgba(255,214,10,.35); }
  .searchbox.has .sicon { color: ${COLORS.hit}; }
  .sclear { display: none; position: absolute; right: 8px; width: 30px; height: 30px; border-radius: 50%; border: 0;
    background: rgba(40,60,110,.95); color: #d2e1ff; font-size: 18px; line-height: 1; cursor: pointer; }
  .searchbox.has .sclear { display: block; }
  .sdrop { position: absolute; z-index: 8; left: 0; right: 0; top: 54px; padding: 6px; min-width: 280px; border-radius: 16px;
    background: rgba(10,20,46,.98); border: 1px solid rgba(90,140,255,.45); box-shadow: 0 14px 34px rgba(0,0,0,.55); }
  .sdrop[hidden] { display: none; }
  .sitem { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 10px; cursor: pointer; }
  .sitem:hover, .sitem.cur { background: rgba(255,214,10,.13); }
  .sitem i { flex: none; width: 12px; height: 12px; border-radius: 50%; border: 2px solid ${COLORS.hit}; }
  .sitem div { flex: 1; min-width: 0; }
  .sitem b { display: block; font-size: 14px; font-weight: 600; color: #f0f4ff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .sitem small { display: block; font-size: 12px; color: #8ea3d4; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .sitem em { flex: none; font-style: normal; font-size: 12px; color: #6f84b8; }
  .sfoot { padding: 6px 10px 4px; font-size: 12px; color: #6f84b8; }
  .shits { display: inline-flex; align-items: center; gap: 4px; height: 46px; padding: 0 8px 0 18px; border-radius: 999px;
    border: 1.5px solid rgba(255,214,10,.85); background: rgba(44,36,6,.92); color: ${COLORS.hit}; font-weight: 600; font-size: 15px; }
  .shits[hidden] { display: none; }
  .shits.none { border-color: rgba(255,107,129,.7); background: rgba(50,14,24,.9); color: #ff9aa9; padding-right: 18px; }
  .shits button { border: 0; background: none; color: #ffe9a0; width: 34px; height: 34px; border-radius: 50%; font-size: 14px; cursor: pointer; }
  .shits button:hover { background: rgba(255,214,10,.16); }
  .node .pulse { fill: none; stroke: ${COLORS.hit}; stroke-width: 2; opacity: 0; transform-box: fill-box; transform-origin: center; pointer-events: none; }
  .node.hit .pulse { animation: pulse 1.7s ease-out infinite; }
  .node.hit .pulse.p2 { animation-delay: .85s; }
  .node.hit circle.ring { stroke: ${COLORS.hit}; filter: drop-shadow(0 0 9px ${COLORS.hit}); }
  .node.cur circle.ring { stroke-width: 3.5; }
  .scroll.searching .node:not(.hit) { opacity: .28; }
  .scroll.searching .lab:not(.hit) { opacity: .3; }
  .scroll.searching line:not(.hit) { opacity: .15; }
  line.hit { stroke: ${COLORS.hit}; opacity: .95; }
  @keyframes pulse { 0% { opacity: .9; transform: scale(1); } 100% { opacity: 0; transform: scale(2.8); } }
  .menu tr.hl td { background: rgba(255,214,10,.15); color: #ffe27a; }
  @media (pointer: coarse) { .scroll { touch-action: none; } .scroll svg { min-width: 0; } }
  @media (max-width: 640px) {
    .searchbox { order: 5; flex: 1 1 100%; max-width: none; }
    .shits { order: 6; }
    .stage3d { aspect-ratio: auto; height: 66vh; min-height: 420px; }
    h1 { font-size: 22px; letter-spacing: .12em; }
    .logo { width: 38px; height: 38px; }
  }
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
  @media (prefers-reduced-motion: reduce) { .flow { animation: none; } .node.hit .pulse { animation: none; opacity: .55; } .node circle.ring { transition: none; } }
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
    this._pos3 = {};
    this._opts = {};
    this._showHidden = false;
    this._vb = { x: 0, y: 0, w: W, h: H };
    this._inet = { px: 750, py: 70 };
    this._cur = {};
    this._els = {};
    this._cam = { yaw: -24, pitch: 17, k: 1, px: 0, py: 0, lab: 0 };
    this._d3 = null;
    this._hov = "";
    this._scr = [];
    this._pending = false;
    this._q = "";
    this._hits = [];
    this._hitSet = new Set();
    this._hitIdx = -1;
    this._sfocus = false;
    this._scaret = 0;
    this._tp = new Map();
    this._tg = null;
    this._tw = null;
    const r = this._root;
    r.addEventListener("click", (e) => this._onClick(e));
    r.addEventListener("input", (e) => {
      const t = e.target;
      if (t && t.classList && t.classList.contains("sinput")) {
        this._scaret = t.selectionStart;
        this._setQuery(t.value);
      }
    });
    r.addEventListener("focusin", (e) => {
      if (e.target.classList && e.target.classList.contains("sinput")) {
        this._sfocus = true;
        this._updateSearchUI();
      }
    });
    r.addEventListener("focusout", (e) => {
      if (!(e.target.classList && e.target.classList.contains("sinput"))) return;
      setTimeout(() => {
        const a = this._root.activeElement;
        if (!(a && a.classList && a.classList.contains("sinput"))) {
          this._sfocus = false;
          this._updateSearchUI();
        }
      }, 200);
    });
    r.addEventListener("keydown", (e) => {
      if (e.target && e.target.classList && e.target.classList.contains("sinput")) {
        if (e.key === "Enter") {
          e.preventDefault();
          this._stepHit(e.shiftKey ? -1 : 1);
        } else if (e.key === "Escape") {
          if (this._q) {
            e.target.value = "";
            this._setQuery("");
          } else e.target.blur();
        }
        return;
      }
      if (e.target && e.target.tagName === "INPUT") {
        if (e.key === "Enter") this._saveInput(e.target);
        else if (e.key === "Escape") this._closeMenu();
        return;
      }
      if (e.key === "Escape") this._closeMenu();
      else if ((e.key === "Enter" || e.key === " ") && !(e.target && e.target.tagName === "BUTTON")) this._onClick(e);
    });
    r.addEventListener("contextmenu", (e) => {
      if (e.target.closest && e.target.closest(".stage3d")) {
        e.preventDefault(); // Rechtsklick dreht in 3D, das Umbenennen läuft über pointerup
        return;
      }
      const n = e.target.closest ? e.target.closest("[data-dev]") : null;
      if (!n) return;
      e.preventDefault();
      this._openRename(n.dataset.dev);
    });
    r.addEventListener(
      "wheel",
      (e) => {
        if (!this._config || this._config.zoom === "off") return;
        const st = e.target.closest ? e.target.closest(".stage3d") : null;
        if (st) {
          if (this._config.zoom === "ctrl" && !e.ctrlKey) return;
          e.preventDefault();
          const dy3 = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaY;
          this._cam.k = clamp(this._cam.k * Math.exp(-dy3 * 0.0015), 0.35, 5);
          this._req3d();
          return;
        }
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
      if (e.target.closest && e.target.closest(".sdrop")) e.preventDefault(); // Fokus im Suchfeld behalten
      if (e.button === 1 && e.target.closest && (e.target.closest(".scroll") || e.target.closest(".stage3d"))) e.preventDefault();
    });
    r.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "touch") return this._tdown(e);
      if (e.target.closest && e.target.closest(".stage3d")) return this._p3down(e);
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
      if (e.pointerType === "touch") return this._tmove(e);
      if (this._d3) return this._p3move(e);
      if (e.buttons === 0 && e.target.closest && e.target.closest(".stage3d")) return this._hover3(e);
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
    r.addEventListener("pointerup", (e) => {
      if (e.pointerType === "touch") return this._tup(e);
      this._endDrag();
      this._endDrag3(e);
    });
    r.addEventListener("pointercancel", (e) => {
      if (e.pointerType === "touch") return this._tup(e);
      this._endDrag();
      this._endDrag3(e, true);
    });
    r.addEventListener("dblclick", (e) => {
      const t = e.target;
      if (t.closest && t.closest(".stage3d")) {
        const rc = this._cv.getBoundingClientRect();
        const hit = this._pick(e.clientX - rc.left, e.clientY - rc.top);
        if (!hit) this._zoomBy("reset");
        else if (hit.kind === "dev" || hit.kind === "hub") this._persist(POS3_KEY, "_pos3", hit.id, null); // Standardposition
        return;
      }
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
    this._pos3 = await load(POS3_KEY);
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
    const is3 = this._is3d();
    const prop = is3 ? "_pos3" : "_pos";
    const key = is3 ? POS3_KEY : POS_KEY;
    if (!Object.keys(this[prop]).length) return;
    if (!window.confirm("Alle gespeicherten Positionen dieser Ansicht zurücksetzen?")) return;
    this[prop] = {};
    try {
      localStorage.removeItem(key);
    } catch (err) {
      /* ignorieren */
    }
    this._key = "";
    this._update();
    try {
      await this._hass.callWS({ type: "frontend/set_user_data", key, value: {} });
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
    const sa = t.closest("[data-search]");
    if (sa) return this._searchAct(sa.dataset.search);
    const sh = t.closest("[data-hit]");
    if (sh) return this._goto(sh.dataset.hit);
    const tg = t.closest("[data-toggle]");
    if (tg) return this._toggle(tg.dataset.toggle);
    const md = t.closest("[data-mode]");
    if (md) return this._setMode(md.dataset.mode);
    const cv = t.closest("canvas.c3d");
    if (cv) return this._click3d(e, cv);
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
    const terms = this._terms();
    const rowHtml = (x) => `<tr${terms.length && terms.some((q) => `${x[0]} ${x[1]}`.toLowerCase().includes(q)) ? ' class="hl"' : ""}><td>${esc(x[0])}</td><td>${esc(x[1])}</td></tr>`;
    const table = (r) => `<table>${r.map(rowHtml).join("")}</table>`;
    const html = `<div class="mh">${esc(d.name)}</div>${table(rows)}
      ${extra.length ? `<table><tr class="sep"><td colspan="2">WEITERE ATTRIBUTE</td></tr>${extra.map(rowHtml).join("")}</table>` : ""}
      ${leaseRows.length ? `<table><tr class="sep"><td colspan="2">DHCP-LEASE (OPNSENSE)</td></tr>${leaseRows.map(rowHtml).join("")}</table>` : ""}
      <div class="row"><button data-act="rename">Umbenennen</button><button data-act="${d.hidden ? "unhide" : "hide"}">${d.hidden ? "Einblenden" : "Ausblenden"}</button>${d.entity ? `<button data-act="more" data-entity="${esc(d.entity)}">Entität öffnen</button>` : ""}</div>`;
    this._showMenu(html, el, "info", d.key);
  }

  _openRename(key) {
    const d = this._m && this._m.devices.find((x) => x.key === key);
    const el = this._devEl(key) || this._anchor3d(this._scr.find((q) => q.key === key));
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

  // ---------- 3D-Ansicht (Canvas) ----------
  _is3d() {
    return (this._opts.mode || (this._config && this._config.view) || "2d") === "3d";
  }

  _setMode(mode) {
    if (mode === "2d" || mode === "3d") this._persist(OPT_KEY, "_opts", "mode", mode);
  }

  // Räumliche Anordnung: Router liegen an den Stellen der 2D-Ansicht (mit etwas Höhenunterschied),
  // die Geräte auf einer abgeflachten Kugelschale um ihren Router. Alles ist stabil aus Namen berechnet.
  _build3d(m) {
    const MAIN = m.hubs[0];
    const hubById = Object.fromEntries(m.hubs.map((h) => [h.id, h]));
    const hash = (str) => {
      let h = 2166136261;
      for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 16777619);
      }
      return ((h >>> 0) % 100000) / 100000;
    };
    const nodes = [];
    const links = [];
    const hub3 = {};
    const hubDef = {};
    let maxDef = 0;
    m.hubs.forEach((h) => {
      const def = [h.px - MAIN.px, h.main ? 0 : (hash(`y${h.id}`) - 0.5) * 240, h.py - MAIN.py];
      hubDef[h.id] = def;
      maxDef = Math.max(maxDef, Math.hypot(def[0], def[1], def[2]));
      const sv = h.main ? null : this._pos3[`h:${h.id}`];
      const p = sv && isFinite(sv.x) && isFinite(sv.y) && isFinite(sv.z) ? [sv.x, sv.y, sv.z] : def;
      hub3[h.id] = p;
      nodes.push({
        id: `h:${h.id}`, kind: h.main ? "main" : "hub", hubId: h.id, p, r: h.main ? 22 : 16,
        color: h.main ? COLORS.wlan : COLORS[h.link] || COLORS.mesh, online: h.online, name: h.name,
        sub: `${h.ssid ? `${h.ssid} · ` : ""}${h.count} Geräte`, ip: h.ip || "",
        shell: h.ring.n ? clamp(h.ring.r * 0.9 + 40, 90, 420) : 0, entity: h.entity || "",
      });
      if (!h.main) {
        const par = hubById[h.parent] || MAIN;
        links.push({ a: `h:${par.id}`, b: `h:${h.id}`, color: COLORS[h.link] || COLORS.mesh, w: 2.6, online: h.online });
      }
    });
    const by = {};
    m.devices.forEach((d) => (by[d.hub] = by[d.hub] || []).push(d));
    m.hubs.forEach((h) => {
      const ds = (by[h.id] || []).slice().sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
      const n = ds.length;
      const R3 = clamp(h.ring.r * 0.9 + 40, 90, 420);
      const phase = hash(`p${h.id}`) * 6.2832;
      ds.forEach((d, i) => {
        const y = 1 - (2 * (i + 0.5)) / n;
        const rad = Math.sqrt(Math.max(0, 1 - y * y));
        const th = phase + i * 2.399963;
        const j = 0.82 + 0.34 * hash(`j${d.key}`);
        const hp = hub3[h.id];
        const color = d.online ? COLORS[d.connection] || COLORS.wlan : COLORS.offline;
        let o = [Math.cos(th) * rad * R3 * j, y * R3 * 0.62 * j, Math.sin(th) * rad * R3 * j];
        const dh = hubDef[h.id];
        maxDef = Math.max(maxDef, Math.hypot(dh[0] + o[0], dh[1] + o[1], dh[2] + o[2]));
        const sd = this._pos3[`d:${d.key}`];
        if (sd && sd.hub === h.id && isFinite(sd.dx) && isFinite(sd.dy) && isFinite(sd.dz)) o = [sd.dx, sd.dy, sd.dz];
        nodes.push({
          id: `d:${d.key}`, kind: "dev", key: d.key, hubId: h.id, r: 8.5, color, online: d.online,
          lease: !!d.lease, hidden: !!d.hidden, name: d.name, ip: d.ip || "", entity: d.entity,
          p: [hp[0] + o[0], hp[1] + o[1], hp[2] + o[2]],
        });
        links.push({ a: `h:${h.id}`, b: `d:${d.key}`, color, w: 1, online: d.online });
      });
    });
    nodes.push({
      id: "i:net", kind: "inet", p: [-120, 330, -110], r: 24, color: m.internet.online ? COLORS.internet : COLORS.bad, online: true,
      name: m.internet.online ? "Internet online" : "Internet offline", entity: m.internet.entity,
    });
    links.push({ a: "i:net", b: `h:${MAIN.id}`, color: COLORS.internet, w: 1.6, online: m.internet.online });
    const R = Math.max(500, maxDef, Math.hypot(120, 330, 110)) + 60; // aus der Standardanordnung, damit die Ansicht beim Verschieben ruhig bleibt
    return { nodes, links, R };
  }

  _init3d() {
    const cv = this._root.querySelector("canvas.c3d");
    this._cv = cv;
    this._scr = [];
    if (!cv || !this._m) return;
    this._scene = this._build3d(this._m);
    if (this._ro) this._ro.disconnect();
    if (typeof ResizeObserver !== "undefined") {
      this._ro = new ResizeObserver(() => this._req3d());
      this._ro.observe(cv.parentElement);
    }
    this._render3d();
  }

  _req3d() {
    if (this._raf) return;
    this._raf = requestAnimationFrame(() => {
      this._raf = 0;
      this._render3d();
    });
  }

  _sprite(color) {
    this._sprites = this._sprites || {};
    if (this._sprites[color]) return this._sprites[color];
    const c = document.createElement("canvas");
    c.width = 96;
    c.height = 96;
    const x = c.getContext("2d");
    if (!x) return null;
    const g = x.createRadialGradient(48, 48, 0, 48, 48, 48);
    g.addColorStop(0, hexA(color, 0.85));
    g.addColorStop(0.35, hexA(color, 0.3));
    g.addColorStop(1, hexA(color, 0));
    x.fillStyle = g;
    x.fillRect(0, 0, 96, 96);
    return (this._sprites[color] = c);
  }

  _glyph(ctx, kind, x, y, r, color) {
    if (r < 4) return;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = Math.max(1, r * 0.13);
    ctx.lineCap = "round";
    if (kind === "dev") {
      const w = r * 0.55;
      const h = r * 0.42;
      ctx.strokeRect(x - w, y - h, 2 * w, 2 * h);
      ctx.beginPath();
      ctx.moveTo(x - w * 0.5, y + h + r * 0.14);
      ctx.lineTo(x + w * 0.5, y + h + r * 0.14);
      ctx.stroke();
    } else if (kind === "inet") {
      ctx.beginPath();
      ctx.arc(x, y, r * 0.55, 0, 6.2832);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x - r * 0.55, y);
      ctx.lineTo(x + r * 0.55, y);
      ctx.moveTo(x, y - r * 0.55);
      ctx.lineTo(x, y + r * 0.55);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(x, y, r * 0.25, r * 0.55, 0, 0, 6.2832);
      ctx.stroke();
    } else {
      const w = r * 0.6;
      const h = r * 0.3;
      ctx.strokeRect(x - w, y - h * 0.1, 2 * w, h * 1.8);
      ctx.beginPath();
      ctx.moveTo(x - w * 0.55, y - h * 0.1);
      ctx.lineTo(x - w * 0.8, y - r * 0.6);
      ctx.moveTo(x + w * 0.55, y - h * 0.1);
      ctx.lineTo(x + w * 0.8, y - r * 0.6);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x - w * 0.4, y + h * 0.8, r * 0.07, 0, 6.2832);
      ctx.arc(x, y + h * 0.8, r * 0.07, 0, 6.2832);
      ctx.fill();
    }
  }

  _render3d() {
    const cv = this._cv;
    if (!cv || !cv.isConnected || !this._scene) return;
    const box = cv.parentElement.getBoundingClientRect();
    const Wc = Math.max(320, box.width || 1000);
    const Hc = Math.max(240, box.height || 560);
    const dpr = window.devicePixelRatio || 1;
    const pw = Math.round(Wc * dpr);
    const ph = Math.round(Hc * dpr);
    if (cv.width !== pw || cv.height !== ph) {
      cv.width = pw;
      cv.height = ph;
    }
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, Wc, Hc);
    const sc = this._scene;
    const cam = this._cam;
    const u = Wc / 1500;
    const dist = sc.R * 2.6;
    const f0 = 1.14 * Wc;
    const s0 = f0 / dist;
    const focal = f0 * cam.k;
    const ca = Math.cos((cam.yaw * Math.PI) / 180);
    const sa = Math.sin((cam.yaw * Math.PI) / 180);
    const cp = Math.cos((cam.pitch * Math.PI) / 180);
    const sp = Math.sin((cam.pitch * Math.PI) / 180);
    const proj = this._projFor(cam, Wc, Hc);
    const hitSet = this._hitSet;
    const searching = hitSet.size > 0;
    const reduce = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    const phase = reduce ? 0.35 : (Date.now() % 1700) / 1700;
    const depthT = (z) => clamp((z + sc.R) / (2 * sc.R), 0, 1);
    const FONT = '"Segoe UI", system-ui, -apple-system, Roboto, sans-serif';
    const fs = clamp(Wc / 1500, 0.85, 1.25);

    // Sternenstaub, leicht mitbewegt
    if (!this._stars) {
      let seed = 7;
      const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      this._stars = Array.from({ length: 240 }, () => [rnd(), rnd(), 0.15 + 0.5 * rnd() ** 3, 0.5 + 1.1 * rnd() ** 3]);
    }
    for (const [sx, sy, a, r] of this._stars) {
      const x = (((sx * Wc + cam.yaw * 0.6) % Wc) + Wc) % Wc;
      const y = (((sy * Hc + cam.pitch * 0.6) % Hc) + Hc) % Hc;
      ctx.fillStyle = `rgba(170,200,255,${a})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, 6.2832);
      ctx.fill();
    }

    const pn = sc.nodes.map((n) => ({ n, ...proj(n.p) })).sort((a, b) => a.z - b.z);
    const P = {};
    pn.forEach((o) => (P[o.n.id] = o));

    // Nebel um die Router-Gruppen
    pn.forEach((o) => {
      if (!o.n.shell) return;
      const rad = o.n.shell * o.s * 1.3;
      const g = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, rad);
      g.addColorStop(0, hexA(COLORS.wlan, 0.12));
      g.addColorStop(1, hexA(COLORS.wlan, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(o.x, o.y, rad, 0, 6.2832);
      ctx.fill();
    });

    // Verbindungen
    sc.links.forEach((l) => {
      const A = P[l.a];
      const B = P[l.b];
      if (!A || !B) return;
      const lh = searching && (hitSet.has(l.a) || hitSet.has(l.b));
      const fade = searching && !lh ? 0.25 : 1;
      const lw = Math.max(0.6, l.w * u * (A.s / s0) * (lh ? 1.1 : 0.7));
      const path = () => {
        ctx.beginPath();
        ctx.moveTo(A.x, A.y);
        ctx.lineTo(B.x, B.y);
      };
      const lc = lh ? COLORS.hit : l.color;
      if (!l.online && !lh) {
        ctx.setLineDash([2 * u, 5 * u]);
        ctx.strokeStyle = hexA(COLORS.offline, 0.35 * fade);
      } else {
        ctx.setLineDash([]);
        if (l.w > 1.2 || lh) {
          path();
          ctx.strokeStyle = hexA(lc, 0.22 * fade + (lh ? 0.2 : 0));
          ctx.lineWidth = lw * 3.4;
          ctx.stroke();
        }
        ctx.strokeStyle = hexA(lc, lh ? 0.95 : (0.2 + 0.55 * depthT((A.z + B.z) / 2)) * fade);
      }
      path();
      ctx.lineWidth = lw;
      ctx.stroke();
      ctx.setLineDash([]);
    });

    // Knoten, von hinten nach vorn
    this._scr = [];
    const curId = this._hits[this._hitIdx];
    pn.forEach(({ n, x, y, z, s }) => {
      const rr = n.r * u * (s / s0);
      const hit = hitSet.has(n.id);
      const col = hit ? COLORS.hit : n.color;
      const spr = this._sprite(col);
      const dimmed = searching && !hit ? 0.28 : 1;
      ctx.globalAlpha = (n.hidden ? 0.4 : 0.45 + 0.55 * depthT(z)) * (n.online ? 1 : 0.65) * dimmed;
      if (spr) ctx.drawImage(spr, x - rr * (hit ? 3.4 : 2.6), y - rr * (hit ? 3.4 : 2.6), rr * (hit ? 6.8 : 5.2), rr * (hit ? 6.8 : 5.2));
      ctx.beginPath();
      ctx.arc(x, y, rr, 0, 6.2832);
      ctx.fillStyle = "#0a1534";
      ctx.fill();
      ctx.lineWidth = Math.max(1, rr * (hit ? 0.28 : 0.2));
      ctx.strokeStyle = hit ? COLORS.hit : n.online ? n.color : COLORS.offline;
      if (n.lease && !hit) ctx.setLineDash([rr * 0.55, rr * 0.4]);
      ctx.stroke();
      ctx.setLineDash([]);
      this._glyph(ctx, n.kind === "dev" ? "dev" : n.kind === "inet" ? "inet" : "router", x, y, rr, hit ? COLORS.hit : n.online ? n.color : COLORS.offline);
      if (hit) {
        ctx.globalAlpha = 1;
        for (let k = 0; k < 2; k++) {
          const t = (phase + k * 0.5) % 1; // pulsierende Ringe
          ctx.beginPath();
          ctx.arc(x, y, rr * (1.15 + 1.9 * t), 0, 6.2832);
          ctx.strokeStyle = hexA(COLORS.hit, (1 - t) * 0.85);
          ctx.lineWidth = Math.max(1.2, rr * 0.16);
          ctx.stroke();
        }
        if (n.id === curId) {
          const q = rr * 2.1;
          ctx.strokeStyle = COLORS.hit;
          ctx.lineWidth = Math.max(2, rr * 0.2);
          [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sy]) => {
            ctx.beginPath();
            ctx.moveTo(x + sx * q, y + sy * (q - rr * 0.8));
            ctx.lineTo(x + sx * q, y + sy * q);
            ctx.lineTo(x + sx * (q - rr * 0.8), y + sy * q);
            ctx.stroke();
          });
        }
      }
      if (this._hov === n.id) {
        ctx.globalAlpha = 1;
        ctx.beginPath();
        ctx.arc(x, y, rr + 3, 0, 6.2832);
        ctx.strokeStyle = "rgba(255,255,255,.85)";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      this._scr.push({ id: n.id, kind: n.kind, key: n.key, hubId: n.hubId, entity: n.entity, x, y, r: rr, z, s });
    });

    // Beschriftungen: Router immer, Geräte nach Nähe zur Kamera, dazu das Gerät unter der Maus
    const placed = [];
    const rrect = (x, y, w, h, r) => {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    };
    const measure = (text, sub) => {
      ctx.font = `600 ${13 * fs}px ${FONT}`;
      const tw = ctx.measureText(text).width;
      ctx.font = `400 ${10.5 * fs}px ${FONT}`;
      const sw = sub ? ctx.measureText(sub).width : 0;
      return { w: Math.max(tw, sw) + 16 * fs, h: (sub ? 34 : 22) * fs };
    };
    const drawPill = (x0, y0, w, h, text, sub) => {
      rrect(x0, y0, w, h, 7 * fs);
      ctx.fillStyle = "rgba(8,16,40,.86)";
      ctx.fill();
      ctx.strokeStyle = "rgba(130,160,255,.4)";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#e8efff";
      ctx.font = `600 ${13 * fs}px ${FONT}`;
      ctx.fillText(text, x0 + w / 2, y0 + (sub ? 12 : h / 2) * (sub ? fs : 1));
      if (sub) {
        ctx.fillStyle = "#8ea3d4";
        ctx.font = `400 ${10.5 * fs}px ${FONT}`;
        ctx.fillText(sub, x0 + w / 2, y0 + 26 * fs);
      }
    };
    const hits = (r) => placed.some((q) => r.x0 < q.x1 && r.x1 > q.x0 && r.y0 < q.y1 && r.y1 > q.y0);
    const place = (o, text, sub, force) => {
      const { w, h } = measure(text, sub);
      const rr = o.n.r * u * (o.s / s0);
      for (const side of ["right", "left"]) {
        const x0 = side === "right" ? o.x + rr + 6 : o.x - rr - 6 - w;
        const y0 = o.y - h / 2;
        const r = { x0, y0, x1: x0 + w, y1: y0 + h };
        if (r.x0 < 4 || r.x1 > Wc - 4) continue;
        if (!force && hits(r)) continue;
        placed.push(r);
        drawPill(x0, y0, w, h, text, sub);
        return true;
      }
      return false;
    };
    // Router: Name darunter (mit Schatten, damit die Schrift vor Knoten lesbar bleibt)
    ctx.shadowColor = "rgba(4,9,26,.95)";
    ctx.shadowBlur = 7;
    pn.forEach((o) => {
      if (o.n.kind !== "hub" && o.n.kind !== "main") return;
      const rr = o.n.r * u * (o.s / s0);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#f4f7ff";
      ctx.font = `700 ${(o.n.kind === "main" ? 16 : 14) * fs}px ${FONT}`;
      ctx.fillText(o.n.name, o.x, o.y + rr + 14 * fs);
      ctx.fillStyle = "#8ea3d4";
      ctx.font = `400 ${11 * fs}px ${FONT}`;
      ctx.fillText(o.n.sub, o.x, o.y + rr + 30 * fs);
      if (this._config.show_ip !== false && o.n.ip) ctx.fillText(o.n.ip, o.x, o.y + rr + 44 * fs);
      placed.push({ x0: o.x - 80 * fs, x1: o.x + 80 * fs, y0: o.y + rr + 4, y1: o.y + rr + 52 * fs });
    });
    pn.filter((o) => o.n.kind === "inet").forEach((o) => {
      const rr = o.n.r * u * (o.s / s0);
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#f4f7ff";
      ctx.font = `700 ${14 * fs}px ${FONT}`;
      ctx.fillText(o.n.name, o.x + rr + 10, o.y);
      placed.push({ x0: o.x, x1: o.x + rr + 140 * fs, y0: o.y - 12, y1: o.y + 12 });
    });
    ctx.shadowBlur = 0;
    ctx.shadowColor = "transparent";
    const limit = [12, 34, 9999][cam.lab] * Math.max(0.7, Wc / 1500);
    let shown = 0;
    [...pn]
      .filter((o) => o.n.kind === "dev")
      .reverse()
      .forEach((o) => {
        if (searching || shown >= limit || o.n.id === this._hov) return;
        const sub = this._config.show_ip !== false && o.n.ip ? o.n.ip : "";
        if (place(o, o.n.name, sub, false)) shown++;
      });
    if (searching) {
      // Treffer immer beschriften (aktueller Treffer zuerst)
      const order = [...pn].filter((o) => hitSet.has(o.n.id) && o.n.kind === "dev").sort((a, b) => (b.n.id === curId) - (a.n.id === curId) || b.z - a.z);
      order.slice(0, 12).forEach((o) => {
        const sub = this._config.show_ip !== false && o.n.ip ? o.n.ip : "";
        if (!place(o, o.n.name, sub, false)) place(o, o.n.name, sub, true);
      });
    }
    const hv = pn.find((o) => o.n.id === this._hov && o.n.kind === "dev");
    if (hv) place(hv, hv.n.name, hv.n.ip || "", true);

    // Achsenkreuz
    const gx = 46;
    const gy = Hc - 58;
    [[[1, 0, 0], "#ff6b81", "X"], [[0, 1, 0], "#33f0a8", "Y"], [[0, 0, 1], "#2fd4ff", "Z"]].forEach(([v, col, lb]) => {
      const x1 = ca * v[0] + sa * v[2];
      const z1 = -sa * v[0] + ca * v[2];
      const y2 = cp * v[1] - sp * z1;
      const ex = gx + x1 * 28;
      const ey = gy - y2 * 28;
      ctx.strokeStyle = col;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(gx, gy);
      ctx.lineTo(ex, ey);
      ctx.stroke();
      ctx.fillStyle = col;
      ctx.font = `600 11px ${FONT}`;
      ctx.textAlign = "center";
      ctx.fillText(lb, ex + (ex - gx) * 0.28, ey + (ey - gy) * 0.28);
    });
    ctx.fillStyle = "rgba(110,135,190,.9)";
    ctx.font = `400 11px ${FONT}`;
    ctx.textAlign = "left";
    const touch = !!(window.matchMedia && window.matchMedia("(pointer: coarse)").matches);
    if (!touch) ctx.fillText("Rechte Maustaste: drehen · Mausrad: zoomen · Links auf Hintergrund: Ansicht verschieben · Links auf Knoten: Knoten verschieben", 16, Hc - 14);
  }

  _pick(x, y) {
    const inside = (q) => {
      const dx = x - q.x;
      const dy = y - q.y;
      return dx * dx + dy * dy <= (q.r + 5) * (q.r + 5);
    };
    for (let i = this._scr.length - 1; i >= 0; i--) {
      const q = this._scr[i];
      if (q.kind !== "dev" && inside(q)) return q; // Router, Hauptknoten und Internet zuerst
    }
    for (let i = this._scr.length - 1; i >= 0; i--) {
      if (inside(this._scr[i])) return this._scr[i];
    }
    return null;
  }

  _anchor3d(q) {
    if (!q || !this._cv) return null;
    const r = this._cv.getBoundingClientRect();
    const x = r.left + q.x;
    const y = r.top + q.y;
    const rad = q.r;
    const dataset = q.kind === "dev" ? { dev: q.key } : { hub: q.hubId || "" };
    return { dataset, getBoundingClientRect: () => ({ left: x - rad, right: x + rad, top: y - rad, bottom: y + rad, width: 2 * rad, height: 2 * rad }) };
  }

  _click3d(e, cv) {
    if (this._suppress) {
      this._suppress = false;
      return;
    }
    const r = cv.getBoundingClientRect();
    const hit = this._pick(e.clientX - r.left, e.clientY - r.top);
    this._closeMenu();
    if (!hit) return;
    if (hit.kind === "dev") return this._devClick(this._anchor3d(hit));
    if (hit.kind === "inet") {
      if (hit.entity) this._moreInfo(hit.entity);
      return;
    }
    this._hubClick(this._anchor3d(hit));
  }

  _hover3(e) {
    const cv = this._cv;
    if (!cv) return;
    const r = cv.getBoundingClientRect();
    const hit = this._pick(e.clientX - r.left, e.clientY - r.top);
    const id = hit ? hit.id : "";
    cv.style.cursor = hit ? "pointer" : "grab";
    if (id !== this._hov) {
      this._hov = id;
      this._req3d();
    }
  }

  _p3down(e) {
    if (e.pointerType !== "mouse" || ![0, 1, 2].includes(e.button) || !this._cv) return;
    const d = { id: e.pointerId, btn: e.button, x: e.clientX, y: e.clientY, moved: false, yaw: this._cam.yaw, pitch: this._cam.pitch, px: this._cam.px, py: this._cam.py, node: null };
    // Linke Taste auf einem Gerät oder Router: Knoten verschieben (Router samt Gruppe). Sonst: ganze Ansicht verschieben.
    if (e.button === 0 && this._config.drag_nodes !== false && this._scene) {
      const rc = this._cv.getBoundingClientRect();
      const hit = this._pick(e.clientX - rc.left, e.clientY - rc.top);
      if (hit && (hit.kind === "dev" || hit.kind === "hub")) {
        const n = this._scene.nodes.find((q) => q.id === hit.id);
        const kids = hit.kind === "hub" ? this._scene.nodes.filter((q) => q.kind === "dev" && q.hubId === hit.hubId) : [];
        if (n) d.node = { n, s: hit.s, p0: n.p.slice(), kids: kids.map((k) => ({ n: k, p0: k.p.slice() })) };
      }
    }
    this._d3 = d;
  }

  _p3move(e) {
    const d = this._d3;
    if (!d || e.pointerId !== d.id) return;
    if (e.buttons === 0) return this._endDrag3(e, true);
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.moved) {
      if (Math.hypot(dx, dy) < 4) return;
      d.moved = true;
      this._cv.parentElement.classList.add("drag");
      try {
        this._cv.setPointerCapture(d.id);
      } catch (err) {
        /* ignorieren */
      }
    }
    if (d.node) {
      // Bildschirmbewegung in die Ebene parallel zum Bildschirm umrechnen und in Weltkoordinaten zurückdrehen
      const ca = Math.cos((this._cam.yaw * Math.PI) / 180);
      const sa = Math.sin((this._cam.yaw * Math.PI) / 180);
      const cp = Math.cos((this._cam.pitch * Math.PI) / 180);
      const sp = Math.sin((this._cam.pitch * Math.PI) / 180);
      const vx = dx / d.node.s;
      const vy = -dy / d.node.s;
      const y1 = cp * vy;
      const z1 = -sp * vy;
      const w = [ca * vx - sa * z1, y1, sa * vx + ca * z1];
      const mv = (o) => (o.n.p = [o.p0[0] + w[0], o.p0[1] + w[1], o.p0[2] + w[2]]);
      mv(d.node);
      d.node.kids.forEach(mv);
      this._req3d();
      return;
    }
    if (d.btn === 2) {
      this._cam.yaw = d.yaw + dx * 0.35;
      this._cam.pitch = clamp(d.pitch + dy * 0.35, -88, 88);
    } else {
      this._cam.px = d.px + dx;
      this._cam.py = d.py + dy;
    }
    this._req3d();
  }

  _commitMove3(n) {
    const r = (v) => Math.round(v * 10) / 10;
    if (n.kind === "hub") {
      this._persist(POS3_KEY, "_pos3", n.id, { x: r(n.p[0]), y: r(n.p[1]), z: r(n.p[2]) });
      return;
    }
    const hub = this._scene.nodes.find((q) => q.id === `h:${n.hubId}`);
    if (hub) this._persist(POS3_KEY, "_pos3", n.id, { hub: n.hubId, dx: r(n.p[0] - hub.p[0]), dy: r(n.p[1] - hub.p[1]), dz: r(n.p[2] - hub.p[2]) });
  }

  _endDrag3(e, cancelled) {
    const d = this._d3;
    if (!d) return;
    this._d3 = null;
    if (this._cv) this._cv.parentElement.classList.remove("drag");
    if (d.moved) {
      this._suppress = true;
      setTimeout(() => (this._suppress = false), 0);
      if (d.node && !cancelled) this._commitMove3(d.node.n);
      return;
    }
    // Rechtsklick ohne Ziehen: Gerät unter dem Zeiger umbenennen
    if (d.btn === 2 && !cancelled && this._cv) {
      const r = this._cv.getBoundingClientRect();
      const hit = this._pick(d.x - r.left, d.y - r.top);
      if (hit && hit.kind === "dev") this._openRename(hit.key);
    }
  }

  // ---------- Suche ----------
  _terms() {
    return this._q.toLowerCase().split(/\s+/).filter(Boolean);
  }

  _leaseFor(d) {
    return this._leaseRows().find((r) => {
      const f = leaseFields(r);
      return (d.mac && f.mac === d.mac) || (d.ip && f.ip === d.ip);
    });
  }

  // Alle durchsuchbaren Eigenschaften je Knoten: Name, IP, MAC, Router, Tracker-Attribute, Lease-Felder (z. B. Hersteller)
  _haystacks(m) {
    const low = (v) => String(v).toLowerCase();
    const flat = (v) => (v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v));
    const hs = new Map();
    m.hubs.forEach((h) => hs.set(`h:${h.id}`, low([h.name, h.ssid, h.ip, h.mac, h.entity, "router"].filter(Boolean).join(" "))));
    m.devices.forEach((d) => {
      const st = d.entity ? this._hass.states[d.entity] : null;
      const a = (st && st.attributes) || {};
      const lr = this._leaseFor(d);
      const hub = m.hubs.find((x) => x.id === d.hub);
      const parts = [
        d.name, d.orig, d.key, d.ip, d.mac, d.entity, hub && hub.name, hub && hub.ssid, LABELS[d.connection] || d.connection,
        st && st.state, d.lease ? "dhcp lease" : "", d.online ? "online" : "offline",
        ...Object.values(a).map(flat), ...(lr ? Object.values(lr).map(flat) : []),
      ];
      const compact = [d.mac, a.mac, lr && lr.hwaddr].filter(Boolean).map((x) => low(x).replace(/[^0-9a-f]/g, "")).join(" ");
      hs.set(`d:${d.key}`, `${low(parts.filter((x) => x !== "" && x != null).join(" "))} ${compact}`);
    });
    return hs;
  }

  _refreshHits() {
    const terms = this._terms();
    const prev = this._hits[this._hitIdx];
    if (!terms.length || !this._m || !this._hass) this._hits = [];
    else {
      this._hits = [...this._haystacks(this._m).entries()].filter(([, txt]) => terms.every((t) => txt.includes(t))).map(([id]) => id);
    }
    this._hitSet = new Set(this._hits);
    this._hitIdx = prev ? this._hits.indexOf(prev) : -1;
  }

  _setQuery(q) {
    this._q = q;
    this._hitIdx = -1;
    this._refreshHits();
    this._applySearch();
  }

  _applySearch() {
    this._updateSearchUI();
    if (this._is3d()) {
      this._req3d();
      this._startPulse();
    } else this._applySearch2D();
  }

  _applySearch2D() {
    const sc = this._root.querySelector(".scroll");
    if (sc) sc.classList.toggle("searching", this._hitSet.size > 0);
    const cur = this._hits[this._hitIdx];
    Object.entries(this._els).forEach(([id, e]) => {
      const h = this._hitSet.has(id);
      if (e.node) {
        e.node.classList.toggle("hit", h);
        e.node.classList.toggle("cur", id === cur);
      }
      e.labs.forEach((l) => l.classList.toggle("hit", h));
      e.b.forEach((l) => l.classList.toggle("hit", h));
    });
  }

  _hitInfo(id) {
    const m = this._m;
    if (id.startsWith("h:")) {
      const h = m.hubs.find((x) => `h:${x.id}` === id);
      return h ? { name: h.name, sub: [h.ssid, h.ip].filter(Boolean).join("  ·  "), hub: "Router" } : null;
    }
    const d = m.devices.find((x) => `d:${x.key}` === id);
    if (!d) return null;
    const lr = this._leaseFor(d);
    const st = d.entity ? this._hass.states[d.entity] : null;
    const mfr = (lr && lr.mac_info) || (st && st.attributes && st.attributes.manufacturer) || "";
    const hub = m.hubs.find((x) => x.id === d.hub);
    return { name: d.name, sub: [d.ip, mfr].filter(Boolean).join("  ·  "), hub: hub ? hub.name.replace(/^FRITZ!Box /, "Box ") : "" };
  }

  _updateSearchUI() {
    const box = this._root.querySelector(".searchbox");
    const chip = this._root.querySelector(".shits");
    const drop = this._root.querySelector(".sdrop");
    if (!box || !chip || !drop) return;
    const n = this._hits.length;
    box.classList.toggle("has", !!this._q);
    chip.hidden = !this._q;
    chip.classList.toggle("none", !!this._q && n === 0);
    chip.innerHTML = !this._q
      ? ""
      : n
        ? `<span>${this._hitIdx >= 0 ? `${this._hitIdx + 1}/${n}` : n} Treffer</span><button data-search="prev" aria-label="Vorheriger Treffer">◀</button><button data-search="next" aria-label="Nächster Treffer">▶</button>`
        : `<span>Keine Treffer</span>`;
    const show = this._sfocus && n > 0;
    drop.hidden = !show;
    if (!show) return;
    const cur = this._hits[this._hitIdx];
    const items = this._hits.slice(0, 7).map((id) => {
      const i = this._hitInfo(id);
      return i
        ? `<div class="sitem${id === cur ? " cur" : ""}" data-hit="${esc(id)}"><i></i><div><b>${esc(i.name)}</b><small>${esc(i.sub)}</small></div><em>${esc(i.hub)}</em></div>`
        : "";
    });
    drop.innerHTML = items.join("") + (n > 7 ? `<div class="sfoot">+ ${n - 7} weitere Treffer · Eingabetaste: nächster Treffer</div>` : `<div class="sfoot">Eingabetaste: nächster Treffer</div>`);
  }

  _searchAct(act) {
    if (act === "clear") {
      const inp = this._root.querySelector(".sinput");
      if (inp) {
        inp.value = "";
        inp.focus();
      }
      this._setQuery("");
    } else if (act === "next") this._stepHit(1);
    else if (act === "prev") this._stepHit(-1);
  }

  _stepHit(dir) {
    const n = this._hits.length;
    if (!n) return;
    const i = this._hitIdx < 0 ? (dir > 0 ? 0 : n - 1) : (this._hitIdx + dir + n) % n;
    this._goto(this._hits[i]);
  }

  // Zum Treffer springen: 3D dreht den Knoten nach vorn, 2D schwenkt und zoomt dorthin. Das Infofenster öffnet sich erst beim Antippen des Knotens.
  _goto(id) {
    const i = this._hits.indexOf(id);
    if (i < 0) return;
    this._hitIdx = i;
    this._updateSearchUI();
    this._closeMenu(true);
    if (this._is3d()) {
      this._req3d();
      this._jump3(id);
    } else {
      this._applySearch2D();
      this._jump2(id);
    }
  }

  _tween(ms, step, done) {
    if (this._tw) this._tw.stop = true;
    const tw = { stop: false };
    this._tw = tw;
    const t0 = Date.now();
    const reduce = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    const tick = () => {
      if (tw.stop) return;
      const t = reduce ? 1 : clamp((Date.now() - t0) / ms, 0, 1);
      step(t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
      if (t < 1) requestAnimationFrame(tick);
      else {
        this._tw = null;
        if (done) done();
      }
    };
    requestAnimationFrame(tick);
  }

  _jump2(id, done) {
    const c = this._cur[id];
    if (!c) return;
    const vb = this._vb;
    const v0 = { ...this._view };
    const k1 = Math.max(v0.k, 1.6);
    const x1 = vb.x + vb.w / 2 - k1 * c.x;
    const y1 = vb.y + vb.h / 2 - k1 * c.y;
    this._tween(600, (e) => {
      this._view = { k: v0.k + (k1 - v0.k) * e, x: v0.x + (x1 - v0.x) * e, y: v0.y + (y1 - v0.y) * e };
      this._applyView();
    }, done);
  }

  _jump3(id, done) {
    const n = this._scene && this._scene.nodes.find((q) => q.id === id);
    if (!n || !this._cv) return;
    const cam = this._cam;
    const c0 = { ...cam };
    const p = n.p;
    const yawT = (Math.atan2(-p[0], p[2]) * 180) / Math.PI; // Knoten nach vorn
    const yaw1 = c0.yaw + ((((yawT - c0.yaw) % 360) + 540) % 360) - 180;
    const pitch1 = clamp(c0.pitch, 10, 30);
    const k1 = Math.max(c0.k, 1.5);
    const box = this._cv.parentElement.getBoundingClientRect();
    const Wc = Math.max(320, box.width || 1000);
    const Hc = Math.max(240, box.height || 560);
    const q = this._projFor({ yaw: yaw1, pitch: pitch1, k: k1, px: 0, py: 0 }, Wc, Hc)(p);
    const px1 = Wc / 2 - q.x;
    const py1 = Hc / 2 - q.y;
    this._tween(700, (e) => {
      cam.yaw = c0.yaw + (yaw1 - c0.yaw) * e;
      cam.pitch = c0.pitch + (pitch1 - c0.pitch) * e;
      cam.k = c0.k + (k1 - c0.k) * e;
      cam.px = c0.px + (px1 - c0.px) * e;
      cam.py = c0.py + (py1 - c0.py) * e;
      this._render3d();
    }, done);
  }

  _projFor(cam, Wc, Hc) {
    const dist = this._scene.R * 2.6;
    const focal = 1.14 * Wc * cam.k;
    const ca = Math.cos((cam.yaw * Math.PI) / 180);
    const sa = Math.sin((cam.yaw * Math.PI) / 180);
    const cp = Math.cos((cam.pitch * Math.PI) / 180);
    const sp = Math.sin((cam.pitch * Math.PI) / 180);
    return (p) => {
      const x1 = ca * p[0] + sa * p[2];
      const z1 = -sa * p[0] + ca * p[2];
      const y2 = cp * p[1] - sp * z1;
      const z2 = sp * p[1] + cp * z1;
      const s = focal / (dist - z2);
      return { x: Wc / 2 + cam.px + x1 * s, y: Hc / 2 + cam.py - y2 * s, z: z2, s };
    };
  }

  // Pulsieren der Treffer in 3D: nur solange es Treffer gibt
  _startPulse() {
    if (this._pulsing || !this._hitSet.size) return;
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    this._pulsing = true;
    const tick = () => {
      if (!this._pulsing) return;
      if (!this.isConnected || !this._is3d() || !this._hitSet.size) {
        this._pulsing = false;
        return;
      }
      this._render3d();
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  // ---------- Touch: ein Finger dreht (3D) oder verschiebt (2D), zwei Finger zoomen ----------
  _tdown(e) {
    const t = e.target;
    if (!t || !t.closest) return;
    const area = t.closest(".stage3d") ? "3d" : t.closest(".scroll") ? "2d" : "";
    if (!area || t.closest(".zoom") || t.closest(".menu")) return;
    if (!this._tp.size) {
      this._tarea = area;
      this._tmoved = false;
    } else if (area !== this._tarea) return;
    this._tp.set(e.pointerId, { x: e.clientX, y: e.clientY });
    this._tbase();
  }

  _tbase() {
    const pts = [...this._tp.values()];
    const g = { n: pts.length, cam0: { ...this._cam }, view0: { ...this._view }, p0: pts.map((q) => ({ ...q })) };
    if (pts.length >= 2) {
      g.d0 = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1;
      g.m0 = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
    }
    this._tg = g;
  }

  _tmove(e) {
    if (!this._tp.has(e.pointerId) || !this._tg) return;
    this._tp.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = this._tg;
    const pts = [...this._tp.values()];
    const is3 = this._tarea === "3d";
    const svg = is3 ? null : this._root.querySelector(".scroll svg");
    const rect = svg ? svg.getBoundingClientRect() : null;
    const vb = this._vb;
    if (pts.length === 1) {
      const dx = pts[0].x - g.p0[0].x;
      const dy = pts[0].y - g.p0[0].y;
      if (!this._tmoved && Math.hypot(dx, dy) < 8) return;
      this._tmoved = true;
      if (is3) {
        this._cam.yaw = g.cam0.yaw + dx * 0.4;
        this._cam.pitch = clamp(g.cam0.pitch + dy * 0.4, -88, 88);
        this._req3d();
      } else if (rect) {
        this._view = { k: g.view0.k, x: g.view0.x + (dx * vb.w) / rect.width, y: g.view0.y + (dy * vb.h) / rect.height };
        this._applyView();
      }
    } else if (g.d0) {
      this._tmoved = true;
      const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1;
      const ratio = d / g.d0;
      const m1 = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
      if (is3) {
        this._cam.k = clamp(g.cam0.k * ratio, 0.35, 5);
        this._cam.px = g.cam0.px + (m1.x - g.m0.x);
        this._cam.py = g.cam0.py + (m1.y - g.m0.y);
        this._req3d();
      } else if (rect) {
        const toU = (q) => ({ x: vb.x + ((q.x - rect.left) * vb.w) / rect.width, y: vb.y + ((q.y - rect.top) * vb.h) / rect.height });
        const u0 = toU(g.m0);
        const u1 = toU(m1);
        const k = clamp(g.view0.k * ratio, 0.4, 6);
        const f = k / g.view0.k;
        this._view = { k, x: u1.x - (u0.x - g.view0.x) * f, y: u1.y - (u0.y - g.view0.y) * f };
        this._applyView();
      }
    }
  }

  _tup(e) {
    if (!this._tp.has(e.pointerId)) return;
    this._tp.delete(e.pointerId);
    if (this._tp.size) {
      this._tbase();
      return;
    }
    this._tg = null;
    if (this._tmoved) {
      this._suppress = true;
      setTimeout(() => (this._suppress = false), 0);
    }
    this._tmoved = false;
    this._tarea = "";
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
    if (this._is3d()) {
      if (a === "layout") return this._resetLayout();
      if (a === "reset") this._cam = { yaw: -24, pitch: 17, k: 1, px: 0, py: 0, lab: this._cam.lab };
      else if (a === "labels") this._cam.lab = (this._cam.lab + 1) % 3;
      else if (a === "in" || a === "out") this._cam.k = clamp(this._cam.k * (a === "in" ? 1.25 : 0.8), 0.35, 5);
      this._req3d();
      return;
    }
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
    this._refreshHits();
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
    const is3d = this._is3d();
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
        <circle class="pulse" r="${r}"/><circle class="pulse p2" r="${r}"/>
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

    const stage = is3d
      ? `<div class="stage3d"><canvas class="c3d" aria-label="Netzwerk-Topologie (3D)"></canvas></div>`
      : `<div class="scroll"><svg viewBox="${this._vb.x.toFixed(0)} ${this._vb.y.toFixed(0)} ${this._vb.w.toFixed(0)} ${this._vb.h.toFixed(0)}" role="img" aria-label="Netzwerk-Topologie">
          <g id="vp">${links}${nodes}${labels}${empty}</g></svg></div>`;
    const zoomBtns =
      c.zoom === "off"
        ? ""
        : `<div class="zoom"><button data-zoom="in" title="Vergrößern">+</button><button data-zoom="out" title="Verkleinern">−</button><button data-zoom="reset" title="Ansicht zurücksetzen">⟲</button>${
            `${is3d ? `<button data-zoom="labels" title="Beschriftungen: wenige, mehr, alle">Aa</button>` : ""}${
              c.drag_nodes === false ? "" : `<button data-zoom="layout" title="Gespeicherte Positionen dieser Ansicht zurücksetzen">▦</button>`
            }`
          }</div>`;
    const searchHtml = `<div class="searchbox${this._q ? " has" : ""}"><svg class="sicon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><circle cx="10" cy="10" r="6" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M15 15l6 6" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg><input class="sinput" type="text" inputmode="search" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Suchen: Name, IP, MAC, Hersteller …" aria-label="Suche" value="${esc(this._q)}"><button class="sclear" data-search="clear" aria-label="Suche löschen" title="Löschen">×</button><div class="sdrop" hidden></div></div><div class="shits" hidden></div>`;
    this._root.innerHTML = `<style>${STYLE}</style>
      <ha-card>
        <header>
          <div class="brand"><div class="logo"><ha-icon icon="mdi:lan"></ha-icon></div>
            <div><h1>${esc(c.title)}</h1><div class="sub">${esc(c.subtitle)}</div></div></div>
          <div class="mode" role="group" aria-label="Ansicht"><button data-mode="2d" class="${is3d ? "" : "on"}">2D</button><button data-mode="3d" class="${is3d ? "on" : ""}">3D</button></div>
          ${searchHtml}
          <span class="chip" style="--c:${chip}"><i></i>${m.internet.online ? "Internet online" : "Internet offline"}</span>
        </header>
        ${tiles ? `<div class="stats">${tiles}</div>` : ""}
        <div class="legend">${legend}</div>
        <div class="wrap">${stage}${zoomBtns}</div>
      </ha-card>`;
    if (is3d) this._init3d();
    else {
      this._indexEls();
      this._applyView();
    }
    this._applySearch();
    if (this._sfocus) {
      const inp = this._root.querySelector(".sinput");
      if (inp) {
        inp.focus();
        try {
          inp.setSelectionRange(this._scaret, this._scaret);
        } catch (err) {
          /* ignorieren */
        }
      }
    }
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
