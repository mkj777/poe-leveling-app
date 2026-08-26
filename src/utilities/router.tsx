import MainPage from '@/pages/main.page';
import SettingsPage from '@/pages/settings.page';
import { createBrowserRouter } from 'react-router-dom';

const router = createBrowserRouter([
  {
    path: '/',
    element: <MainPage />
  },
  {
    path: '/settings',
    element: <SettingsPage />
  },
  {
    path: '*',
    element: <h1>404 Not Found</h1>
  }
]);
export default router;
