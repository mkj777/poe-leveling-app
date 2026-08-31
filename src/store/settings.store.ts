import type {
  OverlayAnchor,
  OverlayOffset
} from '@/utilities/overlay-geometry';
import type { StateCreator, StoreApi, UseBoundStore } from 'zustand';
import { create } from 'zustand';
import { isOverlayWindow } from '@/utilities/window-role';
import { persist } from 'zustand/middleware';

interface States {
  clientTxtPath: string;
  overlayScale: number;
  overlayOffset: OverlayOffset;
  /** Deckkraft der Overlay-Flaeche, 0 ist voellig durchsichtig. */
  overlayOpacity: number;
  overlayAnchor: OverlayAnchor;
}

interface Actions {
  setClientTxtPath: (clientTxtPath: string) => void;
  setOverlayScale: (overlayScale: number) => void;
  setOverlayOffset: (overlayOffset: OverlayOffset) => void;
  setOverlayOpacity: (overlayOpacity: number) => void;
  setOverlayAnchor: (overlayAnchor: OverlayAnchor) => void;
  resetOverlayPlacement: () => void;
}

type SettingsStore = States & Actions;

const createState: StateCreator<SettingsStore> = (set) => ({
  clientTxtPath: '',
  overlayScale: 1,
  overlayOffset: { dx: 0, dy: 0 },
  overlayOpacity: 0.35,
  overlayAnchor: 'bottom',
  setClientTxtPath: (clientTxtPath) => set({ clientTxtPath }),
  setOverlayScale: (overlayScale) => set({ overlayScale }),
  setOverlayOffset: (overlayOffset) => set({ overlayOffset }),
  setOverlayOpacity: (overlayOpacity) => set({ overlayOpacity }),
  setOverlayAnchor: (overlayAnchor) => set({ overlayAnchor }),
  resetOverlayPlacement: () =>
    set({ overlayScale: 1, overlayOffset: { dx: 0, dy: 0 } })
});

/**
 * Gespeichert wird nur im Hauptfenster, dem die Einstellungen gehoeren. Das
 * Overlay bekommt sie geschickt und haelt sie im Speicher, damit es zeichnen
 * kann. Zog man es frueher an eine neue Stelle, schrieb es das hier hinein,
 * das Hauptfenster wusste nichts davon, und der naechste Regler dort setzte
 * die Verschiebung stumm zurueck (ADR-0012).
 */
export const useSettingsStore: UseBoundStore<StoreApi<SettingsStore>> =
  isOverlayWindow()
    ? create<SettingsStore>()(createState)
    : create<SettingsStore>()(
        persist(createState, {
          name: 'settings',
          version: 4,
          migrate: (persisted) => {
            // Version 1 hielt displayPosition in absoluten Bildschirmpixeln
            // und growDirection. Beides ist nach Fenster-, Aufloesungs- oder
            // Monitorwechsel falsch und wird darum verworfen statt
            // uebernommen. Anker plus relativer Offset ersetzen es (ADR-0006).
            //
            // Version 2 konnte einen weggelaufenen Offset enthalten, weil der
            // Drag-Handler auf die eigenen setPosition-Aufrufe reagierte. Auch
            // der wird verworfen statt mitgeschleppt.
            //
            // Version 3 hatte den Anker unter der Minimap als Standard. Dort
            // steht das Overlay oft im Weg, Standard ist jetzt unten knapp
            // ueber der XP-Leiste. Der Pfad bleibt erhalten.
            //
            // Der Schalter showLayout ist mit dem Layout-Fenster entfallen.
            // Die Version bleibt trotzdem 4: ein Hochzaehlen wuerde die
            // Migration erneut ausloesen und dabei Groesse, Deckkraft und
            // Verschiebung des Overlays auf die Standardwerte zuruecksetzen.
            // Ein uebrig gebliebener Eintrag im Speicher stoert niemanden, es
            // liest ihn keiner mehr.
            const old = persisted as Partial<States> | undefined;
            return {
              clientTxtPath: old?.clientTxtPath ?? '',
              overlayScale: 1,
              overlayOffset: { dx: 0, dy: 0 },
              overlayOpacity: 0.35,
              overlayAnchor: 'bottom'
            } as SettingsStore;
          }
        })
      );
