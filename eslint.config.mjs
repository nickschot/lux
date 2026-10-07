import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

// `src/` is entirely TypeScript. The remaining `.js` in the tree is the
// `test/test-app` fixture app (plain ES, no Flow), which parses with the
// default parser — so the old @babel/eslint-parser block is gone.
export default [
  {
    ignores: [
      'build/',
      'dist/',
      'docs/api/',
      'coverage/',
      'examples/',
      'test/test-app/dist/',
      'test/utils/debugger/dist/'
    ]
  },

  js.configs.recommended,

  // The only `.js` left is the `test/test-app` fixture app plus the debugger
  // tooling — plain ES, no Flow, so the default parser handles them. They keep
  // the relaxed rules the Flow block used to apply: they are fixtures and dev
  // utilities, not framework source, and several carry legacy disable comments
  // for rules this config no longer enables.
  {
    files: ['**/*.js'],
    linterOptions: {
      reportUnusedDisableDirectives: 'off'
    },
    languageOptions: {
      globals: {
        ...globals.node
      }
    },
    rules: {
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
    },
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'chalk',
              importNames: ['default'],
              message:
                "Use src/utils/chalk: chalk's default export breaks once " +
                'the app compiler re-bundles dist/index.mjs to CommonJS.'
            }
          ]
        }
      ],
      // `_`-prefixed parameters are deliberately unused: a built-in controller
      // action declares the `res` every action is called with, so overrides
      // that use it still type-check.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_' }
      ],
      // A leftover of upstream's `prefer-reflect` rule. These have plain
      // equivalents that keep type checking on (`Reflect.*` returns `any`)
      // and, for `defineProperty`/`set`, throw instead of returning `false`.
      // Model attributes go through `readAttribute`/`writeAttribute`; proxy
      // traps forwarding to their target disable this inline.
      'no-restricted-properties': [
        'error',
        ...[
          ['apply', 'Call the function directly, or use `fn.call(ctx, ...)`.'],
          ['construct', 'Use `new`.'],
          ['defineProperty', 'Use `Object.defineProperty`, which throws.'],
          ['has', 'Use the `in` operator, or `Object.hasOwn`.'],
          ['deleteProperty', 'Use the `delete` operator.'],
          ['get', 'Use property access, or `readAttribute` for a Model.'],
          ['set', 'Use assignment, or `writeAttribute` for a Model.']
        ].map(([property, message]) => ({
          object: 'Reflect',
          property,
          message
        }))
      ]
    }
  },

  // Colocated tests — all Vitest, which imports `describe`/`it`/`expect`
  // explicitly rather than relying on globals.
  {
    files: ['**/*.test.ts', 'test/**/*.ts'],
    rules: {
      // chai's BDD assertions (`expect(x).to.be.true`) are bare member
      // expressions, which this rule reads as a no-op statement. The suites
      // are built on that style, so it's off for tests.
      '@typescript-eslint/no-unused-expressions': 'off'
    }
  },

  // Build tooling and the CLI entry point run in plain Node.
  {
    files: ['*.mjs', '*.cjs', 'bin/lumen'],
    languageOptions: {
      globals: {
        ...globals.node
      }
    },
    rules: {
      // ESLint 9 flipped this default to 'all', which flags `catch (err)` where
      // the binding is unused. Rewriting those to optional catch binding is not
      // an option here: `bin/lumen` must stay Babel-6-parseable (see the note at
      // the top of that file).
      'no-unused-vars': ['error', { caughtErrors: 'none' }]
    }
  },

  // Must stay last: turns off every rule Prettier owns.
  prettier
];
