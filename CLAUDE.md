# CLAUDE.md

Guidance for working in this repository.

## What this is

`lumen-framework` — an MVC-style Node.js framework for building JSON:API 1.0 compliant
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
  `Serializer`, `Application`, `Logger`, `lumenify`) and the app-facing compiler may change
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
  `lumen db:*` and fails the whole suite. **The build/ship-model must become `.ts`-capable
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
   `cli.cjs` for `bin/lumen`). App compiler's `LUMEN_LOCAL` now points at `dist/index.mjs`, so
   it bundles built JS (decoupled from source language). TS foundation in place: strict
   [tsconfig.json](tsconfig.json), `pnpm typecheck` (`tsc --noEmit`), and
   `lib/ts-hook.js` (esbuild-register ran `.ts` in Mocha, loaded via `babel-hook.js`
   before babel-register). Proven end-to-end on `src/utils/uniq.ts`. *(Both hooks and
   `lib/` itself were removed in Phase 4 Step 3.)*
3. ✅ **Flow → TypeScript, bottom-up per `src/packages/*`** — all *source* converted
   (295 `.ts`). Test suites/fixtures were deferred to Phase 4 and are now done too. See
   "Phase 3 status" below.
4. **Runner swap.** ✅ Steps 1–3: Vitest replaced Mocha, all 89 Flow test files converted,
   the Mocha stack retired (`test` = `vitest run`). ✅ Step 4 (build target): the framework
   esbuild build now targets **node20** — the `es2017` pin is gone, since nothing re-parses
   `dist/` with an older parser anymore. (A full tsup migration was never needed — the
   framework already bundles with esbuild via [build.mjs](build.mjs).)
5. ✅ **App compiler reworked to esbuild** (phase 5). Rollup 0.43 + Babel 6 +
   `rollup-plugin-lux` are gone; [compiler/index.ts](src/packages/compiler/index.ts) is a
   single `esbuild.build`. See "Phase 5 status" below.
6. ✅ ESLint 9 flat + typescript-eslint + Prettier. ✅ CI is **GitHub Actions**
   ([.github/workflows/ci.yml](.github/workflows/ci.yml)); CircleCI, AppVeyor and Codecov
   are gone.

## Phase 5 status — app compiler on esbuild

**DONE.** [compiler/index.ts](src/packages/compiler/index.ts) is now a single
`esbuild.build` (was Rollup 0.43 + Babel 6 + six plugins incl. `rollup-plugin-lux`). Suite
**542 passing** (552 − 10 removed tests: 8 `is-external`, 2 `onwarn`). How it maps:

- **`keepNames: true`** replaces `rollup-plugin-lux` exactly — both emit
  `Object.defineProperty(Class, 'name', …)` (Lumen keys models/controllers/serializers off
  `.name`). Verified: `bundle.Post.name === 'Post'` on the compiled test-app.
- **`packages: 'external'`** reproduces the old `is-external` bare-vs-relative split; the
  framework itself is bundled in via the `LUMEN_LOCAL` alias (apps import
  `from 'LUMEN_LOCAL'`), which resolves to `path.join(__dirname, 'index.mjs')` — the built
  `dist/index.mjs`, *not* source. **This is why the compiler unit test stubs esbuild** (via
  `vi.mock` — the namespace is non-configurable, so `spyOn` fails): imported from source,
  `__dirname` has no `index.mjs`. The real end-to-end path is covered by the global setup —
  every `lumen db:*` compiles the test-app through `dist/`.
- **eslint-during-compile dropped**: it ran `useEslintrc:false` with no ruleset and no
  `throwError`, so it enforced nothing and couldn't fail the build (a parse check esbuild
  already does). Confirmed empirically before removing.
- **`source-map-support` dropped** for `--enable-source-maps`, set via the `bin/lumen`
  shebang (`#!/usr/bin/env -S node --enable-source-maps`) — process-wide, so the required
  bundle and cluster workers (inherit `execArgv`) both map traces.
- Removed: the 7 `rollup*` deps, `source-map-support`, `compiler/utils/{is-external,
  handle-warning}.ts` + `legacy-rollup.d.ts`. The standalone debugger tool
  ([test/utils/debugger](test/utils/debugger)) was converted to esbuild too.

