'use strict';

// Transpiles TypeScript (`.ts`/`.tsx`) sources on the fly for the Mocha suite
// while the Flow -> TS migration is in progress. Scoped to `.ts`/`.tsx` on
// purpose: the default esbuild-register hook also grabs `.js`, which would
// shadow the Babel-6 Flow hook (`./babel-hook.js`) and make esbuild choke on
// the Flow annotations in the not-yet-converted `.js` files.
//
// Retired once the tree is fully TypeScript and the runner moves to Vitest.
require('esbuild-register/dist/node').register({
  extensions: ['.ts', '.tsx']
});
