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
    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
    setupFiles: ['src/__tests__/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'text'],
      /**
       * Measured is our own testable core: geometry, progress, rendering,
       * sync and stores. Deliberately left out:
       *
       * - route-processing is taken unchanged from upstream. Its coverage is
       *   their business; our guarantee on it is the golden-file test.
       * - Components and pages need a DOM environment and mostly check
       *   rendering. Whatever is decidable about them sits in pure functions
       *   next to them and is tested there.
       * - Anything that only forwards Tauri calls cannot be tested
       *   meaningfully without a running app.
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
