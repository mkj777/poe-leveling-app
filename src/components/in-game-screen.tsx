import type { OverlayView } from '@/utilities/overlay-view';
import type { RefObject } from 'react';

import FragmentLine from './fragment-text';
import OverlayEditControls from './overlay-edit-controls';
import { useSettingsStore } from '@/store/settings.store';

interface Props {
  view: OverlayView;
  /** Zum Ausmessen der Inhaltshoehe, danach richtet sich das Fenster. */
  contentRef: RefObject<HTMLDivElement>;
  editMode: boolean;
  onCloseEdit: () => void;
}

export default function InGameScreen({
  view,
  contentRef,
  editMode,
  onCloseEdit
}: Props) {
  const opacity = useSettingsStore((state) => state.overlayOpacity);

  return (
    <section
      className='relative flex h-full w-full select-none flex-col justify-center overflow-hidden rounded-md px-3 py-2'
      style={{
        backgroundColor: `rgba(0, 0, 0, ${opacity})`,
        backdropFilter: opacity > 0.05 ? 'blur(2px)' : 'none'
      }}
    >
      {/* Ausserhalb des Flusses: die Kopfzeile soll den Schritt nicht aus der
          Mitte schieben, der Schritt ist die Mitte. */}
      {view.act !== null && (
        <div className='absolute inset-x-3 top-2 flex items-baseline justify-between text-[0.7rem] tracking-wide text-white/45'>
          <span>{view.act}</span>
          <span>
            {view.stepsLeft === 0
              ? 'last step of the act'
              : `${view.stepsLeft} left in act`}
          </span>
        </div>
      )}

      <div ref={contentRef} className='flex flex-col gap-0.5'>
        {view.steps.map((step, index) => (
          <div key={index}>
            <p
              className={
                index === 0
                  ? 'text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]'
                  : 'text-sm text-white/80 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]'
              }
            >
              <FragmentLine parts={step.parts} />
            </p>
            {step.subSteps.map((subStep, subIndex) => (
              <p
                key={subIndex}
                className='pl-3 text-xs text-white/55 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]'
              >
                <FragmentLine parts={subStep} />
              </p>
            ))}
          </div>
        ))}
      </div>

      {editMode && <OverlayEditControls onClose={onCloseEdit} />}
    </section>
  );
}
