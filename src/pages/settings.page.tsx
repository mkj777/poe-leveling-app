import { Check, File } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Menubar } from '@/components/ui/menubar';
import { Switch } from '@/components/ui/switch';
import { open } from '@tauri-apps/api/dialog';
import { useNavigate } from 'react-router-dom';
import { useRouteStore } from '@/store/route.store';
import { useSettingsStore } from '@/store/settings.store';
import { useState } from 'react';

export default function SettingsPage() {
  const navigator = useNavigate();
  const settingStore = useSettingsStore((state) => state);
  const sha = useRouteStore((state) => state.sha);

  const [clientTxtPathValue, setClientTxtPathValue] = useState(
    settingStore.clientTxtPath
  );

  const handleOnClose = () => {
    navigator('/');
  };

  const handleSetClientTxt = async () => {
    const selection = await open({
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
      <Menubar
        className='h-[35px] justify-between rounded-none border-0 border-b-[2px] px-2 lg:px-4'
        data-tauri-drag-region
      >
        <h4 className='select-none' data-tauri-drag-region>
          Settings
        </h4>
        <div className='flex flex-row items-center justify-center gap-2'>
          <Button className='h-6' size='sm' onClick={handleOnClose}>
            <Check size={20} /> Apply
          </Button>
        </div>
      </Menubar>
      <main className='flex-grow overflow-y-auto p-2'>
        <section className='flex flex-col gap-4'>
          <div className='flex flex-col gap-1'>
            <Label>Client.txt Pfad</Label>
            <p className='text-xs opacity-60'>
              Wird automatisch aus dem laufenden Spiel erkannt. Nur setzen,
              wenn das fehlschlaegt.
            </p>
            <div className='flex w-full max-w-sm items-center space-x-2'>
              <Input
                type='text'
                placeholder='Client.txt Pfad'
                value={clientTxtPathValue}
                onChange={(e) => setClientTxtPathValue(e.target.value)}
                onBlur={() => settingStore.setClientTxtPath(clientTxtPathValue)}
              />
              <Button type='button' onClick={handleSetClientTxt}>
                <File /> Datei suchen
              </Button>
            </div>
          </div>

          <div className='flex flex-col gap-1'>
            <Label>Overlay-Position</Label>
            <p className='max-w-md text-xs opacity-60'>
              Das Overlay setzt sich selbst mittig unten in das Spielfenster
              und folgt ihm. Zum Verschieben und Skalieren im Overlay
              Strg+Shift+Alt+O druecken.
            </p>
          </div>

          <div className='flex flex-col gap-1'>
            <Label>Zonen-Layout anzeigen</Label>
            <div className='flex w-full max-w-sm items-center space-x-2'>
              <Switch
                title='Zonen-Layout anzeigen'
                defaultChecked={settingStore.showLayout}
                onCheckedChange={(set) => {
                  settingStore.setShowLayout(set);
                }}
              />
            </div>
          </div>

          <div className='flex flex-col gap-1'>
            <Label>Datenstand</Label>
            <p className='text-xs opacity-60'>
              {sha === null
                ? 'noch nicht geladen'
                : `exile-leveling ${sha.slice(0, 7)}`}
            </p>
          </div>
        </section>
      </main>
    </>
  );
}
