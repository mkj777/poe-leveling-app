# ADR-0002: Upstream-Parser vendoren statt nachbauen

Datum: 2026-08-25
Status: angenommen

## Kontext

Die Route-DSL kennt Präprozessor-Direktiven (`#ifdef`, `#ifndef`, `#endif`), Substeps
(`#sub`), Sektionen (`#section`) und rund zwanzig Fragment-Typen (`{enter|id}`,
`{waypoint|id}`, `{quest|id}`, `{dir|270}` und weitere). Der Parser liegt in
`common/src/route-processing/` und umfasst rund 13 KB TypeScript.

Historie: Der Parser wurde in 100 datenberührenden Commits nur selten angefasst, die
Daten dagegen regelmäßig. Lizenz des Upstream-Repos: MIT.

## Entscheidung

Der Parser wird unverändert nach `src/lib/exile-leveling/` kopiert, inklusive
`ATTRIBUTION.md` mit Lizenztext und der sha des Kopierstands. Einzige Änderung ist
`data.ts`: statische JSON-Imports werden durch einen Loader auf den Laufzeit-Cache ersetzt.

Ein CI-Job diffed wöchentlich `common/src/route-processing/` gegen den vendored Stand und
öffnet bei Abweichung einen Pull Request.

## Alternativen

**Eigenen Parser schreiben.** Gleiche Datenaktualität, aber doppelte Logik und höhere
Driftgefahr ohne Gegenwert.

**Upstream als npm-Abhängigkeit.** `common` ist ein workspace-internes Paket ohne
Registry-Veröffentlichung.

## Konsequenzen

* Die App erzeugt bitgleiche Ergebnisse wie die Website. Siehe Golden-File-Test in der Spec.
* Alle Dateien außer `data.ts` bleiben unverändert, damit ein Upstream-Diff sauber
  anwendbar bleibt.
* Eine Grammatikänderung bricht den Parser. Abgefedert durch Golden-File-Test,
  CI-Watcher und Beibehalten des letzten erfolgreich geparsten Stands.
