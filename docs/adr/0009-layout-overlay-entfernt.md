# ADR-0009: Layout-Overlay entfernt, Bilder kommen nur noch aus dem Bundle

Datum: 2026-08-26
Status: angenommen

## Kontext

Neben dem Schritt-Overlay lief ein zweites Fenster mit der Bezeichnung `layoutmap`. Es
klebte am linken Bildschirmrand, war 141 × 77 Pixel groß, trug keine Beschriftung und
zeigte Zonenbilder aus `src-tauri/resources/zones`. Die 194 PNG machten 7,3 MB der 7,6 MB
großen Programmpakete aus.

Im Release 0.91.0 zeigte es nur noch kaputte Bilder. Der Grund liegt im Umstieg auf
Velopack (ADR-0008): der MSI-Bundler ist weg, die Ressourcen legt das Release-Skript von
Hand neben das Kompilat, und `convertFileSrc` liefert sie über das Asset-Protokoll aus,
dessen Scope und CSP-Eintrag dabei nicht mehr trugen.

Wichtiger als der Fehler war die Rückmeldung dazu: „keine Ahnung was er macht“. Ein
Overlay, dessen Zweck sich im Spiel nicht erschließt, ist auch repariert wertlos.

Getrennt davon fehlten zwei Icons im Schritt-Overlay. Vite hängt Dateien unter
`assetsInlineLimit` (Standard 4096 Byte) als `data:`-URI ins Bundle. `quest.png` (3991 B)
und `town.png` (3944 B) lagen knapp darunter, die vier übrigen Icons knapp darüber. Die
CSP erlaubt für Bilder nur `self`, also blieben genau diese beiden leer. Im Dev-Server
fiel das nie auf, weil der jede Datei einzeln ausliefert.

## Entscheidung

Das `layoutmap`-Fenster entfällt vollständig: Seite, Route, Fenstererzeugung,
`showLayout`-Schalter, `tauri.utilities.ts`, der Capability-Eintrag, das Asset-Protokoll
samt Scope, das `fs`-Plugin auf beiden Seiten und die 194 PNG.

Für die verbliebenen Bilder gilt `assetsInlineLimit: 0`. Alle Assets werden als Datei
ausgeliefert, damit nicht eine Byte-Grenze darüber entscheidet, ob ein Bild ankommt. Die
CSP bleibt dafür so eng wie sie ist, `img-src` erlaubt nur `self`.

## Alternativen

**Das Asset-Protokoll reparieren und das Fenster behalten.** Hätte die Bilder
zurückgebracht, nicht aber die Frage, wozu das Fenster da ist.

**`data:` in der CSP erlauben.** Ein Wort statt einer Konfigurationszeile, weitet aber
die Richtlinie und lässt die Byte-Grenze als stille Bedingung bestehen.

**Layouts später in das Schritt-Overlay einbetten.** Bleibt möglich. Die Bilder sind über
`git checkout 47ebd2e -- src-tauri/resources/zones` zurückzuholen.

## Konsequenzen

* Ein Overlay-Fenster statt zwei, das verbliebene sitzt unten in der Mitte.
* Das Programmpaket schrumpft weniger als die 7,3 MB Rohgröße vermuten lässt, weil PNG
  sich im Paket nicht weiter komprimieren: `full.nupkg` von 7 320 873 auf 5 568 773 Byte,
  `Setup.exe` von 11 807 017 auf 10 054 917 Byte. Die Delta-Updates aus ADR-0008 werden
  dadurch nicht schlechter, sie waren ohnehin klein.
* Ein gespeicherter `showLayout`-Eintrag bleibt in den Einstellungen liegen. Die
  Store-Version bleibt bei 4, weil ein Hochzählen die Migration erneut auslösen und dabei
  Größe, Deckkraft und Verschiebung des Overlays zurücksetzen würde.
* `src/utilities/__tests__/asset-policy.test.ts` hält Inline-Grenze und CSP zusammen.
