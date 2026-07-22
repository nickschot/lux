import { createRequire } from 'node:module';
import { join as joinPath } from 'path';

import type Application from '../../src/packages/application';

// `require` is not a global under Vitest's ESM module runner, so derive one
// from this file. Named `nodeRequire` (not `require`) to avoid colliding with
// the CJS `require` parameter when esbuild-register transpiles this module to
// CommonJS for the still-Mocha suites that import it.
const nodeRequire = createRequire(__filename);

type TestAppModule = {
  config: Record<string, unknown>;
  database: Record<string, unknown>;
  Application: new (opts: Record<string, unknown>) => Promise<Application>;
};

let instance: Application | undefined;

async function setupTestApp(): Promise<Application> {
  const port = 4000;
  const path = joinPath(__dirname, '..', 'test-app');

  const {
    config,
    database,
    Application: TestApp
  } = nodeRequire(joinPath(path, 'dist', 'bundle')) as TestAppModule;

  return new TestApp({
    ...config,
    database,
    path,
    port
  });
}

export async function getTestApp(): Promise<Application> {
  if (!instance) {
    instance = await setupTestApp();
  }

  return instance;
}
