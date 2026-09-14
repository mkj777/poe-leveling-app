import { describe, expect, it } from 'vitest';

import type { OverlayAnchor, PoeBounds } from '../overlay-geometry';
import {
  computeOverlayRect,
  offsetFromWindow,
  overlayWidth
} from '../overlay-geometry';

const ANCHORS: OverlayAnchor[] = ['bottom', 'minimap'];

const FHD: PoeBounds = {
  x: 0,
  y: 0,
  w: 1920,
  h: 1080,
  focused: true,
  exclusiveFullscreen: false,
  found: true
};

const NO_OFFSET = { dx: 0, dy: 0 };

const finite = (value: number) => Number.isFinite(value);

describe('edge cases of the game bounds', () => {
  // Exactly what PoeBounds::not_found() from the backend returns. The caller
  // checks found, but the computation must still not spit out NaN, otherwise
  // nonsense lands in setPosition.
  const zero: PoeBounds = { ...FHD, w: 0, h: 0, found: false };

  for (const anchor of ANCHORS) {
    it(`returns finite values at size zero, anchor ${anchor}`, () => {
      const rect = computeOverlayRect(zero, 120, 1, NO_OFFSET, anchor);

      expect(finite(rect.x)).toBe(true);
      expect(finite(rect.y)).toBe(true);
      expect(finite(rect.width)).toBe(true);
    });

    it(`computes no offset from a rect without size, anchor ${anchor}`, () => {
      const offset = offsetFromWindow(
        zero,
        { x: 0, y: 0, width: 500, height: 120 },
        anchor
      );

      expect(finite(offset.dx)).toBe(true);
      expect(finite(offset.dy)).toBe(true);
    });
  }

  it('keeps the minimum width even with a tiny game window', () => {
    const tiny: PoeBounds = { ...FHD, w: 320, h: 240 };

    expect(overlayWidth(tiny, 1)).toBe(320);
  });

  it('handles negative monitor coordinates', () => {
    const left: PoeBounds = { ...FHD, x: -1920, y: 129 };
    const rect = computeOverlayRect(left, 200, 1, NO_OFFSET, 'bottom');

    expect(rect.x).toBeLessThan(0);
    expect(finite(rect.y)).toBe(true);
  });

  it('follows a very wide aspect ratio', () => {
    const ultrawide: PoeBounds = { ...FHD, w: 5120, h: 1440 };
    const rect = computeOverlayRect(ultrawide, 200, 1, NO_OFFSET, 'bottom');

    // Centred means centred, even when the width has long been clamped.
    expect(Math.abs(rect.x + rect.width / 2 - 2560)).toBeLessThanOrEqual(0.5);
  });
});

describe('edge cases of the scale', () => {
  it('stays computable at scale zero', () => {
    const rect = computeOverlayRect(FHD, 120, 0, NO_OFFSET, 'bottom');

    expect(rect.width).toBe(0);
    expect(finite(rect.x)).toBe(true);
  });

  it('always rounds to whole pixels', () => {
    for (const scale of [0.63, 0.77, 1.11, 1.37, 1.99]) {
      const rect = computeOverlayRect(FHD, 137, scale, NO_OFFSET, 'bottom');

      expect(Number.isInteger(rect.x)).toBe(true);
      expect(Number.isInteger(rect.y)).toBe(true);
      expect(Number.isInteger(rect.width)).toBe(true);
    }
  });
});

describe('edge cases of the offset', () => {
  it('can be pushed off screen without breaking', () => {
    const rect = computeOverlayRect(FHD, 200, 1, { dx: 5, dy: 5 }, 'bottom');

    // Deliberately not clamped: anyone dragging far should be able to, and
    // the reset button brings it back. All that is required is that the
    // computation runs and nothing tips over.
    expect(finite(rect.x)).toBe(true);
    expect(rect.x).toBeGreaterThan(FHD.w);
  });

  for (const anchor of ANCHORS) {
    it(`stays stable over many rounds, anchor ${anchor}`, () => {
      // This is the bug that once drove the overlay off screen: compute, read
      // back, compute again. After twenty rounds the same value must stand.
      let offset = { dx: 0.07, dy: -0.04 };

      for (let round = 0; round < 20; round++) {
        const rect = computeOverlayRect(FHD, 180, 1.3, offset, anchor);
        offset = offsetFromWindow(
          FHD,
          { x: rect.x, y: rect.y, width: rect.width, height: 180 },
          anchor
        );
      }

      expect(offset.dx).toBeCloseTo(0.07, 2);
      expect(offset.dy).toBeCloseTo(-0.04, 2);
    });
  }
});
