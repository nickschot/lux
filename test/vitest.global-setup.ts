import { resolve as resolvePath } from 'path';

import exec from '../src/utils/exec';

// Vitest global setup. Runs once, in the main process, before any suite: it
// resets, migrates and seeds the test-app database (each `lumen db:*` first
// compiles the app with esbuild, through `dist/`). It does *not*
// warm the `getTestApp()` singleton — that cache lives in the test worker, so
// suites lazy-init it there on first use.
//
// `lumen db:reset` provisions every driver. LUMEN_SKIP_DB_RESET skips it, for
// a database created by other means.
const { LUMEN_SKIP_DB_RESET } = process.env;

export default async function setup(): Promise<void> {
  const path = resolvePath(import.meta.dirname, 'test-app');
  const execOpts = { cwd: path };

  if (!LUMEN_SKIP_DB_RESET) {
    await exec('lumen db:reset', execOpts);
  }

  await exec('lumen db:migrate', execOpts);
  await exec('lumen db:seed', execOpts);
}
