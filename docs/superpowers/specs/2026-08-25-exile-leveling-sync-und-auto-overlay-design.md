# Design: Exile-Leveling-Sync und automatisches Overlay-Placement

Datum: 2026-08-25
Status: zur Umsetzung freigegeben
Betrifft: `poe-leveling-app` (Tauri 1.5 + React 18 + Zustand)

## 1. Problem

Der Leveling-Guide kommt heute aus zwei eingefrorenen Quellen:

* `src/data/guides/*.guide.json`: von Hand aus der Exile-Leveling-Website exportierte Routen.
* `src/data/level-tracker-{areas,gems,quests}.ts`: 14 059 Zeilen kopierte Spieldaten.

Beides veraltet still. Upstream aktualisiert die Route vor allem in der Startphase einer
neuen Liga mehrfach innerhalb weniger Tage, danach sporadisch. Ohne Automatik muss jedes
Mal von Hand exportiert, eingefügt und die App neu gebaut werden.

Zweitens muss der Nutzer die Overlay-Position selbst setzen (`TestScreen`,
`settings.displayPosition`). Die Position wird absolut in Pixeln gespeichert und ist nach
jedem Verschieben des Spielfensters, jedem Auflösungswechsel und jedem Monitorwechsel falsch.

## 2. Ziel

1. Der Walkthrough stammt zur Laufzeit aus dem Upstream-Projekt und aktualisiert sich ohne
   App-Release und ohne Zutun des Nutzers.
2. Das Overlay positioniert sich selbst am Spielfenster und folgt ihm. Feinjustierung
   (Verschieben, Skalieren) bleibt möglich, ist aber optional und wird relativ gespeichert.

## 3. Nicht-Ziel

* Path-of-Building-Import und buildabhängige Gem-Schritte. Die Modulgrenze wird gezogen,
  der Decoder wird nicht gebaut. Siehe ADR-0007.
* Passive-Skill-Tree-Anzeige.
* Andere Betriebssysteme als Windows. Das Overlay nutzt Win32 direkt.
* Die Zonen-Layout-Bilder (`src-tauri/resources/zones/`) und das `layout-map`-Fenster.
  Bleiben unverändert.

## 4. Erkenntnisse aus der Voruntersuchung

### 4.1 Die Website ist nicht die Quelle

`https://heartofphos.github.io/exile-leveling/` liefert eine leere HTML-Hülle. Der gesamte
Inhalt wird clientseitig gerendert. Scraping im Wortsinn bräuchte einen Headless-Browser.

Die eigentliche Quelle liegt als Klartext im Repository
`github.com/HeartofPhos/exile-leveling`:

```
common/data/routes/act-1.txt ... act-10.txt     rund 28 KB, eigene DSL
common/data/json/areas.json                      53 KB
common/data/json/quests.json                    304 KB
common/data/json/gems.json                      196 KB
common/data/json/{characters,gem-colours,kill-waypoints,
                  awakened-gem-lookup,vaal-gem-lookup}.json
```

### 4.2 Änderungsfrequenz

Auswertung aller 100 Commits, die `common/data` berühren:

| Fenster | Commits | Anlass |
|---|---|---|
| 2023-08-15 bis 08-19 | 9 in 5 Tagen | Liga 3.22 Start, danach Route-Fixes und Wording |
| 2025-10-31 | 4 an einem Tag | Liga 3.27, Tree, Lab-Level, Ascend-Reihenfolge, Bandit |
| 2025-11-14 | 1 | Nachzügler zwei Wochen später |
| 2026-07-22 bis 07-24 | 2 in 2 Tagen | Campaign-Secrets, Allflame-Route |
| 2026-08-02 | 1 | 3.29 Gems, POB-Import |
| 2025-06-02, 2025-03-17, 2024-04-23 | je 1 | Einzelfix Monate nach Launch |

Muster: Burst über rund eine Woche nach Liga-Start, danach vereinzelte Fixes.
Der Parser (`common/src/route-processing/`) ändert sich dagegen fast nie.

