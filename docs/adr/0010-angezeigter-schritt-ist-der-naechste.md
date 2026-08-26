# ADR-0010: Angezeigt wird der nächste Schritt, nicht der erreichte Übergang

Datum: 2026-08-26
Status: angenommen

## Kontext

Der Fortschritt läuft über `currentEdge` (ADR-0004). Der Parser vergibt den `edgeIndex`
aber mit der **Ziel**zone, nicht der Startzone (`route-processing/index.ts:213`):

```
EDGE 1 area=1_1_town  ["➞ ", enter 1_1_town]
EDGE 2 area=1_1_2     ["➞ ", enter 1_1_2]
```

`advanceEdge` springt auf Kante N, sobald `Client.txt` die Zone `edges[N]` meldet. In
diesem Moment ist der Kopfschritt von Segment N bereits ausgeführt: er ist der Übergang,
der einen gerade dorthin gebracht hat.

Das Overlay zeigte trotzdem den Kopfschritt zuerst und am größten. In der echten Route
sind 247 von 248 Kopfschritten Übergänge (`enter`, `waypoint_use`, `logout`, `portal_use`,
`ascend`), und 101 von 248 Segmenten bestehen **nur** aus dem Kopfschritt. Beim Betreten
einer solchen Zone stand dort also genau eine Zeile: der Übergang, den man eben gemacht
hatte.

## Entscheidung

`selectPending` ersetzt `selectSegment` im Overlay. Der Kopfschritt fällt weg. Übrig
bleibt der Rest der Zone, gefolgt vom nächsten Übergang als tatsächlich nächster Aktion.
Ist die Route zu Ende, bleibt der erreichte Schritt stehen, statt die Karte zu leeren.

Die Listenansicht im Hauptfenster rendert `groupSteps`: einen Block je Kante statt einer
Zeile je Schritt. Der Trenner fällt damit dorthin, wo wirklich ein Schritt endet, und ein
Block ist genau das, wohin „Jump here“ springt. Vorher trug jede Zeile einen Trenner, und
es war nicht zu sehen, welcher Text noch zum selben Schritt gehört. Hervorgehoben wird der
ganze Block; dort ist der Übergang eine Überschrift und liest sich als „hier bist du“,
allein markiert las er sich als nächste Aufgabe.

Die Akt-Überschrift bekommt `z-20`. Sie war zwar `sticky`, aber die Blöcke sind relativ
positioniert und die Sprung-Schaltflächen trugen `z-50`, beide malten also über sie. Beim
Scrollen lief der Text mitten durch die Überschrift.

## Alternativen

**`advanceEdge` um eins vorlaufen lassen.** Verschiebt den Fehler nur: die Aufgaben der
betretenen Zone würden übersprungen.

**Den Parser die Startzone eintragen lassen.** Er ist vendored (ADR-0002), eine Abweichung
müsste bei jedem Upstream-Nachzug neu aufgelöst werden.

## Konsequenzen

* Die oberste, große Zeile im Overlay ist immer etwas, das noch zu tun ist.
* Das Overlay zeigt den nächsten Zonenwechsel mit an, statt ihn erst nach dem Betreten
  einzublenden.
* `selectSegment` entfällt. `selectPending` trägt das Overlay, `groupSteps` die Liste.
