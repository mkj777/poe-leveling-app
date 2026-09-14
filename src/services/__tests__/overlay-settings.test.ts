import { beforeEach, describe, expect, it, vi } from 'vitest';

const emit = vi.fn();
vi.mock('@tauri-apps/api/event', () => ({ emit }));

const { OVERLAY_SETTINGS_EVENT, publishOverlaySettings } = await import(
  '../overlay-settings'
);

describe('publishOverlaySettings', () => {
  beforeEach(() => emit.mockClear());

  it('sends exactly the fields the overlay needs', () => {
    publishOverlaySettings({
      overlayScale: 1.2,
      overlayOpacity: 0.4,
      overlayOffset: { dx: 0.1, dy: -0.1 },
      overlayAnchor: 'minimap'
    });

    expect(emit).toHaveBeenCalledWith(OVERLAY_SETTINGS_EVENT, {
      overlayScale: 1.2,
      overlayOpacity: 0.4,
      overlayOffset: { dx: 0.1, dy: -0.1 },
      overlayAnchor: 'minimap'
    });
  });

  it('takes nothing along that does not belong', () => {
    // The store also holds the Client.txt path. It has no business in the
    // overlay window and must not travel along.
    publishOverlaySettings({
      overlayScale: 1,
      overlayOpacity: 0.35,
      overlayOffset: { dx: 0, dy: 0 },
      overlayAnchor: 'bottom',
      clientTxtPath: 'C:/poe/Client.txt'
    } as never);

    expect(Object.keys(emit.mock.calls[0][1] as object).sort()).toEqual([
      'overlayAnchor',
      'overlayOffset',
      'overlayOpacity',
      'overlayScale'
    ]);
  });
});
