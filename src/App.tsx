import { HashRouter, Route, Routes } from 'react-router-dom';

import LayoutMapPage from './pages/layout-map.page';
import MainRoutes from './pages/main-routes';
import OverlayPage from './pages/overlay.page';
import { ToastAction } from './components/ui/toast';
import { checkForUpdate, installPendingUpdate } from './services/updater';
import { useAppStore } from './store/app.store';
import { useEffect } from 'react';
import { useToast } from './components/ui/use-toast';

function App() {
  const { setNewUpdateAvailable } = useAppStore((state) => state);

  const { toast } = useToast();

  const startInstall = () => {
    toast({
      title: 'Installing update...',
      description:
        'Please wait...\nThis program will restart automatically after the update is installed.'
    });
    void installPendingUpdate();
  };

  useEffect(() => {
    void checkForUpdate()
      .then((version) => {
        setNewUpdateAvailable(version !== null);
        if (version === null) return;

        toast({
          title: 'New update available',
          description: `Version ${version}. The app restarts on its own once it is in.`,
          action: (
            <ToastAction altText='Install' onClick={startInstall}>
              Install
            </ToastAction>
          )
        });
      })
      // Die Endpunkte zeigen noch auf das Upstream-Projekt, ein Fehlschlag
      // darf die App nicht stoeren.
      .catch(() => setNewUpdateAvailable(false));
  }, []);

  return (
    <HashRouter>
      <Routes>
        <Route path='/*' element={<MainRoutes />} />

        <Route path='/overlay' element={<OverlayPage />} />
        <Route path='/layoutmap' element={<LayoutMapPage />} />
        <Route path='*' element={<h1>404 Not Found</h1>} />
      </Routes>
    </HashRouter>
  );
}

export default App;
