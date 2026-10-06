# CLAUDE.md

Guidance for working in this repository.

## What this is

`lumen-framework` — an MVC-style Node.js framework for building JSON:API 1.0 compliant
REST APIs with minimal boilerplate. Controllers get automatic CRUD, pagination,
sorting, and filtering; the ORM sits on top of [Knex](http://knexjs.org/).

**Lineage.** Lumen began as a fork of [postlight/lux](https://github.com/postlight/lux)
(unmaintained upstream, last release `v1.2.3` in 2018) and is now a **standalone project**
rather than a fork: renamed `lux-framework` → `lumen-framework`, with its own release line.
Attribution to the original author lives in [README.md](README.md) and [LICENSE](LICENSE) —
keep both intact. References to `postlight/lux` elsewhere in the tree are deliberate.

The GitHub repository is still `nickschot/lux` **until it is renamed**, so URLs in the tree
point there on purpose; `rollup-plugin-lux` and `babel-preset-lux` are unrelated upstream
npm packages and must never be renamed.

**Status: the modernization is complete and released.** v3.x is published to npm as
`lumen-framework`; the toolchain is TypeScript + esbuild + Vitest on Node 22 (details in
"Toolchain" below). The plan, the phase-by-phase log, and the reasoning behind the
choices are archived in [docs/MIGRATION-NOTES.md](docs/MIGRATION-NOTES.md) — read that
before revisiting a decision, not to learn the current state.

**Compatibility scope — still load-bearing:** this package is consumed **only by the
maintainer's own apps**. There are no external downstream users, so the public API
(`Model`, `Controller`, `Serializer`, `Application`, `Logger`, `lumenify`) and the
app-facing compiler may change freely; consumer apps are co-evolved. Prefer a clean
result over backward compatibility, and record anything app-visible in
[UPGRADING.md](UPGRADING.md).

## Traps this migration hit (all pre-existing bugs the runner swap exposed)

- **`declare`, not `!`, for class fields backed by prototype accessors.** With
  `useDefineForClassFields` (default true at `target: ES2022`) a declaration-only field is
  *emitted* as an own property set to `undefined`, shadowing the accessor
  `Model.initialize()` installs — attributes silently stop persisting. **`!` does not
  prevent the emit**, it only silences `strictPropertyInitialization`.
  **RESOLVED — keep it that way.** `src/` used to rely on a build-step plugin
  (`lib/babel-plugin-strip-uninitialized-fields.cjs`) deleting these fields, which would
  have silently reintroduced the bug the moment the build moved off Babel. All 113
  uninitialized fields are now **`declare`** in the source and the plugin is gone. Note
  the three shapes this takes: 91 instance fields that were `!:`; **18 statics on `Model`,
  which cannot take `!` at all** (TS1255 — `strictPropertyInitialization` does not check
  statics, so a bare annotation was the only option); and 4 plain uninitialized fields.
  Adding a new field with a bare annotation or `!` will reintroduce the emit.
  (Why the suite stayed green before: `Model`'s constructor re-defines its instance fields
  via `Object.defineProperties`, so an own `undefined` gets overwritten — whereas the
  attribute accessors that broke `model.test` live on the *prototype* and stay shadowed.)
- **Never default-import an ESM-only package in framework code.** The app compiler
  re-bundles `dist/index.mjs` to CJS with packages external; importing from an `.mjs`,
  esbuild gives a default import Node's CommonJS semantics (the whole `require()`
  result), and `require()` of an ES module returns its *namespace* — so the default
  resolves to `{ default, … }`. The suite stays green (test env disables logging) while
  apps crash: chalk 6 shipped `chalk_default.yellow is not a function` until caught by
  hand. `dist/cli.cjs` is unaffected (bundled from TS, which honours `__esModule`).
  Use a **named** export — chalk goes through `src/utils/chalk.ts` (`new Chalk()`), and
  an ESLint `no-restricted-imports` rule bans `chalk`'s default.
  `compiler/test/framework-bundle.test.ts` re-bundles `dist/` like the compiler and
  logs through `Logger` to catch a regression.
- **Cross-suite DB pollution.** Mocha's alphabetical file order was load-bearing:
  `serializer.test` leaked 32 `posts` rows (its `createPost` registered every *related*
  record for teardown but not the post), which broke `query.test`'s absolute counts against
  the 100 seeded posts. Vitest orders files differently. Fixed the leak, not the ordering.
- **A per-test `createServer().listen(PORT)` + `close()` races itself** — `close()` is
  async, so each request can hit the previous server mid-shutdown (`socket hang up`).
  **Tell-tale sign: failures alternate exactly every other test.** `responder.test` now
  shares one listener via `beforeAll`/`afterAll`. `request.test` still uses the per-test
  shape on port 4100 and passes; apply the same fix if it goes flaky.
- **Vitest has no `done` callback and no globals.** Callback tests must become
  promise-based; hook globals (`beforeEach` etc.) must be imported or the file fails to
  **collect** — 0 tests run and the total silently drops rather than going red.
- **Neither `tsc` nor eslint catches Flow syntax in `.ts` test files** (`tsc` excludes
  `src/**/test`; eslint parses `void | ?string` without complaint — verified). Only
  `pnpm build` does, via Babel. Do not skip the build gate.
- Chai 3→4 breaks are the most common per-batch fix: dotted/indexed `deep.property` paths
  moved to `.nested.property`, and `constructor`/`__proto__` are guarded outright — assert
  the value directly instead. Also, oxc keeps `async` functions native, so
  `expect(asyncFn).to.be.a('function')` fails (`type-detect` says `'AsyncFunction'`); use
  `typeof x === 'function'`.

**Two weak specs were carried through the runner swap behaviour-faithful, then fixed once
the migration settled:** `fs.test`'s `returnsPromiseSpec` used to capture its path at
describe-collection time (before `beforeEach`), so 7 of 8 callers ran `fs` methods with
`undefined` and only asserted "returns a Promise" — now the args are a run-time thunk and the
spec `await`s the real call; and `logger.test`'s "writes with a recent timestamp" exact-equality
1 ms race is now a `[before, now]` window assertion.

## Conventions (keep these consistent)

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

## Toolchain (current)

- **Language:** **TypeScript** (strict). Type-check: `pnpm typecheck` (`tsc --noEmit`).
  No Flow remains, and its tooling is gone (`.flowconfig`, `flow-typed/`, `decl/`,
  flow-bin, preset-flow).
  Note `tsconfig` **excludes `src/**/test`**, so test files are not type-checked — the
  build and the suite are what catch errors there.
- **Build:** [build.mjs](build.mjs) is **pure esbuild** — it strips TS *and* bundles
  `src/` straight to `dist/` in one pass (`index.js` CJS, `index.mjs` ESM, `cli.cjs`). No
  Babel: **Babel is fully retired** (no `.babelrc`, no `babel-config.build.cjs`, no
  `@babel/*` or Babel-6 deps). `pnpm build`. **esbuild targets `node22`** — nothing
  re-parses the output with an older parser (the app compiler bundles `dist/index.mjs` with
  esbuild; `dist/cli.cjs` is loaded straight by Node via `bin/lumen`). esbuild reads
  `tsconfig.json` for `useDefineForClassFields` (true at ES2022), so **uninitialized class
  fields must stay `declare`** or they get emitted and shadow the prototype accessors.
- **Types:** `pnpm build:types` (`tsc -p [tsconfig.build.json](tsconfig.build.json)`) emits
  `dist/types/` (`declaration`/`emitDeclarationOnly`, `rootDir: src`); the `types` field
  points at `dist/types/index.d.ts`, so consumers get real types instead of `any`. Kept
  separate from `pnpm build` so the hot build/test loop stays fast; `prepack` runs both, and
  the CI `static` job runs `build:types` to catch declaration-only errors (e.g. TS2742).
- **Lint/format:** **ESLint 9 flat** ([eslint.config.mjs](eslint.config.mjs)) +
  typescript-eslint + **Prettier**. `pnpm lint`, `pnpm format`, `pnpm format:check`. `.ts`
  uses typescript-eslint; the remaining `.js` (test-app fixture + tooling) uses the default
  parser (the old `@babel/eslint-parser` block is gone). **eslint does not catch Flow syntax
  in `.ts` files** (verified), so it is not a substitute for the build gate.
- **Test:** **Vitest 4** ([vitest.config.ts](vitest.config.ts)) + Sinon, with chai-style
  `expect` (Vitest bundles chai 5). Single fork, `isolate: false`, `fileParallelism: false`
  — the `getTestApp()` singleton and the migrated DB are shared, matching Mocha's old
  single-process model. `globalSetup: test/vitest.global-setup.ts` runs `lumen db:*`.
  Run: `pnpm test` (= `vitest run`). Coverage is Vitest's **v8** provider
  (`pnpm test --coverage`), reported in CI as a job summary / PR comment.
  The Mocha stack — `mocha.opts`, `lib/`, `test/index.js`, mocha/nyc/chai — was removed
  once no suite referenced it.
- **Package manager:** **pnpm 10** (migrated from yarn; `pnpm-lock.yaml`, `packageManager`
  field). The old `yarn.lock` is retained untracked for reference only.
- **Node:** pinned to **22** via **Volta** (`volta` field in `package.json`; `.nvmrc` = 22);
  `engines` is `>= 22.13` (first 22.x where `require()` of ESM is stable — 22.12 unflagged
  it but still warns — and the floor faker 10 and ESLint 10 declare), and CI runs a leg
  on exactly 22.13.0 so the floor is proven. Node 20 is EOL (April 2026) and dropped.

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

Ships the latest Node **22.x** (the same line as the Volta pin), pnpm **10.34.5** via corepack,
watchman, the `gh` CLI (devcontainer feature), and Claude Code. First run: `claude`
prompts for login and `gh auth login` (or export `GH_TOKEN` on the host — `remoteEnv`
forwards it, along with `GIT_AUTHOR_NAME`/`GIT_AUTHOR_EMAIL`).

**Claude Code is installed natively as the `node` user, not via the claude-code
devcontainer feature** — that feature installs through global npm into
`/usr/local/share/npm-global/…`, owned `root:npm` with no group write bit, so
`claude update` fails on a permission error. The native installer keeps the launcher
(`~/.local/bin/claude`) and the binaries it swaps (`~/.local/share/claude/versions/`)
in the user's own home, so self-updating works — verified by downgrading and running a
real update. Auth/config stay in `~/.claude` and the installation itself in `~/.local`,
both named volumes, so logins **and** updates survive a rebuild — Docker auto-populates an
empty named volume from the image, so the build-time install seeds `~/.local` on first run
with no bootstrap step.

**`~/.local` is captured whole, not just `~/.local/share/claude`** — and that matters:
the launcher (`~/.local/bin/claude`) is a symlink *into* `share/claude/versions/`, so
volumising only one of them lets them desynchronize. After a rebuild the image's launcher
then points at a version the volume does not contain and `claude` dies with
`command not found` (observed, not theoretical). Kept together they can only ever disagree
by being older, which still runs. Consequence: the volume **pins the version**, so a
rebuilt image does not hand you a newer Claude Code — run `claude update`, or
`docker volume rm lumen-claude-install` to re-seed from the image.

Things about the setup that are load-bearing, all learned by breaking them:
- **Base is `trixie`, not `bookworm`.** Meta's prebuilt watchman links against GLIBC 2.38;
  bookworm ships 2.36 and the binary simply refuses to run, which costs 3 tests.
- **The base image's preinstalled pnpm is removed** (`npm uninstall -g pnpm`). It is newer
  than this project's pin and would shadow corepack's shim (on the old Node 20 image it also
  hard-crashed: it imports `node:sqlite`, which needs Node >= 22.13).
- **`workspaceMount`/`workspaceFolder` are intentionally unset**, so the IDE controls where
  the clone lands: IntelliJ uses `/IdeaProjects/<repo>`, the devcontainer CLI and VS Code
  use `/workspaces/<repo>`. The Dockerfile pre-creates those two **parents** as `node`, with
  no repo name — the name is mid-rename and differs per tool, so hardcoding the leaf went
  stale the moment the project was renamed. A node-owned parent is enough for the IDE's
  clone (verified). *Caveat:* if a tool mounts a named **volume** at the leaf itself, that
  leaf comes up `root:root` regardless of the parent and the clone fails with "Permission
  denied" — post-create's runtime writability check (`sudo chown`) fixes it for anything
  that runs after the clone, but not the clone itself.
- **The postCreate locator globs `/IdeaProjects/*/` and `/workspaces/*/`** rather than
  naming the repo, for the same reason. `${containerWorkspaceFolder}` is tried first and is
  what actually resolves under IntelliJ; the globs are belt-and-braces.
- **`node_modules` gets no volume.** With sources cloned into the container they are
  already on a container-native filesystem. (The earlier bind-mount setup needed volumes to
  keep the host's darwin-x64 sqlite3 binaries out of the linux install — that whole class
  of problem disappears in clone mode.)

Bind-mounting still works via the devcontainer CLI/VS Code, but is not the supported route:
pnpm will refuse to reuse a host-built `node_modules` (`ERR_PNPM_ABORTED_REMOVE_MODULES_DIR`),
which is correct — auto-purging would delete the host's tree.

Inside the container there is **no Volta**, so the `VOLTA_FEATURE_PNPM` dance below does
not apply — `node` and `pnpm` are simply on PATH.

## Environment (host)

This machine uses **Volta**, not nvm. Two gotchas when running the suite locally:

- **`VOLTA_FEATURE_PNPM=1` must be set** in your interactive shell's config (fish:
  `set -gx VOLTA_FEATURE_PNPM 1` in `~/.config/fish/config.fish`; zsh/bash: export it in
  `~/.zshrc`/`~/.bashrc`). Without it, Volta's pnpm shim runs children on the *default*
  Node (18) instead of the project's pinned Node 22.
  Inside `test/test-app/` Volta also falls back to Node 18 because that nested
  `package.json` has no `volta` field — harmless (the legacy stack runs on 18).
