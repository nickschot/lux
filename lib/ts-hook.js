'use strict';

// Transpiles TypeScript (`.ts`/`.tsx`) sources on the fly for the Mocha suite
// while the Flow -> TS migration is in progress. Scoped to `.ts`/`.tsx` on
// purpose: the default esbuild-register hook also grabs `.js`, which would
// shadow the Babel-6 Flow hook (`./babel-hook.js`) and make esbuild choke on
// the Flow annotations in the not-yet-converted `.js` files.
//
// Retired once the tree is fully TypeScript and the runner moves to Vitest.
// The `banner` is load-bearing: esbuild's *transform* API never emits a
// "use strict" prologue, so transpiled modules would run in sloppy mode — while
// ESM (and the Babel build output) is always strict. That mismatch silently
// changes semantics: `this` inside a plain function call becomes `globalThis`
// instead of `undefined`, which sent `utils/k` -> the request formatter into
// infinite recursion over the global object. Keep tests matching production.
// eslint-disable-next-line import/no-extraneous-dependencies
require('esbuild-register/dist/node').register({
  extensions: ['.ts', '.tsx'],
  banner: '"use strict";'
});
