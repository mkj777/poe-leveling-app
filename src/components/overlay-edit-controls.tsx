import { Minus, Plus, RotateCcw, X } from 'lucide-react';
import {
  OVERLAY_SCALE_MAX,
  OVERLAY_SCALE_MIN,
  OVERLAY_SCALE_STEP
} from '@/utilities/constants';

import type { OverlayPlacement } from '@/utilities/overlay-view';
import { Button } from './ui/button';
import { OVERLAY_PLACEMENT_EVENT } from '@/utilities/overlay-view';
import { emit } from '@tauri-apps/api/event';
import { useSettingsStore } from '@/store/settings.store';

interface Props {
  onClose: () => void;
}

// Das Overlay ist im Betrieb klickdurchlaessig. Verschieben und Skalieren
// brauchen darum einen eigenen Zustand, der die Mausereignisse zurueckholt
// (ADR-0006).
export default function OverlayEditControls({ onClose }: Props) {
  const overlayScale = useSettingsStore((state) => state.overlayScale);
  const setOverlayScale = useSettingsStore((state) => state.setOverlayScale);
  const resetOverlayPlacement = useSettingsStore(
    (state) => state.resetOverlayPlacement
  );

  // Hier setzen, damit es sofort zu sehen ist, und dem Hauptfenster melden,
  // dem die Einstellungen gehoeren. Gespeichert wird nur dort (ADR-0012).
  const report = (overlayScale: number, overlayOffset: { dx: number; dy: number }) => {
    void emit(OVERLAY_PLACEMENT_EVENT, {
      overlayScale,
      overlayOffset
    } satisfies OverlayPlacement);
  };

  const step = (direction: number) => {
    const next = Math.min(
      Math.max(overlayScale + direction * OVERLAY_SCALE_STEP, OVERLAY_SCALE_MIN),
      OVERLAY_SCALE_MAX
    );
    const rounded = Math.round(next * 10) / 10;

    setOverlayScale(rounded);
    report(rounded, useSettingsStore.getState().overlayOffset);
  };

  const reset = () => {
    resetOverlayPlacement();
    report(1, { dx: 0, dy: 0 });
  };

  return (
    <div
      className='absolute inset-0 z-50 flex cursor-move flex-col items-center justify-center gap-2 border-2 border-dashed border-primary bg-background/90'
      data-tauri-drag-region
    >
      <p className='select-none text-sm' data-tauri-drag-region>
        Drag to move
      </p>
      <div className='flex flex-row items-center gap-2'>
        <Button
          size='icon'
          className='size-7'
          title='Smaller'
          onClick={() => step(-1)}
        >
          <Minus size={16} />
        </Button>
        <span className='w-12 select-none text-center text-sm'>
          {Math.round(overlayScale * 100)}%
        </span>
        <Button
          size='icon'
          className='size-7'
          title='Bigger'
          onClick={() => step(1)}
        >
          <Plus size={16} />
        </Button>
        <Button
          size='icon'
          className='size-7'
          title='Reset'
          onClick={reset}
        >
          <RotateCcw size={16} />
        </Button>
        <Button
          size='icon'
          className='size-7'
          title='Done'
          onClick={onClose}
        >
          <X size={16} />
        </Button>
      </div>
    </div>
  );
}
