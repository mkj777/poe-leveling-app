import { HashRouter, Route, Routes } from 'react-router-dom';

import MainRoutes from './pages/main-routes';
import { OVERLAY_ROUTE } from './utilities/constants';
import OverlayPage from './pages/overlay.page';
import { ToastAction } from './components/ui/toast';
import { applyUpdateNow, onUpdateReady } from './services/updater';
import { useAppStore } from './store/app.store';
import { useEffect } from 'react';
import { useToast } from './components/ui/use-toast';

function App() {
  const { setNewUpdateAvailable } = useAppStore((state) => state);

  const { toast } = useToast();

  // Geprueft und geladen wird im Rust-Backend, eingespielt beim Beenden. Zu
  // bestaetigen gibt es nichts, der Knopf beschleunigt nur. Bleibt das
  // Ereignis aus, weil kein Netz da ist oder die App nicht installiert ist,
  // passiert schlicht nichts.
  useEffect(() => {
    const ready = onUpdateReady((version) => {
      setNewUpdateAvailable(true);

      toast({
        title: `Version ${version} is ready`,
        description:
          'It installs itself the next time you start the app, or right now.',
        action: (
          <ToastAction
            altText='Install the update now and restart'
            onClick={() => void applyUpdateNow().catch(() => undefined)}
          >
            Update now
          </ToastAction>
        )
      });
    });

    return () => {
      void ready.then((off) => off());
    };
  }, []);

  return (
    <HashRouter>
      <Routes>
        <Route path='/*' element={<MainRoutes />} />

        <Route path={OVERLAY_ROUTE} element={<OverlayPage />} />
        <Route path='*' element={<h1>404 Not Found</h1>} />
      </Routes>
    </HashRouter>
  );
}

export default App;
