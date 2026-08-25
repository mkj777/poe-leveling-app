import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';
import ErrorBoundary from './components/error-boundary';
import { ThemeProvider } from './components/providers/theme-provider';
import { Toaster } from './components/ui/toaster';
import { invoke } from '@tauri-apps/api/tauri';

// Alles, was der Fehlergrenze entgeht, landet trotzdem im Terminal. Ohne das
// verschwinden Fehler aus Effekten und Promises spurlos in einer Konsole, an
// die von aussen niemand herankommt.
function forward(level: string, message: string) {
  void invoke('log_frontend', { level, message }).catch(() => undefined);
}

window.addEventListener('error', (event) => {
  forward('error', `${event.message}\n${event.error?.stack ?? ''}`);
});

window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  forward(
    'unhandledrejection',
    reason instanceof Error
      ? `${reason.message}\n${reason.stack ?? ''}`
      : String(reason)
  );
});

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ThemeProvider defaultTheme='dark'>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
      <Toaster />
    </ThemeProvider>
  </React.StrictMode>
);
