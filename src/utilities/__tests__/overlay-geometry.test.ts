import { describe, expect, it } from 'vitest';

import type { PoeBounds } from '../overlay-geometry';
import { computeOverlayRect } from '../overlay-geometry';

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

describe('computeOverlayRect', () => {
  it('zentriert horizontal', () => {
    const rect = computeOverlayRect(FHD, 200, 1, NO_OFFSET);

    // Bei ungerader Breite liegt der Mittelpunkt systembedingt auf .5,
    // gefordert ist Zentrierung auf den halben Pixel genau.
    expect(Math.abs(rect.x + rect.width / 2 - 960)).toBeLessThanOrEqual(0.5);
  });

  it('klemmt die Breite nach oben', () => {
    // 1920 * 0.26 = 499.2, liegt unter dem Maximum
    expect(computeOverlayRect(FHD, 200, 1, NO_OFFSET).width).toBe(499);
    // mit scale 2 waeren es 998.4, wird auf 560 geklemmt
    expect(computeOverlayRect(FHD, 200, 2, NO_OFFSET).width).toBe(560);
  });

  it('klemmt die Breite nach unten', () => {
    const small: PoeBounds = { ...FHD, w: 800, h: 600 };
    // 800 * 0.26 * 0.6 = 124.8, wird auf 320 geklemmt
    expect(computeOverlayRect(small, 200, 0.6, NO_OFFSET).width).toBe(320);
  });

  it('setzt die Unterkante ueber die HUD-Zeile', () => {
    const rect = computeOverlayRect(FHD, 200, 1, NO_OFFSET);
    // 1080 * (1.0 - 0.16) = 907.2, minus Hoehe 200
    expect(rect.y).toBe(707);
  });

  it('rechnet den Offset relativ zum Spiel-Rect', () => {
    const shifted = computeOverlayRect(FHD, 200, 1, { dx: 0.1, dy: -0.05 });
    const base = computeOverlayRect(FHD, 200, 1, NO_OFFSET);

    expect(shifted.x - base.x).toBe(192);
    expect(shifted.y - base.y).toBe(-54);
  });

  it('bleibt bei anderer Aufloesung relativ gleich', () => {
    const qhd: PoeBounds = { ...FHD, w: 2560, h: 1440 };
    const offset = { dx: 0.1, dy: -0.05 };

    const fhd = computeOverlayRect(FHD, 200, 1, offset);
    const relativeFhd = (fhd.x + fhd.width / 2) / FHD.w;

    const wide = computeOverlayRect(qhd, 200, 1, offset);
    const relativeQhd = (wide.x + wide.width / 2) / qhd.w;

    expect(relativeQhd).toBeCloseTo(relativeFhd, 3);
  });

  it('beruecksichtigt die Fensterposition auf einem zweiten Monitor', () => {
    const second: PoeBounds = { ...FHD, x: 1920, y: -120 };
    const rect = computeOverlayRect(second, 200, 1, NO_OFFSET);

    expect(Math.abs(rect.x + rect.width / 2 - 2880)).toBeLessThanOrEqual(0.5);
    expect(rect.y).toBe(587);
  });
});
