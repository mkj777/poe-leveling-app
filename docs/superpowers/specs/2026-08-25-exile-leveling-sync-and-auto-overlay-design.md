# Design: Exile Leveling sync and automatic overlay placement

Date: 2026-08-25
Status: approved for implementation
Concerns: `poe-leveling-app` (Tauri 1.5 + React 18 + Zustand)

## 1. Problem

Today the levelling guide comes from two frozen sources:

* `src/data/guides/*.guide.json`: routes exported by hand from the Exile Leveling website.
* `src/data/level-tracker-{areas,gems,quests}.ts`: 14,059 lines of copied game data.

Both go stale silently. Upstream updates the route several times within a few days,
mainly in the opening phase of a new league, and sporadically after that. Without
automation, every time someone has to export by hand, paste, and rebuild the app.

Second, the user has to set the overlay position themselves (`TestScreen`,
`settings.displayPosition`). The position is stored as absolute pixels and is wrong after
every move of the game window, every resolution change and every monitor change.

## 2. Goal

1. The walkthrough comes from the upstream project at runtime and updates itself without
   an app release and without any action by the user.
2. The overlay positions itself on the game window and follows it. Fine adjustment
   (moving, scaling) remains possible but is optional and is stored relatively.

## 3. Non-goals

* Path of Building import and build-dependent gem steps. The module boundary is drawn,
  the decoder is not built. See ADR-0007.
* Passive skill tree display.
* Operating systems other than Windows. The overlay uses Win32 directly.
* The zone layout images (`src-tauri/resources/zones/`) and the `layout-map` window.
  Stay unchanged.

## 4. Findings from the investigation

### 4.1 The website is not the source

`https://heartofphos.github.io/exile-leveling/` serves an empty HTML shell. All content
is rendered client-side. Scraping in the literal sense would need a headless browser.

The real source lives as plain text in the repository
`github.com/HeartofPhos/exile-leveling`:

```
common/data/routes/act-1.txt ... act-10.txt     about 28 KB, custom DSL
common/data/json/areas.json                      53 KB
common/data/json/quests.json                    304 KB
common/data/json/gems.json                      196 KB
common/data/json/{characters,gem-colours,kill-waypoints,
                  awakened-gem-lookup,vaal-gem-lookup}.json
```

### 4.2 Change frequency

Evaluation of all 100 commits that touch `common/data`:

| Window | Commits | Occasion |
|---|---|---|
| 2023-08-15 to 08-19 | 9 in 5 days | League 3.22 start, then route fixes and wording |
| 2025-10-31 | 4 in one day | League 3.27, tree, lab level, ascend order, bandit |
| 2025-11-14 | 1 | straggler two weeks later |
| 2026-07-22 to 07-24 | 2 in 2 days | campaign secrets, Allflame route |
| 2026-08-02 | 1 | 3.29 gems, POB import |
| 2025-06-02, 2025-03-17, 2024-04-23 | 1 each | single fix months after launch |

Pattern: a burst over about a week after league start, then isolated fixes.
The parser (`common/src/route-processing/`), by contrast, almost never changes.

Conclusion: one check per day covers both cases.

### 4.3 The export is exactly reproducible

`web/src/components/Navbar/index.tsx:55`:

```ts
const output = [...route.sections, `pob-code:${pobCode ?? "none"}`];
navigator.clipboard.writeText(JSON.stringify(output));
```

Produced in `web/src/state/route.ts`:

```ts
routeState = initializeRouteState()
if (leagueStart) preprocessorDefinitions.add("LEAGUE_START")
if (library)     preprocessorDefinitions.add("LIBRARY")
bandit "Alira" -> preprocessorDefinitions.add("BANDIT_ALIRA")
route = parseRoute(getRouteFiles([act-1 ... act-10]), routeState)
if (requiredGems.length == 0) return baseRoute
```

Defaults from `web/src/state/build-data.ts`:
`{ characterClass: "None", bandit: "Alira", leagueStart: true, library: true }`.

