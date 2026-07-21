// Isolated Babel 8 config for building the framework itself (src -> dist).
// preset-env targets Node 20 so native syntax (async, class fields, spread,
// exponentiation) passes through untransformed. `babelrc: false` keeps it
// hermetic (there is no repo `.babelrc` anymore — Babel 6 is fully retired).
//
// The override stays extension-scoped even though `src/` is now all TypeScript:
// @babel/eslint-parser also reads this config, and preset-typescript should not be
// applied to plain `.js`.
module.exports = {
  babelrc: false,
  presets: [['@babel/preset-env', { targets: { node: '20' }, modules: false }]],
  overrides: [{ test: /\.ts$/, presets: ['@babel/preset-typescript'] }]
};
