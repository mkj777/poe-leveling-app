# ADR-0011: Zwei Lesarten der Route, Ligastart und Speedleveling

Datum: 2026-08-29
Status: angenommen

## Kontext

Der Guide zeigte bisher genau eine Route: die Vorgabe der Website, mit
`LEAGUE_START`, `LIBRARY` und `BANDIT_ALIRA` (ADR-0007). Sie ist auf den ersten
Charakter einer Liga zugeschnitten und sammelt unterwegs alles ein.

Auf dem zweiten Charakter derselben Liga stimmt das nicht mehr. Craftingrezepte
und abgeschlossene Trials gelten dort schon, die Schritte dafür sind nur noch
Umweg. Gemessen an der Momentaufnahme `b7b2dd0`:

| | Anzahl | Form |
|---|---|---|
| Craftingschritte | 47 | 46x `Get {crafting}`, 1x gemischt |
| Trialschritte | 12 | 11x `Complete {trial}`, 1x gemischt |
| davon mit `edgeIndex` | **0** | keiner ist ein Zonenwechsel |

Die letzte Zeile trägt die ganze Entscheidung. Der Fortschritt hängt
ausschließlich am `edgeIndex` (ADR-0004), und kein einziger dieser 59 Schritte
trägt einen. Sie lassen sich also entfernen, ohne dass Overlay, „Jump here“ oder
das Wiederanknüpfen nach einem Neustart davon etwas merken.

Die beiden gemischten Schritte sind die einzigen ihrer Art in der ganzen Route:

```
➞ {arena|Eternal Laboratory}, get {crafting}          Act 3
Before {waypoint}, complete {trial}                   Act 9
```

Beide sollen ganz weg. Das Laboratory betritt man ausschließlich für das Rezept,
und der Wegpunkt in Act 9 ist die Ortsangabe für den Trial, keine eigene Aufgabe.

Upstream hat mit `LEAGUE_START` bereits einen Schalter für diese Unterscheidung.
Er allein reicht aber nicht: er nimmt alle 12 Trials mit, jedoch nur 7 der 47
Craftingschritte. 40 blieben stehen, darunter der Fall aus Act 3, der in keinem
`#ifdef` steht.

## Entscheidung

Zwei Modi, in `src/utilities/guide-mode.ts`.

`league-start` ist der bisherige Ablauf, unverändert. `speedleveling` wirkt an
zwei Stellen:

1. **Preprocessor.** Ohne `LEAGUE_START` entfallen die Umwege, die es nur beim
   Ligastart gibt: Tidal Island mit Hailrake, The Den, die Catacombs, das Silver
   Locket, die Ossuary und die Suche nach der Chemist's Strongbox.
2. **Filter danach.** `filterRoute` entfernt, was der Preprocessor nicht
   abdeckt.

Ergebnis: 488 Schritte auf 248 Kanten werden zu 409 auf 236.

Die Filterregel ist bewusst zurückhaltend. Ein Schritt fällt nur weg, wenn

* er Crafting oder Trial enthält, **und**
* er keinen `edgeIndex` trägt, **und**
* außer Crafting und Trial nur noch Ortsverweise übrig blieben
  (`area`, `arena`, `waypoint`, `dir`, `copy`).

Ein künftiges „Kill X, get Crafting“ bliebe damit stehen, mitsamt dem Rezept.
Lieber eine Zeile zu viel als ein übersehener Boss. Die dritte Bedingung ist
genau das, was die beiden gemischten Schritte fallen lässt, ohne eine Ausnahme
je Textstelle zu pflegen.

Der Modus wird nach elf Tagen ohne Start erfragt. Eine Liga läuft rund 13
Wochen, wer so lange nicht hereingesehen hat, fängt fast immer neu an. Beide
Antworten setzen den Fortschritt auf Akt 1 zurück, eine dritte lässt alles wie es
ist. Beim allerersten Start wird nicht gefragt: es gibt weder Fortschritt noch
einen Modus, von dem man abweichen könnte.

Die Labyrinthschritte bleiben in beiden Modi. Ascendancy-Punkte gelten je
Charakter, nicht je Account, und die drei Schritte tragen außerdem eine Kante.

## Alternativen

**Nur `LEAGUE_START` ausschalten.** Ließe 40 Craftingschritte stehen, darunter
den Fall aus Act 3.

**Nur filtern, `LEAGUE_START` anlassen.** Ließe die Ligastart-Umwege stehen, die
auf dem zweiten Charakter genauso wenig zu suchen haben.

**Einzelne Fragmente aus gemischten Schritten schneiden.** Ergäbe Bruchstücke wie
„➞ Eternal Laboratory, get “. Ein Schritt fällt ganz oder gar nicht.

**Nach dem Icon filtern.** Das Icon ist eine Funktion des Fragmenttyps, der Typ
ist die genauere Angabe. Über das Icon liefe außerdem `ascend` mit ins Netz, das
sich denselben Trial-Anhänger teilt.

## Konsequenzen

* Die Kantenliste ist je Modus unterschiedlich lang, 248 gegen 236. Ein
  gespeicherter Index bedeutet also je nach Modus etwas anderes. `reanchorEdge`
  fängt das ab, indem es die zuletzt betretene Zone in der neuen Liste sucht.
* Vier Zonen gibt es nur im Ligastart. Wer beim Wechsel gerade dort steht, findet
  keine passende Kante. `reanchorEdge` klemmt darum auf die neue Länge. Ohne das
  wäre der Index ins Leere gelaufen und das Overlay leer geblieben, ohne
  Fehlermeldung. Die Ossuary liegt auf Kante 233, Speedleveling hat 236: drei
  Kanten Abstand, die der Upstream jederzeit aufbrauchen kann.
* Das Overlay parst seine Route selbst und erfährt den Modus als
  `guide-mode-changed`, zusammen mit der aktuellen Kante.
* Ein Test hält die vier Formen fest, in denen Crafting und Trial heute
  vorkommen. Taucht eine fünfte auf, hat der Upstream etwas Neues gebaut, und die
  Regel gehört angesehen, bevor sie darüber läuft.
