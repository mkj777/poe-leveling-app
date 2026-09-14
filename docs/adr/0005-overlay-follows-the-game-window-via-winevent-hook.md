# ADR-0005: The overlay follows the game window via SetWinEventHook

Date: 2026-08-25
Status: accepted

## Context

The overlay should place itself and follow the game window. The reference project
`awakened-poe-trade-extended` uses `electron-overlay-window` plus `uiohook-napi`
(`main/src/windowing/GameWindow.ts`, `OverlayWindow.ts`). Both are tied to Electron and
not available for Tauri 1.5.

The project already contains Win32 code: `EnumWindows` and `SetForegroundWindow` in
`src-tauri/src/main.rs`, plus `winapi` as a dependency.

## Decision

New module `src-tauri/src/overlay.rs`. It looks for the window titled `Path of Exile`,
registers `SetWinEventHook` for `EVENT_OBJECT_LOCATIONCHANGE` and
`EVENT_SYSTEM_FOREGROUND` and sends a `poe-bounds` event with position, size, focus and
a fullscreen suspicion to the frontend on every change.

The existing polling command `check_poe_window` is removed.

## Alternatives

**Keep polling with `useInterval`.** Simpler, but visible lag when the window moves and
constant load.

**Move to Tauri 2 for better window APIs.** Does not solve the core problem, the Win32
tracking would be identical, and it enlarges the rework considerably.

## Consequences

* Immediate reaction to move, resize and focus changes, without a timer.
* Windows only. The project targets Windows anyway.
* Two narrow hooks instead of one range. The range from `EVENT_SYSTEM_FOREGROUND`
  (0x0003) to `EVENT_OBJECT_LOCATIONCHANGE` (0x800B) would cover dozens of events that
  are none of our business.
* `EVENT_OBJECT_LOCATIONCHANGE` fires system-wide, including for the mouse cursor.
  Without the filter on `OBJID_WINDOW` and on the remembered window, the emit path would
  run on every mouse movement.
* Game start and exit need no mechanism of their own: on start PoE takes the foreground,
  on exit focus goes elsewhere. Both are an `EVENT_SYSTEM_FOREGROUND`, on which the window
  is searched for again.
* The hook only delivers to the thread that installed it, and that thread needs a message
  loop. Tracking therefore runs in its own thread with thread-local state.
* Two known limits are detected and reported instead of failing silently: exclusive
  fullscreen (`docs/download.md:31` in the neighbouring repository lists only Windowed
  and Windowed Fullscreen as supported) and a game started with admin rights.
