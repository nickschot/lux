// Bundles the debugger dev tool (src/debug.js -> dist/debug.js). Replaces the
// old Rollup 0.43 config; esbuild's `packages: 'external'` reproduces the
// bare-vs-relative external split it hand-rolled, and source maps come from
// `node --enable-source-maps` (the `debugger` script) rather than an injected
// `source-map-support` banner.
import * as esbuild from 'esbuild';

await esbuild.build({
  entryPoints: ['test/utils/debugger/src/debug.js'],
  outfile: 'test/utils/debugger/dist/debug.js',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node20',
  packages: 'external',
  sourcemap: true,
  logLevel: 'info'
});
