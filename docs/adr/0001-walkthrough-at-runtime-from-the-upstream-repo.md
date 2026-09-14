# ADR-0001: Fetch the walkthrough at runtime from the upstream repository

Date: 2026-08-25
Status: accepted

## Context

The guide should stay current without anyone updating it by hand. The original wish was
to scrape the website `heartofphos.github.io/exile-leveling`.

The website, however, serves only an empty HTML shell; the content is built client-side.
The real source lives as plain text in the repository: `common/data/routes/act-1..10.txt`
and `common/data/json/*.json`, about 580 KB in total, 28 KB of it route DSL.

Change pattern across 100 commits: a burst of up to 9 commits within 5 days after a
league start, then isolated fixes over months.

## Decision

The app fetches the raw files from `raw.githubusercontent.com` at runtime, pinned to a
specific commit sha. Before that it sends a conditional GET to
`api.github.com/repos/HeartofPhos/exile-leveling/commits?path=common/data&per_page=1`
with `If-None-Match`, once at startup and every 24 hours after that.

## Alternatives

**Headless browser against the website.** Would be robust even against DSL changes,
because the deployed upstream code does the parsing. Costs a Chromium binary of about
150 MB, cannot do a cheap daily diff, does not work offline and breaks with every DOM or
bundle redesign.

**Git submodule plus CI bump.** Simplest at runtime, but every upstream change needs a
new app release. Misses the goal.

## Consequences

* Data updates without a release, even mid-league.
* The sha in the cache path makes the running data version visible and rollbackable.
* Network dependency on first run. Cushioned by the bundled build snapshot.
* The DSL grammar remains a coupling to upstream. See ADR-0002.
