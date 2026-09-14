import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from './ui/alert-dialog';
import { useEffect, useState } from 'react';

import type { GuideMode } from '@/utilities/guide-mode';
import { GUIDE_MODE_OPTIONS, shouldOfferNewRun } from '@/utilities/guide-mode';
import { useGuideStore } from '@/store/guide.store';
import { useRouteStore } from '@/store/route.store';

// Module-wide instead of component state: under StrictMode the effect runs
// twice, but the question is asked once per start.
let asked = false;

/**
 * Asks after a longer pause whether a new run is due (ADR-0011). Belongs in
 * the main window, not in the overlay: there is nobody there who could
 * answer.
 */
export default function NewRunDialog() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (asked) return;
    asked = true;

    const now = Date.now();
    const { lastOpenedAt, markOpened } = useGuideStore.getState();

    // Measure first, then stamp. The other way round the pause would always be zero.
    if (shouldOfferNewRun(lastOpenedAt, now)) setOpen(true);
    markOpened(now);
  }, []);

  // The mode switch triggers a new parse in useRouteSync. Progress is then
  // already on the first edge, which has the same name in both modes.
  const start = (mode: GuideMode) => {
    useGuideStore.getState().setMode(mode);
    useRouteStore.getState().setCurrentEdge(0);
    setOpen(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Starting over?</AlertDialogTitle>
          <AlertDialogDescription>
            The app has been closed for a while, so this is probably a new
            league or a new character. Pick how the guide should read and it
            starts again at act 1.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className='flex flex-col gap-2'>
          {GUIDE_MODE_OPTIONS.map((option) => (
            <button
              key={option.mode}
              type='button'
              onClick={() => start(option.mode)}
              className='border-border hover:bg-accent flex flex-col items-start gap-1 rounded-md border px-3 py-2 text-left'
            >
              <span className='text-sm font-medium'>{option.title}</span>
              <span className='text-muted-foreground text-xs'>
                {option.hint}
              </span>
            </button>
          ))}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>Keep my progress</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
