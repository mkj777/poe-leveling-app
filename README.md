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

1. Release herunterladen (Releases dieses Repos).
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
yarn tauri build    # Release-Build
```

Voraussetzungen: Node.js, Yarn, Rust-Toolchain und die
[Tauri-Prerequisites](https://tauri.app/start/prerequisites/).

## Tastenkürzel

- `Ctrl + Shift + Alt + F12` - Overlay an/aus
- `Ctrl + Shift + Alt + →` - nächster Schritt
- `Ctrl + Shift + Alt + ←` - vorheriger Schritt

## Screenshots

![In Game View](/.github/images/image-04.webp)

## Lizenz

MIT. Copyright des Ursprungscodes bei Kazte, siehe [LICENSE](LICENSE).
