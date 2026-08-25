# ADR-0005: Overlay koppelt sich per SetWinEventHook an das Spielfenster

Datum: 2026-08-25
Status: angenommen

## Kontext

Das Overlay soll sich selbst platzieren und dem Spielfenster folgen. Das Vorbild
`awakened-poe-trade-extended` nutzt `electron-overlay-window` plus `uiohook-napi`
(`main/src/windowing/GameWindow.ts`, `OverlayWindow.ts`). Beides ist an Electron gebunden
und für Tauri 1.5 nicht verfügbar.

Im Projekt existiert bereits Win32-Code: `EnumWindows` und `SetForegroundWindow` in
`src-tauri/src/main.rs`, plus `winapi` als Abhängigkeit.

## Entscheidung

Neues Modul `src-tauri/src/overlay.rs`. Es sucht das Fenster mit Titel `Path of Exile`,
registriert `SetWinEventHook` auf `EVENT_OBJECT_LOCATIONCHANGE` und
`EVENT_SYSTEM_FOREGROUND` und sendet bei jeder Änderung ein `poe-bounds`-Event mit
Position, Größe, Fokus und Fullscreen-Verdacht an das Frontend.

Der bestehende Polling-Befehl `check_poe_window` entfällt.

## Alternativen

**Weiter pollen mit `useInterval`.** Einfacher, aber sichtbares Nachziehen beim Verschieben
und dauerhafte Last.

**Auf Tauri 2 wechseln, um bessere Fenster-APIs zu bekommen.** Löst das Kernproblem nicht,
das Win32-Tracking wäre identisch, und vergrößert den Umbau erheblich.

## Konsequenzen

* Sofortige Reaktion auf Verschieben, Resize, Fokuswechsel, ohne Timer.
* Windows-only. Das Projekt zielt ohnehin nur auf Windows.
* Zwei bekannte Grenzen werden erkannt und gemeldet statt still zu scheitern:
  Exklusiv-Fullscreen (`docs/download.md:31` im Nachbar-Repo listet nur Windowed und
  Windowed Fullscreen als unterstützt) und ein mit Adminrechten gestartetes Spiel.
