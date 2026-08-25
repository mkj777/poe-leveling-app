# Architecture Decision Records

Entscheidungen zum Umbau auf Laufzeit-Sync mit
[HeartofPhos/exile-leveling](https://github.com/HeartofPhos/exile-leveling) und auf
automatisches Overlay-Placement.

Zugehöriges Design:
[`../superpowers/specs/2026-08-25-exile-leveling-sync-und-auto-overlay-design.md`](../superpowers/specs/2026-08-25-exile-leveling-sync-und-auto-overlay-design.md)

Begriffe: [`../glossary.md`](../glossary.md)

| ADR | Titel | Status |
|---|---|---|
| [0001](0001-walkthrough-zur-laufzeit-aus-dem-upstream-repo.md) | Walkthrough zur Laufzeit aus dem Upstream-Repository holen | angenommen |
| [0002](0002-upstream-parser-vendoren-statt-nachbauen.md) | Upstream-Parser vendoren statt nachbauen | angenommen |
| [0003](0003-netzzugriff-im-rust-backend.md) | Netzzugriff im Rust-Backend, CSP bleibt geschlossen | angenommen |
| [0004](0004-fortschritt-ueber-edgeindex.md) | Fortschritt über edgeIndex statt Area-Namensvergleich | angenommen |
| [0005](0005-overlay-koppelt-per-winevent-hook.md) | Overlay koppelt sich per SetWinEventHook an das Spielfenster | angenommen |
| [0006](0006-anker-plus-relativer-offset.md) | Anker plus relativer Offset und Skalierung statt absoluter Position | angenommen |
| [0007](0007-pob-import-ausgeklammert.md) | Path-of-Building-Import vorerst ausgeklammert | angenommen |