Folgerung: Ein Check pro Tag deckt beide Fälle ab.

### 4.3 Der Export ist exakt reproduzierbar

`web/src/components/Navbar/index.tsx:55`:

```ts
const output = [...route.sections, `pob-code:${pobCode ?? "none"}`];
navigator.clipboard.writeText(JSON.stringify(output));
```

Erzeugt in `web/src/state/route.ts`:

```ts
routeState = initializeRouteState()
if (leagueStart) preprocessorDefinitions.add("LEAGUE_START")
if (library)     preprocessorDefinitions.add("LIBRARY")
bandit "Alira" -> preprocessorDefinitions.add("BANDIT_ALIRA")
route = parseRoute(getRouteFiles([act-1 ... act-10]), routeState)
if (requiredGems.length == 0) return baseRoute
```

Defaults aus `web/src/state/build-data.ts`:
`{ characterClass: "None", bandit: "Alira", leagueStart: true, library: true }`.

Gegenprobe am vorliegenden Referenz-Export: Act 2 tötet Kraityn und Oak, hilft aber
Alira (`BANDIT_ALIRA` bestätigt). Tidal Island und Hailrake vorhanden
(`LEAGUE_START` bestätigt). Kein einziger `gem_step` (`pob-code:none` bestätigt).

Damit ist die Ziel-Ausgabe eindeutig definiert und als Golden-File testbar.

### 4.4 Bestehende Fehler im Renderer

`src/utilities/guide.utilities.ts` bildet die Fragment-Typen unvollständig ab:

| Fund | Beleg | Wirkung |
|---|---|---|
| `dirIndex` läuft 0 bis 7 | `common/src/route-processing/fragment/index.ts:409`, `Math.floor(dir / 45)` | `dirIndex[]` in der App hat 7 Einträge, Index 7 ergibt `undefined`. Im Referenz-Export kommt `dirIndex: 7` 28-mal vor |
| `crafting` trägt `crafting_recipes[]` | Fragment-Typ | App rendert nur das Wort `crafting`, verwirft den Rezeptnamen |
| `reward_quest`, `reward_vendor`, `copy` fehlen | Fragment-Union | fallen in den Default-Zweig, Ausgabe `PART NOT FOUND` |
| `route.edges[]` und `step.edgeIndex` ignoriert | `common/src/route-processing/index.ts` | Fortschritt läuft über String-Vergleich statt Kantenindex |

### 4.5 Overlay-Vorbild

`awakened-poe-trade-extended` koppelt das Fenster über `electron-overlay-window` und
`uiohook-napi` an das Spiel (`main/src/windowing/`). Beides ist Electron-gebunden und
nicht nach Tauri portierbar. Übernommen wird nur das Modell:

* Fenster an das Spielfenster koppeln und dessen Bounds verfolgen
  (`GameWindow.ts`, `OverlayController.targetBounds`).
* Widget-Geometrie relativ zum Spiel-Rect rechnen
  (`GameWindow.uiSidebarWidth` skaliert mit `bounds.height`).
* Zwischen klickdurchlässig und interaktiv umschalten
  (`OverlayWindow.assertOverlayActive` / `assertGameActive`).

Harte Randbedingung, belegt in `docs/download.md:31` des Nachbar-Repos:

```
Windowed Fullscreen: unterstützt
Windowed:            unterstützt
Fullscreen:          nicht unterstützt
```

Exklusiv-Fullscreen lässt sich unter Windows nicht überzeichnen. `docs/issues.md:8`
nennt zusätzlich den Fall, dass ein GeForce-Experience-Profil PoE still auf Fullscreen
umstellt. Der Zustand wird erkannt und gemeldet.

## 5. Architektur

