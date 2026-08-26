import { actProgress, flattenSteps, selectSegment } from '@/utilities/route-progress';

import FragmentText from './fragment-text';
import OverlayEditControls from './overlay-edit-controls';
import { useRouteStore } from '@/store/route.store';
import { useSettingsStore } from '@/store/settings.store';

interface Props {
  editMode: boolean;
  onCloseEdit: () => void;
}

export default function InGameScreen({ editMode, onCloseEdit }: Props) {
  const route = useRouteStore((state) => state.route);
  const currentEdge = useRouteStore((state) => state.currentEdge);
  const opacity = useSettingsStore((state) => state.overlayOpacity);

  const steps = route === null ? [] : flattenSteps(route.sections);
  const segment = selectSegment(steps, currentEdge);
  const act = route === null ? null : actProgress(route.sections, currentEdge);

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
      {act !== null && (
        <div className='absolute inset-x-3 top-2 flex items-baseline justify-between text-[0.7rem] tracking-wide text-white/45'>
          <span>{act.act}</span>
          <span>
            {act.stepsLeft === 0
              ? 'last step of the act'
              : `${act.stepsLeft} left in act`}
          </span>
        </div>
      )}

      <div id={`edge-${currentEdge}`} className='flex flex-col gap-0.5'>
        {segment.map((step, index) => (
          <div key={index}>
            <p
              className={
                index === 0
                  ? 'text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]'
                  : 'text-sm text-white/80 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]'
              }
            >
              <FragmentText step={step} />
            </p>
            {step.subSteps.map((subStep, subIndex) => (
              <p
                key={subIndex}
                className='pl-3 text-xs text-white/55 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]'
              >
                <FragmentText step={subStep} />
              </p>
            ))}
          </div>
        ))}
      </div>

      {editMode && <OverlayEditControls onClose={onCloseEdit} />}
    </section>
  );
}
