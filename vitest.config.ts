import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    setupFiles: ['src/__tests__/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'text'],
      /**
       * Gemessen wird der eigene, testbare Kern: Geometrie, Fortschritt,
       * Darstellung, Sync und Stores. Bewusst aussen vor:
       *
       * - route-processing ist unveraendert vom Upstream uebernommen. Dessen
       *   Abdeckung ist deren Sache, unsere Zusicherung darauf ist der
       *   Golden-File-Test.
       * - Komponenten und Seiten brauchen eine DOM-Umgebung und pruefen vor
       *   allem Darstellung. Was an ihnen entscheidbar ist, steckt in reinen
       *   Funktionen daneben und wird dort geprueft.
       * - Alles, was nur Tauri-Aufrufe weiterreicht, ist ohne laufende App
       *   nicht sinnvoll pruefbar.
       */
      include: [
        'src/utilities/**/*.ts',
        'src/services/route-sync.ts',
        'src/services/overlay-settings.ts',
        'src/lib/exile-leveling/build-route.ts',
        'src/lib/exile-leveling/data.ts',
        'src/store/**/*.ts'
      ],
      exclude: ['**/__tests__/**', '**/__perf__/**', '**/*.test.ts'],
      thresholds: {
        lines: 100,
        functions: 100,
        branches: 100,
        statements: 100
      }
    }
  }
});
