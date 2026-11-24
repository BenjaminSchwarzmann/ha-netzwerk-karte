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

## Prüfen, welche Version läuft

Unten links in der Legende steht die Version der geladenen Karte (z. B. `v0.3.3`). Steht dort nichts oder eine ältere Nummer, wird noch eine zwischengespeicherte Datei benutzt. Dann in HACS *Erneut herunterladen* wählen, den Browser mit `Strg+F5` neu laden und in der Home-Assistant-App unter *Einstellungen → Companion-App → Fehlerbehebung → Frontend-Cache leeren* (je nach App-Version). Ein privates Browserfenster zeigt sofort, ob es am Cache liegt.

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
- **Ansicht verschieben:** Auf dem Hintergrund mit gedrückter linker oder mittlerer Maustaste ziehen.
- **Knoten verschieben:** Ein Gerät oder einen Router mit gedrückter linken Maustaste an die gewünschte Stelle ziehen. Linien und Beschriftung folgen sofort. Zieht man einen Router, wandern seine Geräte mit. Die Positionen bleiben gespeichert (siehe unten). Ein Doppelklick auf einen Knoten stellt seine Standardposition wieder her, die Schaltfläche ▦ setzt alle Positionen zurück. Mit `drag_nodes: false` ist das Verschieben abgeschaltet.
- **Zurücksetzen:** Doppelklick auf den Hintergrund oder die Schaltfläche ⟲. Die Schaltflächen + und − helfen auch auf Touchgeräten.
- **Gerät anklicken:** Es öffnet sich ein Infofenster mit Status, IP- und MAC-Adresse, Hostname, Router, Verbindungsart, Entität, letzter Änderung und allen weiteren Attributen des Trackers. Dort gibt es die Schaltflächen *Umbenennen* und *Entität öffnen*. Mit `device_click: more-info` öffnet stattdessen direkt der Home-Assistant-Dialog.
- **Gerät umbenennen:** Rechtsklick auf das Gerät (oder *Umbenennen* im Infofenster, auch auf Touchgeräten). Name eintragen, mit Enter bestätigen. *Zurücksetzen* stellt den Originalnamen wieder her.
- **Geräte ausblenden:** Im Infofenster *Ausblenden* wählen. Ausgeblendete Geräte erscheinen nicht mehr. Unten rechts in der Legende zeigt der Eintrag *Ausgeblendet (n)* ihre Anzahl, ein Klick darauf blendet sie gedimmt wieder ein, im Infofenster dann *Einblenden*.
- **DHCP-Leases ein- und ausblenden:** Klick auf *Nur DHCP-Lease (n)* in der Legende. Die Einstellung wird gespeichert. Mit `leases.show: false` sind sie von Anfang an ausgeblendet.
- **Router anklicken:** Hat ein Knoten einen Link, öffnet sich die Weboberfläche in einem neuen Fenster. Bei mehreren Zielen erscheint ein kleines Menü. Normale Geräte öffnen den Entitätsdialog.

## OPNsense-DHCP-Leases abgleichen

Clients, die zwar eine DHCP-Adresse von OPNsense (Kea) haben, aber von keinem Tracker gemeldet werden, erscheinen zusätzlich **orange mit gestricheltem Ring** (Legende: *Nur DHCP-Lease*). Sie werden anhand ihrer IP dem passenden Router-Knoten zugeordnet. Geräte, die schon über einen Tracker bekannt sind (Abgleich über MAC oder IP), werden nicht doppelt angezeigt. Ihr Infofenster zeigt dann zusätzlich die Lease-Daten. Die Router selbst (`ip`/`mac` unter `hubs`) werden ausgeblendet, ebenso abgelaufene oder abgelehnte Leases.

Die Karte kann OPNsense nicht direkt abfragen (Browser, Zugangsdaten). Deshalb liest Home Assistant die Leases in einen Sensor, und die Karte wertet dessen Attribut aus.

**1. API-Schlüssel in OPNsense anlegen**
*System → Zugang → Benutzer* → einen eigenen Benutzer für Home Assistant anlegen (nicht root), ihm nur die Berechtigung für die Kea-DHCP-Leases geben, dann beim Benutzer unter *API-Schlüssel* **+** klicken. Die heruntergeladene Datei enthält `key` und `secret`.

