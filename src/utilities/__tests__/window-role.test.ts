import { afterEach, describe, expect, it, vi } from 'vitest';

import { OVERLAY_ROUTE, OVERLAY_WINDOW_URL } from '../constants';
import { isOverlayPath, isOverlayWindow } from '../window-role';

describe('isOverlayPath', () => {
  it('recognises the overlay route with and without the hash sign', () => {
    expect(isOverlayPath('#/overlay')).toBe(true);
    expect(isOverlayPath('/overlay')).toBe(true);
  });

  it('keeps the main window and its subpages out', () => {
    expect(isOverlayPath('')).toBe(false);
    expect(isOverlayPath('#/')).toBe(false);
    expect(isOverlayPath('#/settings')).toBe(false);
  });

  it('matches the address the window is really created with', () => {
    // The actual purpose of the test. A window's role is derived from the
    // hash, the address is in app.state.ts. If the two drift apart, the
    // overlay starts persisting again.
    const hash = new URL(OVERLAY_WINDOW_URL, 'http://localhost/').hash;

    expect(hash).toBe(`#${OVERLAY_ROUTE}`);
    expect(isOverlayPath(hash)).toBe(true);
  });
});

describe('isOverlayWindow', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('is nothing without location, as in the test run', () => {
    expect(isOverlayWindow()).toBe(false);
  });

  it('reads the role from the address of the window', () => {
    vi.stubGlobal('location', { hash: '#/overlay' });
    expect(isOverlayWindow()).toBe(true);

    vi.stubGlobal('location', { hash: '#/settings' });
    expect(isOverlayWindow()).toBe(false);
  });
});
