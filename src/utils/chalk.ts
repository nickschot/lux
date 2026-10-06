import { Chalk } from 'chalk';

/**
 * The framework's chalk instance — equivalent to chalk's default export, which
 * is itself a `Chalk` built without options (same colour-level detection).
 *
 * Built from the *named* `Chalk` export on purpose. chalk is ESM-only from v5
 * on, and the app compiler re-bundles `dist/index.mjs` to CommonJS. Importing
 * from an ES module, esbuild gives a default import Node's CommonJS semantics
 * (the whole `require()` result), and `require()` of an ES module returns its
 * namespace — so `import chalk from 'chalk'` would make `chalk.yellow`
 * undefined inside an app. Named imports resolve correctly either way. An
 * ESLint rule keeps the default import out of `src/`.
 *
 * @private
 */
const chalk = new Chalk();

export default chalk;
