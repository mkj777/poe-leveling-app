import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogTrigger
} from './ui/alert-dialog';
import { AppState, useAppStore } from '@/store/app.store';
import { Minus, Play, RotateCcw, Settings, Square, X } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Button } from './ui/button';
import { appWindow } from '@tauri-apps/api/window';
import { cn } from '@/lib/utils';
import { getVersion } from '@tauri-apps/api/app';
import { installUpdate } from '@tauri-apps/api/updater';
import logo from '@/assets/icon.ico';
import { relaunch } from '@tauri-apps/api/process';
import { useNavigate } from 'react-router-dom';
import { useRouteStore } from '@/store/route.store';
import { useToast } from './ui/use-toast';

export default function Navbar() {
  const navigator = useNavigate();
  const { setAppState, appState, newUpdateAvailable } = useAppStore(
    (state) => state
  );
  const route = useRouteStore((state) => state.route);

  const [openResetDialog, setOpenResetDialog] = useState(false);
  const [appVersion, setAppVersion] = useState<string | null>();

  const { toast } = useToast();

  const startInstall = () => {
    toast({
      title: 'Installing update',
      description: 'The app restarts on its own once the update is in.'
    });
    installUpdate().then(relaunch);
  };

  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      setAppVersion('dev');
      return;
    }
    getVersion().then(setAppVersion);
  }, []);

  // Start und Stop steuern das Overlay-Fenster. Das Hauptfenster bleibt in
  // beiden Faellen stehen, damit Guide und Einstellungen erreichbar bleiben.
  const overlayRunning = appState === AppState.IN_GAME;

  return (
    <>
      <AlertDialog open={openResetDialog} onOpenChange={setOpenResetDialog}>
        <AlertDialogTrigger />
        <AlertDialogContent>
          <AlertDialogTitle>Reset progress to the start?</AlertDialogTitle>
          <AlertDialogFooter>
            <AlertDialogAction
              onClick={() => useRouteStore.getState().setCurrentEdge(0)}
            >
              Yes
            </AlertDialogAction>
            <AlertDialogCancel>No</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <header
        className='border-border flex h-9 shrink-0 items-center justify-between border-b px-3'
        data-tauri-drag-region
      >
        <div
          className='flex select-none items-center gap-2'
          data-tauri-drag-region
        >
          <img src={logo} className='size-4' alt='' data-tauri-drag-region />
          <span className='text-sm font-medium' data-tauri-drag-region>
            PoE Leveling Guide
          </span>
          <span className='text-muted-foreground text-xs' data-tauri-drag-region>
            {appVersion}
          </span>
          {newUpdateAvailable && (
            <Button
              variant='ghost'
              size='sm'
              className='h-6 text-xs text-emerald-400 hover:text-emerald-300'
              onClick={startInstall}
            >
              Update available
            </Button>
          )}
        </div>

        <div className='flex items-center gap-1'>
          <Button
            variant='ghost'
            size='icon'
            className='size-7'
            title='Reset progress'
            disabled={route === null}
            onClick={() => setOpenResetDialog(true)}
          >
            <RotateCcw className='size-4' />
          </Button>

          <Button
            variant='ghost'
            size='icon'
            className='size-7'
            title='Settings'
            onClick={() => navigator('/settings')}
          >
            <Settings className='size-4' />
          </Button>

          <Button
            variant='ghost'
            size='sm'
            className={cn(
              'ml-1 h-7 w-20 gap-1.5',
              overlayRunning
                ? 'text-red-400 hover:text-red-300'
                : 'text-emerald-400 hover:text-emerald-300'
            )}
            disabled={route === null}
            onClick={() =>
              setAppState(overlayRunning ? AppState.NORMAL : AppState.IN_GAME)
            }
          >
            {overlayRunning ? (
              <Square className='size-3.5' />
            ) : (
              <Play className='size-3.5' />
            )}
            {overlayRunning ? 'Stop' : 'Start'}
          </Button>

          <div className='ml-1 flex items-center'>
            <Button
              variant='ghost'
              size='icon'
              className='size-7'
              title='Minimise'
              onClick={() => appWindow.minimize()}
            >
              <Minus className='size-4' />
            </Button>
            <Button
              variant='ghost'
              size='icon'
              className='hover:bg-destructive hover:text-destructive-foreground size-7'
              title='Quit'
              onClick={() => appWindow.close()}
            >
              <X className='size-4' />
            </Button>
          </div>
        </div>
      </header>
    </>
  );
}
