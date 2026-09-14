# ADR-0004: Progress via edgeIndex instead of comparing area names

Date: 2026-08-25
Status: accepted

## Context

Today `src/pages/main.page.tsx` compares the zone name read from `Client.txt` with
`guide[currentStep].changeAreaId`. Zones are entered several times over the course of the
route (Lioneye's Watch, Submerged Passage, every town), so the comparison is ambiguous.

`parseRoute` already returns `route.edges: areaId[]` and sets an `edgeIndex` on every
step that changes the zone. Upstream uses this in `web/src/state/route.ts`
(`activeEdgeAtom`).

## Decision

Progress is held as `currentEdge: number`. It advances only when the logged zone matches
the next edge:

```ts
const m = /Generating level \d+ area "(.*?)"/.exec(logLine);
if (m && m[1] === route.edges[currentEdge + 1]) currentEdge++;
```

After a data refresh mid-run there is no reset to 0. If no matching edge is found, the
previous index stays and the user is told once.

**Correction of 2026-08-26.** Originally this said "the highest index whose `areaId`
matches the last known zone". That was wrong. 46 of the 149 zones of the route are
entered more than once, The Forest Encampment for instance on edges 135, 137, 145, 150
and 156. `lastIndexOf` always returned 156, and because `useRouteSync` re-anchored on
**every** start, the main window jumped up to 21 edges ahead after a restart. The overlay
stayed correct because it does not go through `useRouteSync`.

The stored index is the more precise value, the zone only the fallback. As long as the
index still points at the same zone it is left alone. Only when that no longer holds,
that is, the route underneath has changed, do we search, and then for the **nearest**
occurrence. On a tie the earlier one wins: standing too far ahead costs a glance,
standing too far behind skips steps.

## Alternatives

**Keep the name comparison.** No rework, but the wrong jumps on repeated zones remain.

**Put progress on the array index of the steps.** Breaks on every refresh, because step
counts shift.

## Consequences

* Unambiguous advance, even when returning to a zone already visited.
* Existing persisted progress is incompatible and is discarded on upgrade (version bump
  in `guide.store`).
* A refresh mid-run becomes manageable in the first place.
