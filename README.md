# Netzwerk-Karte für Home Assistant

Lovelace-Karte, die dein Netzwerk als animierte Topologie zeigt: Firewall oder Router in der Mitte, daran Fritzboxen, Repeater oder Switches als eigene Knoten, darum herum die Geräte, automatisch nach IP-Subnetz zugeordnet. Verbindungen sind nach Art eingefärbt (WLAN, LAN, Mesh, Internet), Offline-Geräte werden ausgegraut, oben stehen frei wählbare Kennzahlen. Ein Klick auf einen Knoten öffnet den Entitätsdialog.

Die Karte besteht aus einer einzigen JavaScript-Datei ohne Build-Schritt.

## So kommen die Daten zustande

- **Geräte:** Die Karte liest alle `device_tracker.*`-Entitäten, die eine IP-Adresse (`ip`) oder das Attribut `connected_to` haben. Das liefert die Integration *AVM FRITZ!Box Tools*, jede eingerichtete Fritzbox mit ihren eigenen Clients.
- **Zuordnung zum Router:** Automatisch, in dieser Reihenfolge:
  1. Feste Vorgabe unter `overrides` oder `devices` (`hub`)
  2. **IP-Subnetz:** Passt die IP eines Geräts in das `subnet` eines Hubs, hängt es dort (bei mehreren Treffern gewinnt das genauere Subnetz)
  3. Attribut `connected_to`, verglichen mit dem Namen oder `match` eines Hubs
  4. Sonst am Hauptknoten
- **Zentrum und Router:** Der Hauptknoten (`main`) steht in der Mitte, z. B. eine Firewall. Router, Fritzboxen oder Repeater legst du unter `hubs` an. Mit `ip` und `mac` werden sie nicht als normale Geräte angezeigt, und über die MAC wird ihr Online-Status aus dem passenden Tracker übernommen.
- **Doppelte Geräte:** Sieht mehr als eine Fritzbox dasselbe Gerät, gilt es einmal (Abgleich über die MAC), bevorzugt die Online-Meldung.
- **Kennzahlen:** Beliebige Sensoren unter `stats`. Zeitstempel-Sensoren (z. B. Laufzeit) werden als Dauer dargestellt.

## Einschränkungen

- Die Zuordnung per Subnetz funktioniert nur, wenn die Tracker eine IP-Adresse liefern. Sieht eine Fritzbox Clients aus anderen Netzen nur als Hostnamen ohne IP, nutze `overrides` oder `include`/`exclude`.
- Ob ein Gerät per LAN oder WLAN verbunden ist, liefert die Integration nicht zuverlässig. Standard ist `default_connection` (WLAN). Abweichungen legst du unter `overrides` fest.
- Es gibt keinen grafischen Editor, die Konfiguration erfolgt per YAML.

## Installation

### Über HACS (eigenes Repository)

1. HACS öffnen, oben rechts `⋮` → *Benutzerdefinierte Repositories*.
2. Die URL deines GitHub-Repositories eintragen, Kategorie **Dashboard**.
3. *Netzwerk-Karte* installieren und den Browser-Cache leeren (`Strg+F5`).

### Manuell

1. `dist/netzwerk-karte.js` nach `/config/www/netzwerk-karte.js` kopieren.
2. *Einstellungen → Dashboards → Ressourcen* → Ressource hinzufügen: URL `/local/netzwerk-karte.js`, Typ *JavaScript-Modul*.

## Bedienung

- **Zoomen:** Mausrad über der Karte. Der Punkt unter dem Mauszeiger bleibt dabei stehen. Auf Wunsch nur mit Strg (`zoom: ctrl`), damit die Seite normal scrollt.
- **Verschieben:** Mit gedrückter linker oder mittlerer Maustaste ziehen.
- **Zurücksetzen:** Doppelklick auf den Hintergrund oder die Schaltfläche ⟲. Die Schaltflächen + und − helfen auch auf Touchgeräten.
- **Router anklicken:** Hat ein Knoten einen Link, öffnet sich die Weboberfläche in einem neuen Fenster. Bei mehreren Zielen erscheint ein kleines Menü. Normale Geräte öffnen den Entitätsdialog.

## Konfiguration

Ein vollständiges Beispiel steht in [`examples/karte.yaml`](examples/karte.yaml).

| Option | Standard | Bedeutung |
|---|---|---|
| `title`, `subtitle` | Netzwerk, LAN · WLAN · Mesh | Kopfzeile |
| `internet_entity` | – | Entität für den Internet-Status (`on` = online) |
| `main` | `Router`, x 50, y 34 | Hauptknoten in der Mitte: `name`, `x`, `y`, `icon`, `entity`, `subnet` |
| `hubs` | – | Weitere Knoten: `name`, `ssid`, `subnet` (CIDR, auch Liste), `ip`, `mac`, `url`, `gateway`, `links`, `id`, `match`, `parent`, `link` (`lan`/`mesh`/`wlan`), `x`, `y`, `icon`, `entity` |
| `zoom` | `wheel` | Zoom per Mausrad (`wheel`), nur mit gedrückter Strg-Taste (`ctrl`) oder aus (`off`) |
| `auto_discover` | `true` | Geräte automatisch aus `device_tracker` mit `connected_to` übernehmen |
| `show_offline` | `false` | Auch Offline-Geräte der FRITZ!Box anzeigen |
| `include`, `exclude` | – | Listen von regulären Ausdrücken auf Name oder Entity-ID |
| `devices` | – | Manuelle Geräte: `name`, `entity`, `ip`, `hub`, `connection`, `icon` |
| `overrides` | – | Pro Entity-ID, Name oder MAC: `name`, `hub`, `connection`, `icon`, `hidden` |
| `default_connection` | `wlan` | Verbindungsart für automatisch gefundene Geräte |
| `max_name_length` | `20` | Namen werden darauf gekürzt |
| `stats` | – | Kennzahlen: `entity`, `name`, `icon`, `unit`, `multiply`, `decimals`, `format: text` |

**Links an Routern:**
- `ip` ergibt automatisch den Link `http://<ip>` (Fritzbox-Einstellungen).
- `gateway` ergibt zusätzlich `https://<gateway>` (z. B. OPNsense in diesem Netz).
- `url` ersetzt den Standardlink, am Hauptknoten legt es das Ziel fest.
- `links` (Liste aus `name` und `url`) ersetzt alles und erlaubt beliebig viele Ziele. Es sind nur `http://`- und `https://`-Adressen erlaubt.

Positionen `x` und `y` sind Prozentwerte der Kartenfläche. Hubs ohne Angabe werden auf Standardplätze links, rechts und unten gesetzt.

Die Entity-IDs der FRITZ!Box-Sensoren unterscheiden sich je nach Modell und Sprache. Schau unter *Einstellungen → Geräte & Dienste → FRITZ!Box Tools* nach den tatsächlichen Namen.

## Auf GitHub veröffentlichen

```bash
cd ha-netzwerk-karte
git init
git add .
git commit -m "Netzwerk-Karte 0.3.0"
git branch -M main
git remote add origin https://github.com/DEIN-NAME/ha-netzwerk-karte.git
git push -u origin main
```

Für HACS lohnt sich zusätzlich ein Release (Tag `v0.3.0`), damit Updates erkannt werden.

## Lizenz

MIT
