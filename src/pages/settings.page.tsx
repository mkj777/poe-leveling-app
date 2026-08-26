import { ArrowLeft, Bug, File, Move, PencilRuler } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { AppState, useAppStore } from '@/store/app.store';
import {
  OVERLAY_SCALE_MAX,
  OVERLAY_SCALE_MIN,
  OVERLAY_SCALE_STEP
} from '@/utilities/constants';
import { emit } from '@tauri-apps/api/event';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { open as openExternal } from '@tauri-apps/plugin-shell';
import { useNavigate } from 'react-router-dom';
import { useRouteStore } from '@/store/route.store';
import { useSettingsStore } from '@/store/settings.store';
import { useState } from 'react';

const BUG_REPORT_URL =
  'https://github.com/mkj777/poe-leveling-app/issues/new?title=[BUG]%20&labels=bug&body=**Describe%20the%20bug**%0A%0A**To%20Reproduce**%0A1.%20Step%201%0A2.%20Step%202%0A%0A**Expected%20behavior**%0A%0A**Screenshots**%0A%0A**Additional%20context**%0A';

function Section({
  title,
  hint,
  children
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className='border-border flex flex-col gap-2 border-b pb-5 last:border-b-0'>
      <div className='flex flex-col gap-0.5'>
        <Label className='text-sm'>{title}</Label>
        {hint !== undefined && (
          <p className='text-muted-foreground max-w-md text-xs'>{hint}</p>
        )}
      </div>
      {children}
    </section>
  );
}

export default function SettingsPage() {
  const navigator = useNavigate();
  const settingStore = useSettingsStore((state) => state);
  const sha = useRouteStore((state) => state.sha);
  const overlayRunning = useAppStore((state) => state.appState) === AppState.IN_GAME;

  const [clientTxtPathValue, setClientTxtPathValue] = useState(
    settingStore.clientTxtPath
  );

  const handleSetClientTxt = async () => {
    const selection = await openDialog({
      multiple: false,
      filters: [{ name: 'Text', extensions: ['txt'] }]
    });

    if (selection) {
      settingStore.setClientTxtPath(selection as string);
      setClientTxtPathValue(selection as string);
    }
  };

  return (
    <>
      <header
        className='border-border flex h-9 shrink-0 items-center gap-2 border-b px-3'
        data-tauri-drag-region
      >
        <Button
          variant='ghost'
          size='icon'
          className='size-7'
          title='Back'
          onClick={() => navigator('/')}
        >
          <ArrowLeft className='size-4' />
        </Button>
        <span className='select-none text-sm font-medium' data-tauri-drag-region>
          Settings
        </span>
      </header>

      <main className='flex-grow overflow-y-auto px-4 py-3'>
        <div className='flex max-w-xl flex-col gap-5'>
          <Section
            title='Client.txt'
            hint='Picked up from the running game. Only set this if that fails.'
          >
            <div className='flex w-full items-center gap-2'>
              <Input
                type='text'
                placeholder='Path to Client.txt'
                value={clientTxtPathValue}
                onChange={(e) => setClientTxtPathValue(e.target.value)}
                onBlur={() => settingStore.setClientTxtPath(clientTxtPathValue)}
              />
              <Button
                type='button'
                variant='secondary'
                onClick={handleSetClientTxt}
              >
                <File className='mr-2 size-4' /> Browse
              </Button>
            </div>
          </Section>

          <Section
            title='Overlay'
            hint='It places itself in the game window and follows it. Ctrl+Shift+Alt+F12 closes it.'
          >
            <div className='flex flex-col gap-1.5'>
              <Label className='text-xs font-normal'>Position</Label>
              <Select
                value={settingStore.overlayAnchor}
                onValueChange={(value) =>
                  settingStore.setOverlayAnchor(value as 'minimap' | 'bottom')
                }
              >
                <SelectTrigger className='w-full'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='minimap'>Below the minimap</SelectItem>
                  <SelectItem value='bottom'>Bottom centre</SelectItem>
                </SelectContent>
              </Select>
              <p className='text-muted-foreground text-xs'>
                {settingStore.overlayAnchor === 'minimap'
                  ? 'Hangs on the right below the minimap and grows downwards. Clears the area panel that Tab brings up, which sits higher than the minimap.'
                  : 'Sits in the gap between the flask and skill bars, just above the experience bar, and grows upwards.'}
              </p>
            </div>

            <div className='flex flex-col gap-1.5'>
              <div className='flex items-center justify-between text-xs'>
                <Label className='font-normal'>Size</Label>
                <span className='text-muted-foreground font-mono'>
                  {Math.round(settingStore.overlayScale * 100)}%
                </span>
              </div>
              <Slider
                value={[settingStore.overlayScale]}
                min={OVERLAY_SCALE_MIN}
                max={OVERLAY_SCALE_MAX}
                step={OVERLAY_SCALE_STEP}
                onValueChange={([value]) => settingStore.setOverlayScale(value)}
              />
              <p className='text-muted-foreground text-xs'>
                Changes the window and the text together.
              </p>
            </div>

            <div className='flex flex-col gap-1.5'>
              <div className='flex items-center justify-between text-xs'>
                <Label className='font-normal'>Background opacity</Label>
                <span className='text-muted-foreground font-mono'>
                  {Math.round(settingStore.overlayOpacity * 100)}%
                </span>
              </div>
              <Slider
                value={[settingStore.overlayOpacity]}
                min={0}
                max={1}
                step={0.05}
                onValueChange={([value]) => settingStore.setOverlayOpacity(value)}
              />
            </div>

            <div className='flex flex-wrap items-center gap-2'>
              <Button
                variant='secondary'
                size='sm'
                disabled={!overlayRunning}
                onClick={() => void emit('overlay-edit-toggle')}
              >
                <Move className='mr-2 size-4' />
                Move overlay
              </Button>
              <Button
                variant='ghost'
                size='sm'
                onClick={settingStore.resetOverlayPlacement}
              >
                Reset position and size
              </Button>
            </div>
            <p className='text-muted-foreground text-xs'>
              {overlayRunning
                ? 'Drag it where you want it, then confirm. Same as Ctrl+Shift+Alt+O.'
                : 'Start the overlay first to move it.'}
            </p>

            <div className='mt-1 flex items-center gap-3'>
              <Switch
                id='show-layout'
                defaultChecked={settingStore.showLayout}
                onCheckedChange={settingStore.setShowLayout}
              />
              <Label htmlFor='show-layout' className='text-sm font-normal'>
                Show zone layout images
              </Label>
            </div>
          </Section>

          <Section
            title='Walkthrough data'
            hint='Comes straight from the Exile Leveling project and updates itself.'
          >
            <p className='text-muted-foreground font-mono text-xs'>
              {sha === null ? 'not loaded yet' : sha.slice(0, 7)}
            </p>
            <div className='flex flex-wrap gap-2'>
              <Button
                variant='secondary'
                size='sm'
                onClick={() =>
                  openExternal('https://heartofphos.github.io/exile-leveling/')
                }
              >
                <PencilRuler className='mr-2 size-4' />
                Open Exile Leveling
              </Button>
              <Button
                variant='secondary'
                size='sm'
                onClick={() => openExternal(BUG_REPORT_URL)}
              >
                <Bug className='mr-2 size-4' />
                Report a bug
              </Button>
            </div>
          </Section>
        </div>
      </main>
    </>
  );
}
