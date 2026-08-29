import { afterEach, describe, expect, it, vi } from 'vitest';

import { OVERLAY_ROUTE, OVERLAY_WINDOW_URL } from '../constants';
import { isOverlayPath, isOverlayWindow } from '../window-role';

describe('isOverlayPath', () => {
  it('erkennt die Route des Overlays mit und ohne Rautezeichen', () => {
    expect(isOverlayPath('#/overlay')).toBe(true);
    expect(isOverlayPath('/overlay')).toBe(true);
  });

  it('haelt das Hauptfenster und seine Unterseiten heraus', () => {
    expect(isOverlayPath('')).toBe(false);
    expect(isOverlayPath('#/')).toBe(false);
    expect(isOverlayPath('#/settings')).toBe(false);
  });

  it('passt zu der Adresse, unter der das Fenster wirklich angelegt wird', () => {
    // Der eigentliche Zweck des Tests. Die Rolle eines Fensters wird aus dem
    // Hash abgeleitet, die Adresse steht in app.state.ts. Laufen die beiden
    // auseinander, speichert das Overlay wieder mit.
    const hash = new URL(OVERLAY_WINDOW_URL, 'http://localhost/').hash;

    expect(hash).toBe(`#${OVERLAY_ROUTE}`);
    expect(isOverlayPath(hash)).toBe(true);
  });
});

describe('isOverlayWindow', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('ist ohne location nichts, etwa im Testlauf', () => {
    expect(isOverlayWindow()).toBe(false);
  });

  it('liest die Rolle aus der Adresse des Fensters', () => {
    vi.stubGlobal('location', { hash: '#/overlay' });
    expect(isOverlayWindow()).toBe(true);

    vi.stubGlobal('location', { hash: '#/settings' });
    expect(isOverlayWindow()).toBe(false);
  });
});
