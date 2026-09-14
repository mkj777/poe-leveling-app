import type { LineView } from '@/utilities/overlay-view';
import { FRAGMENT_COLOURS, ICON_SOURCES } from '@/utilities/fragment-style';

/**
 * One line of the guide, in the colours and icons of the original.
 *
 * Deliberately takes finished data and not a step: the same component paints
 * in the main window and in the overlay, and the overlay has no route to
 * derive anything from (ADR-0012).
 */
export default function FragmentLine({ parts }: { parts: LineView }) {
  return (
    <>
      {parts.map((part, index) => (
        <span key={index} className={FRAGMENT_COLOURS[part.colour]}>
          {/* Set only the height, the width follows the image. The icons are
              not square: the quest exclamation mark measures 30x64, trial and
              waypoint are wider than tall. Setting both dimensions stretched
              the one and squashed the others. */}
          {part.icon !== null && (
            <img
              src={ICON_SOURCES[part.icon]}
              alt=''
              aria-hidden
              className='mr-0.5 inline-block h-[1em] w-auto align-[-0.15em]'
            />
          )}
          {part.text}
        </span>
      ))}
    </>
  );
}
