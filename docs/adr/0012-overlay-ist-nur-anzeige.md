# ADR-0012: Das Overlay ist nur Anzeige

Datum: 2026-08-29
Status: angenommen

## Kontext

Das Overlay war formal ein zweites Fenster, faktisch eine zweite Anwendung. Es
parste die Route selbst aus dem Cache, hielt eigene Spieldaten, einen eigenen
Fortschritt und eigene Einstellungen, und alles davon speicherte es in dieselben
Einträge wie das Hauptfenster.

Zwei Fehler daraus, beide gemessen, beide stumm:

**Der Schritt war verschoben.** Mit den zwei Lesarten der Route (ADR-0011)
hielten die Fenster verschieden lange Kantenlisten, 248 gegen 236. Ausgetauscht
wurde nur der Index. Kante 172 ist im Speedleveling The Sarn Ramparts und im
Ligastart The Causeway. Wer im Hauptfenster dorthin sprang, las im Overlay
„Get Crafting: Cold Damage - Rank 2, Find and take Kishara's Star".

**Der Fortschritt sprang zurück.** `setCurrentEdge` schlägt die Zone in der
eigenen Route nach. Das Overlay legte zur gemeldeten Kante seine Zone ab, das
Hauptfenster meinte eine andere, und wer zuletzt schrieb, gewann. Beim nächsten
Start knüpfte die App an die falsche Zone an und stand zehn Kanten zurück. Der
Fehler überlebte damit den Neustart, der ihn hätte beheben sollen.

Dasselbe noch einmal bei den Einstellungen, nachgestellt in einem Test:

```
nach dem Ziehen : {"dx":0.3,"dy":0.2}
nach dem Regler : {"dx":0,"dy":0}
```

Overlay an die gewünschte Stelle ziehen, danach im Hauptfenster irgendeinen
Regler anfassen, und die Platzierung war weg.

Jedes Mal dieselbe Form: zwei Fenster mit eigener Meinung über denselben
Zustand. Jeder einzelne Fall ließ sich flicken, die Form blieb.

## Entscheidung

Das Overlay zeigt an und sonst nichts. Es hält keine Route, keine Spieldaten,
keinen Fortschritt und keinen Speicher.

Das Hauptfenster rechnet aus, was zu sehen ist, und schickt es als Daten:

```ts
export interface FragmentView {
  text: string;
  colour: FragmentColour;
  icon: IconName | null;
}

export interface OverlayView {
  act: string | null;
  stepsLeft: number;
  steps: { parts: FragmentView[]; subSteps: FragmentView[][] }[];
}
```

Damit ist nichts mehr abzuleiten und also nichts mehr, das auseinanderlaufen
könnte. Es gibt keinen Index ohne die Liste dazu, weil kein Index mehr über die
Fenstergrenze geht.

Symbole reisen als Name, nicht als Adresse: `/assets/quest-BQCG-isT.png` gehört
dem Build, nicht dem Inhalt. Das Fenster sucht sich das Bild selbst.

Drei Ereignisse tragen die Grenze:

| Ereignis | Richtung | Inhalt |
|---|---|---|
| `overlay-ready` | Overlay → Haupt | „ich horche" |
| `overlay-view` | Haupt → Overlay | was anzuzeigen ist |
| `overlay-placement` | Overlay → Haupt | gezogen oder skaliert |

Das dritte ist die Gegenrichtung: gezogen wird im Overlay, gespeichert im
Hauptfenster. Das Overlay setzt den Wert sofort lokal, damit das Fenster folgt,
und meldet ihn. Gespeichert wird nur an einer Stelle.

Die Stores prüfen dafür die Rolle des Fensters. Sie werden in beiden Fenstern
geladen, weil `App` in beiden rendert, und ohne die Prüfung schriebe das Overlay
weiter mit.

Dieselbe `FragmentView` malt auch die Liste im Hauptfenster. Eine Darstellung,
ein Bauplan, zwei Fenster.

## Alternativen

**Jeden Fall einzeln flicken.** Der Modus zu jeder Kante mitgeschickt, der
Speicher auf einen Schreiber begrenzt. Beides ist passiert (0.98.0 und 0.99.0)
und beides war richtig, aber es beseitigt die Form nicht: der nächste Zustand,
den beide Fenster halten, hat dasselbe Problem wieder.

**Das Overlay weiter selbst parsen lassen und nur besser synchronisieren.**
Hält zwei Ableitungen derselben Wahrheit am Leben. Jede Zusicherung dazu muss
man aufrechterhalten, statt sie nicht zu brauchen.

**Den Zustand ins Rust-Backend legen.** Eine dritte Instanz für etwas, das ins
Hauptfenster gehört. Rust hält, was die Außenwelt betrifft: Client.txt, Netz,
Cache, Fenstergeometrie, Updates.

## Konsequenzen

* Das Overlay ist ohne laufendes Hauptfenster leer. Das ist ehrlich: es gibt
  ohnehin nur, weil das Hauptfenster es anlegt.
* `loadRouteFromCache` entfällt, ebenso die Zustellung der Lesart ans Overlay
  und dessen Route-Store. Der Umbau entfernt unterm Strich Code.
* Bei jedem Zonenwechsel wird eine Anzeige gebaut und verschickt. Gemessen:
  0,01 ms je Kante, 0,097 ms für alle 488 Schritte der Liste.
* Ein Schritt geht als JSON über die Grenze. Ein Test hält fest, dass dabei
  nichts verloren geht.