- **The `lumen` CLI is resolved via `node_modules/.bin`.** The test bootstrap
  ([test/index.js](test/index.js)) shells out to `lumen db:reset / db:migrate / db:seed`
  (each first runs a full app compile via the legacy Rollup+Babel pipeline). The old flow
  relied on `npm link`; instead the repo now self-links via a `lumen-framework: link:.`
  devDependency, so `pnpm install` places `lumen` in the root `node_modules/.bin`. pnpm
  prepends that dir to PATH for `pnpm test`, and the child_process `exec('lumen …')` inherits
  it — so no `npm link` or manual PATH is needed. (Replacing these `exec('lumen …')`
  shell-outs is still a later-phase cleanup.)

## Commands

```bash
pnpm install          # install deps (root)
pnpm --dir test/test-app install   # install the test fixture app's deps

# The five gates — all must pass before committing a conversion batch:
pnpm typecheck        # tsc --noEmit (strict); the real type gate
pnpm exec prettier --write "src/**/*.ts"
pnpm lint             # eslint 9 flat
pnpm build            # Babel 8 -> build/, esbuild -> dist/
VOLTA_FEATURE_PNPM=1 pnpm test    # 552 passing

pnpm format:check     # prettier verification (CI-style)
pnpm run clean        # remove build/dist/coverage artifacts
```

