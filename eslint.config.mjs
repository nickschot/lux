import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import babelParser from '@babel/eslint-parser';
import prettier from 'eslint-config-prettier';

// The tree is mid-migration, so the two source languages need different
// parsers: TypeScript files go through typescript-eslint, while the remaining
// Flow files go through @babel/eslint-parser with preset-flow (nothing else can
// parse Flow). Once no Flow remains, the `**/*.js` block and the Babel parser
// dependency can be deleted.
export default [
  {
    ignores: [
      'build/',
      'dist/',
      'coverage/',
      '.nyc_output/',
      'examples/',
      'flow-typed/',
      'decl/',
      'lib/',
      'test/test-app/dist/',
      'test/utils/debugger/dist/',
      // Pure Flow type modules — they declare types and export nothing at
      // runtime, so core rules (no-unused-vars in particular) misread them.
      // The previous .eslintignore skipped these too. They disappear as each
      // package is converted to TypeScript.
      '**/interfaces.js'
    ]
  },

  js.configs.recommended,

  // Flow sources (transitional).
  {
    files: ['**/*.js'],
    linterOptions: {
      // These files carry ~80 `eslint-disable` comments for airbnb-era rules
      // this config no longer enables. Reporting them just adds noise to files
      // that are being deleted as they convert, and auto-fixing them leaves
      // trailing-whitespace artifacts behind.
      reportUnusedDisableDirectives: 'off'
    },
    languageOptions: {
      parser: babelParser,
      parserOptions: {
        // Point at a config *file* rather than inlining `presets: [...]`:
        // ESLint deep-merges `parserOptions`, which turns a nested array into
        // an object ({"0": "@babel/preset-flow"}) that Babel then ignores,
        // silently losing Flow syntax support. The build config already maps
        // `.js` -> preset-flow.
        requireConfigFile: true,
        babelOptions: {
          configFile: './babel.config.build.cjs'
        }
      },
      globals: {
        ...globals.node
      }
    },
    rules: {
      // Core ESLint has no notion of Flow types, so both of these misfire on
      // Flow sources: identifiers used only in type positions read as undefined
      // (no-undef) and type-only imports read as unused (no-unused-vars). The
      // old config leaned on eslint-plugin-flowtype for this, which has no
      // ESLint 9 support and is unmaintained — not worth adopting for files
      // that are being deleted as they convert.
      //
      // TypeScript files keep both checks: typescript-eslint understands type
      // usage, so `@typescript-eslint/no-unused-vars` stays on for `.ts`.
      'no-undef': 'off',
      'no-unused-vars': 'off'
    }
  },

  // TypeScript sources.
  ...tseslint.configs.recommended.map(config => ({
    ...config,
    files: ['**/*.ts']
  })),
  {
    files: ['**/*.ts'],
    languageOptions: {
      globals: {
        ...globals.node
      }
    }
  },

  // Colocated tests run under Mocha.
  {
    files: ['**/*.test.{js,ts}', 'test/**/*.{js,ts}'],
    languageOptions: {
      globals: {
        ...globals.mocha
      }
    }
  },

  // Build tooling and the CLI entry point run in plain Node.
  {
    files: ['*.mjs', '*.cjs', 'bin/lux'],
    languageOptions: {
      globals: {
        ...globals.node
      }
    },
    rules: {
      // ESLint 9 flipped this default to 'all', which flags `catch (err)` where
      // the binding is unused. Rewriting those to optional catch binding is not
      // an option here: `bin/lux` must stay Babel-6-parseable (see the note at
      // the top of that file).
      'no-unused-vars': ['error', { caughtErrors: 'none' }]
    }
  },

  // Must stay last: turns off every rule Prettier owns.
  prettier
];
