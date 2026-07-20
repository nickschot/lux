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
    // Three suites are timing-sensitive (the logger timestamp race, sleep()'s
    // 475-525ms window, and fs #watch()'s watchman daemon — see CLAUDE.md).
    // Shared CI runners are more contended than a laptop, so retry there only:
    // locally a flake should still be visible rather than silently papered over.
    retry: process.env.CI ? 2 : 0,
    // Single process, no per-file isolation: the `getTestApp()` singleton and
    // the migrated database are shared across suites, matching Mocha's
    // single-process model. Isolated workers would each re-boot the app.
    // (Vitest 4 moved these off `poolOptions` to the top level.)
    pool: 'forks',
    fileParallelism: false,
    isolate: false,
    coverage: {
      provider: 'v8',
      // `json-summary` is what the CI coverage-report action reads; `json`
      // gives it per-file detail. Neither is in Vitest's default reporter set.
      reporter: ['text', 'json-summary', 'json'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/test/**', 'src/**/*.test.ts', 'src/**/interfaces.ts']
    }
  }
});
