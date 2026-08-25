# ADR-0007: Path-of-Building-Import vorerst ausgeklammert

Datum: 2026-08-25
Status: angenommen

## Kontext

Upstream kann buildabhängige Gem-Schritte erzeugen. Der Weg dorthin führt über einen
PoB-Code (Base64, zlib-inflate, XML), aus dem `findCharacterGems` und `buildGemSteps` die
Schritte ableiten. Ohne PoB-Code liefert `routeSelector` die Basisroute unverändert
zurück.

Anforderung: Der Guide soll buildunabhängig sein und alle Passivpunkte sowie den
Kampagnenabschluss abdecken. PoB ist ausdrücklich optional, ungetestet und nicht wichtig.

## Entscheidung

Die Route wird mit `requiredGems = []` erzeugt, also ohne Gem-Schritte. Das entspricht
exakt dem Referenz-Export mit `pob-code:none`.

`findCharacterGems` und `buildGemSteps` werden beim Vendoring mitkopiert, damit die
Modulgrenze steht. Der PoB-Decoder wird nicht gebaut.

## Alternativen

**PoB gleich mitbauen.** Verdoppelt den Umfang für einen ausdrücklich nachrangigen Nutzen.

**Gem-Code beim Vendoring weglassen.** Spart nichts Nennenswertes und macht das spätere
Nachrüsten teurer.

## Konsequenzen

* Der Overlay-Text enthält keine Gem-Erinnerungen.
* Der letzte Schritt der Route bleibt erhalten und prüft mit `/passives` die 23
  Quest-Passivpunkte, was die Anforderung direkt abdeckt.
* Nachrüsten später erfordert nur den Decoder plus zwei Einstellungen
  (Klasse, PoB-Code), nicht den Umbau der Pipeline.