Cross-check against the reference export at hand: Act 2 kills Kraityn and Oak but helps
Alira (`BANDIT_ALIRA` confirmed). Tidal Island and Hailrake present (`LEAGUE_START`
confirmed). Not a single `gem_step` (`pob-code:none` confirmed).

So the target output is unambiguously defined and testable as a golden file.

### 4.4 Existing bugs in the renderer

`src/utilities/guide.utilities.ts` covers the fragment types incompletely:

| Finding | Evidence | Effect |
|---|---|---|
| `dirIndex` runs 0 to 7 | `common/src/route-processing/fragment/index.ts:409`, `Math.floor(dir / 45)` | `dirIndex[]` in the app has 7 entries, index 7 yields `undefined`. `dirIndex: 7` occurs 28 times in the reference export |
| `crafting` carries `crafting_recipes[]` | fragment type | app renders only the word `crafting`, drops the recipe name |
| `reward_quest`, `reward_vendor`, `copy` missing | fragment union | fall into the default branch, output `PART NOT FOUND` |
| `route.edges[]` and `step.edgeIndex` ignored | `common/src/route-processing/index.ts` | progress runs on string comparison instead of the edge index |

### 4.5 Overlay reference

`awakened-poe-trade-extended` attaches the window to the game via
`electron-overlay-window` and `uiohook-napi` (`main/src/windowing/`). Both are bound to
Electron and cannot be ported to Tauri. Only the model is adopted:

* Attach the window to the game window and track its bounds
  (`GameWindow.ts`, `OverlayController.targetBounds`).
* Compute widget geometry relative to the game rect
  (`GameWindow.uiSidebarWidth` scales with `bounds.height`).
* Toggle between click-through and interactive
  (`OverlayWindow.assertOverlayActive` / `assertGameActive`).

Hard constraint, documented in `docs/download.md:31` of the neighbouring repository:

```
Windowed Fullscreen: supported
Windowed:            supported
Fullscreen:          not supported
```

Exclusive fullscreen cannot be drawn over on Windows. `docs/issues.md:8` also mentions
the case where a GeForce Experience profile silently switches PoE to fullscreen. The
state is detected and reported.

## 5. Architecture

```
GitHub API
   |  conditional GET, If-None-Match
   v
 new sha?  --no-->  done
   |  yes
   v
raw.githubusercontent.com/<sha>/common/data/{routes,json}
   |  Rust, reqwest
   v
$APPDATA/com.poe-leveling-guide.dev/exile-leveling/<sha>/
   |
   v
vendored parseRoute(routeFiles, { LEAGUE_START, LIBRARY, BANDIT_ALIRA })
   |
   v
RouteData.Route { sections[], edges[] }
   |
   +--> fragment renderer -----> overlay text
   |
   +--> edges[] + Client.txt --> progress
```

### 5.1 Data layer, Rust

New: `src-tauri/src/data_sync.rs`

```rust
#[tauri::command] async fn check_upstream() -> Result<UpstreamStatus, String>;
#[tauri::command] async fn fetch_upstream(sha: String) -> Result<(), String>;
#[tauri::command] async fn read_cached() -> Result<CachedData, String>;

struct UpstreamStatus { changed: bool, sha: String }
struct CachedData { sha: String, routes: Vec<String>, json: HashMap<String, String> }
```

`check_upstream` queries
`api.github.com/repos/HeartofPhos/exile-leveling/commits?path=common/data&per_page=1`
with `If-None-Match` from the manifest. A 304 response means unchanged and does not
count against the rate limit of 60 requests per hour. No token needed.

`fetch_upstream` downloads the 10 route files and 8 JSON files at the pinned sha, writes
them into a temporary directory and only then renames it. An aborted download cannot
damage the last good state.

Cache layout:

```
$APPDATA/com.poe-leveling-guide.dev/exile-leveling/
  manifest.json      { sha, etag, fetchedAt }
  <sha>/routes/act-1.txt ... act-10.txt
  <sha>/json/areas.json ...
```

