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
import {
  Bug,
  Info,
  Minus,
  PencilRuler,
  Play,
  RotateCcw,
  Settings,
  X
} from 'lucide-react';
import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarTrigger
} from './ui/menubar';
import { useEffect, useState } from 'react';

import { Button } from './ui/button';
import { appWindow } from '@tauri-apps/api/window';
import { cn } from '@/lib/utils';
import { getVersion } from '@tauri-apps/api/app';
import { installUpdate } from '@tauri-apps/api/updater';
import logo from '@/assets/icon.ico';
import { open } from '@tauri-apps/api/shell';
import { relaunch } from '@tauri-apps/api/process';
import { useRouteStore } from '@/store/route.store';
import { useNavigate } from 'react-router-dom';
import { useToast } from './ui/use-toast';

export default function Navbar() {
  const navigator = useNavigate();
  const { setAppState, newUpdateAvailable } = useAppStore((state) => state);
  const route = useRouteStore((state) => state.route);

  const [openResetDialog, setOpenResetDialog] = useState(false);
  const [appVersion, setAppVersion] = useState<string | null>();

  const { toast } = useToast();

  const startInstall = () => {
    toast({
      title: 'Installing update...',
      description:
        'Please wait...\nThis program will restart automatically after the update is installed.'
    });
    installUpdate().then(relaunch);
  };

  useEffect(() => {
    // check if is dev mode
    if (process.env.NODE_ENV === 'development') {
      setAppVersion('dev');
      return;
    }
    getVersion().then((version) => {
      setAppVersion(version);
    });
  }, []);

  const handleOnMinize = () => {
    appWindow.minimize();
  };

  const handleOnClose = () => {
    appWindow.close();
  };

  const handleOnResetProgress = () => {
    useRouteStore.getState().setCurrentEdge(0);
  };

  const handleOnStart = () => {
    setAppState(AppState.IN_GAME);
  };

  return (
    <>
      <AlertDialog open={openResetDialog} onOpenChange={setOpenResetDialog}>
        <AlertDialogTrigger />
        <AlertDialogContent>
          <AlertDialogTitle>
            Reset progress to the start?
          </AlertDialogTitle>
          <AlertDialogFooter>
            <AlertDialogAction onClick={handleOnResetProgress}>
              Yes
            </AlertDialogAction>
            <AlertDialogCancel>No</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Menubar
        className='rounded-none border-0 border-b-[2px] px-2 lg:px-4 justify-between h-[35px]'
        data-tauri-drag-region
      >
        <div className='flex flex-row gap-4 justify-center items-center'>
          <MenubarMenu>
            <MenubarTrigger className='text-sm h-1/2 hover:bg-accent transition-opacity data-[state=open]:bg-transparent data-[highlighted]:bg-transparent gap-1'>
              <img
                src={logo}
                className='select-none w-5 h-5'
                data-tauri-drag-region
              />
              Path of Levelling
            </MenubarTrigger>

            <MenubarContent>
              <MenubarItem asChild>
                <a
                  href='https://github.com/Kazte/path-of-levelling'
                  target='_blank'
                  rel='noreferrer'
                >
                  <Info size={16} className='mr-2' />
                  About Path of Levelling
                </a>
              </MenubarItem>
              <MenubarSeparator />
              <MenubarItem
                onClick={() => setOpenResetDialog(true)}
                disabled={route === null}
              >
                <RotateCcw size={16} className='mr-2' /> Reset progress
              </MenubarItem>
              <MenubarItem asChild>
                <a
                  href='https://heartofphos.github.io/exile-leveling/'
                  target='_blank'
                  rel='noreferrer'
                >
                  <PencilRuler size={16} className='mr-2' />
                  Open Exile Leveling
                </a>
              </MenubarItem>
              <MenubarSeparator />
              <MenubarItem
                onClick={() => {
                  navigator('/settings');
                }}
              >
                <Settings size={16} className='mr-2' />
                Settings
              </MenubarItem>
              <MenubarItem
                onClick={async () => {
                  await open(
                    'https://github.com/kazte/path-of-levelling/issues/new?title=[BUG]%20&labels=bug&body=**Describe%20the%20bug**%0A%0A**To%20Reproduce**%0A1.%20Step%201%0A2.%20Step%202%0A%0A**Expected%20behavior**%0A%0A**Screenshots**%0A%0A**Additional%20context**%0A'
                  );
                }}
              >
                <Bug size={16} className='mr-2' />
                Report Bug
              </MenubarItem>
              <MenubarItem
                onClick={handleOnClose}
                className='data-[highlighted]:bg-destructive'
              >
                <X size={16} className='mr-2' />
                Quit
              </MenubarItem>
            </MenubarContent>
          </MenubarMenu>
          <span
            className='text-[0.6rem] opacity-45 select-none self-end justify-self-start'
            data-tauri-drag-region
          >
            Version {appVersion}
          </span>
          {newUpdateAvailable && (
            <Button
              variant='secondary'
              onClick={startInstall}
              className={cn(
                'h-6',
                'bg-green-700 text-foreground hover:bg-opacity-70 hover:bg-green-700'
              )}
            >
              Install Update
            </Button>
          )}
        </div>
        <div className='flex flex-row gap-2 justify-center items-center'>
          <Button
            variant='secondary'
            onClick={handleOnStart}
            className={cn(
              'h-6 w-20',
              'bg-green-700 text-foreground hover:bg-opacity-70 hover:bg-green-700'
            )}
            size='icon'
            disabled={route === null}
          >
            <Play size={20} className='mr-2' />
            Start
          </Button>

          <Button
            variant='secondary'
            className='h-6 w-6'
            size='icon'
            onClick={handleOnMinize}
          >
            <Minus size={20} />
          </Button>
          <Button
            variant='destructive'
            className='h-6 w-6'
            size='icon'
            onClick={handleOnClose}
          >
            <X size={20} />
          </Button>
        </div>
      </Menubar>
    </>
  );
}
