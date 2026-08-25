import { flattenSteps, selectSegment } from '@/utilities/route-progress';

import OverlayEditControls from './overlay-edit-controls';
import { renderStepText } from '@/utilities/fragment-text';
import { useRouteStore } from '@/store/route.store';

interface Props {
  editMode: boolean;
  onCloseEdit: () => void;
}

export default function InGameScreen({ editMode, onCloseEdit }: Props) {
  const route = useRouteStore((state) => state.route);
  const currentEdge = useRouteStore((state) => state.currentEdge);

  const segment =
    route === null ? [] : selectSegment(flattenSteps(route.sections), currentEdge);

  return (
    <section className='relative flex h-full w-full select-none flex-col items-center justify-center gap-1 overflow-hidden px-2 py-3 text-center'>
      <p className='absolute left-1 top-1 text-xs opacity-50'>
        {currentEdge + 1}
        {route !== null && ` / ${route.edges.length}`}
      </p>

      <div id={`edge-${currentEdge}`} className='flex flex-col gap-1'>
        {segment.map((step, index) => (
          <div key={index}>
            <p className={index === 0 ? 'font-medium' : 'text-sm opacity-80'}>
              {renderStepText(step)}
            </p>
            {step.subSteps.map((subStep, subIndex) => (
              <p key={subIndex} className='text-xs opacity-60'>
                {renderStepText(subStep)}
              </p>
            ))}
          </div>
        ))}
      </div>

      {editMode && <OverlayEditControls onClose={onCloseEdit} />}
    </section>
  );
}