Dependency: `reqwest` with `rustls-tls`, not with `openssl`.

Fallback chain: cache, then the bundled build snapshot, never empty.

Cadence: once at startup, then every 24 hours of runtime.

### 5.2 Parser, vendored

New: `src/lib/exile-leveling/`, copied from `common/src/` of the upstream project:

```
route-processing/index.ts
route-processing/patterns.ts
route-processing/scoped-logger.ts
route-processing/fragment/index.ts
route-processing/fragment/language.ts
route-processing/gems.ts
types.d.ts
data.ts          <- the only modification
ATTRIBUTION.md   <- MIT, HeartofPhos/exile-leveling, sha of the vendored commit
```

`data.ts` imports statically in the original:

```ts
import AREAS_JSON from "../data/json/areas.json" with { type: "json" };
```

Replaced by a loader that uses `read_cached()` and provides `Data` only after the first
sync. All other files stay unchanged so that an upstream diff applies cleanly.

A watcher in CI diffs `common/src/route-processing/` against the vendored copy and
opens a PR when they differ.

### 5.3 Overlay, Rust

New: `src-tauri/src/overlay.rs`

```rust
EnumWindows -> HWND with title "Path of Exile"
SetWinEventHook(EVENT_OBJECT_LOCATIONCHANGE | EVENT_SYSTEM_FOREGROUND)
GetWindowRect, GetWindowLong(GWL_STYLE) -> fullscreen suspicion
emit("poe-bounds", PoeBounds)

struct PoeBounds { x: i32, y: i32, w: i32, h: i32,
                   focused: bool, exclusive_fullscreen: bool }
```

Event hook instead of a timer: no one-second loop, immediate reaction to move, resize
and focus changes.

The existing `check_poe_window` (polling via `EnumWindows`) is dropped in favour of the
hook. `open_poe_window` stays.

### 5.4 Overlay, frontend

New: `src/hooks/usePoeWindow.ts`. Listens for `poe-bounds` and computes the geometry.

Anchor: horizontally centred, vertically at the bottom edge, with clearance above the
HUD row.

```ts
const ANCHOR = { x: 0.5, y: 1.0 };          // bottom centre
const BOTTOM_MARGIN = 0.16;                 // share of the game height above the HUD row
const BASE_WIDTH = 0.26;                    // share of the game width
const WIDTH_CLAMP = { min: 320, max: 560 };

width  = clamp(b.w * BASE_WIDTH * scale, WIDTH_CLAMP.min, WIDTH_CLAMP.max)
x      = b.x + b.w * (ANCHOR.x + offset.dx) - width / 2
y      = b.y + b.h * (ANCHOR.y - BOTTOM_MARGIN + offset.dy) - height
```

`offset` is a fraction of the game rect, not a pixel value. That keeps the fine
adjustment valid after resolution and monitor changes.

`scale` scales window width and font size together, applied via the CSS root size:

```ts
document.documentElement.style.fontSize = `${16 * scale}px`;
```

The existing dynamic height adjustment (`main.page.tsx`, `adjustWindow`) keeps computing
the text height of the current step, now bottom-aligned. The `growDirection` setting is
dropped because the bottom edge is fixed and the window always grows upwards.

Window properties in operation: `alwaysOnTop`, `skipTaskbar`, `ignoreCursorEvents`,
hidden when `focused === false`.

### 5.5 Edit mode

The overlay is click-through, so moving and scaling need a toggleable state.

* Hotkey `CmdOrCtrl+Shift+Alt+O` toggles it.
* On enabling: `setIgnoreCursorEvents(false)`, the background is visibly darkened, a drag
  handle (`data-tauri-drag-region`) and the controls appear.
* Controls: scale in steps of 0.1 within 0.6 to 2.0, plus a reset to `scale = 1`,
  `offset = { dx: 0, dy: 0 }`.
* Dragging writes the offset back, converted into fractions of the game rect.
* On disabling: `setIgnoreCursorEvents(true)`, controls gone.

