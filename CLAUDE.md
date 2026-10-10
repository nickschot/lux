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

**Status:** published to npm as `lumen-framework`, released with
[release-plan](RELEASE.md). The toolchain is TypeScript + esbuild + Vitest on Node 22
(details in "Toolchain" below). The 3.0 modernization's plan, phase-by-phase log and
reasoning are archived in [docs/internal/MIGRATION-NOTES.md](docs/internal/MIGRATION-NOTES.md)
— read that before revisiting a decision, not to learn the current state.

**Compatibility scope — still load-bearing:** this package is consumed **only by the
maintainer's own apps**. There are no external downstream users, so the public API
(`Model`, `Controller`, `Serializer`, `Application`, `Logger`, `lumenify`) and the
app-facing compiler may change freely; consumer apps are co-evolved. Prefer a clean
result over backward compatibility, and record anything app-visible in
[UPGRADING.md](UPGRADING.md).

## Traps (pre-existing bugs the 3.0 migration exposed)

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
- **Test files are not type-checked** (`tsconfig` excludes `src/**/test`), so a type
  error there only shows up in `pnpm build` or the suite. Do not skip the build gate.
- Chai (6, bundled with Vitest): dotted/indexed paths need `.nested.property`, and
  `constructor`/`__proto__` are guarded outright — assert the value directly instead.
  `expect(asyncFn).to.be.a('function')` fails on a native `async` function
  (`'AsyncFunction'`); use `typeof x === 'function'`.

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
- Keep refactors **behaviour-faithful**. A latent bug found along the way gets its own
  change, with a test that fails before the fix; fold it into a refactor only when the fix
  is provably a no-op, and say so in the commit.

## Toolchain (current)

- **Language:** **TypeScript** (strict). Type-check: `pnpm typecheck` (`tsc --noEmit`).
  No Flow remains, and its tooling is gone (`.flowconfig`, `flow-typed/`, `decl/`,
  flow-bin, preset-flow).
  Note `tsconfig` **excludes `src/**/test`**, so test files are not type-checked — the
  build and the suite are what catch errors there.
- **Build:** [build.mjs](build.mjs) is **pure esbuild** — it strips TS *and* bundles
  `src/` straight to `dist/` in one pass (`index.js` CJS, `index.mjs` ESM, `testing.js`/`.mjs`,
  `cli.cjs`). No
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
- **Lint/format:** **ESLint 10 flat** ([eslint.config.mjs](eslint.config.mjs)) +
  typescript-eslint + **Prettier**. `pnpm lint`, `pnpm format`, `pnpm format:check`. `.ts`
  uses typescript-eslint; the remaining `.js` (test-app fixture + tooling) uses the default
  parser (the old `@babel/eslint-parser` block is gone). **eslint does not catch Flow syntax
  in `.ts` files** (verified), so it is not a substitute for the build gate.
- **Test:** **Vitest 5** ([vitest.config.ts](vitest.config.ts)) + Sinon, with chai-style
  `expect` (Vitest bundles chai 6). Single fork, `isolate: false`, `fileParallelism: false`
  — the `getTestApp()` singleton and the migrated DB are shared, matching Mocha's old
  single-process model. `globalSetup: test/vitest.global-setup.ts` runs `lumen db:*`.
  Run: `pnpm test` (= `vitest run`). Coverage is Vitest's **v8** provider
  (`pnpm test --coverage`), reported in CI as a job summary / PR comment.
  The Mocha stack — `mocha.opts`, `lib/`, `test/index.js`, mocha/nyc/chai — was removed
  once no suite referenced it.
- **Package manager:** **pnpm 12** (`pnpm-lock.yaml`, `packageManager` field). pnpm 12
  reads its settings from `pnpm-workspace.yaml` only: a `pnpm` field in `package.json` is
  ignored. **Build scripts must be decided** in `allowBuilds` (`true` runs one, `false`
  skips it); an undecided one fails the install (`ERR_PNPM_IGNORED_BUILDS`). The root
  skips esbuild's (it only relinks the `esbuild` command, which nothing here runs), the
  test-app and the example skip better-sqlite3's. **Each of those apps keeps its own
  `pnpm-workspace.yaml`**: with only the root's, pnpm 12 treats them as part of the root
  workspace, and `pnpm --dir test/test-app install` installs nothing. Each lockfile also
  records pnpm itself (`packageManagerDependencies`), so bumping `packageManager` means
  one unfrozen `pnpm install` in each of the three directories. `lumen new` writes the
  same kind of file for generated apps (`cli/templates/pnpm-workspace.ts`): esbuild, a
  dependency of the framework, always; better-sqlite3 for SQLite.