```
GitHub API
   |  conditional GET, If-None-Match
   v
 neue sha?  --nein-->  Ende
   |  ja
   v
raw.githubusercontent.com/<sha>/common/data/{routes,json}
   |  Rust, reqwest
   v
$APPDATA/com.poe-leveling-guide.dev/exile-leveling/<sha>/
   |
   v
vendored parseRoute(routeFiles, { LEAGUE_START, LIBRARY, BANDIT_ALIRA })
   |
   v
RouteData.Route { sections[], edges[] }
   |
   +--> Fragment-Renderer -----> Overlay-Text
   |
   +--> edges[] + Client.txt --> Fortschritt
```

### 5.1 Datenschicht, Rust

Neu: `src-tauri/src/data_sync.rs`

```rust
#[tauri::command] async fn check_upstream() -> Result<UpstreamStatus, String>;
#[tauri::command] async fn fetch_upstream(sha: String) -> Result<(), String>;
#[tauri::command] async fn read_cached() -> Result<CachedData, String>;

struct UpstreamStatus { changed: bool, sha: String }
struct CachedData { sha: String, routes: Vec<String>, json: HashMap<String, String> }
```

`check_upstream` fragt
`api.github.com/repos/HeartofPhos/exile-leveling/commits?path=common/data&per_page=1`
mit `If-None-Match` aus dem Manifest. Antwort 304 bedeutet unverändert und zählt nicht
gegen das Rate-Limit von 60 Anfragen pro Stunde. Kein Token nötig.

`fetch_upstream` lädt die 10 Route-Dateien und 8 JSON-Dateien von der gepinnten sha,
schreibt sie in ein temporäres Verzeichnis und benennt es erst danach um. Ein
abgebrochener Download kann den letzten guten Stand nicht beschädigen.

Cache-Layout:

```
$APPDATA/com.poe-leveling-guide.dev/exile-leveling/
  manifest.json      { sha, etag, fetchedAt }
  <sha>/routes/act-1.txt ... act-10.txt
  <sha>/json/areas.json ...
```

Abhängigkeit: `reqwest` mit `rustls-tls`, nicht mit `openssl`.

Fallback-Kette: Cache, dann mitgelieferter Build-Snapshot, nie leer.

Takt: einmal beim Start, danach alle 24 Stunden Laufzeit.

### 5.2 Parser, vendored

Neu: `src/lib/exile-leveling/`, kopiert aus `common/src/` des Upstream-Projekts:

```
route-processing/index.ts
route-processing/patterns.ts
route-processing/scoped-logger.ts
route-processing/fragment/index.ts
route-processing/fragment/language.ts
route-processing/gems.ts
types.d.ts
data.ts          <- einziger Eingriff
ATTRIBUTION.md   <- MIT, HeartofPhos/exile-leveling, sha des Kopierstands
```

`data.ts` importiert im Original statisch:

```ts
import AREAS_JSON from "../data/json/areas.json" with { type: "json" };
```

Ersetzt durch einen Loader, der `read_cached()` verwendet und `Data` erst nach dem
ersten Sync bereitstellt. Alle anderen Dateien bleiben unverändert, damit ein
Upstream-Diff sauber anwendbar bleibt.

Ein Watcher in CI diffed `common/src/route-processing/` gegen den vendored Stand und
öffnet bei Abweichung einen PR.

### 5.3 Overlay, Rust

Neu: `src-tauri/src/overlay.rs`

```rust
EnumWindows -> HWND mit Titel "Path of Exile"
SetWinEventHook(EVENT_OBJECT_LOCATIONCHANGE | EVENT_SYSTEM_FOREGROUND)
GetWindowRect, GetWindowLong(GWL_STYLE) -> Fullscreen-Verdacht
emit("poe-bounds", PoeBounds)

struct PoeBounds { x: i32, y: i32, w: i32, h: i32,
                   focused: bool, exclusive_fullscreen: bool }
```

Ereignis-Hook statt Timer: keine Sekundenschleife, sofortige Reaktion auf Verschieben,
Resize und Fokuswechsel.

Der vorhandene `check_poe_window` (Polling über `EnumWindows`) entfällt zugunsten des Hooks.
`open_poe_window` bleibt.

### 5.4 Overlay, Frontend

Neu: `src/hooks/usePoeWindow.ts`. Hört auf `poe-bounds` und rechnet die Geometrie.

