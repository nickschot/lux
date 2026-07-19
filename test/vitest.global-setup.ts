import { resolve as resolvePath } from 'path';

import exec from '../src/utils/exec';

// Vitest global setup — the port of the Mocha `before` hook in `test/index.js`.
// Runs once, in the main process, before any suite: it resets, migrates, and
// seeds the test-app database (each `lux db:*` first compiles the app through
// the legacy Rollup+Babel pipeline). Unlike the Mocha hook it does *not* warm
// the `getTestApp()` singleton — that cache lives in the test worker, so suites
// lazy-init it there on first use.
const { APPVEYOR, CIRCLECI } = process.env;

export default async function setup(): Promise<void> {
  const path = resolvePath(import.meta.dirname, 'test-app');
  const execOpts = { cwd: path };

  if (!APPVEYOR && !CIRCLECI) {
    await exec('lux db:reset', execOpts);
  }

  await exec('lux db:migrate', execOpts);
  await exec('lux db:seed', execOpts);
}
