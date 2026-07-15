# CLAUDE.md

Guidance for working in this repository.

## What this is

`lux-framework` — an MVC-style Node.js framework for building JSON:API 1.0 compliant
REST APIs with minimal boilerplate. Controllers get automatic CRUD, pagination,
sorting, and filtering; the ORM sits on top of [Knex](http://knexjs.org/).

This repo is a **fork** of [postlight/lux](https://github.com/postlight/lux) (upstream is
unmaintained), maintained at [nickschot/lux](https://github.com/nickschot/lux). The
current line of work is the `develop` branch, tagged `2.0.0`. Fork-specific commits sit
on top of upstream `v1.2.3` and fix bugs in relationships, pagination `count`, error
detail leakage, and PK resolution on create (see git log, PRs #2–#8).

**Goal of current work:** modernize the framework toward current standards (its
toolchain — Node 6, Babel 6, Flow, Rollup 0.43 — is ~2017-era). Keep behavior stable
while replacing legacy tooling.

### Modernization decisions (agreed)

- **Language:** migrate Flow → **TypeScript**.
- **Compatibility scope:** this fork is consumed **only by the maintainer's own apps**.
  There are no external downstream users, so the public API (`Model`, `Controller`,
  `Serializer`, `Application`, `Logger`, `luxify`) and the app-facing compiler may change
  freely — consumer apps are co-evolved. Optimize for a clean modern result over
  backward compatibility.
- **Package manager:** **pnpm** (replacing yarn).
- **Target stack:** Node 20 LTS · TypeScript · **tsup** build (esbuild) · Vitest · ESLint 9
  flat + typescript-eslint + Prettier.
- **Build tool:** **tsup** for the steady state. The deciding constraint is that
  esbuild/tsup/tsc/swc/Vitest **cannot parse Flow** — only Babel can — and the tree is
  ~375 Flow files. So the build swap and the Flow→TS migration are one project.
- **Migration strategy — "Path B" (front-load conversion):** keep the current Babel build
  + Mocha while we convert Flow→TS, then flip to tsup + Vitest once no Flow remains. (The
  alternative — a dual esbuild+Babel transpiler to swap the build early — was rejected as
  throwaway infra.) **Proper types are a hard requirement:** use `flow-to-ts` only as a
  per-file scaffold, then hand-tighten under **strict** `tsconfig`; `tsc --noEmit` is the
  type-correctness gate (Babel only strips types, it does not check them).
- **Transition wrinkles:**
  - `tsc` can't parse Flow either → keep `allowJs: false` and convert **bottom-up** (leaf
    utils first) so every `.ts` file imports only already-converted `.ts`.
  - The Mocha hook can run `.ts` via esbuild-register alongside the Babel-6 Flow hook for
    `.js` — **validated** (order matters: register `.ts`/esbuild *before* babel-register,
    or Babel grabs `.ts` and babylon chokes; route it through `babel-hook.js` requiring the
    ts-hook first). But this only fixes *unit* test transpilation, not the blocker below.
- **⚠ Sequencing blocker (discovered in the Phase 2 spike):** the framework **ships raw
  source** (`main: src/index.js`), and the test bootstrap builds `test/test-app` *from that
  source* via the **legacy app compiler** (Rollup 0.43 + `rollup-plugin-lux` + Babel 6),
  which cannot resolve or transpile `.ts`. So the first `.ts` file in `src/` breaks
  `lux db:*` and fails the whole suite. **The build/ship-model must become `.ts`-capable
  before source can be converted** — this inverts the naive order (compiler work can't come
  last). `flow-to-ts`/tsconfig/esbuild-register all work; the app compiler is the gate.
- **Drop `source-map-support`** in favor of Node's built-in `--enable-source-maps`.

**Phased roadmap** — REVISED after the Phase 2 spike (order below supersedes the naive
"convert first, compiler last"):
0. ✅ Safety net — suite green on Node 20 / pnpm (552 passing).
1. ✅ Runtime & dependency hygiene — safe dep bumps, Node-6 shims dropped.
2. **Decouple + unify the transpiler (the real unlock).** Make the framework build a
   plain-JS `dist` and point `main`/`module`/`types` at it, so the app compiler consumes
   built JS instead of raw source. Use a transpiler that handles **both** Flow and TS —
   **Babel 7** (`@babel/preset-flow` for `.js` + `@babel/preset-typescript` for `.ts`) is
   the only single tool that does — for the framework build (and, when it's touched, the
   app compiler). `tsc --noEmit` (strict) is the separate type gate.
3. Flow → TypeScript, bottom-up per `src/packages/*`, hand-tightened to proper types;
   green throughout via the Babel-7 build.
4. Once no Flow remains: drop `@babel/preset-flow`, flip the build to **tsup**/esbuild and
   the runner to **Vitest**; retire Babel/Mocha/nyc, `lib/babel-hook.js`, `.babelrc`.
5. Finish the app-facing compiler rework (`rollup-plugin-lux`) — likely esbuild; free to
   break since only own apps consume it.
6. ESLint 9 flat + Prettier; replace CircleCI/AppVeyor with GitHub Actions.

## Architecture

Source lives in `src/`, organized as self-contained "packages" under `src/packages/`.
The public API is re-exported from `src/index.js`:

- **`application`** — the `Application` class; boots everything via `initialize.js`.
- **`database`** — the ORM. `Model` base class plus `query`, `relationship`,
  `attribute`, `validation`, `migration`, `change-set`, and `transaction`
  subsystems. Largest package (~63 files). Wraps Knex.
- **`controller`** — `Controller` base class. Actions return values (objects, arrays,
  Models, Queries, Promises) rather than calling `res.end()`. CRUD is automatic.
- **`router`** — routing built on a `FreezeableMap` (not an array). `namespace`,
  `resource`, `route`, `definitions`.
- **`server`** — Node `http` wrapper: `request`, `response`, `responder`. Handles
  content negotiation and CORS.
- **`serializer`** — `Serializer` base class; declares which attributes/relationships
  appear in JSON:API output, driving query optimization.
- **`jsonapi`** — JSON:API document types and helpers.
- **`cli`** — the `lux` binary's commands (`new`/`create`, `serve`, `build`, `generate`,
  `destroy`, `db*`, `repl`, `test`). Entry: `src/packages/cli/commands/`.
- **`compiler`** / **`loader`** — Rollup-based build of user apps and module loading.
- **`luxify`** — adapter to use classic `(req, res, next)` middleware in
  `Controller#beforeAction`.
- Support packages: `config`, `logger`, `fs`, `freezeable`, `template`, `pm` (cluster
  process management).

Shared helpers are in `src/utils/`; global constants in `src/constants.js` (reads from
`process.env`: `PORT` default 4000, `NODE_ENV`, `DATABASE_URL`, etc.).

Colocated tests: `src/**/*.test.js`. Type/decl stubs in `decl/` and `flow-typed/`.
`test/test-app/` is a full example Lux app the suite boots against (Postgres/MySQL/SQLite).

## Toolchain (current, legacy)

- **Language:** ES2015+ with [Flow](https://flow.org/) types (`// @flow`,
  `flow-bin@0.38`). Type-check: `npm run flow`.
- **Transpile:** Babel 6 via `babel-preset-lux`. `.babelrc` uses the `lux` preset.
- **Bundle:** Rollup 0.43 (`rollup.config.js`) → `dist/index.js`. Build: `npm run build`.
- **Lint:** ESLint 3 (`airbnb-base`, `babel-eslint` parser, flowtype plugin) + `remark`
  for markdown. `npm run lint`. Note `max-len` is 80.
- **Test:** Mocha 3 + Chai + Sinon, run through `nyc` for coverage. Test setup registers
  Babel via `lib/babel-hook.js` (`mocha.opts`). Run: `npm test`.
- **Package manager:** **pnpm 10** (migrated from yarn; `pnpm-lock.yaml`, `packageManager`
  field). The old `yarn.lock` is retained untracked for reference only.
- **Node:** pinned to **20** via **Volta** (`volta` field in `package.json`; `.nvmrc` = 20).

## Environment (Phase 0 — done)

This machine uses **Volta**, not nvm. Two gotchas when running the suite locally:

- **`VOLTA_FEATURE_PNPM=1` must be set** in your interactive shell's config (fish:
  `set -gx VOLTA_FEATURE_PNPM 1` in `~/.config/fish/config.fish`; zsh/bash: export it in
  `~/.zshrc`/`~/.bashrc`). Without it, Volta's pnpm shim runs children on the *default*
  Node (18) instead of the project's pinned Node 20.
  Inside `test/test-app/` Volta also falls back to Node 18 because that nested
  `package.json` has no `volta` field — harmless (the legacy stack runs on 18).
