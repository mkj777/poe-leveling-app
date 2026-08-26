# ADR-0008: Autoupdate über Velopack statt über den Tauri-Updater

Datum: 2026-08-26
Status: angenommen

## Kontext

Der geerbte Stand zeigte auf das Upstream-Projekt: `plugins.updater.endpoints` verwies auf
Releases von `kazte/path-of-levelling`, und `pubkey` trug dessen Minisign-Schlüssel. Ein
eigenes Release wäre damit nie ausgeliefert worden, ein fremdes dagegen schon. Der
Updater musste also ohnehin angefasst werden.

Ausgeliefert wurde als MSI. Ein Update lud damit jedes Mal das vollständige Paket, und die
194 Zonenbilder unter `resources/zones` machen den Großteil davon aus, obwohl sie sich
zwischen zwei Versionen praktisch nie ändern.

## Entscheidung

Autoupdate läuft über Velopack. `tauri-plugin-updater` und `tauri-plugin-process` fallen
weg, `bundle.active` steht auf `false`. Tauri liefert nur noch das nackte Programm,
`scripts/release-velopack.mjs` stellt daraus ein Paketverzeichnis zusammen und ruft `vpk`.
Die Update-Logik liegt in `src-tauri/src/updater.rs` hinter drei Tauri-Commands, das
Frontend ruft nur noch diese.

Quelle der Releases ist `GithubSource` auf `mkj777/poe-leveling-app`. Der Tag ist die
Quelle der Wahrheit für die Version, der Workflow bricht ab, wenn `tauri.conf.json`
davon abweicht.

## Alternativen

**Tauri-Updater behalten, Endpunkte und Schlüssel austauschen.** Weniger Umbau und ein
Minisign-Schlüsselpaar mehr zu verwalten. Bleibt aber bei vollständigen Downloads pro
Update, und der MSI-Installer läuft mit erhöhten Rechten.

**Gar kein Autoupdate, nur Release-Downloads.** Der Guide ändert sich zum Liga-Start
schubweise. Genau dann will niemand von Hand nachinstallieren.

## Konsequenzen

* Delta-Updates. Gemessen an 0.2.0 → 0.2.1: 89 KB statt 7,3 MB, weil `vpk` 197 der 198
  Dateien als unverändert erkennt und nur die ausführbare Datei patcht.
* Installation pro Benutzer nach `%LocalAppData%`, ohne Rechteabfrage.
* Keine Signaturschlüssel nötig. Velopack prüft SHA über das Release-Feed.
* Die Ressourcen, die vorher der MSI-Bundler eingepackt hat, müssen im Skript von Hand
  neben die ausführbare Datei gelegt werden. Zur Laufzeit sucht
  `src/utilities/tauri.utilities.ts` sie unter `<resourceDir>/resources/zones`, und
  `resourceDir` ist auf Windows das Verzeichnis der ausführbaren Datei. Ein Test hält
  Skript und `updater.rs` auf dasselbe Repo fest.
* `vpk` ist ein dotnet-Werkzeug und damit eine Abhängigkeit der Release-Kette, nicht der
  Anwendung.