`pnpm build` matters more than it looks: the app compiler consumes `dist/index.mjs`, so
the suite runs against the *last build*, not the working tree. Always build before test.

Tests need a database; the test-app defaults to **`sqlite3`** (`^6.0.1`, a prebuilt
N-API binary — no native compile, no Python). Upstream marked node-sqlite3 **unmaintained**
alongside v6.0.0, so it is a dead end; knex's `better-sqlite3` client is the likely successor. CI additionally runs `pg` /
`mysql2` via `DATABASE_DRIVER`.

**Current baseline (Node 22 / pnpm 10):** `850 passing` across 103 files, all on **Vitest**
(`pnpm test` = `vitest run`, ~30 s). Coverage sits at ~70% of statements.

### CI — GitHub Actions ([.github/workflows/ci.yml](.github/workflows/ci.yml))

Two jobs on push to `develop`/`modernization`, on every PR, and on demand:
`static` (typecheck + lint + format:check — none of which the old CI ran) and `test`,
a matrix over `sqlite3` / `pg` / `mysql2`.

Things worth knowing before editing it:
- **⚠ The test-app's DB drivers are ancient enough to break on modern Node.**
  `pg@7.18` (2019) is **silently broken on Node 20**: `Client#connect()` returns a promise
  that never settles *and* keeps no handle alive, so the process just exits. knex reports
  that only as `Timeout acquiring a connection. The pool is probably full`, which sends you
  hunting for auth/host/server-version causes that are all red herrings. Bumped to `pg@8`.
  **Quickest check for this class of bug — connect to a closed port and see if it rejects:**
  a healthy driver gives `ECONNREFUSED` immediately; the broken one exits 0 in silence.
  `mysql2` was bumped 1.7 -> 3.x for the same reason, which let the workflow drop a
  `mysql:8.0` pin and a `mysql_native_password` switch; both services now run current
  releases (postgres:16, mysql:8.4) with ordinary password auth. `sqlite3` is current
  (6.0.1). **If a driver is ever pinned back, expect the server-side workarounds
  to come back with it.**
