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
2. ✅ **Decouple + unify the transpiler (the real unlock).** New two-stage build
   ([build.mjs](build.mjs)): **Babel 8** strips Flow (`.js`) + TS (`.ts`) → plain-JS ESM
   in `build/`; **esbuild** bundles → `dist/` (`index.js` CJS `main`, `index.mjs` ESM,
   `cli.cjs` for `bin/lux`). App compiler's `LUX_LOCAL` now points at `dist/index.mjs`, so
   it bundles built JS (decoupled from source language). TS foundation in place: strict
   [tsconfig.json](tsconfig.json), `pnpm typecheck` (`tsc --noEmit`), and
   [lib/ts-hook.js](lib/ts-hook.js) (esbuild-register runs `.ts` in Mocha, loaded via
   `babel-hook.js` before babel-register). Proven end-to-end on `src/utils/uniq.ts`.
3. 🔄 **Flow → TypeScript, bottom-up per `src/packages/*`** — IN PROGRESS, see
   "Phase 3 status" below.
4. Once no Flow remains: drop `@babel/preset-flow`, flip the build to **tsup**/esbuild and
   the runner to **Vitest**; retire Babel/Mocha/nyc, `lib/babel-hook.js`, `lib/ts-hook.js`,
   `.babelrc`. Raise the esbuild target off `es2017`. Convert the `*.test.js` files then
   too (they stay Flow for now; chai/mocha typings come with the runner swap).
5. Finish the app-facing compiler rework (`rollup-plugin-lux`) — likely esbuild; free to
   break since only own apps consume it.
6. ✅ ESLint 9 flat + typescript-eslint + Prettier. ⬜ Still to do: replace
   CircleCI/AppVeyor with GitHub Actions.

## Phase 3 status — where to resume

**Progress: 53 `.ts` files, 322 Flow files left.** Every batch is one commit, with all
five gates green (see "Conversion recipe").

**Converted:** all of `src/utils/`, `src/interfaces`, `src/constants`, `freezeable`,
`template`; `jsonapi` partially (`constants`, `utils/has-media-type`, `utils/is-jsonapi`);
`logger` partially (`interfaces`, `constants`, `utils/line`, `utils/sql`, all of
`writer/`, `request-logger/utils/filter-params`).

**⚠ The next step is a cluster, not a package.** `logger`, `server` and `router` are
**mutually dependent** — `server` does `import type Logger`, `logger/request-logger` does
`import type { Request, Response }`, `router` is entangled with both. TypeScript handles
circular *types* fine, but `allowJs: false` means none of them can read the others' types
until they are all `.ts`. So they convert **as one unit** (~113 files: logger 10 left,
server 29, router 65). Everything else waits on it: `logger/index` is blocked behind
`request-logger`, which blocks `jsonapi/{errors,index,interfaces}`, which blocks
`controller`/`serializer`. Consider splitting the work across sessions but landing it as
one green commit.

**Conversion recipe (per batch):**
1. Map the package's imports first — only convert files whose internal imports are already
   `.ts` (`grep -hoE "from '[^']*'"` over the package).
2. Hand-write the types. `flow-to-ts` is fine as a scaffold for big files, but these are
   small enough that hand conversion produces better types.
3. Gates, all of which must pass: `pnpm exec tsc --noEmit` → `pnpm exec prettier --write
   "src/**/*.ts"` → `pnpm lint` → `pnpm build` → `pnpm test` (552 passing).
4. `git rm` the `.js` originals in the same commit so renames show up as renames.

**Conventions established so far** (keep these consistent):
- Prefer real **type predicates** (`value is null`) over `boolean` for guards.
- Where Flow claimed `T -> T` but the runtime returns something else, type it **honestly**:
  `pick`/`omit` → `Partial<T>`; `compact`/`transformKeys` → **overloads**, because arrays
  and objects behave differently.
- `setType` was a Flow crutch and is **gone** — TypeScript generics say it directly. Delete
  any remaining calls as their callers convert.
- Confine unavoidable casts to return boundaries where dynamic key access genuinely makes
  the shape unknowable, and comment why.
- `noImplicitOverride` is on: subclass methods need `override`.
- Keep conversions **behaviour-faithful**. Several latent bugs surfaced (dead `worker.pid`
  branch, redundant spreads, an ignored `dasherize` argument); fix them only when the fix
  is provably a no-op, and say so in the commit.

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
- **Transpile:** Babel 6 via `babel-preset-lux` (`.babelrc`) is still used by the *app
  compiler*. The framework's own build is Babel 8 + esbuild — see [build.mjs](build.mjs).
- **Bundle:** [build.mjs](build.mjs) → `dist/` (`index.js` CJS, `index.mjs` ESM,
  `cli.cjs`). Build: `pnpm build`. **esbuild targets `es2017` on purpose:** two Babel 6
  stages still *parse* the output — nyc wraps child processes so the suite's `lux …`
  shell-outs load `dist/cli.cjs` through `lib/babel-hook.js`, and the legacy app compiler
  bundles `dist/index.mjs` with Rollup 0.43 + Babel 6. babylon rejects post-ES2017 syntax,
  so a stray `??`/`?.` in any converted source otherwise breaks the test bootstrap.
  `bin/lux` is subject to the same constraint (noted in that file). Raise the target once
  phases 4 and 5 retire Mocha/nyc and the app compiler.
