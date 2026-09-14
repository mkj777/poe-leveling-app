# Glossary

Terms from the interplay of `poe-leveling-app` and the upstream project
[HeartofPhos/exile-leveling](https://github.com/HeartofPhos/exile-leveling) (MIT).
The canonical definitions live there in `common/src/types.d.ts`.

## Data and route

**Route DSL**
The text format of the walkthrough source files `common/data/routes/act-1.txt` to
`act-10.txt`. Line-oriented, with directives (`#section`, `#sub`, `#ifdef`) and
fragments in curly braces (`{enter|1_1_2}`).

**RouteFile**
One section of the DSL, split at `#section`. `{ name, contents }`. Produced by
`getRouteFiles(routeSources)`. The ten act files yield ten RouteFiles.

**Route**
The parsed result: `{ sections: Section[], edges: areaId[] }`. Produced by
`parseRoute(routeFiles, routeState)`.

**Section**
One act. `{ name: "Act 1", steps: Step[] }`.

**Step**
Either a `FragmentStep` or a `GemStep`.

**FragmentStep**
One line of the guide. `{ type: "fragment_step", parts: Fragment[], subSteps: FragmentStep[],
edgeIndex: number | null }`. The `parts` mix raw strings and typed fragments.

**GemStep**
A build-dependent step "get gem X". Only produced from an imported PoB code. Not
generated in this project, see ADR-0007.

**Fragment**
A typed element inside a step. About twenty variants, among them
`enter`, `area`, `arena`, `kill`, `quest`, `quest_text`, `waypoint`, `waypoint_use`,
`waypoint_get`, `portal_set`, `portal_use`, `logout`, `trial`, `ascend`, `crafting`,
`dir`, `generic`, `reward_quest`, `reward_vendor`, `copy`.

**SubStep**
An indented hint below a step, marked with `#sub` in the DSL. Contains direction and
layout tips.

## Zone changes and progress

**Area ID**
Path of Exile's internal zone identifier, such as `1_1_2` (The Coast) or `1_1_town`
(Lioneye's Watch). Resolved via `common/data/json/areas.json`.

**Edge**
A zone change along the route. `route.edges` is the ordered list of area IDs the player
enters one after another.

**edgeIndex**
The index into `route.edges` that a FragmentStep triggers. `null` if the step is not a
zone change (a quest turn-in, for example).

**currentEdge**
This app's progress pointer. Advances when the zone read from `Client.txt` equals
`route.edges[currentEdge + 1]`. See ADR-0004.

**Client.txt**
The game's log file at `<PoE directory>/logs/Client.txt`. Contains a line
`Generating level N area "<areaId>"` on every zone change.

## Route variants

**Preprocessor definition**
A switch that shows or hides `#ifdef` and `#ifndef` blocks of the DSL. Set in
`RouteState.preprocessorDefinitions`.

**LEAGUE_START**
Variant for the league start without existing gear. Enables, among other things, the
detour via Tidal Island and Hailrake. Active in the `league-start` guide mode, disabled
in `speedleveling`, see ADR-0011.

**LIBRARY**
Enables the detour through the Library in Act 3 to buy skill gems. Always active in this
project.

**BANDIT_ALIRA, BANDIT_OAK, BANDIT_KRAITYN, BANDIT_KILL**
Four mutually exclusive variants of the bandit quest in Act 2. Fixed to `BANDIT_ALIRA`
in this project, matching the upstream default.

**PoB code**
A Path of Building export: Base64, zlib-compressed, XML inside. Source of the
build-dependent gem steps. Not implemented, see ADR-0007.

**Reference export**
The JSON output produced by the website, `[...route.sections, "pob-code:none"]`. Serves
as the golden file for the parser test in this project.

## Overlay

**PoE bounds**
Position, size and focus state of the game window, determined in
`src-tauri/src/overlay.rs` and sent to the frontend via the `poe-bounds` event.

**Anchor**
The relative reference point of the overlay inside the game rect. Here `{ x: 0.5, y: 1.0 }`,
that is, horizontally centred and vertically at the bottom edge.

**BOTTOM_MARGIN**
Distance from the overlay's bottom edge to the bottom edge of the game window, as a
share of the game height. Keeps the overlay clear of the flask and skill bar.

**Offset**
The fine adjustment set by the user, stored as a fraction of the game rect
(`{ dx, dy }`), not in pixels. Therefore survives resolution and monitor changes.

**Scale**
Common scale factor for window width and font size, range 0.6 to 2.0. Applied via the
CSS root size.

**Edit mode**
State in which the overlay is not click-through and shows a drag handle and a scale
slider. Toggled by hotkey. Corresponds to `assertOverlayActive` / `assertGameActive` in
the reference project `awakened-poe-trade-extended`.

**Click-through**
Window state `setIgnoreCursorEvents(true)`: mouse events pass through the overlay to the
game.

**Windowed Fullscreen**
The only fullscreen mode on top of which an overlay can be drawn on Windows. Exclusive
fullscreen does not work, see ADR-0005.

## Synchronisation

**Snapshot**
A complete set of ten route files and eight JSON files in the local cache, pinned to one
commit sha.

**sha**
The upstream commit the current snapshot comes from. Part of the cache path, so that
versions can sit side by side and an aborted download does not damage the good one.

**Manifest**
`manifest.json` in the cache directory. Holds `sha`, `etag` and `fetchedAt`.

**Conditional GET**
A request with `If-None-Match: <etag>`. A 304 response means unchanged, costs no
rate-limit quota and no body.

**Build snapshot**
A data set shipped at build time. Last line of fallback if neither network nor cache is
available.

**Parser drift**
The case where upstream changes the DSL grammar or the parser and the vendored copy no
longer fits. Made visible by the CI watcher and the golden-file test.

**Data drift**
The expected normal case: upstream changes only route contents or game data. Picked up
automatically at runtime and only requires re-generating the golden-file fixture.