- **`lumen db:reset` cannot provision pg/mysql.** `dbdrop` connects *to* `lumen_test` and then
  drops it (Postgres refuses); `dbcreate` connects to a database it is about to create. So
  those legs create the database with the service container's client and set
  **`LUMEN_SKIP_DB_RESET=1`**, which [test/vitest.global-setup.ts](test/vitest.global-setup.ts)
  honours. This replaced the old `CIRCLECI`/`APPVEYOR` env gating, and the matching
  `src/constants.ts` exports are gone.
- **Seeding is not idempotent** — `db:seed` on an already-seeded database duplicates rows and
  breaks `query.test`'s absolute counts. Harmless in CI (containers start empty) but it means
  you cannot skip the reset against a warm local database.
- **watchman is installed from Meta's prebuilt release**, pinned via `WATCHMAN_VERSION` and
  kept in step with [.devcontainer/Dockerfile](.devcontainer/Dockerfile). `ubuntu-latest`
  (24.04, glibc 2.39) clears the GLIBC 2.38 floor. `fs/watcher` falls back to native
  `fs.watch` without it, but `watcher.test.ts` asserts a real client — it now probes
  `which watchman` and skips itself when absent, so no CI-vendor flag is involved.
- **Both service containers start for every leg** (GitHub evaluates `services` statically),
  so the sqlite leg waits on health checks it doesn't use. Deliberate: one readable job
  beats three near-duplicates.