Anker: horizontal zentriert, vertikal am unteren Rand, mit Abstand über der HUD-Zeile.

```ts
const ANCHOR = { x: 0.5, y: 1.0 };          // Mitte unten
const BOTTOM_MARGIN = 0.16;                 // Anteil der Spielhöhe über der HUD-Zeile
const BASE_WIDTH = 0.26;                    // Anteil der Spielbreite
const WIDTH_CLAMP = { min: 320, max: 560 };

width  = clamp(b.w * BASE_WIDTH * scale, WIDTH_CLAMP.min, WIDTH_CLAMP.max)
x      = b.x + b.w * (ANCHOR.x + offset.dx) - width / 2
y      = b.y + b.h * (ANCHOR.y - BOTTOM_MARGIN + offset.dy) - height
```

`offset` ist ein Bruchteil des Spiel-Rects, kein Pixelwert. Dadurch bleibt die
Feinjustierung nach Auflösungs- und Monitorwechsel gültig.

`scale` skaliert Fensterbreite und Schriftgröße gemeinsam, umgesetzt über die
CSS-Wurzelgröße:

```ts
document.documentElement.style.fontSize = `${16 * scale}px`;
```

Die vorhandene dynamische Höhenanpassung (`main.page.tsx`, `adjustWindow`) rechnet
weiterhin die Texthöhe des aktuellen Schritts aus, jetzt bottom-aligned. Die Einstellung
`growDirection` entfällt, weil der untere Rand fix ist und das Fenster immer nach oben wächst.

Fenster-Eigenschaften im Betrieb: `alwaysOnTop`, `skipTaskbar`, `ignoreCursorEvents`,
versteckt wenn `focused === false`.

### 5.5 Edit-Modus

Das Overlay ist klickdurchlässig, also brauchen Verschieben und Skalieren einen
umschaltbaren Zustand.

* Hotkey `CmdOrCtrl+Shift+Alt+O` schaltet um.
* Beim Einschalten: `setIgnoreCursorEvents(false)`, Hintergrund wird sichtbar abgedunkelt,
  ein Ziehgriff (`data-tauri-drag-region`) und die Regler erscheinen.
* Regler: Skalierung in Schritten von 0.1 im Bereich 0.6 bis 2.0, plus Zurücksetzen
  auf `scale = 1`, `offset = { dx: 0, dy: 0 }`.
* Ziehen schreibt den Offset zurück, umgerechnet in Bruchteile des Spiel-Rects.
* Beim Ausschalten: `setIgnoreCursorEvents(true)`, Regler weg.

Persistiert in `settings.store`:

```ts
overlayScale: number          // default 1
overlayOffset: { dx, dy }     // default { 0, 0 }, Bruchteile des Spiel-Rects
```

### 5.6 Fortschritt

Übernommen aus `web/src/state/route.ts`, `activeEdgeAtom`:

```ts
const m = /Generating level \d+ area "(.*?)"/.exec(logLine);
if (m && m[1] === route.edges[currentEdge + 1]) currentEdge++;
```

Ersetzt den heutigen Vergleich gegen `guide[currentStep].changeAreaId`. Der Kantenindex
ist eindeutig, auch wenn dieselbe Zone mehrfach betreten wird.

Nach einem Daten-Refresh mitten im Durchlauf wird nicht auf 0 zurückgesetzt. Stattdessen
wird die zuletzt bekannte `areaId` in den neuen `edges` gesucht und der höchste passende
Index übernommen. Findet sich keiner, bleibt der bisherige Index bestehen und der Nutzer
wird einmal darauf hingewiesen.

### 5.7 Client.txt

Der Pfad wird aus dem gefundenen Spielprozess abgeleitet, da das HWND ohnehin vorliegt:

```
GetWindowThreadProcessId -> QueryFullProcessImageNameW -> <dir>/logs/Client.txt
```

Die manuelle Auswahl bleibt als Rückfallebene erhalten, falls die Ableitung scheitert.

