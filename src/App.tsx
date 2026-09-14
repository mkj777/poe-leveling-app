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

  // Checking and downloading happen in the Rust backend, applying on exit.
  // There is nothing to confirm, the button only speeds things up. If the
  // event never comes, because there is no network or the app is not
  // installed, nothing happens at all.
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
