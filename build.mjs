// Framework build: two stages, decoupled from the legacy Rollup app compiler.
//
//   1. Babel strips Flow (`.js`) and TypeScript (`.ts`) types -> plain-JS ESM in
//      `build/` (esbuild can't parse Flow, so Babel goes first).
//   2. esbuild bundles the entry points into `dist/`. Bundling (not transpile-only)
//      is required: the source has circular imports and extensionless imports that
//      only resolve at bundle time.
//
// Outputs:
//   dist/index.js   CJS library   -> package "main" / require()
//   dist/index.mjs  ESM library   -> the app compiler bundles this (Rollup eats ESM)
//   dist/cli.cjs    CJS CLI bundle -> bin/lux
import { execFileSync } from 'node:child_process';
import { rmSync } from 'node:fs';

import esbuild from 'esbuild';

const shared = {
  bundle: true,
  platform: 'node',
  // Node 20 is the floor everywhere (engines, .nvmrc, CI). Nothing re-parses
  // this output with an older parser anymore: the app compiler bundles
  // dist/index.mjs with esbuild (phase 5), and dist/cli.cjs is loaded straight
  // by Node via bin/lux. Native `??`/`?.` are fine.
  target: 'node20',
  packages: 'external', // deps come from node_modules, don't inline them
  sourcemap: true,
  logLevel: 'info'
};

rmSync('build', { recursive: true, force: true });
rmSync('dist', { recursive: true, force: true });

// Stage 1 — type-strip with Babel (Flow for .js, TS for .ts).
execFileSync(
  'babel',
  [
    '--config-file',
    './babel.config.build.cjs',
    'src',
    '--out-dir',
    'build',
    '--extensions',
    '.ts',
    // Ambient `.d.ts` stubs (declarations for untyped npm modules) parse as
    // ambient TS, which @babel/preset-typescript can't handle; keep them out
    // of the type-strip pass. Runtime is unaffected.
    '--ignore',
    'src/**/*.d.ts'
  ],
  { stdio: 'inherit' }
);

// Stage 2 — bundle.
await esbuild.build({
  ...shared,
  entryPoints: ['build/index.js'],
  format: 'cjs',
  outfile: 'dist/index.js'
});
await esbuild.build({
  ...shared,
  entryPoints: ['build/index.js'],
  format: 'esm',
  outfile: 'dist/index.mjs'
});
await esbuild.build({
  ...shared,
  entryPoints: ['build/packages/cli/commands/index.js'],
  format: 'cjs',
  outfile: 'dist/cli.cjs'
});