**2. Zugangsdaten in `secrets.yaml`**
```yaml
opnsense_api_key: "DEIN_KEY"
opnsense_api_secret: "DEIN_SECRET"
```

**3. Sensor in `configuration.yaml`**
```yaml
rest:
  - resource: https://192.168.4.1/api/kea/leases4/search
    method: POST
    verify_ssl: false            # bei selbstsigniertem Zertifikat
    authentication: basic
    username: !secret opnsense_api_key
    password: !secret opnsense_api_secret
    headers:
      Content-Type: application/json
    payload: '{"current": 1, "rowCount": 1000}'
    scan_interval: 60            # Sekunden: so schnell erscheinen Änderungen in der Karte
    timeout: 20
    sensor:
      - name: OPNsense DHCP Leases
        unique_id: opnsense_dhcp_leases
        value_template: "{{ value_json.total | int(0) }}"
        json_attributes:
          - rows

recorder:
  exclude:
    entities:
      - sensor.opnsense_dhcp_leases   # große Attribute gehören nicht in die Datenbank
```
Läuft die OPNsense-Oberfläche ohne TLS, nimm `http://` statt `https://`. Nach dem Eintragen die Konfiguration prüfen und Home Assistant neu starten. Unter *Entwicklerwerkzeuge → Zustände* sollte `sensor.opnsense_dhcp_leases` die Anzahl der Leases zeigen und im Attribut `rows` die einzelnen Einträge.

**4. In der Karte aktivieren**
```yaml
leases:
  entity: sensor.opnsense_dhcp_leases
  exclude:                       # optional, reguläre Ausdrücke auf Hostname, IP oder MAC
    - "^esp"
```
Damit Leases einem Router zugeordnet werden, genügt das `subnet` des Hubs. Alternativ trägst du beim Hub den OPNsense-Schnittstellennamen unter `match` ein (z. B. `match: OG_WLAN3`).

**Hinweise**
- Ein Lease bedeutet nicht, dass das Gerät gerade online ist. Er zeigt nur, dass es eine Adresse bekommen hat und sie noch gültig ist.
- Die Karte liest die Felder `address`, `hwaddr`, `hostname`, `state` und `if_descr`/`if_name` der Kea-Antwort. Stehen sie in deinem Sensor anders, nenne sie mir oder passe `leaseFields` in der JavaScript-Datei an.
- Nur DHCPv4 über Kea ist vorgesehen.

## 3D-Ansicht

Mit dem Umschalter **2D | 3D** neben dem Titel wechselst du zwischen der flachen Darstellung und einer räumlichen Ansicht. Die Wahl wird pro Benutzer gespeichert. Mit `view: 3d` startet die Karte standardmäßig räumlich.

- **Drehen und neigen:** Rechte Maustaste gedrückt halten und ziehen. Der Mittelpunkt der Drehung ist der Hauptknoten (z. B. OPNsense).
- **Zoomen:** Mausrad (oder `+` und `−`). **Verschieben:** linke oder mittlere Maustaste ziehen.
- **Zurücksetzen:** Doppelklick auf den leeren Hintergrund oder ⟲.
- **Beschriftungen:** Router sind immer beschriftet, bei Geräten nur die der Kamera nächsten und das Gerät unter dem Mauszeiger. Die Schaltfläche **Aa** schaltet zwischen *wenige*, *mehr* und *alle* um.
- **Klicken:** Wie in 2D öffnet ein Klick auf ein Gerät das Infofenster und ein Klick auf einen Router sein Link-Menü. Ein Rechtsklick **ohne Ziehen** auf ein Gerät öffnet das Umbenennen.
- **Anordnung:** Die Router liegen wie in 2D, mit leichtem Höhenunterschied. Die Geräte sitzen auf einer abgeflachten Kugelschale um ihren Router. Die Lage wird aus dem Gerät berechnet und bleibt beim Umbenennen gleich. Einzelne Knoten lassen sich in 3D nicht verschieben, dafür gibt es die 2D-Ansicht.
- **Ausblenden, Leases, Namen:** Alles funktioniert wie in 2D, ebenso die Legende.

Die 3D-Ansicht braucht keine zusätzliche Bibliothek. Sie funktioniert nur mit der Maus, nicht per Touch. Auf schwachen Geräten kann das Drehen bei sehr vielen Knoten ruckeln.

