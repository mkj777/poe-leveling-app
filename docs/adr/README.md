# Architecture Decision Records

Decisions behind the move to runtime sync with
[HeartofPhos/exile-leveling](https://github.com/HeartofPhos/exile-leveling) and
automatic overlay placement.

Related design:
[`../superpowers/specs/2026-08-25-exile-leveling-sync-and-auto-overlay-design.md`](../superpowers/specs/2026-08-25-exile-leveling-sync-and-auto-overlay-design.md)

Terms: [`../glossary.md`](../glossary.md)

| ADR | Title | Status |
|---|---|---|
| [0001](0001-walkthrough-at-runtime-from-the-upstream-repo.md) | Fetch the walkthrough at runtime from the upstream repository | accepted |
| [0002](0002-vendor-the-upstream-parser-instead-of-rewriting-it.md) | Vendor the upstream parser instead of rewriting it | accepted |
| [0003](0003-network-access-in-the-rust-backend.md) | Network access in the Rust backend, CSP stays closed | accepted |
| [0004](0004-progress-via-edge-index.md) | Progress via edgeIndex instead of comparing area names | accepted |
| [0005](0005-overlay-follows-the-game-window-via-winevent-hook.md) | The overlay follows the game window via SetWinEventHook | accepted |
| [0006](0006-anchor-plus-relative-offset.md) | Anchor plus relative offset and scale instead of an absolute position | accepted |
| [0007](0007-pob-import-deferred.md) | Path of Building import deferred for now | accepted |
| [0008](0008-autoupdate-via-velopack.md) | Autoupdate via Velopack instead of the Tauri updater | accepted |
| [0009](0009-layout-overlay-removed.md) | Layout overlay removed, images come only from the bundle | accepted |
| [0010](0010-displayed-step-is-the-next-one.md) | The displayed step is the next one, not the transition just made | accepted |
| [0011](0011-two-guide-modes.md) | Two guide modes for the route, league start and speedleveling | accepted |
| [0012](0012-overlay-is-display-only.md) | The overlay is display only | accepted |
