import { describe, expect, it } from 'vitest';

import type { PoeBounds } from '../overlay-geometry';
import { computeOverlayRect, offsetFromWindow } from '../overlay-geometry';

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

describe('computeOverlayRect, anchor bottom centre', () => {
  it('centres horizontally', () => {
    const rect = computeOverlayRect(FHD, 200, 1, NO_OFFSET, 'bottom');

    // With an odd width the centre inevitably sits on .5; what is required
    // is centring to within half a pixel.
    expect(Math.abs(rect.x + rect.width / 2 - 960)).toBeLessThanOrEqual(0.5);
  });

  it('puts the bottom edge just above the XP bar', () => {
    const rect = computeOverlayRect(FHD, 200, 1, NO_OFFSET, 'bottom');
    // 1080 * (1.0 - 0.03) = 1047.6, minus height 200
    expect(rect.y).toBe(848);
  });

  it('does not touch the measured XP bar', () => {
    // Measured at 2560x1440: the bar starts at 97.9% of the height.
    const qhd: PoeBounds = { ...FHD, w: 2560, h: 1440 };
    const rect = computeOverlayRect(qhd, 200, 1, NO_OFFSET, 'bottom');

    expect(rect.y + 200).toBeLessThan(qhd.h * 0.979);
  });

  it('grows upwards, the bottom edge stays put', () => {
    const short = computeOverlayRect(FHD, 120, 1, NO_OFFSET, 'bottom');
    const tall = computeOverlayRect(FHD, 300, 1, NO_OFFSET, 'bottom');

    expect(short.y + 120).toBe(tall.y + 300);
  });
});

describe('computeOverlayRect, anchor below the minimap', () => {
  it('hangs at the top right and grows downwards', () => {
    const rect = computeOverlayRect(FHD, 200, 1, NO_OFFSET, 'minimap');

    // 1920 * (1 - 0.005) = 1910.4 as the right edge
    expect(rect.x + rect.width).toBe(1910);
    // 1080 * 0.28 = 302.4 as the top edge
    expect(rect.y).toBe(302);
  });

  it('keeps the top edge when the content grows', () => {
    const short = computeOverlayRect(FHD, 120, 1, NO_OFFSET, 'minimap');
    const tall = computeOverlayRect(FHD, 300, 1, NO_OFFSET, 'minimap');

    expect(short.y).toBe(tall.y);
  });

  it('stays below the measured bottom edge of the minimap', () => {
    // Measured at 2560x1440: minimap down to 25.7%, info panel down to 19.8%.
    const qhd: PoeBounds = { ...FHD, w: 2560, h: 1440 };
    const rect = computeOverlayRect(qhd, 200, 1, NO_OFFSET, 'minimap');

    expect(rect.y).toBeGreaterThan(qhd.h * 0.257);
    expect(rect.y).toBeGreaterThan(qhd.h * 0.198);
  });
});

describe('computeOverlayRect, width', () => {
  it('clamps the base width, not the result', () => {
    const wide: PoeBounds = { ...FHD, w: 4000 };
    // 4000 * 0.26 = 1040, base width is clamped to 560
    expect(computeOverlayRect(wide, 200, 1, NO_OFFSET, 'bottom').width).toBe(
      560
    );

    const small: PoeBounds = { ...FHD, w: 800, h: 600 };
    // 800 * 0.26 = 208, base width is raised to 320
    expect(computeOverlayRect(small, 200, 1, NO_OFFSET, 'bottom').width).toBe(
      320
    );
  });

  it('always lets the scale affect the width', () => {
    const at = (scale: number) =>
      computeOverlayRect(FHD, 200, scale, NO_OFFSET, 'bottom').width;

    expect(at(1)).toBe(499);
    expect(at(2)).toBe(998);
    expect(at(0.6)).toBe(300);

    for (let scale = 0.6; scale < 2; scale += 0.1) {
      expect(at(Math.round((scale + 0.1) * 10) / 10)).toBeGreaterThan(at(scale));
    }
  });
});

describe('computeOverlayRect, offset', () => {
  it('computes the offset relative to the game rect', () => {
    const shifted = computeOverlayRect(
      FHD,
      200,
      1,
      { dx: 0.1, dy: -0.05 },
      'bottom'
    );
    const base = computeOverlayRect(FHD, 200, 1, NO_OFFSET, 'bottom');

    expect(shifted.x - base.x).toBe(192);
    expect(shifted.y - base.y).toBe(-54);
  });

  it('stays relatively the same at a different resolution', () => {
    const qhd: PoeBounds = { ...FHD, w: 2560, h: 1440 };
    const offset = { dx: 0.1, dy: -0.05 };

    const fhd = computeOverlayRect(FHD, 200, 1, offset, 'bottom');
    const wide = computeOverlayRect(qhd, 200, 1, offset, 'bottom');

    expect((wide.x + wide.width / 2) / qhd.w).toBeCloseTo(
      (fhd.x + fhd.width / 2) / FHD.w,
      3
    );
  });

  it('accounts for the window position on a second monitor', () => {
    const second: PoeBounds = { ...FHD, x: 1920, y: -120 };
    const rect = computeOverlayRect(second, 200, 1, NO_OFFSET, 'bottom');

    expect(Math.abs(rect.x + rect.width / 2 - 2880)).toBeLessThanOrEqual(0.5);
    // -120 + 1080 * 0.97 - 200
    expect(rect.y).toBe(728);
  });
});

describe('offsetFromWindow', () => {
  // Dragging and computing must cancel each other out, otherwise the overlay
  // wanders a bit further on every cycle.
  for (const anchor of ['bottom', 'minimap'] as const) {
    it(`is the inverse of computeOverlayRect, anchor ${anchor}`, () => {
      const offset = { dx: 0.08, dy: -0.03 };
      const rect = computeOverlayRect(FHD, 200, 1, offset, anchor);

      const back = offsetFromWindow(
        FHD,
        { x: rect.x, y: rect.y, width: rect.width, height: 200 },
        anchor
      );

      expect(back.dx).toBeCloseTo(offset.dx, 3);
      expect(back.dy).toBeCloseTo(offset.dy, 3);
    });
  }
});
