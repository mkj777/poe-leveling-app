![banner](/.github/images/banner.webp)

# POE Leveling App

Overlay app that helps with levelling in Path of Exile: the walkthrough from
**[Exile Leveling](https://heartofphos.github.io/exile-leveling/)** sits inside the
game window, and progress advances on its own from the zone changes in `Client.txt`.

Tauri (Rust) + React + TypeScript + Vite + Tailwind/shadcn.

## Origin

This project is based on **[Kazte/path-of-levelling](https://github.com/Kazte/path-of-levelling)**
by [Kazte](https://github.com/Kazte), licensed under MIT.

The code was taken over including its full git history (172 commits, last adopted
upstream commit `51aef5e` from 2024-09-03, tags `v0.1.0`-`v0.2.0`). It is **not a
GitHub fork** but a standalone repository: development continues independently of the
original, and changes flow neither back nor in automatically.

Thanks to Kazte and all
[contributors of the original](https://github.com/Kazte/path-of-levelling/graphs/contributors).

The original README is kept unchanged as [README.upstream.md](README.upstream.md).

## Installation and first start

1. Download `PoELevelingGuide-win-Setup.exe` from the [releases](https://github.com/mkj777/poe-leveling-app/releases)
   and run it. Installs per user into `%LocalAppData%`, no elevation prompt.
2. Start Path of Exile, then the app. It reads the path to `Client.txt` from the running
   game. If the game is not running, "Client.txt not found" stays on screen and the file
   can be picked by hand, usually at
   `C:\Program Files (x86)\Grinding Gear Games\Path of Exile\logs\Client.txt`.
3. Wait until the walkthrough has loaded. It comes from the Exile Leveling project, so
   the app needs internet access on first start. After that it is stored locally and
   keeps itself up to date. No build needs to be imported.
4. Click **Start**. The overlay places itself inside the game window and follows it.

Position, size and opacity of the overlay are in the settings. Nothing needs to be done
about updates: the app fetches a new version in the background and installs it on the
next start, see [ADR-0008](docs/adr/0008-autoupdate-via-velopack.md).

## Shortcuts

- `Ctrl + Alt + 0` - close the overlay, back to the main window
- `Ctrl + Shift + Alt + →` - next step
- `Ctrl + Shift + Alt + ←` - previous step
- `Ctrl + Shift + Alt + O` - move the overlay, on/off

## Development

```bash
yarn install
yarn tauri dev      # app in dev mode
yarn test           # unit, edge and performance tests
```

Prerequisites: Node.js, Yarn, the Rust toolchain and the
[Tauri prerequisites](https://tauri.app/start/prerequisites/).

## Release

Tauri does not bundle itself, packaging is done with [Velopack](https://velopack.io).

```bash
dotnet tool install -g vpk   # once
yarn release:pack            # build and pack, output under src-tauri/target/velopack-releases
yarn release:publish         # additionally upload to GitHub, needs GITHUB_TOKEN
```

Normally `.github/workflows/main.yml` does this when a tag `vX.Y.Z` is pushed. The tag
must match the `version` in `src-tauri/tauri.conf.json`, otherwise the run aborts.

## Screenshots

![In Game View](/.github/images/image-04.webp)

## Licence

MIT. Copyright of the original code belongs to Kazte, see [LICENSE](LICENSE).
