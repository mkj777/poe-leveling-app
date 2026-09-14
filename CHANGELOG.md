# Changelog

All notable changes per version. The section of a version is read by
`scripts/release-notes.mjs` at release time and becomes the description of the GitHub
release. If the section is missing, the release workflow aborts.

Versions follow [SemVer](https://semver.org/), the format is modelled on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## Unreleased

### Changed

- Error messages from the updater and the data sync, and the fallback text for an
  unknown direction (`… degrees`), are in English now. Documentation, code comments,
  commit messages and CI output were translated as well.

## 1.0.0 (2026-08-31)

First release without caveats.

### Added

- A downloaded update can be installed right away instead of waiting for the next
  start. The notice in the header is now a button, and the toast shown after the
  download carries the same one. The app restarts on its own.

### Changed

- The shortcut that closes the overlay is shown below the last step of the guide.
  Otherwise it only appears in the settings, and nobody looks there in the middle of
  a game. It now sits on Ctrl+Alt+0 instead of Ctrl+Shift+Alt+F12, and it lives in
  one place in the source instead of three.
- The overlay is display only. It no longer parses a route, holds no game data, no
  progress and no persisted settings. The main window computes what is to be shown
  and sends it as finished lines. With that there is nothing left that could drift
  apart between the windows.

### Fixed

- List and overlay highlighted different steps, each one off by one. A block in the
  list began with the transition into its zone, and that transition is done as soon as
  Client.txt reports the zone: the highlighted step was therefore the one just made,
  while the overlay showed the next one. At edge 53 the list said "➞ The Slums" and the
  overlay "➞ The Crematorium". A block now ends with the transition instead of starting
  with it. Both windows show the same lines, checked for every edge of the route.
- Dragging the overlay somewhere else and then touching a slider in the main window
  reset the placement. Both windows wrote into the same entry, and the main window
  never knew about the drag. Dragging now happens in the overlay, saving in the main
  window.
- Switching the mode asked GitHub before re-reading the route, and so took as long as
  that check, for which the library sets no time limit. It now reads straight from the
  cache: the data is the same, only the mode differs. Measured 37 ms instead of a
  network round trip.

### Internal

- The overlay window was closed in two places on stop. A leftover from the time with
  two windows: one won, the other found nothing and reported "window not found". It is
  now closed in one place.
- `loadRouteFromCache` and delivering the mode to the overlay are gone. The rework
  removes code on balance (ADR-0012).
- Icons are passed across the window boundary by name instead of by address inside the
  bundle.
- The weekly look at the upstream parser reported a change where there was none. The
  generator rewrote `ATTRIBUTION.md` every time without a section added by hand later,
  and the upstream clone ended up as a submodule in the proposal. Both fixed.

## 0.99.0 (2026-08-29)

### Fixed

- Only the main window stores progress now. Before, both windows wrote into the same
  entry, and each computed the associated zone from its own route. If the overlay held
  a different mode, it stored a different zone for the same edge and overwrote the
  state. On the next start the app re-anchored on that zone and stood ten edges back.
  The bug thus survived the restart that should have fixed it.
- The overlay no longer reads or writes progress. It is a display and is told mode and
  edge by the main window.

### Internal

- The overlay window's address, its route in the router and the role check share one
  constant. A test pins that the address really is recognised as the overlay.

## 0.98.0 (2026-08-29)

### Fixed

- In speedleveling the overlay showed a different step than the list in the main
  window, usually one further ahead. Both windows parse the route themselves, but only
  the edge index was exchanged. Speedleveling has 236 edges, league start 248: the same
  number hits a different zone per mode. Edge 172 is The Sarn Ramparts in speedleveling
  and The Causeway at league start, ten edges earlier. Anyone who jumped there saw "Get
  Crafting: Cold Damage - Rank 2, Find and take Kishara's Star" in the overlay.
- The mode is now part of every message to the overlay, not only of the switch. The
  overlay reloads its route before applying an index that belongs to a different mode.
  A missed message thus heals itself.
- The overlay reports in at startup and receives the state as the answer. Before, it
  guessed from the shared storage, and edge and mode could be stale while it was being
  built.
- Progress is reported to the overlay even while the settings page is open. Before,
  that hung on the main screen, which is no longer rendered there.

## 0.97.0 (2026-08-29)

### Added

- Second mode **Speedleveling** for the next character of the same league. Crafting
  recipes and trials already count there, so their steps are dropped, as are the
  detours that only pay off at league start: Tidal Island with Hailrake, The Den, the
  Catacombs, the Silver Locket, the Ossuary and the search for the Chemist's Strongbox.
  488 steps on 248 edges become 409 on 236.
- After eleven days without a start, the app asks on opening whether a new run is due
  and lets you choose between league start and speedleveling. Both answers reset to
  Act 1, a third one leaves everything as it is. On the very first start nothing is
  asked.
- The mode is also in the settings. Switching there keeps progress and re-anchors on
  the nearest matching zone.

### Fixed

- Re-anchoring could point at an edge index that does not exist when the last entered
  zone is missing from the route. The overlay would have stayed empty, with no error
  message. The index is now clamped to the length of the route. Noticed when switching
  modes: the Ossuary sits on edge 233 at league start, speedleveling has only 236.
- The daily data sync did not restart its timer under React StrictMode after the first
  mount had cleared it. Affected the development run only.

## 0.96.0 (2026-08-27)

### Internal

- Node 20 has been out of support since April 2026, CI now builds on Node 24 (active
  LTS). `.nvmrc` says `24`, CI picks up patches within the major.
- `predev` wrote the locally installed Node version into `.nvmrc` on every `yarn dev`,
  and two workflows read exactly that file. Anyone trying a different version locally
  silently shifted the toolchain of release and upstream watch. The automation is
  removed, the version is maintained deliberately.
- This changelog. The release workflow checks before building whether the version has a
  section, and sets it as the release description afterwards.

## 0.95.0 (2026-08-27)

### Fixed

- Progress survives a restart again. On startup the main window re-anchored on the
  **last** occurrence of the last entered zone instead of the stored step. 46 of the
  149 zones of the route are entered more than once, The Forest Encampment for instance
  on edges 135, 137, 145, 150 and 156. Anyone who stopped at 135 stood 21 edges ahead
  after the restart. The overlay stayed correct because it does not take that path.
- Re-anchoring now finds the **nearest** occurrence, and only when the stored step no
  longer fits, that is, the route underneath has changed.
- If the Client.txt tick ran during the daily data sync, progress could jump back one
  step.

### Changed

- The guide list jumps to the current step on startup and on every zone change, centred
  in view. In between it scrolls freely.

## 0.94.0 (2026-08-26)

### Fixed

- Updates download only the difference again. Releases 0.92.0 and 0.93.0 contained only
  full packages, so every update pulled 5.5 MB instead of about 90 KB. `vpk` computes a
  delta only against a package that sits in the output directory, and the CI runner
  starts empty. The predecessor is now fetched before packing.
- If the delta is missing despite an existing predecessor, the release aborts. Without
  this check the bug was invisible for two releases: there was no error message, just a
  release without a delta file.

## 0.93.0 (2026-08-26)

### Fixed

- A strip of the previous line showed above the sticky act heading.
- The icons in the steps keep their aspect ratio. They were forced into a square, which
  stretched the quest exclamation mark to about twice its width and squashed trial and
  waypoint.

### Changed

- Compass directions are spelled out: "Go west" instead of "Go W".
- The act heading is larger and no longer underlined.

## 0.92.0 (2026-08-26)

### Changed

- Updates run without any action. They are checked and downloaded at startup and
  installed on exit, so the app does not restart in the middle of a game. The install
  button is gone.
- The overlay shows the next step instead of the zone change just made. In 101 of 248
  segments it previously showed only the transition you had just made.
- The guide list shows one separator per step instead of per line, so a block is
  exactly what "Jump here" jumps to.

### Removed

- The second, unlabelled overlay at the left edge of the screen with the zone images.
  Since the move to Velopack it only showed empty frames, and its purpose was not
  obvious in game. With it go the 194 zone images and the switch for them in the
  settings.

### Fixed

- Two icons were missing in the installed version. Files below 4096 bytes end up as
  `data:` URIs in the bundle, and the app's security policy allows only its own files
  for images. Affected were exactly the two icons just below that limit. In the
  development run this could never show.

## 0.91.0 (2026-08-26)

First release under the name PoE Leveling Guide, derived from
[Kazte/path-of-levelling](https://github.com/Kazte/path-of-levelling).

### Added

- Overlay as its own window. It attaches to the game window, follows it and can be
  adjusted in position, size and opacity.
- Progress advances automatically, read from `Client.txt`. The path to it is derived
  from the running game.
- The walkthrough comes at runtime from
  [HeartofPhos/exile-leveling](https://github.com/HeartofPhos/exile-leveling) and keeps
  itself up to date. No build needs to be imported.
- Autoupdate via Velopack, per-user installation into `%LocalAppData%` with no
  elevation prompt.

### Fixed

- The inherited updater pointed at the releases of the original project and carried its
  signing key. A release of our own would never have been delivered that way, a foreign
  one would.
