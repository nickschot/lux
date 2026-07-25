# Migration notes (archive)

Historical record of the Flow -> TypeScript / toolchain modernization, moved out of
CLAUDE.md once the work finished (0 Flow files remain; all roadmap phases complete).
Kept for the rationale behind decisions that are still visible in the codebase.

Live gotchas and conventions that came out of this work stayed in
[CLAUDE.md](../CLAUDE.md) -- see "Traps this migration hit" and "Conventions".

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

## Background: the modernization project (decisions and roadmap)

The plan as it stood while the work was in flight. All six phases are complete;
kept for the rationale behind choices still visible in the toolchain.

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
   "Phase 3 status" in [docs/MIGRATION-NOTES.md](docs/MIGRATION-NOTES.md).
4. **Runner swap.** ✅ Steps 1–3: Vitest replaced Mocha, all 89 Flow test files converted,
   the Mocha stack retired (`test` = `vitest run`). ✅ Step 4 (build target): the framework
   esbuild build now targets **node20** — the `es2017` pin is gone, since nothing re-parses
   `dist/` with an older parser anymore. (A full tsup migration was never needed — the
   framework already bundles with esbuild via [build.mjs](build.mjs).)
5. ✅ **App compiler reworked to esbuild** (phase 5). Rollup 0.43 + Babel 6 +
   `rollup-plugin-lux` are gone; [compiler/index.ts](src/packages/compiler/index.ts) is a
   single `esbuild.build`. See "Phase 5 status" in
   [docs/MIGRATION-NOTES.md](docs/MIGRATION-NOTES.md).
6. ✅ ESLint 9 flat + typescript-eslint + Prettier. ✅ CI is **GitHub Actions**
   ([.github/workflows/ci.yml](.github/workflows/ci.yml)); CircleCI, AppVeyor and Codecov
   are gone.