- **Node:** pinned to **22.23.3** by `devEngines.runtime` in `package.json`: pnpm installs
  that Node into `node_modules` (`node_modules/.bin/node`) and runs every script on it,
  whatever `node` is on PATH. Bump it with `pnpm add -D node@runtime:<version>`, which
  updates `package.json` and the lockfile. **Never hand-edit the version**: pnpm 12 doesn't
  notice, even with `--frozen-lockfile`, and keeps the old Node. (There is no `.nvmrc` or
  `volta` field; `.npmrc`'s `use-node-version` is ignored by pnpm 12.) The pin covers
  scripts run through pnpm only; the CI legs on other Node versions delete
  `node_modules/.bin/node` so their own Node runs (a frozen install doesn't restore that
  link: remove `node_modules` and reinstall).
  **`devEngines.runtime` is an array of two entries, and must stay one.** npm 11 checks it
  too, for any npm command in the repo, but has no `onFail: "download"`: against the pin
  alone, npm on another Node fails with `EBADDEVENGINES`. release-plan's actions run
  `npm view` and `npm install -g` here on a hardcoded Node 24, so Plan Release broke. npm
  accepts the first entry that matches, so the second (`>= 22.14`, `onFail: "warn"`) lets
  it through; pnpm uses the first, the pin. `pnpm add -D node@runtime:<version>` updates
  the first and keeps the second.
  `engines` is `>= 22.14`: the first 22.x with **N-API 10**, which better-sqlite3 13's
  prebuilt binary needs (on 22.13 it segfaults — `lumen db:migrate` exits 139). Below
  that: 22.13 is where `require()` of ESM is stable (22.12 unflagged it but still warns)
  and the floor faker 10 and ESLint 10 declare. CI runs a leg on exactly 22.14.0 so the
  floor is proven. Node 20 is EOL (April 2026) and dropped.

## Devcontainer (preferred environment)

[.devcontainer/](.devcontainer/) is the intended way to work on this project now.

**Start it with IntelliJ/WebStorm's "Create Dev Container and Clone Sources"**, not "Mount
Sources": bind-mounting the macOS filesystem is slow for this workload (large
`node_modules`, many-file test runs). The IDE performs the clone itself — you give it the
repo URL and branch — so **the branch has to exist on the remote**; it will not pick up
local-only commits. `postCreateCommand` then runs
[post-create.sh](.devcontainer/post-create.sh), which installs both dependency trees and
builds `dist/`. **Verified end-to-end in clone mode**: the suite passes with
typecheck/lint/format green, watchman tests included.

Ships the latest Node **22.x** (pnpm runs the scripts on the `devEngines.runtime` pin), pnpm **12.5.1** via corepack,
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

Inside the container `node` and `pnpm` are simply on PATH.

## Environment (host)

- **Node:** pnpm runs scripts (`pnpm test`, `pnpm build`, …) on the pinned Node, so
  whatever `node` the shell finds only runs pnpm itself. Running a tool directly
  (`node …`, `npx …`) uses the shell's `node`; use `pnpm exec` to get the pinned one.
