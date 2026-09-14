# ADR-0002: Vendor the upstream parser instead of rewriting it

Date: 2026-08-25
Status: accepted

## Context

The route DSL has preprocessor directives (`#ifdef`, `#ifndef`, `#endif`), substeps
(`#sub`), sections (`#section`) and about twenty fragment types (`{enter|id}`,
`{waypoint|id}`, `{quest|id}`, `{dir|270}` and more). The parser lives in
`common/src/route-processing/` and is about 13 KB of TypeScript.

History: across 100 data-touching commits the parser was rarely touched, the data
regularly. Licence of the upstream repository: MIT.

## Decision

The parser is copied unchanged to `src/lib/exile-leveling/`, including an
`ATTRIBUTION.md` with the licence text and the sha of the vendored commit. The only
change is `data.ts`: static JSON imports are replaced by a loader over the runtime cache.

A weekly CI job diffs `common/src/route-processing/` against the vendored copy and opens
a pull request when they differ.

## Alternatives

**Write our own parser.** Same data freshness, but duplicated logic and a higher risk of
drift with nothing gained.

**Upstream as an npm dependency.** `common` is a workspace-internal package that is not
published to any registry.

## Consequences

* The app produces bit-identical results to the website. See the golden-file test in the
  spec.
* All files except `data.ts` stay unchanged so that an upstream diff applies cleanly.
* A grammar change breaks the parser. Cushioned by the golden-file test, the CI watcher
  and by keeping the last successfully parsed data.
