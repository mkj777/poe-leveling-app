# ADR-0011: Two guide modes for the route, league start and speedleveling

Date: 2026-08-29
Status: accepted

## Context

So far the guide showed exactly one route: the website's default, with `LEAGUE_START`,
`LIBRARY` and `BANDIT_ALIRA` (ADR-0007). It is tailored to the first character of a
league and collects everything along the way.

On the second character of the same league that no longer fits. Crafting recipes and
completed trials already count there, the steps for them are just detours. Measured on
the snapshot `b7b2dd0`:

| | Count | Shape |
|---|---|---|
| Crafting steps | 47 | 46x `Get {crafting}`, 1x mixed |
| Trial steps | 12 | 11x `Complete {trial}`, 1x mixed |
| of those with an `edgeIndex` | **0** | none is a zone change |

The last row carries the whole decision. Progress hangs exclusively on the `edgeIndex`
(ADR-0004), and not one of these 59 steps carries one. They can be removed without the
overlay, "Jump here" or re-anchoring after a restart noticing anything.

The two mixed steps are the only ones of their kind in the whole route:

```
➞ {arena|Eternal Laboratory}, get {crafting}          Act 3
Before {waypoint}, complete {trial}                   Act 9
```

Both should go entirely. The Laboratory is entered only for the recipe, and the waypoint
in Act 9 is the location hint for the trial, not a task of its own.

Upstream already has a switch for this distinction in `LEAGUE_START`. On its own it is
not enough: it covers all 12 trials but only 7 of the 47 crafting steps. 40 would stay,
among them the Act 3 case, which sits in no `#ifdef` at all.

## Decision

Two modes, in `src/utilities/guide-mode.ts`.

`league-start` is the previous flow, unchanged. `speedleveling` acts in two places:

1. **Preprocessor.** Without `LEAGUE_START` the detours that exist only at league start
   disappear: Tidal Island with Hailrake, The Den, the Catacombs, the Silver Locket, the
   Ossuary and the search for the Chemist's Strongbox.
2. **Filter afterwards.** `filterRoute` removes what the preprocessor does not cover.

Result: 488 steps on 248 edges become 409 on 236.

The filter rule is deliberately conservative. A step is dropped only if

* it contains crafting or trial, **and**
* it carries no `edgeIndex`, **and**
* apart from crafting and trial only location references remain
  (`area`, `arena`, `waypoint`, `dir`, `copy`).

A future "Kill X, get Crafting" would therefore stay, recipe included. Better one line
too many than a boss overlooked. The third condition is exactly what drops the two mixed
steps without maintaining an exception per text passage.

The mode is asked for after eleven days without a start. A league runs about 13 weeks;
anyone who has not looked in for that long almost always starts over. Both answers reset
progress to Act 1, a third one leaves everything as it is. On the very first start
nothing is asked: there is neither progress nor a mode to deviate from.

The labyrinth steps stay in both modes. Ascendancy points are per character, not per
account, and the three steps carry an edge as well.

## Alternatives

**Only switch `LEAGUE_START` off.** Would leave 40 crafting steps, among them the Act 3
case.

**Only filter, leave `LEAGUE_START` on.** Would leave the league-start detours, which
have just as little business on the second character.

**Cut individual fragments out of mixed steps.** Would produce fragments like
"➞ Eternal Laboratory, get ". A step goes entirely or not at all.

**Filter by icon.** The icon is a function of the fragment type; the type is the more
precise value. Filtering by icon would also catch `ascend`, which shares the trial
marker.

## Consequences

* The edge list has a different length per mode, 248 versus 236. A stored index thus
  means something different depending on the mode. `reanchorEdge` catches this by
  looking up the last entered zone in the new list.
* Four zones exist only at league start. Anyone standing there during the switch finds
  no matching edge. `reanchorEdge` therefore clamps to the new length. Without that the
  index would have pointed past the end and the overlay would have stayed empty, with no
  error message. The Ossuary sits on edge 233, speedleveling has 236: three edges of
  headroom that upstream can use up at any time.
* The overlay parses its route itself and learns mode and edge from the main window,
  see the addendum below.
* A test pins the four shapes in which crafting and trial occur today. If a fifth turns
  up, upstream has built something new, and the rule should be looked at before it runs
  over it.

## Addendum 2026-08-29: the edge index alone is not enough

The first version sent the mode to the overlay only when it changed, but the edge index
on every zone change. That was wrong, and the bug was silent in operation.

Both windows parse the route themselves. If they hold different modes, the same index
means different zones: edge 172 is The Sarn Ramparts in speedleveling and The Causeway
at league start, ten edges earlier. Anyone who jumped there in the main window read
"Get Crafting: Cold Damage - Rank 2, Find and take Kishara's Star" in the overlay. Of
all things, a crafting step that does not exist in speedleveling was the hint at the
wrong mode.

An index is meaningless without the route it points into. So both belong in the same
message:

```ts
export interface GuideState {
  mode: GuideMode;
  currentEdge: number;
}
```

The overlay reloads its route as soon as the reported mode is not the loaded one, and
**only then** sets the edge. A missed message thus heals itself on the next one instead
of staying wrong until a restart.

On startup the overlay emits `overlay-ready`, and the main window answers with the
current state. Before, it read the mode from the shared `localStorage`. That store is
shared between the windows, measured in the running build, but it is the wrong source:
the state belongs to the window that owns it, not to the storage. The same applied to
the edge, which the overlay until then took from its own persisted store and only got
corrected on the next zone change.

The broadcast now sits in `MainRoutes` instead of `MainPage`. The mode is switched on
the settings page, and `MainPage` was no longer mounted there.

## Addendum 2026-08-29: only the main window stores progress

The addendum above makes sure both windows hold the same mode. It removes only the
cause though, not the path along which the bug took hold.

`setCurrentEdge` looks the zone up in its **own** route:

```ts
setCurrentEdge: (currentEdge) =>
  set({ currentEdge, currentAreaId: get().route?.edges[currentEdge] ?? null })
```

Both windows loaded the same persisted entry `route`, and both wrote into it. The
overlay with the league-start route received "edge 172" and stored The Causeway for it,
where the main window meant The Sarn Ramparts. Whoever wrote last won. On the next start
`useRouteSync` re-anchored on that zone and stood ten edges back. The bug thus survived
the restart that should have fixed it.

The overlay therefore no longer gets a store. It neither reads nor writes progress: it
is a display and is told mode and edge anyway.

```ts
export const useRouteStore = isOverlayWindow()
  ? create<RouteStore>()(createState)
  : create<RouteStore>()(persist(createState, { name: 'route', ... }));
```

The role comes from the hash, not from Tauri's window label, so the stores remain
loadable without Tauri in a Node run. The window's address, the route in the router and
the role check share one constant, and a test pins that the address really is recognised
as the overlay. Three separate strings would be three opportunities to drift apart
silently.

With that, duplicated state is no longer unlikely but impossible: there is only one
writer left.
