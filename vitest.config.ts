import { defineConfig } from 'vitest/config';

// Transitional Vitest config: it runs *only* the already-converted `.ts` test
// suites (`src/**/*.test.ts`), while Mocha keeps owning the remaining Flow
// `.test.js` files (see `mocha.opts`). Both runners are wired into `pnpm test`
// during the migration; this file and the Mocha side collapse into one once no
// `.test.js` remains (Phase 4, Step 4).
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    globalSetup: ['test/vitest.global-setup.ts'],
    // The bootstrap compiles + migrates the test-app, which is slow.
    testTimeout: 120000,
    hookTimeout: 120000,
    // Single process, no per-file isolation: the `getTestApp()` singleton and
    // the migrated database are shared across suites, matching Mocha's
    // single-process model. Isolated workers would each re-boot the app.
    // (Vitest 4 moved these off `poolOptions` to the top level.)
    pool: 'forks',
    fileParallelism: false,
    isolate: false,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/test/**', 'src/**/*.test.ts', 'src/**/interfaces.ts']
    }
  }
});