## Layout

Die Zeichenfläche passt sich dem Inhalt an. Router mit vielen Geräten (mehr als 10) bekommen einen größeren Ring, und die Beschriftungen laufen **radial** längs der Verbindungslinie nach außen. So überlappen sie sich nicht. Bei wenigen Geräten stehen die Beschriftungen waagerecht neben dem Knoten, mit automatischer Suche nach einem freien Platz. Router-Gruppen werden automatisch so weit auseinander gesetzt, dass sie sich nicht überdecken. Der Internet-Knoten sitzt über dem Hauptknoten.

Mit `label_mode: radial` oder `label_mode: horizontal` erzwingst du eine Darstellung für alle Router. Router, die du per `x`/`y` in Prozent festlegst oder per Maus verschiebst, bleiben an ihrem Platz.

## Gespeicherte Positionen

Verschobene Knoten, ausgeblendete Geräte und die Lease-Einstellung merkt sich die Karte wie die eigenen Namen in den Benutzerdaten von Home Assistant (Schlüssel `netzwerk-karte-positionen`) und zusätzlich im Browser. Geräte werden relativ zu ihrem Router gespeichert. Verschiebst du den Router, folgen deshalb auch Geräte mit gespeicherter Position. Neue Geräte ordnet die Karte weiterhin automatisch an. Das Verschieben funktioniert mit der Maus, nicht per Touch.

## Eigene Gerätenamen

Namen, die du per Rechtsklick vergibst, werden **an die MAC-Adresse des Geräts gebunden** (bei Geräten ohne MAC an die Entity-ID). Sie bleiben deshalb nach einem Neustart, bei neuer IP-Adresse oder geändertem Hostnamen erhalten.

- Gespeichert wird in den Benutzerdaten von Home Assistant (`frontend/set_user_data`, Schlüssel `netzwerk-karte-namen`), zusätzlich als Kopie im Browser. Die Namen gelten damit auf allen Geräten, auf denen du angemeldet bist.
- Die Daten gehören zu deinem Benutzerkonto. Andere Benutzer sehen deine Namen nicht. Für Namen, die alle sehen sollen, nutze `overrides` in der YAML-Konfiguration.
- Ein eigener Name hat Vorrang vor `overrides`. Geräte mit eigenem Namen werden auch dann angezeigt, wenn sie durch `exclude` ausgeblendet würden.

## Konfiguration

Ein vollständiges Beispiel steht in [`examples/karte.yaml`](examples/karte.yaml).

| Option | Standard | Bedeutung |
|---|---|---|
| `title`, `subtitle` | Netzwerk, LAN · WLAN · Mesh | Kopfzeile |
| `internet_entity` | – | Entität für den Internet-Status (`on` = online) |
| `main` | `Router`, x 50, y 34 | Hauptknoten in der Mitte: `name`, `x`, `y`, `icon`, `entity`, `subnet` |
| `hubs` | – | Weitere Knoten: `name`, `ssid`, `subnet` (CIDR, auch Liste), `ip`, `mac`, `url`, `gateway`, `links`, `id`, `match`, `parent`, `link` (`lan`/`mesh`/`wlan`), `x`, `y`, `icon`, `entity` |
| `leases` | – | OPNsense-DHCP-Leases abgleichen: `entity`, `attribute` (Standard `rows`), `include`, `exclude`, `show` (`false` = zunächst ausgeblendet) |
| `show_ip` | `true` | IP-Adresse unter dem Namen von Geräten und Routern anzeigen |
| `drag_nodes` | `true` | Knoten per Maus verschiebbar |
| `label_mode` | `auto` | `auto`, `radial` (gedrehte Beschriftung) oder `horizontal` |
| `view` | `2d` | Startansicht: `2d` oder `3d` (der Umschalter in der Karte hat danach Vorrang) |
| `device_click` | `info` | Klick auf ein Gerät: `info` (Infofenster) oder `more-info` (Home-Assistant-Dialog) |
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
git commit -m "Netzwerk-Karte 0.3.4"
git branch -M main
git remote add origin https://github.com/DEIN-NAME/ha-netzwerk-karte.git
git push -u origin main
```

Für HACS lohnt sich zusätzlich ein Release (Tag `v0.3.4`), damit Updates erkannt werden.

## Lizenz

MIT
