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

describe('Randfaelle der Spielbounds', () => {
  // Genau das liefert PoeBounds::not_found() aus dem Backend. Der Aufrufer
  // prueft found, aber die Rechnung darf trotzdem keine NaN ausspucken, sonst
  // landet Unsinn in setPosition.
  const zero: PoeBounds = { ...FHD, w: 0, h: 0, found: false };

  for (const anchor of ANCHORS) {
    it(`liefert endliche Werte bei Groesse null, Anker ${anchor}`, () => {
      const rect = computeOverlayRect(zero, 120, 1, NO_OFFSET, anchor);

      expect(finite(rect.x)).toBe(true);
      expect(finite(rect.y)).toBe(true);
      expect(finite(rect.width)).toBe(true);
    });

    it(`rechnet keinen Offset aus einem Rect ohne Groesse, Anker ${anchor}`, () => {
      const offset = offsetFromWindow(
        zero,
        { x: 0, y: 0, width: 500, height: 120 },
        anchor
      );

      expect(finite(offset.dx)).toBe(true);
      expect(finite(offset.dy)).toBe(true);
    });
  }

  it('haelt die Mindestbreite auch bei winzigem Spielfenster', () => {
    const tiny: PoeBounds = { ...FHD, w: 320, h: 240 };

    expect(overlayWidth(tiny, 1)).toBe(320);
  });

  it('kommt mit negativen Monitorkoordinaten zurecht', () => {
    const left: PoeBounds = { ...FHD, x: -1920, y: 129 };
    const rect = computeOverlayRect(left, 200, 1, NO_OFFSET, 'bottom');

    expect(rect.x).toBeLessThan(0);
    expect(finite(rect.y)).toBe(true);
  });

  it('folgt einem sehr breiten Seitenverhaeltnis', () => {
    const ultrawide: PoeBounds = { ...FHD, w: 5120, h: 1440 };
    const rect = computeOverlayRect(ultrawide, 200, 1, NO_OFFSET, 'bottom');

    // Mittig heisst mittig, auch wenn die Breite laengst geklemmt ist.
    expect(Math.abs(rect.x + rect.width / 2 - 2560)).toBeLessThanOrEqual(0.5);
  });
});

describe('Randfaelle der Skalierung', () => {
  it('bleibt bei Skalierung null berechenbar', () => {
    const rect = computeOverlayRect(FHD, 120, 0, NO_OFFSET, 'bottom');

    expect(rect.width).toBe(0);
    expect(finite(rect.x)).toBe(true);
  });

  it('rundet immer auf ganze Pixel', () => {
    for (const scale of [0.63, 0.77, 1.11, 1.37, 1.99]) {
      const rect = computeOverlayRect(FHD, 137, scale, NO_OFFSET, 'bottom');

      expect(Number.isInteger(rect.x)).toBe(true);
      expect(Number.isInteger(rect.y)).toBe(true);
      expect(Number.isInteger(rect.width)).toBe(true);
    }
  });
});

describe('Randfaelle des Offsets', () => {
  it('laesst sich aus dem Bild schieben, ohne zu brechen', () => {
    const rect = computeOverlayRect(FHD, 200, 1, { dx: 5, dy: 5 }, 'bottom');

    // Bewusst nicht geklemmt: wer weit zieht, soll es auch koennen, und der
    // Zuruecksetzen-Knopf holt es wieder. Gefordert ist nur, dass gerechnet
    // wird und nichts kippt.
    expect(finite(rect.x)).toBe(true);
    expect(rect.x).toBeGreaterThan(FHD.w);
  });

  for (const anchor of ANCHORS) {
    it(`bleibt ueber viele Runden stabil, Anker ${anchor}`, () => {
      // Das ist der Fehler, der das Overlay einmal aus dem Bild getrieben hat:
      // rechnen, zuruecklesen, wieder rechnen. Nach zwanzig Runden muss
      // derselbe Wert stehen.
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
