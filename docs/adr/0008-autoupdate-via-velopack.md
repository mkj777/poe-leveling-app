# ADR-0008: Autoupdate via Velopack instead of the Tauri updater

Date: 2026-08-26
Status: accepted

## Context

The inherited configuration pointed at the upstream project: `plugins.updater.endpoints`
referred to releases of `kazte/path-of-levelling`, and `pubkey` carried its Minisign
key. A release of our own would never have been delivered that way, a foreign one would.
So the updater had to be touched anyway.

Distribution was an MSI. An update therefore downloaded the full package every time, and
the 194 zone images under `resources/zones` make up most of it, although they practically
never change between two versions.

## Decision

Autoupdate runs through Velopack. `tauri-plugin-updater` and `tauri-plugin-process` go,
`bundle.active` is `false`. Tauri only delivers the bare program,
`scripts/release-velopack.mjs` assembles a package directory from it and calls `vpk`.
The update logic lives entirely in `src-tauri/src/updater.rs`. The frontend triggers
nothing, it only learns that something happened.

The flow is split across two moments:

* At startup, `check_and_download` checks in the background and downloads a package it
  finds. It is not applied at that point, otherwise the app would have to restart in the
  middle of a game.
* On exit, `apply_on_exit` hands a waiting package to the Velopack updater, which installs
  it once the process is gone. The next start runs the new version.

The order is not a matter of taste. `wait_exit_then_apply_updates` launches the updater
with `--waitPid` on our own process, and it waits at most 60 seconds. Called at startup
it would have given up long before anyone closes the app again.

On exit the package folder is asked (`get_update_pending_restart`), not memory. That way
a package downloaded by an earlier session that was left behind, say after a crash, gets
installed too.

The release source is `GithubSource` on `mkj777/poe-leveling-app`. The tag is the source
of truth for the version; the workflow aborts if `tauri.conf.json` differs.

## Alternatives

**Keep the Tauri updater, swap endpoints and key.** Less rework and one more Minisign key
pair to manage. Still full downloads per update, and the MSI installer runs with
elevated rights.

**No autoupdate at all, just release downloads.** The guide changes in bursts at league
start. That is exactly when nobody wants to reinstall by hand.

## Consequences

* Delta updates, but only with a predecessor in the output directory. `vpk pack`
  computes the delta against a package that is already there. The CI runner starts
  empty, which is why 0.92.0 and 0.93.0 contained only full packages and every update
  downloaded 5.5 MB. Locally this never showed, because the previous version from the
  last run was still lying around. `scripts/release-velopack.mjs` now fetches it before
  packing with `vpk download github`, and `deltaMissing` aborts if no delta appears
  despite a predecessor. Without this check the bug slipped through silently for two
  releases. Measured 0.93.0 → 0.94.0: 286 KB instead of 5.56 MB.
* Per-user installation into `%LocalAppData%`, no elevation prompt.
* No signing keys needed. Velopack verifies SHA via the release feed.
* No dialog, no button, no restart mid-session. The UI only shows that a new version
  runs on the next start.
* Without a Velopack installation, that is, in development and portable builds, nothing
  happens. That is not an error and is not reported as one.
* The resources the MSI bundler used to pack had to be placed next to the executable by
  hand in the script. With ADR-0009 there are none left. A test pins the script and
  `updater.rs` to the same repository.
* `vpk` is a dotnet tool and therefore a dependency of the release chain, not of the
  application.
