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
  // Deliberately below what Node 20 supports: two Babel 6 stages still *parse*
  // this output, and babylon rejects post-ES2017 syntax.
  //   - dist/cli.cjs  -> nyc wraps child processes, so the suite's `lux ...`
  //                      shell-outs load it through lib/babel-hook.js
  //   - dist/index.mjs -> the legacy app compiler bundles it with Rollup 0.43
  //                      + rollup-plugin-babel
  // Without this, any `??`/`?.` in a converted source file reaches the bundle
  // and breaks the test bootstrap. Raise to 'node20' once the Mocha/nyc stack
  // and the app compiler are retired (phases 4 and 5).
  target: 'es2017',
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
    '.js,.ts',
    // Ambient `.d.ts` stubs (temporary type shims for not-yet-converted
    // packages) parse as ambient TS, which @babel/preset-typescript can't
    // handle; keep them out of the type-strip pass. Runtime is unaffected.
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