Persisted in `settings.store`:

```ts
overlayScale: number          // default 1
overlayOffset: { dx, dy }     // default { 0, 0 }, fractions of the game rect
```

### 5.6 Progress

Adopted from `web/src/state/route.ts`, `activeEdgeAtom`:

```ts
const m = /Generating level \d+ area "(.*?)"/.exec(logLine);
if (m && m[1] === route.edges[currentEdge + 1]) currentEdge++;
```

Replaces today's comparison against `guide[currentStep].changeAreaId`. The edge index
is unambiguous even when the same zone is entered several times.

After a data refresh mid-run there is no reset to 0. Instead the last known `areaId` is
looked up in the new `edges` and the highest matching index is adopted. If none is found,
the previous index stays and the user is told once.

### 5.7 Client.txt

The path is derived from the game process that was found, since the HWND is available
anyway:

```
GetWindowThreadProcessId -> QueryFullProcessImageNameW -> <dir>/logs/Client.txt
```

Manual selection stays as the fallback in case the derivation fails.

## 6. What goes away

| Gone | Reason |
|---|---|
| `src/data/level-tracker-{areas,gems,quests}.ts` | 14,059 lines of frozen copy, replaced by the runtime cache |
| `src/data/guides/*.guide.json` | routes exported by hand, replaced |
| `src/interfaces/guide-import.interface.ts` | import format goes away |
| `src/utilities/guide.schema.ts` | only validated the import |
| `setNewGuide(guideText)`, import UI in `navbar.tsx` | requirement: no more importing |
| `src/components/test-screen.tsx` | manual placement goes away |
| `settings.displayPosition`, `settings.growDirection` | replaced by anchor plus relative offset |

## 7. Error cases

| Case | Behaviour |
|---|---|
| No network at startup | last cache, else build snapshot, silent retry on the next tick |
| GitHub answers 403, rate limit | skip the check, next tick in 24 h, note only in the log |
| Download aborts | discard the temporary directory, old state stays active |
| Vendored parser throws on new DSL | keep the last successfully parsed state, warn the user visibly, name the sha of the broken version |
| PoE not started | overlay hidden, main window shows a waiting state |
| PoE in exclusive fullscreen | one-time message in the main window pointing to Windowed Fullscreen |
| PoE started with admin rights | hook delivers no events, message as in the neighbouring repository |

## 8. Tests

* **Golden file**: `parseRoute` against the pinned upstream commit `b7b2dd0`, result
  serialised as `[...sections, "pob-code:none"]`, `deepEqual` against the reference
  export. If the test fails after an upstream update, the diff distinguishes data drift
  (regenerate the fixture) from parser drift (real fix).
* **Renderer**: table test over the complete `Fragments.AnyFragment` union. No branch
  may produce `PART NOT FOUND`. Covers `dirIndex: 7`, `crafting_recipes`,
  `reward_quest`, `reward_vendor`, `copy`.
* **Sync**: 304 path, 200 path, aborted download, offline start, corrupted manifest.
* **Overlay geometry**: the conversion from `PoeBounds` plus `scale` plus `offset` to a
  window position is a pure function and is tested directly, including resolution change
  and negative offset.
* **Progress**: edge advance on repeated zones, re-anchoring after a refresh.

## 9. Implementation order

1. Vendor the parser, switch `data.ts` to the loader, golden-file test green against a
   locally stored snapshot. No network yet.
2. `data_sync.rs` with cache, manifest and fallback chain. Golden-file test now against
   the fetched data.
3. Rewrite the fragment renderer, table test green.
4. Switch progress to `edgeIndex`.
5. `overlay.rs` with hook and `poe-bounds`.
6. `usePoeWindow` plus anchor geometry, remove the old positioning.
7. Edit mode with scale and offset.
8. Client.txt derivation.
9. Clean-up: remove old data files, import UI, `TestScreen`.
10. CI watcher for parser drift.

## 10. Open points

None. All decisions are recorded in the ADRs under `docs/adr/`.
