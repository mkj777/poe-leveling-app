import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The migration only runs when a persisted state with an older version is
 * present. So exactly that is set up: put the old state into storage, load
 * the module fresh, look at the result.
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

describe('settings migration', () => {
  beforeEach(() => localStorage.clear());

  it('rescues the path from version 1', async () => {
    const state = await loadWith(
      {
        clientTxtPath: 'C:/poe/Client.txt',
        displayPosition: { x: 400, y: 900 },
        growDirection: 'up'
      },
      1
    );

    expect(state.clientTxtPath).toBe('C:/poe/Client.txt');
  });

  it('discards the absolute position from version 1', async () => {
    const state = await loadWith(
      { clientTxtPath: '', displayPosition: { x: 400, y: 900 } },
      1
    );

    expect(state.overlayOffset).toEqual({ dx: 0, dy: 0 });
    expect(state).not.toHaveProperty('displayPosition');
    expect(state).not.toHaveProperty('growDirection');
  });

  it('discards a runaway offset from version 2', async () => {
    // Exactly the value that once pushed the overlay 256 px to the right and
    // 242 px down.
    const state = await loadWith(
      { clientTxtPath: '', overlayOffset: { dx: 0.125, dy: 0.21 } },
      2
    );

    expect(state.overlayOffset).toEqual({ dx: 0, dy: 0 });
  });

  it('sets the anchor from version 3 to the new default', async () => {
    const state = await loadWith(
      { clientTxtPath: '', overlayAnchor: 'minimap' },
      3
    );

    expect(state.overlayAnchor).toBe('bottom');
  });

  it('handles an empty persisted state', async () => {
    const state = await loadWith(undefined, 1);

    expect(state.clientTxtPath).toBe('');
    expect(state.overlayScale).toBe(1);
    expect(state.overlayOpacity).toBe(0.35);
    expect(state.overlayAnchor).toBe('bottom');
  });

  it('leaves a current state untouched', async () => {
    const state = await loadWith(
      {
        clientTxtPath: 'C:/poe/Client.txt',
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
