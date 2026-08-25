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
          <h2 className='underline'>Could not load the guide</h2>
          <p className='max-w-md text-sm opacity-70'>
            {syncError ?? 'Unknown error'}
          </p>
          <p className='max-w-md text-sm opacity-70'>
            It will try again on the next start. An internet connection is what it needs.
          </p>
        </>
      ) : (
        <>
          <Loader2 size={32} className='animate-spin' />
          <h2 className='underline'>Loading the guide</h2>
          <p className='max-w-md text-sm opacity-70'>
            The walkthrough comes straight from the Exile Leveling project and keeps itself current.
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
          Open Exile Leveling
        </a>
      </Button>
    </div>
  );
}
