import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Die Migration laeuft nur, wenn ein gespeicherter Stand mit aelterer Version
 * vorliegt. Also wird genau das hergestellt: alten Stand in den Speicher
 * legen, Modul frisch laden, Ergebnis ansehen.
 */
async function loadWith(persisted: unknown, version: number) {
  localStorage.clear();
  localStorage.setItem(
    'settings',
    JSON.stringify({ state: persisted, version })
  );

  vi.resetModules();
  const { useSettingsStore } = await import('../settings.store');
  return useSettingsStore.getState();
}

describe('Migration der Einstellungen', () => {
  beforeEach(() => localStorage.clear());

  it('rettet Pfad und Layout-Schalter aus Version 1', async () => {
    const state = await loadWith(
      {
        clientTxtPath: 'C:/poe/Client.txt',
        showLayout: false,
        displayPosition: { x: 400, y: 900 },
        growDirection: 'up'
      },
      1
    );

    expect(state.clientTxtPath).toBe('C:/poe/Client.txt');
    expect(state.showLayout).toBe(false);
  });

  it('verwirft die absolute Position aus Version 1', async () => {
    const state = await loadWith(
      { clientTxtPath: '', displayPosition: { x: 400, y: 900 } },
      1
    );

    expect(state.overlayOffset).toEqual({ dx: 0, dy: 0 });
    expect(state).not.toHaveProperty('displayPosition');
    expect(state).not.toHaveProperty('growDirection');
  });

  it('verwirft einen weggelaufenen Offset aus Version 2', async () => {
    // Genau der Wert, der das Overlay einmal 256 px nach rechts und 242 px
    // nach unten geschoben hat.
    const state = await loadWith(
      { clientTxtPath: '', overlayOffset: { dx: 0.125, dy: 0.21 } },
      2
    );

    expect(state.overlayOffset).toEqual({ dx: 0, dy: 0 });
  });

  it('setzt den Anker aus Version 3 auf den neuen Standard', async () => {
    const state = await loadWith(
      { clientTxtPath: '', overlayAnchor: 'minimap' },
      3
    );

    expect(state.overlayAnchor).toBe('bottom');
  });

  it('kommt mit einem leeren gespeicherten Stand zurecht', async () => {
    const state = await loadWith(undefined, 1);

    expect(state.clientTxtPath).toBe('');
    expect(state.showLayout).toBe(true);
    expect(state.overlayScale).toBe(1);
    expect(state.overlayOpacity).toBe(0.35);
    expect(state.overlayAnchor).toBe('bottom');
  });

  it('laesst einen aktuellen Stand unangetastet', async () => {
    const state = await loadWith(
      {
        clientTxtPath: 'C:/poe/Client.txt',
        showLayout: true,
        overlayScale: 1.5,
        overlayOpacity: 0.9,
        overlayOffset: { dx: 0.05, dy: 0.05 },
        overlayAnchor: 'minimap'
      },
      4
    );

    expect(state.overlayScale).toBe(1.5);
    expect(state.overlayOpacity).toBe(0.9);
    expect(state.overlayAnchor).toBe('minimap');
  });
});
