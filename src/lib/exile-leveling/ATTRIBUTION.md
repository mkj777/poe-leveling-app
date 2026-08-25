# Attribution

Die Dateien in `route-processing/` und `types.d.ts` stammen aus
https://github.com/HeartofPhos/exile-leveling (Lizenz MIT).

Kopierstand: `b7b2dd0ed62ae25cf55c74085fa64a1f4d7cf4ba`

Aenderungen gegenueber dem Original:

1. `.js`-Endungen relativer Importe entfernt, damit die Aufloesung unter
   `moduleResolution: bundler` funktioniert.
2. Ein Kommentarkopf, der auf Herkunft und Generator hinweist.

Der Code besteht die strikte Typpruefung dieses Projekts unveraendert,
es ist kein `@ts-nocheck` noetig.

Erzeugt von `scripts/vendor-exile-leveling.mjs`, nicht von Hand bearbeiten.

`data.ts`, `index.ts` und `build-route.ts` in diesem Verzeichnis sind eigener Code.
