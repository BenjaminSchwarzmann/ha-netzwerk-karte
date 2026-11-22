/*! netzwerk-karte 0.1.0 – Netzwerk-Topologie für Home Assistant (FRITZ!Box Tools, Mesh, eigene Geräte) */
const VERSION = "0.1.0";
const W = 1200;
const H = 760;
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
const PRESETS = [[26, 46], [74, 50], [50, 90], [28, 88], [72, 88], [50, 10]];
const ICONS = [
  [/iphone|pixel|galaxy|handy|phone/i, "mdi:cellphone"],
  [/ipad|tablet/i, "mdi:tablet"],
  [/\btv\b|fernseher|fire ?stick|chromecast/i, "mdi:television"],
  [/drucker|printer|laserjet|officejet/i, "mdi:printer"],
  [/\bnas\b|diskstation|qnap|synology/i, "mdi:nas"],
  [/\bcam\b|kamera|reolink|\bnvr\b|\bring\b/i, "mdi:cctv"],
  [/echo|alexa|homepod|sonos|speaker/i, "mdi:speaker-wireless"],
  [/klima|air ?con/i, "mdi:air-conditioner"],
  [/repeater|accesspoint|access point/i, "mdi:router-wireless"],
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
  .scroll { overflow-x: auto; }
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
    this._root.addEventListener("click", (e) => this._onClick(e));
    this._root.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") this._onClick(e);
    });
  }

  setConfig(config) {
    if (!config || typeof config !== "object") throw new Error("Ungültige Konfiguration");
    this._config = {
      title: "Netzwerk",
      subtitle: "LAN · WLAN · Mesh",
      auto_discover: true,
      show_offline: false,
      include: [],
      exclude: [],
      default_connection: "wlan",
      max_name_length: 20,
      hubs: [],
      devices: [],
      overrides: {},
      stats: [],
      ...config,
      main: { name: "FRITZ!Box", x: 50, y: 40, ...(config.main || {}) },
    };
    this._key = "";
    this._update();
  }

  set hass(hass) {
    this._hass = hass;
    this._update();
  }

  getCardSize() {
    return 9;
  }

  static getStubConfig() {
    return { title: "Netzwerk" };
  }

  _onClick(e) {
    const el = e.target && e.target.closest ? e.target.closest("[data-entity]") : null;
    if (!el || !el.dataset.entity) return;
    this.dispatchEvent(
      new CustomEvent("hass-more-info", { bubbles: true, composed: true, detail: { entityId: el.dataset.entity } })
    );
  }

  _update() {
    if (!this._config || !this._hass) return;
    const model = this._model();
    const key = JSON.stringify(model);
    if (key === this._key) return;
    this._key = key;
    this._draw(model);
  }

  _model() {
    const c = this._config;
    const st = this._hass.states;
    const lang = this._hass.locale?.language || "de";

    const hubs = [
      {
        id: "main", name: c.main.name, match: [], parent: null, link: "lan", x: c.main.x, y: c.main.y,
        entity: c.main.entity || null, icon: c.main.icon || "mdi:router-wireless", main: true,
      },
    ];
    c.hubs.forEach((h, i) => {
      const p = PRESETS[i % PRESETS.length];
      hubs.push({
        id: h.id || slug(h.name), name: h.name,
        match: list(h.match ?? h.name).map((s) => String(s).toLowerCase()),
        parent: h.parent || "main", link: h.link || "mesh", x: h.x ?? p[0], y: h.y ?? p[1],
        entity: h.entity || null, icon: h.icon || "mdi:access-point-network", main: false,
      });
    });
    hubs.forEach((h) => (h.online = h.entity ? isOnline(st[h.entity]?.state) : true));

    const findHub = (key) => {
      if (key == null || key === "") return hubs[0];
      const k = String(key).toLowerCase();
      return (
        hubs.find((h) => h.id === k || h.name.toLowerCase() === k) ||
        hubs.slice(1).find((h) => h.match.some((m) => k.includes(m))) ||
        hubs[0]
      );
    };

    const devs = new Map();
    const override = (eid, name) => c.overrides[eid] || c.overrides[name] || {};
    const incl = c.include.map((r) => new RegExp(r, "i"));
    const excl = c.exclude.map((r) => new RegExp(r, "i"));

    if (c.auto_discover) {
      for (const [eid, s] of Object.entries(st)) {
        if (!eid.startsWith("device_tracker.")) continue;
        const a = s.attributes || {};
        if (!("connected_to" in a)) continue;
        const name = a.friendly_name || eid;
        const hay = `${name} ${eid}`;
        if (incl.length && !incl.some((r) => r.test(hay))) continue;
        if (excl.some((r) => r.test(hay))) continue;
        const o = override(eid, name);
        if (o.hidden) continue;
        const online = isOnline(s.state);
        if (!online && !c.show_offline) continue;
        devs.set(eid, {
          entity: eid, name: o.name || name, hub: findHub(o.hub ?? a.connected_to).id,
          connection: o.connection || c.default_connection, online, icon: o.icon || iconFor(name),
        });
      }
    }
    c.devices.forEach((d) => {
      const s = d.entity ? st[d.entity] : null;
      const name = d.name || s?.attributes?.friendly_name || d.entity || "Gerät";
      devs.set(d.entity || name, {
        entity: d.entity || "", name, hub: findHub(d.hub).id, connection: d.connection || c.default_connection,
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
      if (h.main) forb.push([dir(h, { px: 110, py: 92 }), 0.5]);
      let slots = [];
      for (let total = Math.max(n, 1); total <= n + 48; total++) {
        slots = [];
        for (let j = 0; j < total; j++) {
          const a = -Math.PI / 2 + (2 * Math.PI * j) / total;
          if (!forb.some(([f, t]) => near(a, f, t))) slots.push(a);
        }
        if (slots.length >= n) break;
      }
      const r = clamp(110 + n * 10, 120, 290);
      ds.forEach((d, i) => {
        const a = slots[Math.min(slots.length - 1, Math.floor((i * slots.length) / Math.max(n, 1)))];
        d.px = clamp(h.px + Math.cos(a) * r, 50, W - 50);
        d.py = clamp(h.py + Math.sin(a) * r * 0.82, 44, H - 44);
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

    const node = (x, y, icon, color, online, entity, r, extra = "") => `
      <g class="node ${online ? "" : "off"} ${extra}" style="--c:${color}" transform="translate(${x.toFixed(1)} ${y.toFixed(1)})"
         ${entity ? `data-entity="${esc(entity)}" tabindex="0" role="button"` : ""}>
        <circle class="ring" r="${r}" fill="#0c1530" stroke="${color}" stroke-width="2"/>
        <foreignObject x="${-r}" y="${-r}" width="${r * 2}" height="${r * 2}"><div xmlns="http://www.w3.org/1999/xhtml"><ha-icon icon="${esc(icon)}"></ha-icon></div></foreignObject>
      </g>`;

    // Internet
    const ix = 110;
    const iy = 92;
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
      nodes += node(h.px, h.py, h.icon, h.main ? COLORS.wlan : COLORS[h.link] || COLORS.mesh, h.online, h.entity, h.main ? 32 : 26, "hub");
      labels += `<text class="hubname" x="${h.px}" y="${h.py + (h.main ? 56 : 50)}" text-anchor="middle" fill="#f4f7ff" font-size="14" font-weight="700">${esc(h.name)}</text>
        <text class="count" x="${h.px}" y="${h.py + (h.main ? 72 : 66)}" text-anchor="middle" fill="#8ea3d4" font-size="11">${h.count} Geräte</text>`;
    });
    m.devices.forEach((d) => {
      const color = d.online ? COLORS[d.connection] || COLORS.wlan : COLORS.offline;
      nodes += node(d.px, d.py, d.icon, color, d.online, d.entity, 17);
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
        <div class="scroll"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Netzwerk-Topologie">
          ${links}${nodes}${labels}${empty}</svg></div>
      </ha-card>`;
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
