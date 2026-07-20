// Isolated Babel 8 config for building the framework itself (src -> dist).
// `babelrc: false` keeps it from picking up the legacy `.babelrc` (babel-preset-lux,
// Babel 6) that the app compiler still uses. preset-env targets Node 20 so native
// syntax (async, class fields, spread, exponentiation) passes through untransformed.
//
// The override stays extension-scoped even though `src/` is now all TypeScript:
// @babel/eslint-parser also reads this config, and preset-typescript should not be
// applied to plain `.js`.
module.exports = {
  babelrc: false,
  presets: [['@babel/preset-env', { targets: { node: '20' }, modules: false }]],
  overrides: [{ test: /\.ts$/, presets: ['@babel/preset-typescript'] }]
};
