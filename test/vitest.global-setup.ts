import { resolve as resolvePath } from 'path';

import exec from '../src/utils/exec';

// Vitest global setup. Runs once, in the main process, before any suite: it
// resets, migrates and seeds the test-app database (each `lux db:*` first
// compiles the app through the legacy Rollup+Babel pipeline). It does *not*
// warm the `getTestApp()` singleton — that cache lives in the test worker, so
// suites lazy-init it there on first use.
//
// `lux db:reset` can only provision sqlite. For pg/mysql `dbdrop` connects *to*
// `lux_test` before dropping it (which Postgres refuses) and `dbcreate` connects
// to a database it is about to create — so those drivers need the database
// created externally, and whoever does that sets LUX_SKIP_DB_RESET. See the
// pg/mysql legs of .github/workflows/ci.yml.
const { LUX_SKIP_DB_RESET } = process.env;

export default async function setup(): Promise<void> {
  const path = resolvePath(import.meta.dirname, 'test-app');
  const execOpts = { cwd: path };

  if (!LUX_SKIP_DB_RESET) {
    await exec('lux db:reset', execOpts);
  }

  await exec('lux db:migrate', execOpts);
  await exec('lux db:seed', execOpts);
}
