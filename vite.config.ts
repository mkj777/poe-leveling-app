import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(async () => ({
  plugins: [react()],
  clearScreen: false,
  build: {
    // Vite haengt Dateien unter 4096 Byte als data:-URI ins Bundle. Die CSP
    // der Anwendung erlaubt fuer Bilder nur 'self', also fielen genau die
    // Icons aus, die knapp unter der Grenze lagen: quest.png und town.png
    // blieben im Release 0.91.0 leer, im Dev-Server nicht, weil der jede
    // Datei einzeln ausliefert. Eine Byte-Grenze darf nicht entscheiden, ob
    // ein Bild ankommt.
    assetsInlineLimit: 0
  },
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      ignored: ['**/src-tauri/**']
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
}));
