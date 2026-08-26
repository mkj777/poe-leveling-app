![banner](/.github/images/banner.webp)

# POE Leveling App

Overlay-App, die beim Leveln in Path of Exile hilft: Builds von
**[Exile Leveling](https://heartofphos.github.io/exile-leveling/)** importieren,
Schritte im Spiel einblenden, Fortschritt automatisch anhand der Zonenwechsel
in `Client.txt` weiterschalten.

Tauri (Rust) + React + TypeScript + Vite + Tailwind/shadcn.

## Herkunft

Dieses Projekt basiert auf **[Kazte/path-of-levelling](https://github.com/Kazte/path-of-levelling)**
von [Kazte](https://github.com/Kazte), lizenziert unter MIT.

Der Stand wurde inklusive vollständiger Git-History übernommen (172 Commits,
letzter übernommener Upstream-Commit `51aef5e` vom 2024-09-03, Tags `v0.1.0`-`v0.2.0`).
Es ist **kein GitHub-Fork**, sondern ein eigenständiges Repository: die
Weiterentwicklung läuft unabhängig vom Original, Änderungen fließen weder
automatisch zurueck noch herein.

Dank an Kazte und alle
[Contributors des Originals](https://github.com/Kazte/path-of-levelling/graphs/contributors).

Die ursprüngliche README liegt unverändert als [README.upstream.md](README.upstream.md).

## Installation (Nutzung)

1. `PoELevelingGuide-win-Setup.exe` aus den [Releases](https://github.com/mkj777/poe-leveling-app/releases)
   herunterladen und starten. Installiert pro Benutzer nach `%LocalAppData%`, ohne
   Rechteabfrage. Neue Versionen holt sich die App danach selbst, siehe
   [ADR-0008](docs/adr/0008-autoupdate-ueber-velopack.md).
2. `Client.txt` auswählen, Standardpfad:
   `C:\Program Files (x86)\Grinding Gear Games\Path of Exile\logs\Client.txt`.
3. Position des InGame-Steps-Fensters festlegen.
4. Build auf [Exile Leveling](https://heartofphos.github.io/exile-leveling/) erstellen und kopieren.
5. Menü, dann _Load from Clipboard_.
6. Start klicken.

## Entwicklung

```bash
yarn install
yarn tauri dev      # App im Dev-Modus
yarn test           # Unit-, Edge- und Performance-Tests
```

Voraussetzungen: Node.js, Yarn, Rust-Toolchain und die
[Tauri-Prerequisites](https://tauri.app/start/prerequisites/).

## Release

Tauri bundelt nicht selbst, gepackt wird mit [Velopack](https://velopack.io).

```bash
dotnet tool install -g vpk   # einmalig
yarn release:pack            # bauen und packen, Ergebnis unter src-tauri/target/velopack-releases
yarn release:publish         # zusaetzlich zu GitHub, braucht GITHUB_TOKEN
```

Im Normalfall macht das `.github/workflows/main.yml` beim Push eines Tags `vX.Y.Z`. Der
Tag muss zur `version` in `src-tauri/tauri.conf.json` passen, sonst bricht der Lauf ab.

## Tastenkürzel

- `Ctrl + Shift + Alt + F12` - Overlay an/aus
- `Ctrl + Shift + Alt + →` - nächster Schritt
- `Ctrl + Shift + Alt + ←` - vorheriger Schritt

## Screenshots

![In Game View](/.github/images/image-04.webp)

## Lizenz

MIT. Copyright des Ursprungscodes bei Kazte, siehe [LICENSE](LICENSE).
