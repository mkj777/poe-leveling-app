# ADR-0006: Anker plus relativer Offset und Skalierung statt absoluter Position

Datum: 2026-08-25
Status: angenommen

## Kontext

`settings.displayPosition` speichert absolute Bildschirmpixel, gesetzt über den
`TestScreen`. Nach Verschieben des Spielfensters, Auflösungs- oder Monitorwechsel steht
das Overlay falsch. Zusätzlich existiert `growDirection` (`up`/`down`), weil der
Bezugspunkt nicht definiert ist.

Gewünscht ist automatische Platzierung, mittig unten, mit optionaler Feinjustierung und
Skalierung.

## Entscheidung

Die Geometrie wird aus dem Spiel-Rect gerechnet:

```
ANCHOR        = { x: 0.5, y: 1.0 }   // horizontal mittig, vertikal unten
BOTTOM_MARGIN = 0.16                 // Abstand über der HUD-Zeile
BASE_WIDTH    = 0.26                 // Anteil der Spielbreite
```

`overlayOffset` wird als Bruchteil des Spiel-Rects gespeichert, nicht in Pixeln.
`overlayScale` (0.6 bis 2.0) skaliert Fensterbreite und Schriftgröße gemeinsam über die
CSS-Wurzelgröße.

Weil das Overlay klickdurchlässig ist, gibt es einen Edit-Modus: Hotkey schaltet
`ignoreCursorEvents` aus, Ziehgriff und Skalenregler erscheinen, Bestätigen schaltet
zurück. Muster übernommen von `OverlayWindow.assertOverlayActive` / `assertGameActive`.

`TestScreen`, `displayPosition` und `growDirection` entfallen.

## Alternativen

**Fester Anker ohne jede Justierung.** Weniger Code, aber die HUD-Belegung unterscheidet
sich je nach Auflösung und Seitenverhältnis.

**3x3-Wahlraster in den Einstellungen.** Mehr UI, löst das Feinjustierungsproblem aber
nur grob und braucht trotzdem eine Skalierung.

## Konsequenzen

* Die Justierung überlebt Auflösungs- und Monitorwechsel.
* Mitte unten kollidiert mit Flask- und Skillbar. `BOTTOM_MARGIN` setzt die Unterkante
  darüber, der Offset korrigiert den Rest.
* Der Anker ist eine Konstante in `src/utilities/constants.ts` und ohne UI änderbar.
* Das Fenster wächst immer nach oben, weil die Unterkante fix ist. Deshalb entfällt
  `growDirection`.