**✅ Generated-app scaffolding (`cli/templates/*`) modernized — Babel 6 fully retired.**
`lumen new` now emits a modern app: no `.babelrc`, `node >= 20`, a flat `eslint.config.mjs`
(with `eslint`/`@eslint/js`/`globals` devDeps), and — the real bug fix — **the selected DB
driver** (the old template shipped none, so generated apps couldn't connect). Drivers are
trimmed to the three CI-tested (`postgres`/`sqlite`/`mysql` → `pg`/`sqlite3`/`mysql2`); the
dead `mariadb→mariasql` / `oracle→oracledb` mappings are gone (an unsupported `--database`
falls back to sqlite via commander, rather than generating a broken app). With no template
emitting Babel 6, the framework's last Babel-6 deps (`babel-core`, `babel-preset-lumen`,
`babel-eslint`) and root `.babelrc` were removed. **Only `@babel/*` v8 remains** — the
framework's own TS-strip build ([build.mjs](build.mjs)). Templates have no test coverage;
verify by running `lumen new` and inspecting the output against `test/test-app`.

### Traps this migration hit (all pre-existing bugs the runner swap exposed)

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

## Phase 3 status — where to resume

**Progress: 295 `.ts` files — no non-test Flow *source* remains.** Every batch was one
commit, with all five gates green (see "Conversion recipe").

**Converted: the entire source tree.** All of `src/utils/`, `src/interfaces`,
`src/constants`, `freezeable`, `template`, `jsonapi`, `logger`, `server`, `router`,
`serializer`, `controller`, **`database`** (the ORM core — the big one), `application`,
`config`, `fs`, `pm`, `compiler`, `loader`, `lumenify`, `cli` (44 files), both
`src/errors/*`, and the public API barrel `src/index`.

**Nothing is still Flow.** The test suites and test-support fixtures that were deferred
here were all converted in Phase 4 Step 2 — see "Phase 4 status" below.

**No temporary `.d.ts` stubs remain.** The only `.d.ts` files left are legitimate ambient
declarations for untyped npm modules (`fs/watcher/fb-watchman.d.ts`, `cli/ora.d.ts`).
(`compiler/legacy-rollup.d.ts` went with the Rollup deps in phase 5.)

### Database — DONE (the ORM core), how it was typed

