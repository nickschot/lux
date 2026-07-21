// Framework build: esbuild bundles the TypeScript source straight to dist/.
// esbuild strips the types and bundles in one pass -- no Babel stage, no
// intermediate build/ dir. Bundling (not transpile-only) is required: the
// source has circular imports and extensionless imports that only resolve at
// bundle time. esbuild reads tsconfig.json for `useDefineForClassFields`
// (true at target ES2022), so uninitialized fields must stay `declare` (they
// are) or they would be emitted and shadow the prototype accessors.
//
// Outputs:
//   dist/index.js   CJS library    -> package "main" / require()
//   dist/index.mjs  ESM library    -> the app compiler bundles this
//   dist/cli.cjs    CJS CLI bundle  -> bin/lux
//
// Type declarations (dist/types/) are emitted separately by `pnpm build:types`
// (tsc), so this hot build/test path stays fast.
import { rmSync } from 'node:fs';

import esbuild from 'esbuild';

const shared = {
  bundle: true,
  platform: 'node',
  // Node 20 is the floor everywhere (engines, .nvmrc, CI). dist/cli.cjs is
  // loaded straight by Node via bin/lux and dist/index.mjs is re-bundled by the
  // esbuild app compiler, so native `??`/`?.` are fine.
  target: 'node20',
  packages: 'external', // deps come from node_modules, don't inline them
  sourcemap: true,
  logLevel: 'info'
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
  entryPoints: ['src/packages/cli/commands/index.ts'],
  format: 'cjs',
  outfile: 'dist/cli.cjs'
});
