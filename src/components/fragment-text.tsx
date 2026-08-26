import type { Fragments, RouteData } from '@/lib/exile-leveling';
import {
  FRAGMENT_COLOURS,
  fragmentColour,
  fragmentIcon
} from '@/utilities/fragment-style';

import { renderFragment } from '@/utilities/fragment-text';

function Fragment({ fragment }: { fragment: Fragments.AnyFragment }) {
  const text = renderFragment(fragment);
  const icon = fragmentIcon(fragment);
  const colour = FRAGMENT_COLOURS[fragmentColour(fragment)];

  if (typeof fragment === 'string') return <>{text}</>;

  return (
    <span className={colour}>
      {icon !== null && (
        <img
          src={icon}
          alt=''
          aria-hidden
          className='mr-0.5 inline-block h-[1em] w-[1em] align-[-0.15em]'
        />
      )}
      {text}
    </span>
  );
}

/** Ein Schritt mit den Farben und Symbolen des Originals. */
export default function FragmentText({
  step
}: {
  step: RouteData.FragmentStep;
}) {
  return (
    <>
      {step.parts.map((part, index) => (
        <Fragment key={index} fragment={part} />
      ))}
    </>
  );
}
