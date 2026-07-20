// Isolated Babel 8 config for building the framework itself (src -> dist).
// `babelrc: false` keeps it from picking up the legacy `.babelrc` (babel-preset-lux,
// Babel 6) that the app compiler still uses. Flow strips from `.js`, TS strips from
// `.ts`; preset-env targets Node 20 so native syntax (async, class fields, spread,
// exponentiation) passes through untransformed.
module.exports = {
  babelrc: false,
  presets: [['@babel/preset-env', { targets: { node: '20' }, modules: false }]],
  overrides: [
    { test: /\.js$/, presets: ['@babel/preset-flow'] },
    { test: /\.ts$/, presets: ['@babel/preset-typescript'] }
  ]
};