`database` (56 files / ~4,441 LOC) is converted **pragmatic-clean**: reproduced the existing
loose Flow fidelity (`Object` → `Record<string, unknown>`, `Class<Model>` → `ModelClass`,
`mixed` → `unknown`), and confined `any` + justified file-level `eslint-disable` to the
genuinely-dynamic plumbing (Knex query builders, the query-builder snapshot tuples, class
init metaprogramming, ChangeSet's value store). Landed as **one atomic commit** — `model ↔
query` is a runtime value cycle so it couldn't checkpoint. Key decisions worth keeping:

- **`ModelClass<T>` is the whole downstream bridge.** Flow used anonymous `Class<Model>`;
  TS needs a named exported type. It lives in [database/interfaces.ts](src/packages/database/interfaces.ts)
  and had to accumulate every static that *any* code touches off a model class (statics like
  `find/select/create/where/first/isInstance/columnFor/relationshipFor/initialize/transaction`,
  config `hasOne/hasMany/belongsTo/scopes/validates/hooks`, `store/logger/table/prototype`).
  **`typeof Model` must be structurally assignable to `ModelClass`** because the Model class's
  own statics do `new Query(this)`. That assignability is brittle: e.g. `isInstance` had to
  return `boolean` not a `value is Model` predicate; `columnNameFor` had to return `string |
  undefined` not `string | void` (`void` ≠ `undefined`); `Model.relationships` had to carry
  `Relationship$opts`, not `unknown`.
- **Instance `constructor` typing:** `class Model { declare ['constructor']: ModelClass; }`
  — this is what lets `owner.constructor.relationshipFor(...)` and `item.constructor.serializer`
  (in serializer) type-check.
- **`this`-polymorphism:** kept `this` on instance-method returns (`save/update/destroy:
  Promise<Transaction$ResultProxy<this, boolean>>`, `transacting(): this`); used concrete
  `Model`/`Query<Array<Model>>` for **static** returns (`this` in a static means the class,
  which breaks `Query<this>`/`Serializer<this>`).
- **Static fields take no `!`** — `strictPropertyInitialization` doesn't check statics, and a
  `!` there is a hard error (TS1255). Instance fields set via `defineProperties` do need `!`.
- **`Database` constructs async** (`new Database()` returns the `initialize(this)` Promise) —
  a Promise-returning constructor can't be expressed in TS, so it ends with
  `return initialize(this, opts) as unknown as Database;` and callers `await new Database()`.
- **createServerError leaf import** in `errors/unique-constraint-error` +
  `query/errors/record-not-found-error` (same esbuild-register cycle reason as jsonapi/router).
- **One new stub:** `fs/index.d.ts` (`readdir`) — `database` value-imports it from the still-Flow
  `fs` package.

**⚠ Historical note — the logger/server/router/jsonapi cluster (Phase 3b, done):** `logger`, `server`, `router` and
`jsonapi/{errors,index,interfaces}` form **one irreducible type cycle**: `server` does
`import type Logger`; `logger/request-logger` does `import type { Request, Response }`;
`router` value-imports `server` (8 sites: `createServerError`, `getDomain`,
`REQUEST_METHODS`) and type-imports it back; `jsonapi/errors/*` value-import both `server`
(`createServerError`) and `logger` (`line`) while `server` value-imports `jsonapi`
(`MIME_TYPE`, `VERSION`, `hasMediaType`, `NotAcceptableError`). TypeScript handles circular
*types* fine, but `allowJs: false` means none can read the others' types until all are
`.ts` — and splitting the cycle would need throwaway `.d.ts` stubs for the *richest* types
in the tree (`Request`/`Response`), so it lands as **one atomic commit**.

**The real blocker is softer than it looks — and this changes the plan.** Under
`moduleResolution: bundler` + `allowJs: false`, a `.ts` file importing a value or type from
a `.js` module raises **TS7016 (implicit `any`)**, *not* TS2307 (cannot-find-module): the
module still resolves and runs at runtime — only its *type* is `any`. A colocated `.d.ts`
stub fixes `tsc` with **zero runtime/bundle impact** (Babel/esbuild don't emit for `.d.ts`;
runtime still loads `index.js`). So the packages the cluster value-imports but that are
**not** converting now — `controller` (`BUILT_IN_ACTIONS`, default `Controller` [only
~7 members touched: `hasModel, show, index, hasSerializer, defaultPerPage, beforeAction,
afterAction`], type `Controller$builtIn`) and `database` (`Query`, `typeForColumn`) —
become **temporary `.d.ts` cut-points**, not blockers. Reverse edges (controller/database
importing the cluster) stay `.js`, so they need no stubs. Delete the stubs when those
packages convert.

⚠ **Build caveat (load-bearing):** Babel's `--extensions .js,.ts` also matches `.d.ts` and
dies parsing ambient syntax (`export const X: T;` with no initializer), aborting before
`dist/` is written. [build.mjs](build.mjs) now passes `--ignore src/**/*.d.ts` to the
type-strip stage so stubs are safe. (Verified end-to-end.)

**Split (agreed):**
- ✅ **Phase 3a (done):** the `build.mjs` `--ignore` change + the 8 pure-leaf files that
  import only already-`.ts` (server: `constants`, `request/parser/constants`,
  `request/parser/utils/parse-nested-object`; router: `route/constants`,
  `route/action/constants`, `route/utils/get-static-path`, `namespace/utils/normalize-path`,
  `namespace/utils/normalize-name`). Landed as a normal incremental batch.
- ✅ **Phase 3b (done, one atomic commit):** `controller` + `database` `.d.ts` stubs + the
  cluster (logger 6, server 22, router 45, jsonapi/{errors,index,interfaces} 5) +
  `controller-missing-error`. `tsc` landed at **0 errors** with the stub cut-points; the
  `any` count is minimal (honest `unknown`/tuples everywhere except genuinely-dynamic
  boundaries, which carry justified file-level `eslint-disable` blocks like `utils/compose`).
- **Two runtime wrinkles surfaced (both fixed, both worth remembering):**
  - **Module-init cycle:** `jsonapi/errors/*` and `router/route/params/errors/*` call
    `createServerError(...)` at module top-level, importing it through the **`server`
    barrel**. Under esbuild-register the barrel's re-export (`export { default as
    createServerError } from './utils/create-server-error'`) isn't initialized when the
    cycle re-enters → `Cannot read properties of undefined (reading 'default')`. Fix: those
    error files import `createServerError` **directly from the leaf**
    (`server/utils/create-server-error`), not the barrel (as `malformed-request-error`
    already did). Prefer leaf imports for values used at module load inside a cycle.
  - **Async lowering in the test hook:** chai's `type-detect` reports a **native** async
    function as `'AsyncFunction'`, so `expect(fn).to.be.a('function')` fails. Babel 6
    lowered async → plain function; esbuild-register kept it native. Fix at the time:
    `lib/ts-hook.js` set `target: 'es2016'` so async lowered, matching Babel-era behaviour.
    *(Moot now — that hook is gone. The same hazard resurfaced under Vitest's oxc, which
    also keeps async native; see "Phase 4 status".)*
- **Next:** delete the 2 stubs as `controller`/`database`/`serializer` convert.

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
- **`cli`** — the `lumen` binary's commands (`new`/`create`, `serve`, `build`, `generate`,
  `destroy`, `db*`, `repl`, `test`). Entry: `src/packages/cli/commands/`.
- **`compiler`** / **`loader`** — Rollup-based build of user apps and module loading.
- **`lumenify`** — adapter to use classic `(req, res, next)` middleware in
  `Controller#beforeAction`.
- Support packages: `config`, `logger`, `fs`, `freezeable`, `template`, `pm` (cluster
  process management).

Shared helpers are in `src/utils/`; global constants in `src/constants.js` (reads from
`process.env`: `PORT` default 4000, `NODE_ENV`, `DATABASE_URL`, etc.).

Colocated tests: `src/**/*.test.ts` (all Vitest). Ambient declarations for untyped npm
modules live beside their consumers as `.d.ts` (`fs/watcher/fb-watchman.d.ts`,
`cli/ora.d.ts`).
`test/test-app/` is a full example Lumen app the suite boots against (Postgres/MySQL/SQLite).

## Toolchain (current)

- **Language:** **TypeScript** (strict). Type-check: `pnpm typecheck` (`tsc --noEmit`).
  No Flow remains, and its tooling is gone (`.flowconfig`, `flow-typed/`, `decl/`,
  flow-bin, preset-flow).
  Note `tsconfig` **excludes `src/**/test`**, so test files are not type-checked — the
  build and the suite are what catch errors there.
- **Build:** [build.mjs](build.mjs) is **pure esbuild** — it strips TS *and* bundles
  `src/` straight to `dist/` in one pass (`index.js` CJS, `index.mjs` ESM, `cli.cjs`). No
  Babel: **Babel is fully retired** (no `.babelrc`, no `babel-config.build.cjs`, no
  `@babel/*` or Babel-6 deps). `pnpm build`. **esbuild targets `node20`** — nothing
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
  the clone lands. The Dockerfile still pre-creates `/workspaces/lumen` owned by `node`,
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

Tests need a database; the test-app defaults to **`sqlite3`** (bumped to `^5.1.7`, a
prebuilt N-API binary — no native compile, no Python). CI additionally runs `pg` /
`mysql2` via `DATABASE_DRIVER`.

**Current baseline (Node 20 / pnpm 10):** `552 passing` across 83 files, all on **Vitest**
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
  releases (postgres:16, mysql:8.4) with ordinary password auth. `sqlite3` is already
  modern (5.1.7). **If a driver is ever pinned back, expect the server-side workarounds
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
  airbnb config enforces, and prefer `Reflect.*` where the codebase already does (the
  `prefer-reflect` rule is on). Prettier owns formatting for `.ts` — run it, don't
  hand-format.
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