- **The `lux` CLI is resolved via `node_modules/.bin`.** The test bootstrap
  ([test/index.js](test/index.js)) shells out to `lux db:reset / db:migrate / db:seed`
  (each first runs a full app compile via the legacy Rollup+Babel pipeline). The old flow
  relied on `npm link`; instead the repo now self-links via a `lux-framework: link:.`
  devDependency, so `pnpm install` places `lux` in the root `node_modules/.bin`. pnpm
  prepends that dir to PATH for `pnpm test`, and the child_process `exec('lux …')` inherits
  it — so no `npm link` or manual PATH is needed. (Replacing these `exec('lux …')`
  shell-outs is still a later-phase cleanup.)

## Commands

```bash
pnpm install          # install deps (root)
pnpm --dir test/test-app install   # install the test fixture app's deps
pnpm run build        # rollup build -> dist/index.js
pnpm run flow         # flow type check
pnpm run lint         # remark + eslint
pnpm run clean        # remove build/coverage artifacts

# Full test suite (VOLTA_FEATURE_PNPM can instead live in ~/.zshrc):
VOLTA_FEATURE_PNPM=1 pnpm test
```

Tests need a database; the test-app defaults to **`sqlite3`** (bumped to `^5.1.7`, a
prebuilt N-API binary — no native compile, no Python). CI additionally runs `pg` /
`mysql2` via `DATABASE_DRIVER`.

**Current baseline (Node 20 / pnpm 10):** `551 passing, 1 failing`. The single failure is
a *pre-existing flaky* logger test ([logger.test.js:67](src/packages/logger/test/logger.test.js:67))
that asserts a log timestamp exactly equals a `Date.now()` captured a moment earlier — it
loses a 1 ms race intermittently. Not a regression; a candidate to fix during the test-runner migration.

## Working notes

- Follow existing conventions: keep `// @flow` annotations, respect the 80-col limit,
  match the import ordering the airbnb config enforces, and prefer `Reflect.*` where the
  codebase already does (the `prefer-reflect` rule is on).
- `dist/` is **gitignored** (not committed) and generated by the build; don't hand-edit
  it. Note: there is currently **no `pretest`/`prepare` build wired**, so the suite relies
  on a `dist` already existing locally (a stale artifact today). `npm publish` builds it
  first (the old CI ran `npm run build` before publish). Wiring a reliable build step is
  part of Phase 2.
- When modernizing, prefer changing tooling/config over rewriting framework behavior
  unless a change is explicitly requested. The public surface is `src/index.js` exports
  (`Model`, `Controller`, `Serializer`, `Application`, `Logger`, `luxify`).
- Upstream is unmaintained — this fork is the source of truth. When comparing against
  `postlight/lux`, remember fork commits (#2–#8) intentionally diverge.
