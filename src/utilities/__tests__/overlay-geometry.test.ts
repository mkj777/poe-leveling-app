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

describe('computeOverlayRect, Anker unten mittig', () => {
  it('zentriert horizontal', () => {
    const rect = computeOverlayRect(FHD, 200, 1, NO_OFFSET, 'bottom');

    // Bei ungerader Breite liegt der Mittelpunkt systembedingt auf .5,
    // gefordert ist Zentrierung auf den halben Pixel genau.
    expect(Math.abs(rect.x + rect.width / 2 - 960)).toBeLessThanOrEqual(0.5);
  });

  it('setzt die Unterkante knapp ueber die XP-Leiste', () => {
    const rect = computeOverlayRect(FHD, 200, 1, NO_OFFSET, 'bottom');
    // 1080 * (1.0 - 0.03) = 1047.6, minus Hoehe 200
    expect(rect.y).toBe(848);
  });

  it('beruehrt die gemessene XP-Leiste nicht', () => {
    // Gemessen bei 2560x1440: die Leiste beginnt bei 97,9 % der Hoehe.
    const qhd: PoeBounds = { ...FHD, w: 2560, h: 1440 };
    const rect = computeOverlayRect(qhd, 200, 1, NO_OFFSET, 'bottom');

    expect(rect.y + 200).toBeLessThan(qhd.h * 0.979);
  });

  it('waechst nach oben, die Unterkante bleibt stehen', () => {
    const flach = computeOverlayRect(FHD, 120, 1, NO_OFFSET, 'bottom');
    const hoch = computeOverlayRect(FHD, 300, 1, NO_OFFSET, 'bottom');

    expect(flach.y + 120).toBe(hoch.y + 300);
  });
});

describe('computeOverlayRect, Anker unter der Minimap', () => {
  it('haengt rechts oben und waechst nach unten', () => {
    const rect = computeOverlayRect(FHD, 200, 1, NO_OFFSET, 'minimap');

    // 1920 * (1 - 0.005) = 1910.4 als rechte Kante
    expect(rect.x + rect.width).toBe(1910);
    // 1080 * 0.28 = 302.4 als Oberkante
    expect(rect.y).toBe(302);
  });

  it('laesst die Oberkante stehen, wenn der Inhalt waechst', () => {
    const flach = computeOverlayRect(FHD, 120, 1, NO_OFFSET, 'minimap');
    const hoch = computeOverlayRect(FHD, 300, 1, NO_OFFSET, 'minimap');

    expect(flach.y).toBe(hoch.y);
  });

  it('bleibt unter der gemessenen Minimap-Unterkante', () => {
    // Gemessen bei 2560x1440: Minimap bis 25,7 %, Infotafel bis 19,8 %.
    const qhd: PoeBounds = { ...FHD, w: 2560, h: 1440 };
    const rect = computeOverlayRect(qhd, 200, 1, NO_OFFSET, 'minimap');

    expect(rect.y).toBeGreaterThan(qhd.h * 0.257);
    expect(rect.y).toBeGreaterThan(qhd.h * 0.198);
  });
});

describe('computeOverlayRect, Breite', () => {
  it('klemmt die Grundbreite, nicht das Ergebnis', () => {
    const wide: PoeBounds = { ...FHD, w: 4000 };
    // 4000 * 0.26 = 1040, Grundbreite wird auf 560 geklemmt
    expect(computeOverlayRect(wide, 200, 1, NO_OFFSET, 'bottom').width).toBe(
      560
    );

    const small: PoeBounds = { ...FHD, w: 800, h: 600 };
    // 800 * 0.26 = 208, Grundbreite wird auf 320 angehoben
    expect(computeOverlayRect(small, 200, 1, NO_OFFSET, 'bottom').width).toBe(
      320
    );
  });

  it('laesst die Skalierung immer auf die Breite durchschlagen', () => {
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

describe('computeOverlayRect, Offset', () => {
  it('rechnet den Offset relativ zum Spiel-Rect', () => {
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

  it('bleibt bei anderer Aufloesung relativ gleich', () => {
    const qhd: PoeBounds = { ...FHD, w: 2560, h: 1440 };
    const offset = { dx: 0.1, dy: -0.05 };

    const fhd = computeOverlayRect(FHD, 200, 1, offset, 'bottom');
    const wide = computeOverlayRect(qhd, 200, 1, offset, 'bottom');

    expect((wide.x + wide.width / 2) / qhd.w).toBeCloseTo(
      (fhd.x + fhd.width / 2) / FHD.w,
      3
    );
  });

  it('beruecksichtigt die Fensterposition auf einem zweiten Monitor', () => {
    const second: PoeBounds = { ...FHD, x: 1920, y: -120 };
    const rect = computeOverlayRect(second, 200, 1, NO_OFFSET, 'bottom');

    expect(Math.abs(rect.x + rect.width / 2 - 2880)).toBeLessThanOrEqual(0.5);
    // -120 + 1080 * 0.97 - 200
    expect(rect.y).toBe(728);
  });
});

describe('offsetFromWindow', () => {
  // Ziehen und Rechnen muessen sich gegenseitig aufheben, sonst wandert das
  // Overlay bei jedem Zyklus ein Stueck weiter.
  for (const anchor of ['bottom', 'minimap'] as const) {
    it(`ist die Umkehrung von computeOverlayRect, Anker ${anchor}`, () => {
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
