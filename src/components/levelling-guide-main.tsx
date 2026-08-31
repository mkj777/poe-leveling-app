import type { RouteData } from '@/lib/exile-leveling';

import { Button } from './ui/button';
import { cn } from '@/lib/utils';
import FragmentText from './fragment-text';
import { blockSections } from '@/utilities/route-progress';
import { useEffect, useMemo, useRef } from 'react';
import { useRouteStore } from '@/store/route.store';

interface Props {
  route: RouteData.Route;
}

export default function LevellingGuideMain({ route }: Props) {
  const currentEdge = useRouteStore((state) => state.currentEdge);
  const setCurrentEdge = useRouteStore((state) => state.setCurrentEdge);

  // Ein Block je Kante statt einer Zeile je Schritt. Nur so faellt der Trenner
  // dorthin, wo wirklich ein Schritt endet, und "Jump here" hat ein sichtbares
  // Ziel.
  const currentBlock = useRef<HTMLDivElement>(null);

  // Ein Block endet mit dem Uebergang in die naechste Zone, statt mit ihm zu
  // beginnen. Sonst stuende oben im hervorgehobenen Block der Schritt, der
  // gerade erledigt wurde, und nicht der naechste.
  const sections = useMemo(() => blockSections(route.sections), [route]);

  // Beim Start und bei jedem Zonenwechsel zurueck zum aktuellen Block. Wer
  // dazwischen selbst scrollt, wird nicht gestoert: das laeuft nur, wenn sich
  // die Kante oder die Route aendert.
  useEffect(() => {
    currentBlock.current?.scrollIntoView({ block: 'center' });
  }, [currentEdge, sections]);

  return (
    // Der Abstand sitzt hier und nicht am Scroll-Container: dessen
    // Polsterung gehoert zum scrollbaren Bereich, der Text zoege oben durch
    // und stuende als Streifen ueber der klebenden Ueberschrift.
    <div className='pb-2'>
      {sections.map((section) => (
        <section key={section.name}>
          {/* z-20 haelt die Ueberschrift ueber den Bloecken. Die sind relativ
              positioniert und lagen sonst darueber, die Ueberschrift war
              waehrend des Scrollens nicht zu lesen. */}
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
                id={edgeIndex === null ? undefined : `edge-${edgeIndex}`}
                className={cn(
                  'relative border-b-[1px] px-3 py-2',
                  isCurrent && 'bg-neutral-700'
                )}
              >
                {block.steps.map((step, stepIndex) => (
                  <div key={stepIndex}>
                    <p className={stepIndex === 0 ? undefined : 'pt-1'}>
                      <FragmentText step={step} />
                    </p>

                    {step.subSteps.map((subStep, subIndex) => (
                      <p
                        key={subIndex}
                        className='text-muted-foreground pl-4 text-sm'
                      >
                        <FragmentText step={subStep} />
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
