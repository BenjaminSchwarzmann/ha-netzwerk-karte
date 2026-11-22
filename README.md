# Netzwerk-Karte für Home Assistant

Lovelace-Karte, die dein Netzwerk als animierte Topologie zeigt: FRITZ!Box in der Mitte, Mesh-Repeater als eigene Knoten, darum herum die Geräte. Verbindungen sind nach Art eingefärbt (WLAN, LAN, Mesh, Internet), Offline-Geräte werden ausgegraut, oben stehen frei wählbare Kennzahlen. Ein Klick auf einen Knoten öffnet den Entitätsdialog.

Die Karte besteht aus einer einzigen JavaScript-Datei ohne Build-Schritt.

## So kommen die Daten zustande

- **Geräte:** Die Karte liest alle `device_tracker.*`-Entitäten der Integration *AVM FRITZ!Box Tools*. Sie haben das Attribut `connected_to` mit dem Namen des Zugangspunkts, an dem das Gerät hängt. Daraus ergibt sich, an welchem Repeater ein Gerät angezeigt wird.
- **Repeater und andere Knoten:** Du legst sie unter `hubs` an. Der Name (oder `match`) muss zum Wert von `connected_to` passen.
- **Kennzahlen:** Beliebige Sensoren unter `stats`. Zeitstempel-Sensoren (z. B. Laufzeit) werden als Dauer dargestellt.

## Einschränkungen

- Die FRITZ!Box kennt nur Geräte in ihrem eigenen Segment. Geräte hinter einem weiteren Router (z. B. OPNsense mit mehreren Subnetzen) erscheinen nicht automatisch. Trage sie unter `devices` ein, mit einer beliebigen Entität für den Online-Status (Ping, Binary-Sensor, Device-Tracker).
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

## Konfiguration

Ein vollständiges Beispiel steht in [`examples/karte.yaml`](examples/karte.yaml).

| Option | Standard | Bedeutung |
|---|---|---|
| `title`, `subtitle` | Netzwerk, LAN · WLAN · Mesh | Kopfzeile |
| `internet_entity` | – | Entität für den Internet-Status (`on` = online) |
| `main` | `FRITZ!Box`, x 50, y 40 | Hauptknoten: `name`, `x`, `y`, `icon`, `entity` |
| `hubs` | – | Weitere Knoten: `name`, `id`, `match`, `parent`, `link` (`mesh`/`lan`/`wlan`), `x`, `y`, `icon`, `entity` |
| `auto_discover` | `true` | Geräte automatisch aus `device_tracker` mit `connected_to` übernehmen |
| `show_offline` | `false` | Auch Offline-Geräte der FRITZ!Box anzeigen |
| `include`, `exclude` | – | Listen von regulären Ausdrücken auf Name oder Entity-ID |
| `devices` | – | Manuelle Geräte: `name`, `entity`, `hub`, `connection`, `icon` |
| `overrides` | – | Pro Entity-ID oder Name: `name`, `hub`, `connection`, `icon`, `hidden` |
| `default_connection` | `wlan` | Verbindungsart für automatisch gefundene Geräte |
| `max_name_length` | `20` | Namen werden darauf gekürzt |
| `stats` | – | Kennzahlen: `entity`, `name`, `icon`, `unit`, `multiply`, `decimals`, `format: text` |

Positionen `x` und `y` sind Prozentwerte der Kartenfläche. Hubs ohne Angabe werden auf Standardplätze links, rechts und unten gesetzt.

Die Entity-IDs der FRITZ!Box-Sensoren unterscheiden sich je nach Modell und Sprache. Schau unter *Einstellungen → Geräte & Dienste → FRITZ!Box Tools* nach den tatsächlichen Namen.

## Auf GitHub veröffentlichen

```bash
cd ha-netzwerk-karte
git init
git add .
git commit -m "Netzwerk-Karte 0.1.0"
git branch -M main
git remote add origin https://github.com/DEIN-NAME/ha-netzwerk-karte.git
git push -u origin main
```

Für HACS lohnt sich zusätzlich ein Release (Tag `v0.1.0`), damit Updates erkannt werden.

## Lizenz

MIT
