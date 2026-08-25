import { Minus, Plus, RotateCcw, X } from 'lucide-react';
import {
  OVERLAY_SCALE_MAX,
  OVERLAY_SCALE_MIN,
  OVERLAY_SCALE_STEP
} from '@/utilities/constants';

import { Button } from './ui/button';
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

  const step = (direction: number) => {
    const next = Math.min(
      Math.max(overlayScale + direction * OVERLAY_SCALE_STEP, OVERLAY_SCALE_MIN),
      OVERLAY_SCALE_MAX
    );
    setOverlayScale(Math.round(next * 10) / 10);
  };

  return (
    <div
      className='absolute inset-0 z-50 flex cursor-move flex-col items-center justify-center gap-2 border-2 border-dashed border-primary bg-background/90'
      data-tauri-drag-region
    >
      <p className='select-none text-sm' data-tauri-drag-region>
        Ziehen zum Verschieben
      </p>
      <div className='flex flex-row items-center gap-2'>
        <Button
          size='icon'
          className='size-7'
          title='Kleiner'
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
          title='Groesser'
          onClick={() => step(1)}
        >
          <Plus size={16} />
        </Button>
        <Button
          size='icon'
          className='size-7'
          title='Zuruecksetzen'
          onClick={resetOverlayPlacement}
        >
          <RotateCcw size={16} />
        </Button>
        <Button
          size='icon'
          className='size-7'
          title='Fertig'
          onClick={onClose}
        >
          <X size={16} />
        </Button>
      </div>
    </div>
  );
}