- **pnpm:** a version-switching pnpm (Homebrew's, corepack) picks its version from
  `packageManager`; the root, `test/test-app` and the example app all pin `pnpm@12.5.1`.
- **The `lumen` CLI is resolved via `node_modules/.bin`.** The suite's global setup
  ([test/vitest.global-setup.ts](test/vitest.global-setup.ts)) shells out to
  `lumen db:reset / db:migrate / db:seed`, each of which compiles the test-app first. The
  repo self-links via a `lumen-framework: link:.` devDependency, so `pnpm install` places
  `lumen` in the root `node_modules/.bin`; pnpm prepends that dir to PATH for `pnpm test`,
  and `exec('lumen …')` inherits it — no `npm link` or manual PATH needed.

## Commands

```bash
pnpm install          # install deps (root)
pnpm --dir test/test-app install   # install the test fixture app's deps

# The gates CI runs — all must pass before pushing:
pnpm typecheck        # tsc --noEmit (strict); the real type gate
pnpm lint             # eslint 10 flat
pnpm format:check     # prettier (`pnpm format` writes)
pnpm build:types      # declaration-only errors, e.g. TS2742
pnpm docs:api         # TypeDoc; fails on any warning
pnpm build            # esbuild -> dist/; always before testing
pnpm test             # vitest run

pnpm run clean        # remove dist/coverage artifacts
```

`pnpm build` matters more than it looks: the app compiler consumes `dist/index.mjs`, so
the suite runs against the *last build*, not the working tree. Always build before test.

Tests need a database; the test-app defaults to **`better-sqlite3`** (`^13.0.3`), which
replaced the unmaintained `sqlite3` in #74. It **bundles prebuilt N-API binaries** and
sets `"gypfile": false`, so nothing compiles: npm skips the build, and pnpm is told to
with `allowBuilds` in the test-app's `pnpm-workspace.yaml` (pnpm otherwise runs
`node-gyp rebuild` for its `binding.gyp` and fails without a toolchain). **SQLite always gets one connection**
(`connect()` ignores `pool` for it): better-sqlite3 is synchronous, so a second connection
waiting on the first's lock blocks the event loop and fails with "database is locked".
The test-app pins **`"packageManager"`** like the root and the example app, so a
version-switching pnpm runs the same version in all three. pnpm keeps a lockfile's existing resolutions, so
regenerate a lockfile from scratch after removing a dependency: knex's optional peers
(`sqlite3`, `tedious`) and their trees lingered in the test-app's for years. CI
additionally runs `pg` / `mysql2` via `DATABASE_DRIVER`.

**Current baseline (Node 22 / pnpm 12):** `1028 passing` across 135 files, all on **Vitest**
(`pnpm test` = `vitest run`). A drop in the *file* count means a file failed to collect.

### CI — GitHub Actions ([.github/workflows/ci.yml](.github/workflows/ci.yml))

Runs on push to `main`, on every PR, and on demand. Jobs: `static` (typecheck, lint,
format:check, build:types), `docs` (TypeDoc + an offline Markdown link check), `test` (a
matrix: `better-sqlite3` / `pg` / `mysql2` on Node 22, plus `better-sqlite3` on 22.14.0,
24 and 26), `consume` (packs the package and installs it production-only into a
throwaway app) and `example` (migrates, seeds and smoke-tests examples/social-network).

Things worth knowing before editing it:
- **⚠ The test-app's DB drivers were once ancient enough to break on modern Node.**
  `pg@7.18` (2019) is **silently broken on Node 20**: `Client#connect()` returns a promise
  that never settles *and* keeps no handle alive, so the process just exits. knex reports
  that only as `Timeout acquiring a connection. The pool is probably full`, which sends you
  hunting for auth/host/server-version causes that are all red herrings. Bumped to `pg@8`.
  **Quickest check for this class of bug — connect to a closed port and see if it rejects:**
  a healthy driver gives `ECONNREFUSED` immediately; the broken one exits 0 in silence.
  `mysql2` was bumped 1.7 -> 3.x for the same reason, which let the workflow drop a
  `mysql:8.0` pin and a `mysql_native_password` switch; both services now run current
  releases (postgres:16, mysql:8.4) with ordinary password auth. `better-sqlite3` is
  current (13.x). **If a driver is ever pinned back, expect the server-side workarounds
  to come back with it.**
