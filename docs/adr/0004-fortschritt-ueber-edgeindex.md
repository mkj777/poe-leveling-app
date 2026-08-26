# ADR-0004: Fortschritt über edgeIndex statt Area-Namensvergleich

Datum: 2026-08-25
Status: angenommen

## Kontext

Heute vergleicht `src/pages/main.page.tsx` den aus `Client.txt` gelesenen Zonennamen mit
`guide[currentStep].changeAreaId`. Zonen werden im Verlauf mehrfach betreten
(Lioneye's Watch, Submerged Passage, sämtliche Towns), der Vergleich ist also nicht
eindeutig.

`parseRoute` liefert bereits `route.edges: areaId[]` und setzt an jedem Schritt, der die
Zone wechselt, ein `edgeIndex`. Upstream nutzt das in `web/src/state/route.ts`
(`activeEdgeAtom`).

## Entscheidung

Der Fortschritt wird als `currentEdge: number` gehalten. Vorlauf nur, wenn die geloggte
Zone der nächsten Kante entspricht:

```ts
const m = /Generating level \d+ area "(.*?)"/.exec(logLine);
if (m && m[1] === route.edges[currentEdge + 1]) currentEdge++;
```

Nach einem Daten-Refresh mitten im Durchlauf wird nicht auf 0 zurückgesetzt. Findet sich
keine passende Kante, bleibt der bisherige Index bestehen und der Nutzer wird einmal
informiert.

**Korrektur vom 2026-08-26.** Ursprünglich stand hier „der höchste Index, dessen `areaId`
der zuletzt bekannten Zone entspricht". Das war falsch. 46 der 149 Zonen der Route werden
mehrfach betreten, The Forest Encampment etwa auf den Kanten 135, 137, 145, 150 und 156.
`lastIndexOf` lieferte immer 156, und weil `useRouteSync` bei **jedem** Start wieder
anknüpfte, sprang das Hauptfenster nach einem Neustart um bis zu 21 Kanten nach vorn. Das
Overlay blieb richtig, weil es nicht durch `useRouteSync` läuft.

Der gespeicherte Index ist die genauere Angabe, die Zone nur der Notnagel. Zeigt der Index
noch auf dieselbe Zone, bleibt er unangetastet. Erst wenn das nicht mehr stimmt, sich also
die Route unter ihm verändert hat, wird gesucht, und dann nach dem **nächstgelegenen**
Vorkommen. Bei gleichem Abstand gewinnt das frühere: zu weit vorne zu stehen kostet einen
Blick, zu weit hinten lässt Schritte aus.

## Alternativen

**Beim Namensvergleich bleiben.** Kein Umbau, aber falsche Sprünge bei wiederholten Zonen
bleiben bestehen.

**Fortschritt auf den Array-Index der Schritte legen.** Bricht bei jedem Refresh, weil sich
Schrittzahlen verschieben.

## Konsequenzen

* Eindeutiger Vorlauf, auch bei Rückkehr in eine bereits besuchte Zone.
* Bestehender persistierter Fortschritt ist inkompatibel und wird beim Upgrade verworfen
  (Versionsbump im `guide.store`).
* Der Refresh mitten im Run wird überhaupt erst handhabbar.
