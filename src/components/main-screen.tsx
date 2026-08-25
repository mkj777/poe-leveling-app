import { AlertTriangle, Loader2, PencilRuler } from 'lucide-react';

import { Button } from './ui/button';
import { useRouteStore } from './../store/route.store';

export default function MainScreen() {
  const syncState = useRouteStore((state) => state.syncState);
  const syncError = useRouteStore((state) => state.syncError);

  return (
    <div className='flex h-full flex-grow flex-col items-center justify-center gap-6 p-2 text-center'>
      {syncState === 'error' ? (
        <>
          <AlertTriangle size={32} className='text-destructive' />
          <h2 className='underline'>Guide konnte nicht geladen werden</h2>
          <p className='max-w-md text-sm opacity-70'>
            {syncError ?? 'Unbekannter Fehler'}
          </p>
          <p className='max-w-md text-sm opacity-70'>
            Beim naechsten Start wird es erneut versucht. Bis dahin hilft eine
            Internetverbindung.
          </p>
        </>
      ) : (
        <>
          <Loader2 size={32} className='animate-spin' />
          <h2 className='underline'>Guide wird geladen</h2>
          <p className='max-w-md text-sm opacity-70'>
            Der Walkthrough kommt direkt aus dem Exile-Leveling-Projekt und
            aktualisiert sich selbst.
          </p>
        </>
      )}

      <Button asChild variant='secondary'>
        <a
          href='https://heartofphos.github.io/exile-leveling/'
          target='_blank'
          rel='noreferrer'
        >
          <PencilRuler size={16} className='mr-2' />
          Exile Leveling oeffnen
        </a>
      </Button>
    </div>
  );
}
