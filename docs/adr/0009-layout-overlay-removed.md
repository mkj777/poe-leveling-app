# ADR-0009: Layout overlay removed, images come only from the bundle

Date: 2026-08-26
Status: accepted

## Context

Next to the step overlay ran a second window labelled `layoutmap`. It stuck to the left
edge of the screen, was 141 × 77 pixels, had no caption and showed zone images from
`src-tauri/resources/zones`. The 194 PNGs made up 7.3 MB of the 7.6 MB program
packages.

In release 0.91.0 it only showed broken images. The reason lies in the move to Velopack
(ADR-0008): the MSI bundler is gone, the release script places the resources next to the
executable by hand, and `convertFileSrc` serves them through the asset protocol, whose
scope and CSP entry no longer held up.

More important than the bug was the feedback on it: "no idea what it does". An overlay
whose purpose is not obvious in game is worthless even when repaired.

Separately, two icons were missing in the step overlay. Vite inlines files below
`assetsInlineLimit` (default 4096 bytes) as `data:` URIs into the bundle. `quest.png`
(3991 B) and `town.png` (3944 B) were just below, the four other icons just above. The
CSP allows only `self` for images, so exactly those two stayed blank. The dev server
never showed it, because it serves every file individually.

## Decision

The `layoutmap` window is removed entirely: page, route, window creation, the
`showLayout` switch, `tauri.utilities.ts`, the capability entry, the asset protocol with
its scope, the `fs` plugin on both sides and the 194 PNGs.

For the remaining images `assetsInlineLimit: 0` applies. All assets are shipped as files
so that a byte threshold does not decide whether an image arrives. The CSP stays as tight
as it is, `img-src` allows only `self`.

## Alternatives

**Repair the asset protocol and keep the window.** Would have brought the images back,
but not an answer to what the window is for.

**Allow `data:` in the CSP.** One word instead of one configuration line, but widens the
policy and leaves the byte threshold as a silent condition.

**Embed layouts into the step overlay later.** Remains possible. The images can be
recovered with `git checkout 47ebd2e -- src-tauri/resources/zones`.

## Consequences

* One overlay window instead of two; the remaining one sits at the bottom centre.
* The program package shrinks less than the 7.3 MB raw size suggests, because PNGs do
  not compress further inside the package: `full.nupkg` from 7,320,873 to 5,568,773
  bytes, `Setup.exe` from 11,807,017 to 10,054,917 bytes. The delta updates from
  ADR-0008 do not get worse; they were small anyway.
* A stored `showLayout` entry stays in the settings. The store version stays at 4,
  because bumping it would trigger the migration again and reset size, opacity and
  offset of the overlay.
* `src/utilities/__tests__/asset-policy.test.ts` keeps the inline limit and the CSP
  together.
