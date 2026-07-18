'use strict';

// Register the esbuild `.ts` hook *before* babel-register installs its own
// require hook below. If Babel loads first it ends up handling `.ts` files too
// (babylon then chokes on TS syntax), so order matters — and routing it through
// here keeps it correct however this file is required (mocha `--require`, nyc
// `-i`, or a direct import).
require('./ts-hook.js');

// Transforms applied to source when running the test suite through Babel 6.
// (Previously the async/exponentiation transforms were toggled by sniffing the
// Node version + `--harmony` flag — dead Node-6/7-era logic, now removed. The
// transforms stay: the legacy Chai/type-detect stack classifies a *native*
// async function as 'asyncfunction' rather than 'function', so several tests
// rely on async being down-levelled. This whole hook goes away in the Vitest
// migration.)
const plugins = (...items) => items.concat([
  'transform-class-properties',
  'transform-flow-strip-types',
  'transform-es2015-modules-commonjs',
  ['transform-object-rest-spread', {
    useBuiltIns: true
  }],
  'babel-plugin-transform-exponentiation-operator',
  'babel-plugin-transform-async-to-generator'
]);

// eslint-disable-next-line import/no-extraneous-dependencies
require('babel-core/register')({
  babelrc: false,
  plugins: plugins(),
  env: {
    test: {
      sourceMaps: 'inline',
      plugins: plugins(['istanbul', {
        include: [
          'src/**/*.js'
        ],
        exclude: [
          '**/test',
          '**/errors',
          '**/interfaces.js'
        ]
      }])
    }
  }
});
