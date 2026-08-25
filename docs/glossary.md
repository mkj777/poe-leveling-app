# Glossar

Begriffe aus dem Zusammenspiel von `poe-leveling-app` und dem Upstream-Projekt
[HeartofPhos/exile-leveling](https://github.com/HeartofPhos/exile-leveling) (MIT).
Kanonische Definitionen stehen dort in `common/src/types.d.ts`.

## Daten und Route

**Route-DSL**
Das Textformat der Walkthrough-Quelldateien `common/data/routes/act-1.txt` bis
`act-10.txt`. Zeilenorientiert, mit Direktiven (`#section`, `#sub`, `#ifdef`) und
Fragmenten in geschweiften Klammern (`{enter|1_1_2}`).

**RouteFile**
Ein Abschnitt der DSL, zerlegt an `#section`. `{ name, contents }`. Erzeugt von
`getRouteFiles(routeSources)`. Die zehn Act-Dateien ergeben zehn RouteFiles.

**Route**
Das geparste Ergebnis: `{ sections: Section[], edges: areaId[] }`. Erzeugt von
`parseRoute(routeFiles, routeState)`.

**Section**
Ein Act. `{ name: "Act 1", steps: Step[] }`.

**Step**
Entweder ein `FragmentStep` oder ein `GemStep`.

**FragmentStep**
Eine Zeile des Guides. `{ type: "fragment_step", parts: Fragment[], subSteps: FragmentStep[],
edgeIndex: number | null }`. Die `parts` mischen rohe Strings und typisierte Fragmente.

**GemStep**
Ein buildabhängiger Schritt "hole Gem X". Entsteht nur bei importiertem PoB-Code. In
diesem Projekt nicht erzeugt, siehe ADR-0007.

**Fragment**
Ein typisiertes Element innerhalb eines Schritts. Rund zwanzig Varianten, unter anderem
`enter`, `area`, `arena`, `kill`, `quest`, `quest_text`, `waypoint`, `waypoint_use`,
`waypoint_get`, `portal_set`, `portal_use`, `logout`, `trial`, `ascend`, `crafting`,
`dir`, `generic`, `reward_quest`, `reward_vendor`, `copy`.

**SubStep**
Ein eingerückter Hinweis unter einem Schritt, in der DSL mit `#sub` markiert. Enthält
Richtungs- und Layouttipps.

## Zonenwechsel und Fortschritt

**Area ID**
Der interne Zonenbezeichner von Path of Exile, etwa `1_1_2` (The Coast) oder `1_1_town`
(Lioneye's Watch). Wird in `common/data/json/areas.json` aufgelöst.

**Edge**
Ein Zonenwechsel entlang der Route. `route.edges` ist die geordnete Liste der Area IDs,
die der Spieler nacheinander betritt.

**edgeIndex**
Der Index in `route.edges`, den ein FragmentStep auslöst. `null`, wenn der Schritt keinen
Zonenwechsel bedeutet (zum Beispiel eine Quest-Abgabe).

**currentEdge**
Der Fortschrittszeiger dieser App. Läuft vor, wenn die aus `Client.txt` gelesene Zone
`route.edges[currentEdge + 1]` entspricht. Siehe ADR-0004.

**Client.txt**
Das Logfile des Spiels unter `<PoE-Verzeichnis>/logs/Client.txt`. Enthält bei jedem
Zonenwechsel eine Zeile `Generating level N area "<areaId>"`.

## Routenvarianten

**Präprozessor-Definition**
Ein Schalter, der `#ifdef`- und `#ifndef`-Blöcke der DSL ein- oder ausblendet. Gesetzt in
`RouteState.preprocessorDefinitions`.

**LEAGUE_START**
Variante für den Ligastart ohne vorhandene Ausrüstung. Aktiviert unter anderem den
Umweg über Tidal Island und Hailrake. In diesem Projekt fest aktiv.

**LIBRARY**
Aktiviert den Umweg über die Bibliothek in Act 3 zum Kauf von Skill-Gems.
In diesem Projekt fest aktiv.

**BANDIT_ALIRA, BANDIT_OAK, BANDIT_KRAITYN, BANDIT_KILL**
Vier sich ausschließende Varianten der Banditenquest in Act 2. In diesem Projekt fest
`BANDIT_ALIRA`, entsprechend dem Upstream-Default.

**PoB-Code**
Ein Path-of-Building-Export: Base64, zlib-komprimiert, darin XML. Quelle der
buildabhängigen Gem-Schritte. Nicht implementiert, siehe ADR-0007.

**Referenz-Export**
Die von der Website erzeugte JSON-Ausgabe `[...route.sections, "pob-code:none"]`. Dient
in diesem Projekt als Golden File für den Parser-Test.

## Overlay

**PoE-Bounds**
Position, Größe und Fokuszustand des Spielfensters, ermittelt in `src-tauri/src/overlay.rs`
und per Event `poe-bounds` an das Frontend gesendet.

**Anker**
Der relative Bezugspunkt des Overlays im Spiel-Rect. Hier `{ x: 0.5, y: 1.0 }`, also
horizontal mittig und vertikal am unteren Rand.

**BOTTOM_MARGIN**
Abstand der Overlay-Unterkante zur Unterkante des Spielfensters, als Anteil der
Spielhöhe. Hält das Overlay über Flask- und Skillbar frei.

**Offset**
Die vom Nutzer gesetzte Feinverschiebung, gespeichert als Bruchteil des Spiel-Rects
(`{ dx, dy }`), nicht in Pixeln. Überlebt dadurch Auflösungs- und Monitorwechsel.

**Scale**
Gemeinsamer Skalierungsfaktor für Fensterbreite und Schriftgröße, Bereich 0.6 bis 2.0.
Umgesetzt über die CSS-Wurzelgröße.

**Edit-Modus**
Zustand, in dem das Overlay nicht klickdurchlässig ist und Ziehgriff sowie Skalenregler
zeigt. Per Hotkey umschaltbar. Entspricht `assertOverlayActive` / `assertGameActive` im
Vorbildprojekt `awakened-poe-trade-extended`.

**Klickdurchlässig**
Fensterzustand `setIgnoreCursorEvents(true)`: Mausereignisse gehen durch das Overlay
hindurch an das Spiel.

**Windowed Fullscreen**
Der einzige Vollbildmodus, über dem sich unter Windows ein Overlay zeichnen lässt.
Exklusiv-Fullscreen funktioniert nicht, siehe ADR-0005.

## Synchronisation

**Snapshot**
Ein vollständiger, auf eine Commit-sha gepinnter Satz aus zehn Route-Dateien und acht
JSON-Dateien im lokalen Cache.

**sha**
Der Upstream-Commit, aus dem der aktuelle Snapshot stammt. Teil des Cache-Pfads, damit
Stände nebeneinander liegen können und ein abgebrochener Download den guten Stand nicht
beschädigt.

**Manifest**
`manifest.json` im Cache-Verzeichnis. Hält `sha`, `etag` und `fetchedAt`.

**Conditional GET**
Anfrage mit `If-None-Match: <etag>`. Antwort 304 bedeutet unverändert, kostet kein
Rate-Limit-Kontingent und keinen Body.

**Build-Snapshot**
Ein zum Buildzeitpunkt mitgelieferter Datensatz. Letzte Rückfallebene, falls weder Netz
noch Cache verfügbar sind.

**Parser-Drift**
Der Fall, dass Upstream die DSL-Grammatik oder den Parser ändert und der vendored Stand
nicht mehr passt. Wird vom CI-Watcher und vom Golden-File-Test sichtbar gemacht.

**Datendrift**
Der erwartete Normalfall: Upstream ändert nur Routeninhalte oder Spieldaten. Wird zur
Laufzeit automatisch übernommen und erfordert nur ein Neuziehen des Golden-File-Fixtures.
