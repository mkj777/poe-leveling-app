# ADR-0007: Path of Building import deferred for now

Date: 2026-08-25
Status: accepted

## Context

Upstream can generate build-dependent gem steps. The way there goes through a PoB code
(Base64, zlib inflate, XML), from which `findCharacterGems` and `buildGemSteps` derive
the steps. Without a PoB code, `routeSelector` returns the base route unchanged.

Requirement: the guide should be build-independent and cover all passive points plus the
end of the campaign. PoB is explicitly optional, untested and not important.

## Decision

The route is generated with `requiredGems = []`, that is, without gem steps. This matches
exactly the reference export with `pob-code:none`.

`findCharacterGems` and `buildGemSteps` are copied along during vendoring so the module
boundary stays intact. The PoB decoder is not built.

## Alternatives

**Build PoB right away.** Doubles the scope for an explicitly secondary benefit.

**Leave the gem code out of the vendoring.** Saves nothing worth mentioning and makes a
later retrofit more expensive.

## Consequences

* The overlay text contains no gem reminders.
* The last step of the route stays and checks the 23 quest passive points with
  `/passives`, which covers the requirement directly.
* Retrofitting later only needs the decoder plus two settings (class, PoB code), not a
  rework of the pipeline.
