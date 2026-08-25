import type { RouteData } from '@/lib/exile-leveling';

import { Button } from './ui/button';
import { cn } from '@/lib/utils';
import { renderStepText } from '@/utilities/fragment-text';
import { useRouteStore } from '@/store/route.store';

interface Props {
  route: RouteData.Route;
}

export default function LevellingGuideMain({ route }: Props) {
  const currentEdge = useRouteStore((state) => state.currentEdge);
  const setCurrentEdge = useRouteStore((state) => state.setCurrentEdge);

  return (
    <div>
      {route.sections.map((section) => (
        <section key={section.name}>
          <h3 className='sticky top-0 bg-background px-1 py-2 text-sm font-semibold underline'>
            {section.name}
          </h3>

          {section.steps.map((step, index) => {
            if (step.type !== 'fragment_step') return null;

            const isCurrent = step.edgeIndex === currentEdge;

            return (
              <div
                key={`${section.name}-${index}`}
                id={
                  step.edgeIndex === null
                    ? undefined
                    : `edge-${step.edgeIndex}`
                }
                className={cn(
                  'relative border-b-[1px] p-1',
                  isCurrent && 'bg-neutral-700'
                )}
              >
                <p>{renderStepText(step)}</p>

                {step.subSteps.map((subStep, subIndex) => (
                  <p key={subIndex} className='pl-4 text-sm opacity-60'>
                    {renderStepText(subStep)}
                  </p>
                ))}

                {step.edgeIndex !== null && !isCurrent && (
                  <Button
                    className='absolute right-1 top-1 z-50 px-2 py-1'
                    onClick={() => setCurrentEdge(step.edgeIndex as number)}
                    variant='link'
                  >
                    Hierhin springen
                  </Button>
                )}
              </div>
            );
          })}
        </section>
      ))}
    </div>
  );
}
