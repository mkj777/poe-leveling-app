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
Die Update-Logik liegt vollständig in `src-tauri/src/updater.rs`. Das Frontend stößt
nichts an, es erfährt nur, dass etwas passiert ist.

Der Ablauf ist auf zwei Zeitpunkte verteilt:

* Beim Start prüft `check_and_download` im Hintergrund und lädt ein gefundenes Paket.
  Angewendet wird es dabei nicht, sonst müsste die App mitten im Spiel neu starten.
* Beim Beenden übergibt `apply_on_exit` ein bereitliegendes Paket an den Velopack-Updater,
  der es einspielt, sobald der Prozess weg ist. Beim nächsten Start läuft die neue Version.

Die Reihenfolge ist keine Geschmacksfrage. `wait_exit_then_apply_updates` startet den
Updater mit `--waitPid` auf den eigenen Prozess, und der wartet höchstens 60 Sekunden.
Beim Start aufgerufen hätte er längst aufgegeben, bevor jemand die App wieder schließt.

Gefragt wird beim Beenden der Paketordner (`get_update_pending_restart`), nicht der
Speicher. So wird auch ein Paket eingespielt, das eine frühere Sitzung geladen hat und das
liegen blieb, etwa nach einem Absturz.

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
* Kein Dialog, kein Knopf, kein Neustart mitten im Betrieb. Die Oberfläche zeigt nur an,
  dass beim nächsten Start eine neue Version läuft.
* Ohne Velopack-Installation, also im Entwicklungslauf und portabel, passiert nichts. Das
  ist kein Fehlerfall und wird auch nicht als solcher gemeldet.
* Die Ressourcen, die vorher der MSI-Bundler eingepackt hat, mussten im Skript von Hand
  neben die ausführbare Datei gelegt werden. Mit ADR-0009 gibt es keine mehr. Ein Test
  hält Skript und `updater.rs` auf dasselbe Repo fest.
* `vpk` ist ein dotnet-Werkzeug und damit eine Abhängigkeit der Release-Kette, nicht der
  Anwendung.
