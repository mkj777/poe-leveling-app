import type { LineView } from '@/utilities/overlay-view';
import { FRAGMENT_COLOURS, ICON_SOURCES } from '@/utilities/fragment-style';

/**
 * Eine Zeile des Guides, in den Farben und Symbolen des Originals.
 *
 * Nimmt bewusst fertige Daten und keinen Schritt: dieselbe Komponente malt im
 * Hauptfenster und im Overlay, und das Overlay hat keine Route, aus der es
 * etwas ableiten koennte (ADR-0012).
 */
export default function FragmentLine({ parts }: { parts: LineView }) {
  return (
    <>
      {parts.map((part, index) => (
        <span key={index} className={FRAGMENT_COLOURS[part.colour]}>
          {/* Nur die Hoehe festlegen, die Breite folgt dem Bild. Die Icons sind
              nicht quadratisch: das Quest-Ausrufezeichen misst 30x64, Trial und
              Waypoint sind breiter als hoch. Beide Masse zu setzen zog das eine
              in die Breite und stauchte die anderen. */}
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
