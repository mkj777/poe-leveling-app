import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(async () => ({
  plugins: [react()],
  clearScreen: false,
  build: {
    // Vite inlines files under 4096 bytes as data: URIs into the bundle. The
    // app's CSP allows only 'self' for images, so exactly the icons just
    // below that limit dropped out: quest.png and town.png stayed blank in
    // release 0.91.0, but not in the dev server, which serves every file
    // individually. A byte threshold must not decide whether an image
    // arrives.
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