- **`pnpm build` must precede `pnpm test`** — the app compiler consumes `dist/index.mjs`.
- **Do not set `DATABASE_URL` in CI.** It takes precedence over everything in
  [connect.ts](src/packages/database/utils/connect.ts) and bypasses the sqlite filename logic.
- The remaining known-flaky tests are handled with `retry: process.env.CI ? 2 : 0` in
  [vitest.config.ts](vitest.config.ts) — retries in CI only, so local flakes stay visible.

Two areas are **known-flaky** — if a run goes red here, re-run before investigating:
- `module "fs" #watch()` depends on the external **watchman** daemon; it intermittently
  times out and then fails its `after all` hook with
  `Cannot read properties of undefined (reading 'destroy')`. Environmental (the daemon),
  not a test-design flaw.
- [sleep.test.ts](src/utils/test/sleep.test.ts) asserts `sleep(500)` lands within
  475–525 ms. Under a loaded machine the timer overshoots (seen at 556 ms) and the file's
  other test fails alongside it. Passes in isolation; re-run before investigating.

Both are environmental/timer flakiness, not regressions. (The logger "recent timestamp"
1 ms race and the `fs` `returnsPromiseSpec` no-op specs — the two behaviour-faithful weak
specs carried through the runner swap — were fixed once the migration settled.)

## Working notes

- Follow existing conventions: respect the 80-col limit, match the import ordering the
  airbnb config enforces. Prettier owns formatting for `.ts` — run it, don't
  hand-format.
- **Don't reach for `Reflect.*`.** It was mandated by upstream's `prefer-reflect` rule
  (long removed from ESLint); `Reflect.get` returns `any`, which switches type checking
  off, and `Reflect.defineProperty`/`set` fail silently by returning `false`. Use plain
  property access, `new`, direct calls, `in`/`Object.hasOwn` and `Object.defineProperty`
  — `no-restricted-properties` bans `Reflect.apply/construct/defineProperty/has/
  deleteProperty`. `Reflect.get`/`set` remain for **proxy traps** and for **dynamic
  attribute access on `Model`/`Controller` instances**, which have no index signature
  (the alternative is an `as unknown as Record<…>` double cast).
- `dist/` is **gitignored** (not committed) and generated by the build; don't hand-edit
  it. Note: there is currently **no `pretest`/`prepare` build wired**, so the suite relies
  on a `dist` already existing locally (a stale artifact today). `npm publish` builds it
  first (the old CI ran `npm run build` before publish). Wiring a reliable build step is
  part of Phase 2.
- When modernizing, prefer changing tooling/config over rewriting framework behavior
  unless a change is explicitly requested. The public surface is `src/index.js` exports
  (`Model`, `Controller`, `Serializer`, `Application`, `Logger`, `lumenify`).
- Upstream is unmaintained — this fork is the source of truth. When comparing against
  `postlight/lux`, remember fork commits (#2–#8) intentionally diverge.
