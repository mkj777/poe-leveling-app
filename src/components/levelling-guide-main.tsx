import type { RouteData } from '@/lib/exile-leveling';

import { Button } from './ui/button';
import { cn } from '@/lib/utils';
import FragmentLine from './fragment-text';
import { blockSections } from '@/utilities/route-progress';
import { toStepView } from '@/utilities/overlay-view';
import { useEffect, useMemo, useRef } from 'react';
import { useRouteStore } from '@/store/route.store';

interface Props {
  route: RouteData.Route;
}

export default function LevellingGuideMain({ route }: Props) {
  const currentEdge = useRouteStore((state) => state.currentEdge);
  const setCurrentEdge = useRouteStore((state) => state.setCurrentEdge);

  // One block per edge instead of one line per step. Only then does the
  // separator land where a step really ends, and "Jump here" has a visible
  // target.
  const currentBlock = useRef<HTMLDivElement>(null);

  // Shaped once per route into the form the overlay gets its lines in as
  // well (ADR-0012). One rendering, one blueprint, two windows. And the same
  // grouping, so the step highlighted here is the one the overlay shows.
  const sections = useMemo(
    () =>
      blockSections(route.sections).map((section) => ({
        name: section.name,
        blocks: section.blocks.map((block) => ({
          edgeIndex: block.edgeIndex,
          steps: block.steps.map(toStepView)
        }))
      })),
    [route]
  );

  // Back to the current block on startup and on every zone change. Anyone
  // scrolling in between is not disturbed: this only runs when the edge or
  // the route changes.
  useEffect(() => {
    currentBlock.current?.scrollIntoView({ block: 'center' });
  }, [currentEdge, sections]);

  return (
    // The spacing sits here and not on the scroll container: its padding
    // belongs to the scrollable area, text would run through at the top and
    // show as a strip above the sticky heading.
    <div className='pb-2'>
      {sections.map((section) => (
        <section key={section.name}>
          {/* z-20 keeps the heading above the blocks. They are positioned
              relatively and otherwise sat on top; the heading was unreadable
              while scrolling. */}
          <h3 className='bg-background sticky top-0 z-20 border-b px-3 py-2 text-lg font-semibold'>
            {section.name}
          </h3>

          {section.blocks.map((block, index) => {
            const edgeIndex = block.edgeIndex;
            const isCurrent = edgeIndex === currentEdge;

            return (
              <div
                key={`${section.name}-${index}`}
                ref={isCurrent ? currentBlock : undefined}
                className={cn(
                  'relative border-b-[1px] px-3 py-2',
                  isCurrent && 'bg-neutral-700'
                )}
              >
                {block.steps.map((step, stepIndex) => (
                  <div key={stepIndex}>
                    <p className={stepIndex === 0 ? undefined : 'pt-1'}>
                      <FragmentLine parts={step.parts} />
                    </p>

                    {step.subSteps.map((subStep, subIndex) => (
                      <p
                        key={subIndex}
                        className='text-muted-foreground pl-4 text-sm'
                      >
                        <FragmentLine parts={subStep} />
                      </p>
                    ))}
                  </div>
                ))}

                {edgeIndex !== null && !isCurrent && (
                  <Button
                    className='absolute right-1 top-1 z-10 px-2 py-1'
                    onClick={() => setCurrentEdge(edgeIndex)}
                    variant='link'
                  >
                    Jump here
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