- **Lint/format:** **ESLint 9 flat** ([eslint.config.mjs](eslint.config.mjs)) +
  typescript-eslint + **Prettier**. `pnpm lint`, `pnpm format`, `pnpm format:check`.
  Because the tree is mid-migration the config scopes parsers by extension: `.ts` uses
  typescript-eslint, `.js` uses `@babel/eslint-parser` (nothing else parses Flow). On the
  Flow side `no-undef`/`no-unused-vars` are off — core ESLint can't see type-position
  usage and `eslint-plugin-flowtype` has no ESLint 9 support. Prettier skips `**/*.js`
  (transitional; files get formatted as they convert) and `*.md`.
- **Test:** Mocha 3 + Chai + Sinon, run through `nyc` for coverage. Test setup registers
  Babel via `lib/babel-hook.js` (`mocha.opts`). Run: `npm test`.
- **Package manager:** **pnpm 10** (migrated from yarn; `pnpm-lock.yaml`, `packageManager`
  field). The old `yarn.lock` is retained untracked for reference only.
- **Node:** pinned to **20** via **Volta** (`volta` field in `package.json`; `.nvmrc` = 20).

## Devcontainer (preferred environment)

[.devcontainer/](.devcontainer/) is the intended way to work on this project now.

**Start it with IntelliJ/WebStorm's "Create Dev Container and Clone Sources"**, not "Mount
Sources": bind-mounting the macOS filesystem is slow for this workload (large
`node_modules`, many-file test runs). The IDE performs the clone itself — you give it the
repo URL and branch — so **the branch has to exist on the remote**; it will not pick up
local-only commits. `postCreateCommand` then runs
[post-create.sh](.devcontainer/post-create.sh), which installs both dependency trees and
builds `dist/`. **Verified end-to-end in clone mode: `552 passing`** with
typecheck/lint/format green, watchman tests included.

Ships Node **20.20.2** (same as the host's Volta pin), pnpm **10.34.5** via corepack,
watchman, the `gh` CLI, and Claude Code (via the official feature). First run: `claude`
prompts for login and `gh auth login` (or export `GH_TOKEN` on the host — `remoteEnv`
forwards it, along with `GIT_AUTHOR_NAME`/`GIT_AUTHOR_EMAIL`).

Things about the setup that are load-bearing, all learned by breaking them:
- **Base is `trixie`, not `bookworm`.** Meta's prebuilt watchman links against GLIBC 2.38;
  bookworm ships 2.36 and the binary simply refuses to run, which costs 3 tests.
- **The base image's preinstalled pnpm is removed** (`npm uninstall -g pnpm`). It is newer
  than this project's pin, requires Node >= 22.13 (it imports `node:sqlite`), and would
  shadow corepack's shim — it hard-crashes on Node 20.
- **`workspaceMount`/`workspaceFolder` are intentionally unset**, so the IDE controls where
  the clone lands. The Dockerfile still pre-creates `/workspaces/lux` owned by `node`,
  because a volume mounted at a path the image lacks comes up root-owned and the clone
  then fails with "Permission denied"; post-create re-checks writability at runtime for
  whatever path is actually used.
- **`node_modules` gets no volume.** With sources cloned into the container they are
  already on a container-native filesystem. (The earlier bind-mount setup needed volumes to
  keep the host's darwin-x64 sqlite3 binaries out of the linux install — that whole class
  of problem disappears in clone mode.)

Bind-mounting still works via the devcontainer CLI/VS Code, but is not the supported route:
pnpm will refuse to reuse a host-built `node_modules` (`ERR_PNPM_ABORTED_REMOVE_MODULES_DIR`),
which is correct — auto-purging would delete the host's tree.

Inside the container there is **no Volta**, so the `VOLTA_FEATURE_PNPM` dance below does
not apply — `node` and `pnpm` are simply on PATH.

## Environment (host — Phase 0)

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

# The five gates — all must pass before committing a conversion batch:
pnpm typecheck        # tsc --noEmit (strict); the real type gate
pnpm exec prettier --write "src/**/*.ts"
pnpm lint             # eslint 9 flat (.ts + Flow .js)
pnpm build            # Babel 8 -> build/, esbuild -> dist/
VOLTA_FEATURE_PNPM=1 pnpm test    # 552 passing

pnpm format:check     # prettier verification (CI-style)
pnpm run flow         # legacy Flow check — NOT a gate, expected to fail mid-migration
pnpm run clean        # remove build/dist/coverage artifacts
```

`pnpm build` matters more than it looks: the app compiler consumes `dist/index.mjs`, so
the suite runs against the *last build*, not the working tree. Always build before test.

Tests need a database; the test-app defaults to **`sqlite3`** (bumped to `^5.1.7`, a
prebuilt N-API binary — no native compile, no Python). CI additionally runs `pg` /
`mysql2` via `DATABASE_DRIVER`.

**Current baseline (Node 20 / pnpm 10):** `552 passing`.

Two areas are **known-flaky** — if a run goes red here, re-run before investigating:
- [logger.test.js:67](src/packages/logger/test/logger.test.js:67) asserts a log timestamp
  exactly equals a `Date.now()` captured a moment earlier, so it loses a 1 ms race
  intermittently.
- `module "fs" #watch()` depends on the external **watchman** daemon; it intermittently
  times out and then fails its `after all` hook with
  `Cannot read properties of undefined (reading 'destroy')`.

Both are pre-existing, not regressions, and are candidates to fix during the test-runner
migration.

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
