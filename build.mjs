// Framework build: esbuild bundles the TypeScript source straight to dist/.
// esbuild strips the types and bundles in one pass -- no Babel stage, no
// intermediate build/ dir. Bundling (not transpile-only) is required: the
// source has circular imports and extensionless imports that only resolve at
// bundle time.
//
// The compiler options that change emitted code are passed explicitly via
// `tsconfigRaw` rather than discovered from tsconfig.json (esbuild then reads
// no tsconfig at all), so the output does not depend on which config file
// happens to sit above the sources:
//   - `useDefineForClassFields: true` -- uninitialized fields must stay
//     `declare` (they are) or they would be emitted and shadow the prototype
//     accessors `Model.initialize()` installs.
//   - `alwaysStrict: true` -- emits `"use strict"` in the CJS outputs, which
//     ESM input otherwise loses when esbuild converts it to CommonJS.
//
// Outputs:
//   dist/index.js   CJS library    -> package "main" / require()
//   dist/index.mjs  ESM library    -> the app compiler bundles this
//   dist/cli.cjs    CJS CLI bundle  -> bin/lumen
//   dist/testing.js / dist/testing.mjs
//                   test helpers    -> `lumen-framework/testing`
//
// package.json `exports` maps the public entries. Under Node both resolve to
// the CJS builds, as `main` did before the map; bundlers that honour the
// `module` condition get the ESM ones, as they got `module` before.
//
// Type declarations (dist/types/) are emitted separately by `pnpm build:types`
// (tsc), so this hot build/test path stays fast.
import { rmSync } from 'node:fs';

import esbuild from 'esbuild';

const shared = {
  bundle: true,
  platform: 'node',
  // Node 22 is the floor everywhere (engines, devEngines, CI). dist/cli.cjs is
  // loaded straight by Node via bin/lumen and dist/index.mjs is re-bundled by the
  // esbuild app compiler, so native `??`/`?.` are fine.
  target: 'node22',
  packages: 'external', // deps come from node_modules, don't inline them
  sourcemap: true,
  logLevel: 'info',
  tsconfigRaw: {
    compilerOptions: {
      useDefineForClassFields: true,
      alwaysStrict: true
    }
  }
};

rmSync('dist', { recursive: true, force: true });

await esbuild.build({
  ...shared,
  entryPoints: ['src/index.ts'],
  format: 'cjs',
  outfile: 'dist/index.js'
});
await esbuild.build({
  ...shared,
  entryPoints: ['src/index.ts'],
  format: 'esm',
  outfile: 'dist/index.mjs'
});
await esbuild.build({
  ...shared,
  entryPoints: ['src/testing.ts'],
  format: 'cjs',
  outfile: 'dist/testing.js'
});
await esbuild.build({
  ...shared,
  entryPoints: ['src/testing.ts'],
  format: 'esm',
  outfile: 'dist/testing.mjs'
});
await esbuild.build({
  ...shared,
  entryPoints: ['src/packages/cli/commands/index.ts'],
  format: 'cjs',
  outfile: 'dist/cli.cjs'
});