- **`lumen db:reset` provisions pg/mysql too** (#111): `db:create`/`db:drop` connect to the
  server (`postgres` maintenance database, or none for MySQL), not to `lumen_test`, and a
  Postgres drop is `WITH (FORCE)`. The pg/mysql legs still create `lumen_test` up front so
  the reset drops an existing database. **`LUMEN_SKIP_DB_RESET=1`** (honoured by
  [test/vitest.global-setup.ts](test/vitest.global-setup.ts)) skips the reset, for a
  database created by other means; CI no longer sets it.
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

- **Where docs live.** User guides go in `docs/guides/` as plain Markdown with
  relative links and no site-specific syntax, so they read on GitHub today and
  can be fed to a static site (e.g. VitePress) later without rewriting.
  Contributor-only notes go in `docs/internal/`. An app-visible change updates
  the matching guide *and* gets an [UPGRADING.md](UPGRADING.md) entry — don't
  let UPGRADING become the only description of a feature again. UPGRADING is
  grouped per major version, then by area (Requests, Responses, Errors, …), not
  numbered: an entry says what changed and what to do or check, in a few lines,
  and links to the guide. A required action also goes in the version's
  "In short" list.
- **HTTP tests validate what they fetch.** Read a response with
  `readDocument(res)` from
  [test/utils/expect-jsonapi-document.ts](test/utils/expect-jsonapi-document.ts),
  not `res.json()`: every `application/vnd.api+json` body is then checked
  against the JSON:API 1.0 schema in `test/jsonapi-schema/` (vendored
  unchanged; see its README). Known deviations live in the helper's
  `KNOWN_DEVIATIONS`: today only the test-app's reactions, whose `type`
  attribute tests the serializer opt-out `allowReservedNames` (#149). Keep
  each entry as narrow as the deviation, rather than adding broader ones.
- **API reference: TypeDoc** ([typedoc.json](typedoc.json), `pnpm docs:api` →
  gitignored `docs/api/`), from `src/index.ts`. CI's `docs` job fails on any
  warning — a public symbol without a doc comment (`notDocumented`), a
  broken `{@link}`, or a public signature naming a type
  `src/index.ts` does not export. Fix the latter by exporting it — or (for
  framework internals) listing it in `intentionallyNotExported`.
- **Types have plain PascalCase names**, public and internal alike
  (`LoggerConfig`, `RouteOptions`, `JsonApiDocument`; `Options` for what was
  `$opts`). The `Foo$bar` style was a Flow leftover and is gone (#92, #93);
  ESLint's `@typescript-eslint/naming-convention` keeps it out. The only `$`
  names left are the identifiers the app compiler generates (`Admin$Posts`).
  **Public types** are defined under the name they are exported as. Each
  package's `index.ts` exports its own public types, and
  `src/index.ts` re-exports them **by name** from those package indexes: no
  `as` aliases, no deep imports from `interfaces.ts`, no `export *` (package
  indexes also export internals). That list is the public type API. `@private` hides a member from the reference;
  prefer `@internal` in new comments, and drop YUIDoc leftovers (`@method`,
  `@static`, `@type {X}`) when touching a comment — TypeDoc reads the types
  from TypeScript.
- Follow existing conventions: respect the 80-col limit and the existing import
  grouping. Prettier owns formatting for `.ts` — run it, don't hand-format.
- **Don't reach for `Reflect.*`.** It was mandated by upstream's `prefer-reflect` rule
  (long removed from ESLint); `Reflect.get` returns `any`, which switches type checking
  off, and `Reflect.defineProperty`/`set` fail silently by returning `false`. Use plain
  property access, `new`, direct calls, `in`/`Object.hasOwn` and `Object.defineProperty`
  — `no-restricted-properties` bans `Reflect.apply/construct/defineProperty/has/
  deleteProperty/get/set`. Read/write a `Model` attribute or relationship by a dynamic
  key with **`readAttribute`/`writeAttribute`** (`database/model/utils/attribute.ts`):
  `Model` deliberately has no index signature, since one would make every typo on a
  model a silent `unknown`. Proxy traps forwarding to their target keep `Reflect.get`
  behind an inline disable.
- `dist/` is **gitignored** (not committed) and generated by the build; don't hand-edit
  it. There is **no `pretest` build**, so the suite runs against whatever `dist/` exists:
  build first. `prepack` builds it (and the types) for publishing.
- The public surface is what [src/index.ts](src/index.ts) (`lumen-framework`) and
  [src/testing.ts](src/testing.ts) (`lumen-framework/testing`, test helpers kept out of
  apps' runtime bundles) export. `package.json` `exports` maps the two, plus
  `./package.json`; **any other path in the package is unimportable**, so anything a
  consumer needs goes through an entry (CI's `consume` job loads the CLI bundle by file
  path for that reason). Under Node both entries resolve to the CJS builds; the `module`
  condition gives bundlers the ESM ones. A helper in `lumen-framework/testing` runs
  against an app compiled with its *own* copy of the framework, so it must not rely on
  `instanceof` or module identity, only on properties of what it's given.
- Upstream is unmaintained — this fork is the source of truth. When comparing against
  `postlight/lux`, remember fork commits (#2–#8) intentionally diverge.
