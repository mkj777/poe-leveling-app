# ADR-0003: Network access in the Rust backend, CSP stays closed

Date: 2026-08-25
Status: accepted

## Context

`src-tauri/tauri.conf.json` sets
`"csp": "default-src 'self'; img-src 'self' asset: https://asset.localhost"`.
A `fetch` from the frontend to `api.github.com` or `raw.githubusercontent.com` is blocked
by it. The Tauri allowlist has no `http` module so far.

## Decision

All network access lives in `src-tauri/src/data_sync.rs` and is reached through Tauri
commands. The CSP stays unchanged. The HTTP client is `reqwest` with `rustls-tls`.

## Alternatives

**Extend the CSP with `connect-src https://api.github.com https://raw.githubusercontent.com`.**
Less Rust code, but opens the content security policy for everything in the renderer and
moves file caching into the frontend, where it has no good place.

**Enable the Tauri `http` allowlist.** A similar opening, plus a scope that has to be
maintained.

## Consequences

* The renderer stays without outbound network rights.
* Cache writes, atomic renames and manifest upkeep live where the file system is touched
  anyway.
* `rustls-tls` instead of `openssl` avoids the build chain that already triggered a
  Dependabot bump in this repository.
