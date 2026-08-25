# ADR-0001: Walkthrough zur Laufzeit aus dem Upstream-Repository holen

Datum: 2026-08-25
Status: angenommen

## Kontext

Der Guide soll aktuell bleiben, ohne dass jemand von Hand nachzieht. Der Ausgangswunsch
lautete, die Website `heartofphos.github.io/exile-leveling` zu scrapen.

Die Website liefert jedoch nur eine leere HTML-Hülle, der Inhalt entsteht clientseitig.
Die eigentliche Quelle liegt als Klartext im Repository: `common/data/routes/act-1..10.txt`
und `common/data/json/*.json`, zusammen rund 580 KB, davon 28 KB Route-DSL.

Änderungsmuster aus 100 Commits: ein Burst von bis zu 9 Commits in 5 Tagen nach
Liga-Start, danach vereinzelte Fixes über Monate.

## Entscheidung

Die App holt zur Laufzeit die Rohdateien von `raw.githubusercontent.com`, gepinnt auf eine
konkrete Commit-sha. Vorgeschaltet ist ein Conditional GET gegen
`api.github.com/repos/HeartofPhos/exile-leveling/commits?path=common/data&per_page=1`
mit `If-None-Match`, einmal beim Start und danach alle 24 Stunden.

## Alternativen

**Headless-Browser gegen die Website.** Wäre robust auch gegen DSL-Änderungen, weil der
deployte Upstream-Code parst. Kostet aber ein Chromium-Binary von rund 150 MB, kann keinen
billigen Tages-Diff, funktioniert nicht offline und bricht bei jedem DOM- oder
Bundle-Redesign.

**Git-Submodul plus CI-Bump.** Einfachste Laufzeit, aber jede Upstream-Änderung braucht
einen neuen App-Release. Verfehlt das Ziel.

## Konsequenzen

* Datenaktualisierung ohne Release, auch mitten in der Liga.
* Die sha im Cache-Pfad macht den gefahrenen Stand sichtbar und rollbackfähig.
* Netzabhängigkeit beim Erstlauf. Abgefedert durch mitgelieferten Build-Snapshot.
* Die DSL-Grammatik bleibt eine Kopplung an Upstream. Siehe ADR-0002.
