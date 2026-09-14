# ADR-0006: Anchor plus relative offset and scale instead of an absolute position

Date: 2026-08-25
Status: accepted

## Context

`settings.displayPosition` stores absolute screen pixels, set via the `TestScreen`. After
moving the game window, or changing resolution or monitor, the overlay sits in the wrong
place. On top of that there is `growDirection` (`up`/`down`), because the reference
point is not defined.

Wanted: automatic placement, bottom centre, with optional fine adjustment and scaling.

## Decision

The geometry is computed from the game rect:

```
ANCHOR        = { x: 0.5, y: 1.0 }   // horizontally centred, vertically at the bottom
BOTTOM_MARGIN = 0.16                 // clearance above the HUD row
BASE_WIDTH    = 0.26                 // share of the game width
```

`overlayOffset` is stored as a fraction of the game rect, not in pixels. `overlayScale`
(0.6 to 2.0) scales window width and font size together via the CSS root size.

Because the overlay is click-through there is an edit mode: a hotkey switches
`ignoreCursorEvents` off, a drag handle and a scale slider appear, confirming switches
back. Pattern taken from `OverlayWindow.assertOverlayActive` / `assertGameActive`.

`TestScreen`, `displayPosition` and `growDirection` are removed.

## Alternatives

**Fixed anchor without any adjustment.** Less code, but the HUD layout differs by
resolution and aspect ratio.

**3x3 selection grid in the settings.** More UI, solves the fine adjustment problem only
roughly and still needs scaling.

## Consequences

* The adjustment survives resolution and monitor changes.
* Bottom centre collides with the flask and skill bar. `BOTTOM_MARGIN` puts the bottom
  edge above it, the offset corrects the rest.
* The anchor is a constant in `src/utilities/constants.ts` and can be changed without UI.
* The window always grows upwards because the bottom edge is fixed. That is why
  `growDirection` goes away.
