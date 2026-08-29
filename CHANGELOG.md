# Changelog

Alle nennenswerten Änderungen je Version. Der Abschnitt einer Version wird beim
Release von `scripts/release-notes.mjs` ausgelesen und zur Beschreibung des
GitHub-Releases. Fehlt der Abschnitt, bricht der Release-Workflow ab.

Versionen folgen [SemVer](https://semver.org/lang/de/), Format angelehnt an
[Keep a Changelog](https://keepachangelog.com/de/1.1.0/).

## 0.99.0 (2026-08-29)

### Behoben

- Den Fortschritt speichert jetzt allein das Hauptfenster. Bisher schrieben
  beide Fenster in denselben Eintrag, und die dazugehörige Zone rechnete jedes
  aus seiner eigenen Route aus. Hielt das Overlay eine andere Lesart, legte es
  zur selben Kante eine andere Zone ab und überschrieb damit den Stand. Beim
  nächsten Start knüpfte die App an diese Zone an und stand zehn Kanten
  zurück. Der Fehler überlebte so den Neustart, der ihn hätte beheben sollen.
- Das Overlay liest und schreibt keinen Fortschritt mehr. Es ist Anzeige und
  bekommt Lesart und Kante vom Hauptfenster gesagt.

### Intern

- Adresse des Overlay-Fensters, seine Route im Router und die Rollenprüfung
  teilen sich eine Konstante. Ein Test hält fest, dass die Adresse wirklich als
  Overlay erkannt wird.

## 0.98.0 (2026-08-29)

### Behoben

- Das Overlay zeigte im Speedleveling einen anderen Schritt als die Liste im
  Hauptfenster, meist einen weiter vorn. Beide Fenster parsen die Route selbst,
  ausgetauscht wurde aber nur der Kantenindex. Speedleveling hat 236 Kanten,
  der Ligastart 248: derselbe Zahlenwert trifft je Lesart eine andere Zone.
  Kante 172 ist im Speedleveling The Sarn Ramparts und im Ligastart The
  Causeway, zehn Kanten früher. Wer dorthin sprang, sah im Overlay „Get
  Crafting: Cold Damage - Rank 2, Find and take Kishara's Star".
- Der Modus gehört jetzt zu jeder Meldung ans Overlay, nicht nur zum Wechsel.
  Das Overlay lädt seine Route neu, bevor es einen Index anwendet, der zu einer
  anderen Lesart gehört. Eine verpasste Meldung heilt damit von selbst.
- Das Overlay meldet sich beim Start und bekommt den Stand als Antwort. Vorher
  riet es aus dem gemeinsamen Speicher, und Kante wie Modus konnten beim
  Aufbau veraltet sein.
- Der Fortschritt wird auch dann ans Overlay gemeldet, wenn die
  Einstellungsseite offen ist. Bisher hing das am Hauptbildschirm, der dort
  nicht mehr gerendert wird.

## 0.97.0 (2026-08-29)

### Neu

- Zweiter Modus **Speedleveling** für den nächsten Charakter derselben Liga.
  Craftingrezepte und Trials gelten dort schon, ihre Schritte fallen darum weg,
  ebenso die Umwege, die nur beim Ligastart etwas bringen: Tidal Island mit
  Hailrake, The Den, die Catacombs, das Silver Locket, die Ossuary und die Suche
  nach der Chemist's Strongbox. Aus 488 Schritten auf 248 Kanten werden 409 auf
  236.
- Nach elf Tagen ohne Start fragt die App beim Öffnen, ob ein neuer Durchgang
  ansteht, und lässt zwischen Ligastart und Speedleveling wählen. Beide
  Antworten setzen auf Akt 1 zurück, eine dritte lässt alles stehen. Beim
  allerersten Start wird nicht gefragt.
- Der Modus steht auch in den Einstellungen. Ein Wechsel dort behält den
  Fortschritt und knüpft an der nächstgelegenen passenden Zone wieder an.

### Behoben

- Ein Wiederanschluss konnte auf einen Kantenindex zeigen, den es nicht gibt,
  wenn die zuletzt betretene Zone in der Route fehlt. Das Overlay wäre leer
  geblieben, ohne Fehlermeldung. Der Index wird jetzt auf die Länge der Route
  geklemmt. Aufgefallen beim Moduswechsel: die Ossuary liegt im Ligastart auf
  Kante 233, Speedleveling hat nur 236.
- Der tägliche Datenabgleich setzte seinen Takt unter React StrictMode nicht neu
  auf, nachdem der erste Mount ihn abgeräumt hatte. Betraf nur den
  Entwicklungslauf.

## 0.96.0 (2026-08-27)

### Intern

- Node 20 ist seit April 2026 ohne Support, CI baut jetzt auf Node 24 (aktives
  LTS). `.nvmrc` steht auf `24`, Patches innerhalb des Majors nimmt CI mit.
- `predev` schrieb bei jedem `yarn dev` die lokal installierte Node-Version nach
  `.nvmrc`, und zwei Workflows lesen genau diese Datei. Wer lokal eine andere
  Version ausprobierte, verschob damit unbemerkt die Toolchain von Release und
  Upstream-Watch. Die Automatik ist entfernt, die Version wird bewusst gepflegt.
- Dieser Changelog. Der Release-Workflow prüft vor dem Bauen, ob die Version
  einen Abschnitt hat, und setzt ihn danach als Release-Beschreibung.

## 0.95.0 (2026-08-27)

### Behoben

- Der Fortschritt überlebt einen Neustart wieder. Das Hauptfenster knüpfte beim
  Start am **letzten** Vorkommen der zuletzt betretenen Zone an statt am
  gespeicherten Schritt. 46 der 149 Zonen der Route werden mehrfach betreten,
  The Forest Encampment etwa auf den Kanten 135, 137, 145, 150 und 156. Wer bei
  135 aufhörte, stand nach dem Neustart 21 Kanten weiter. Das Overlay blieb
  richtig, weil es diesen Weg nicht nimmt.
- Ein Wiederanschluss findet jetzt das **nächstgelegene** Vorkommen, und nur
  dann, wenn der gespeicherte Schritt nicht mehr passt, sich also die Route
  darunter geändert hat.
- Lief während des täglichen Datenabgleichs der Client.txt-Takt, konnte der
  Fortschritt einen Schritt zurückspringen.

### Geändert

- Die Guide-Liste springt beim Start und bei jedem Zonenwechsel zum aktuellen
  Schritt, mittig ins Bild. Dazwischen lässt sie sich frei scrollen.

## 0.94.0 (2026-08-26)

### Behoben

- Updates laden wieder nur die Differenz. Die Releases 0.92.0 und 0.93.0
  enthielten ausschließlich vollständige Pakete, jedes Update zog also 5,5 MB
  statt rund 90 KB. `vpk` rechnet ein Delta nur gegen ein Paket, das im
  Ausgabeverzeichnis liegt, und der CI-Runner startet leer. Der Vorgänger wird
  jetzt vor dem Packen geholt.
- Bleibt das Delta trotz vorhandenem Vorgänger aus, bricht der Release ab. Ohne
  diese Prüfung war der Fehler zwei Releases lang unsichtbar: es gab keine
  Fehlermeldung, nur ein Release ohne Delta-Datei.

## 0.93.0 (2026-08-26)

### Behoben

- Über der mitlaufenden Akt-Überschrift stand ein Streifen der vorigen Zeile.
- Die Symbole in den Schritten behalten ihr Seitenverhältnis. Sie waren auf ein
  Quadrat gezwungen, das Quest-Ausrufezeichen dadurch auf gut die doppelte
  Breite gezogen, Trial und Waypoint gestaucht.

### Geändert

- Himmelsrichtungen stehen ausgeschrieben: „Go west" statt „Go W".
- Die Akt-Überschrift ist größer und nicht mehr unterstrichen.

## 0.92.0 (2026-08-26)

### Geändert

- Updates laufen ohne Zutun. Geprüft und geladen wird beim Start, eingespielt
  beim Beenden, damit die App nicht mitten im Spiel neu startet. Der
  Install-Knopf entfällt.
- Das Overlay zeigt den nächsten Schritt statt des gerade erledigten
  Zonenwechsels. In 101 von 248 Abschnitten stand dort vorher nur der Übergang,
  den man eben gemacht hatte.
- Die Guide-Liste zeigt einen Trenner je Schritt statt je Zeile, ein Block ist
  damit genau das, wohin „Jump here" springt.

### Entfernt

- Das zweite, unbeschriftete Overlay am linken Bildschirmrand mit den
  Zonenbildern. Es zeigte seit dem Umbau auf Velopack nur noch leere Rahmen, und
  sein Zweck erschloss sich im Spiel nicht. Damit entfallen auch die 194
  Zonenbilder und der Schalter dafür in den Einstellungen.

### Behoben

- Zwei Symbole fehlten in der installierten Version. Dateien unter 4096 Byte
  landen als `data:`-URI im Bündel, und die Sicherheitsrichtlinie der Anwendung
  lässt für Bilder nur eigene Dateien zu. Betroffen waren genau die zwei Icons
  knapp unter dieser Grenze. Im Entwicklungslauf konnte das nie auffallen.

## 0.91.0 (2026-08-26)

Erste Ausgabe unter dem Namen PoE Leveling Guide, abgeleitet von
[Kazte/path-of-levelling](https://github.com/Kazte/path-of-levelling).

### Neu

- Overlay als eigenes Fenster. Es koppelt sich an das Spielfenster, folgt ihm
  und lässt sich in Position, Größe und Deckkraft einstellen.
- Fortschritt läuft automatisch mit, gelesen aus `Client.txt`. Der Pfad dorthin
  wird aus dem laufenden Spiel abgeleitet.
- Der Walkthrough kommt zur Laufzeit aus
  [HeartofPhos/exile-leveling](https://github.com/HeartofPhos/exile-leveling) und
  hält sich selbst aktuell. Ein Build muss nicht importiert werden.
- Autoupdate über Velopack, Installation pro Benutzer nach `%LocalAppData%` ohne
  Rechteabfrage.

### Behoben

- Der geerbte Updater zeigte auf die Releases des Ursprungsprojekts und trug
  dessen Signaturschlüssel. Ein eigenes Release wäre damit nie ausgeliefert
  worden, ein fremdes dagegen schon.
