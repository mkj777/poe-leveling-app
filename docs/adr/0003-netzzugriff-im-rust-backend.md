# ADR-0003: Netzzugriff im Rust-Backend, CSP bleibt geschlossen

Datum: 2026-08-25
Status: angenommen

## Kontext

`src-tauri/tauri.conf.json` setzt
`"csp": "default-src 'self'; img-src 'self' asset: https://asset.localhost"`.
Ein `fetch` aus dem Frontend auf `api.github.com` oder `raw.githubusercontent.com` wird
davon blockiert. Die Tauri-Allowlist enthält bislang kein `http`-Modul.

## Entscheidung

Der gesamte Netzzugriff liegt in `src-tauri/src/data_sync.rs` und wird über
Tauri-Commands angesprochen. Die CSP bleibt unverändert. Als HTTP-Client dient `reqwest`
mit `rustls-tls`.

## Alternativen

**CSP um `connect-src https://api.github.com https://raw.githubusercontent.com` erweitern.**
Weniger Rust-Code, öffnet aber die Content-Security-Policy für alles im Renderer und
verlagert Dateicaching ins Frontend, wo es keinen guten Platz hat.

**Tauri-`http`-Allowlist aktivieren.** Ähnliche Öffnung, zusätzlich ein Scope, der
gepflegt werden muss.

## Konsequenzen

* Der Renderer bleibt ohne ausgehende Netzrechte.
* Cache-Schreiben, atomares Umbenennen und Manifest-Pflege liegen dort, wo das Dateisystem
  ohnehin angesprochen wird.
* `rustls-tls` statt `openssl` vermeidet die Build-Kette, die im Repo bereits einen
  Dependabot-Bump ausgelöst hat.
