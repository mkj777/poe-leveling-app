# ADR-0010: The displayed step is the next one, not the transition just made

Date: 2026-08-26
Status: accepted

## Context

Progress runs on `currentEdge` (ADR-0004). The parser, however, assigns the `edgeIndex`
with the **target** zone, not the start zone (`route-processing/index.ts:213`):

```
EDGE 1 area=1_1_town  ["➞ ", enter 1_1_town]
EDGE 2 area=1_1_2     ["➞ ", enter 1_1_2]
```

`advanceEdge` jumps to edge N as soon as `Client.txt` reports the zone `edges[N]`. At
that moment the head step of segment N is already done: it is the transition that just
brought you there.

The overlay still showed the head step first and largest. In the real route, 247 of 248
head steps are transitions (`enter`, `waypoint_use`, `logout`, `portal_use`, `ascend`),
and 101 of 248 segments consist **only** of the head step. On entering such a zone there
was exactly one line: the transition you had just made.

## Decision

`selectPending` replaces `selectSegment` in the overlay. The head step is dropped. What
remains is the rest of the zone, followed by the next transition as the actual next
action. When the route is finished, the reached step stays instead of clearing the card.

The list view in the main window renders `groupSteps`: one block per edge instead of one
line per step. The separator thus lands where a step really ends, and a block is exactly
what "Jump here" jumps to. Before, every line carried a separator, and it was impossible
to see which text still belonged to the same step. The whole block is highlighted; there
the transition is a heading and reads as "you are here", highlighted alone it read as the
next task.

The act heading gets `z-20`. It was `sticky`, but the blocks are positioned relatively
and the jump buttons carried `z-50`, so both painted over it. While scrolling, text ran
straight through the heading.

The scroll container `<main>` also carries **no** padding any more. It belonged to the
scrollable area, text ran through it at the top, and a strip of the previous line showed
above the sticky heading. The spacing now sits in the content (`px-3` on heading and
blocks), so the visual indent stays the same. Reproduced with the built stylesheet, old
and new version scrolled side by side.

## Alternatives

**Let `advanceEdge` run one ahead.** Only shifts the bug: the tasks of the zone just
entered would be skipped.

**Have the parser record the start zone.** It is vendored (ADR-0002); a deviation would
have to be resolved again on every upstream update.

## Consequences

* The top, large line in the overlay is always something still to do.
* The overlay shows the next zone change too, instead of revealing it only after
  entering.
* `selectSegment` is gone. `selectPending` drives the overlay, `groupSteps` the list.
