# ADR-0012: The overlay is display only

Date: 2026-08-29
Status: accepted

## Context

The overlay was formally a second window, in practice a second application. It parsed
the route itself from the cache, held its own game data, its own progress and its own
settings, and stored all of it in the same entries as the main window.

Two bugs came out of that, both measured, both silent:

**The step was shifted.** With the two guide modes (ADR-0011) the windows held edge
lists of different lengths, 248 versus 236. Only the index was exchanged. Edge 172 is
The Sarn Ramparts in speedleveling and The Causeway at league start. Anyone who jumped
there in the main window read "Get Crafting: Cold Damage - Rank 2, Find and take
Kishara's Star" in the overlay.

**Progress jumped back.** `setCurrentEdge` looks the zone up in its own route. The
overlay stored its zone for the reported edge, the main window meant a different one,
and whoever wrote last won. On the next start the app re-anchored on the wrong zone and
stood ten edges back. The bug thus survived the restart that should have fixed it.

The same again with the settings, reproduced in a test:

```
after dragging   : {"dx":0.3,"dy":0.2}
after the slider : {"dx":0,"dy":0}
```

Drag the overlay where you want it, then touch any slider in the main window, and the
placement was gone.

Every time the same shape: two windows with their own opinion about the same state.
Each individual case could be patched, the shape remained.

## Decision

The overlay displays and does nothing else. It holds no route, no game data, no
progress and no storage.

The main window computes what is to be shown and sends it as data:

```ts
export interface FragmentView {
  text: string;
  colour: FragmentColour;
  icon: IconName | null;
}

export interface OverlayView {
  act: string | null;
  stepsLeft: number;
  steps: { parts: FragmentView[]; subSteps: FragmentView[][] }[];
}
```

With that there is nothing left to derive and therefore nothing that could drift apart.
There is no index without its list, because no index crosses the window boundary any
more.

Icons travel by name, not by address: `/assets/quest-BQCG-isT.png` belongs to the build,
not to the content. The window looks up the image itself.

Three events carry the boundary:

| Event | Direction | Content |
|---|---|---|
| `overlay-ready` | overlay → main | "I am listening" |
| `overlay-view` | main → overlay | what to display |
| `overlay-placement` | overlay → main | dragged or scaled |

The third one is the reverse direction: dragging happens in the overlay, saving in the
main window. The overlay applies the value locally right away so the window follows, and
reports it. Saving happens in one place only.

For that the stores check the window's role. They are loaded in both windows, because
`App` renders in both, and without the check the overlay would keep writing.

The same `FragmentView` also paints the list in the main window. One rendering, one
blueprint, two windows.

## Alternatives

**Patch each case individually.** Send the mode with every edge, limit the storage to
one writer. Both happened (0.98.0 and 0.99.0) and both were right, but they do not
remove the shape: the next piece of state both windows hold has the same problem again.

**Let the overlay keep parsing and just synchronise better.** Keeps two derivations of
the same truth alive. Every guarantee about them has to be upheld instead of not being
needed.

**Put the state into the Rust backend.** A third instance for something that belongs to
the main window. Rust holds what concerns the outside world: Client.txt, network, cache,
window geometry, updates.

## Consequences

* The overlay is empty without a running main window. That is honest: it only exists
  because the main window creates it.
* `loadRouteFromCache` goes, as does delivering the mode to the overlay and its route
  store. The rework removes code on balance.
* On every zone change a view is built and sent. Measured: 0.01 ms per edge, 0.097 ms
  for all 488 steps of the list.
* A step crosses the boundary as JSON. A test pins that nothing gets lost on the way.