## 6. Was entfällt

| Weg | Grund |
|---|---|
| `src/data/level-tracker-{areas,gems,quests}.ts` | 14 059 Zeilen eingefrorene Kopie, ersetzt durch Laufzeit-Cache |
| `src/data/guides/*.guide.json` | von Hand exportierte Routen, ersetzt |
| `src/interfaces/guide-import.interface.ts` | Import-Format entfällt |
| `src/utilities/guide.schema.ts` | validierte nur den Import |
| `setNewGuide(guideText)`, Import-UI in `navbar.tsx` | Anforderung: nicht mehr importieren |
| `src/components/test-screen.tsx` | manuelles Platzieren entfällt |
| `settings.displayPosition`, `settings.growDirection` | ersetzt durch Anker plus relativen Offset |

## 7. Fehlerfälle

| Fall | Verhalten |
|---|---|
| Kein Netz beim Start | letzter Cache, sonst Build-Snapshot, stiller Retry beim nächsten Takt |
| GitHub antwortet 403, Rate-Limit | Check überspringen, nächster Takt in 24 h, Hinweis nur im Log |
| Download bricht ab | temporäres Verzeichnis verwerfen, alter Stand bleibt aktiv |
| Vendored Parser wirft auf neuer DSL | letzten erfolgreich geparsten Stand behalten, Nutzer sichtbar warnen, sha der defekten Fassung nennen |
| PoE nicht gestartet | Overlay versteckt, Hauptfenster zeigt Wartezustand |
| PoE in Exklusiv-Fullscreen | einmalige Meldung im Hauptfenster mit Hinweis auf Windowed Fullscreen |
| PoE mit Adminrechten gestartet | Hook liefert keine Ereignisse, Meldung analog Nachbar-Repo |

## 8. Tests

* **Golden-File**: `parseRoute` gegen den gepinnten Upstream-Stand `b7b2dd0`, Ergebnis als
  `[...sections, "pob-code:none"]` serialisiert, `deepEqual` gegen den Referenz-Export.
  Schlägt der Test nach einem Upstream-Update fehl, unterscheidet der Diff zwischen
  Datendrift (Fixture neu ziehen) und Parserdrift (echter Fix).
* **Renderer**: Tabellentest über die vollständige `Fragments.AnyFragment`-Union.
  Kein Zweig darf `PART NOT FOUND` erzeugen. Deckt `dirIndex: 7`, `crafting_recipes`,
  `reward_quest`, `reward_vendor`, `copy` ab.
* **Sync**: 304-Pfad, 200-Pfad, abgebrochener Download, Offline-Start, beschädigtes Manifest.
* **Overlay-Geometrie**: die Umrechnung von `PoeBounds` plus `scale` plus `offset` nach
  Fensterposition ist eine reine Funktion und wird direkt getestet, inklusive
  Auflösungswechsel und negativem Offset.
* **Fortschritt**: Kantenvorlauf bei wiederholten Zonen, Wiederanknüpfung nach Refresh.

## 9. Reihenfolge der Umsetzung

1. Parser vendoren, `data.ts` auf Loader umstellen, Golden-File-Test grün gegen einen
   lokal abgelegten Snapshot. Noch kein Netz.
2. `data_sync.rs` mit Cache, Manifest und Fallback-Kette. Golden-File-Test jetzt gegen
   den gefetchten Stand.
3. Fragment-Renderer neu schreiben, Tabellentest grün.
4. Fortschritt auf `edgeIndex` umstellen.
5. `overlay.rs` mit Hook und `poe-bounds`.
6. `usePoeWindow` plus Anker-Geometrie, altes Positionieren entfernen.
7. Edit-Modus mit Skalierung und Offset.
8. Client.txt-Ableitung.
9. Aufräumen: alte Datendateien, Import-UI, `TestScreen` entfernen.
10. CI-Watcher für Parser-Drift.

## 10. Offene Punkte

Keine. Alle Entscheidungen sind in den ADRs unter `docs/adr/` festgehalten.
