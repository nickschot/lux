# Upgrading a Lux app to the modernized framework

This branch replaces the framework's 2017-era toolchain (Node 6, Flow, Babel 6,
Rollup 0.43) with a modern one (Node 20, TypeScript, esbuild). The app-facing
**runtime API is unchanged** — the work below is about the build and the
runtime environment, not your application code's logic.

Every point is grounded in `test/test-app`, which is co-evolved with the
framework and is the canonical example app.

## 1. Hard requirements — these break if you skip them

**Node 20.** The toolchain targets it (`engines: ">=20"`, esbuild target
`node20`). Pin your app to it (`.nvmrc` / `volta` → `20`).

**Bump your database driver.** This is the one that breaks *silently*: `pg@7`
never settles a connection on Node 20 — knex reports it as
`Timeout acquiring a connection. The pool is probably full`, which looks like a
pool bug but is a dead driver. Match the reference app:

```jsonc
// package.json "dependencies"
"pg": "^8.16.3",      // was ^7.x — REQUIRED on Node 20
"mysql2": "^3.15.3",  // was ^1.x
"sqlite3": "^5.1.7",  // already modern
"knex": "^0.16.3"     // unchanged
```

On modern DB *servers*, the newer drivers also let you drop any
`mysql_native_password` / SCRAM auth workarounds the old ones forced.

## 2. Now dead — the compiler ignores these; remove them

The app compiler is now **esbuild**, not Rollup + Babel 6. It no longer reads
your app's Babel config, so these do nothing and can be deleted:

- **`.babelrc`** (the `{"presets": ["lux"]}` file) — ignored.
- **`babel-core`, `babel-preset-lux`** in `dependencies` — dead.
- **`source-map-support`** in `dependencies` — dead. Source maps are automatic
  now (the `lumen` CLI runs with `--enable-source-maps`), so also remove any
  `require('source-map-support').install()` you added yourself.

## 3. App source must be esbuild-compatible

With Babel gone from the build, anything that relied on a Babel transform in
your app code stops working:

- **No Flow types in app source.** esbuild can't strip Flow. Remove `// @flow`
  and any Flow annotations from your models/controllers/etc.
- **No Babel-only syntax** — legacy decorators, experimental proposals wired
  through babel plugins.
- **App files stay `.js`.** The compiler globs `app/**/*.js` and
  `db/migrate/*.js`; `.ts` app files are not picked up.

What's fine (and what the reference app uses): plain ESM,
`import { Model } from 'LUMEN_LOCAL'`, class fields (`static hasMany = {...}`),
async/await, `??` / `?.`. Standard modern JS passes straight through.

## 4. Unchanged — no action needed

- **Framework imports:** still `import { Model, Controller, Serializer,
  Application } from 'LUMEN_LOCAL'`. The magic specifier is the same.
- **Runtime API:** `Model`, `Controller`, `Serializer`, `Application`,
  `Logger`, `lumenify` behave identically — the Flow → TypeScript conversion was
  behaviour-faithful, not a rewrite.
- **App layout:** `app/{models,controllers,serializers}`,
  `config/environments/*.js`, `db/migrate`, `db/seed.js`, `app/routes.js`.
- **CLI:** same commands (`lumen serve`, `lumen build`, `lumen db:migrate`, …).
- **Your `.eslintrc`:** independent of the framework build. It still works as-is
  (even the old `babel-eslint` + `flowtype` setup); modernizing it is optional.

## 5. Deployment note

`LUMEN_LOCAL` resolves to the framework's **built** `dist/index.mjs`, and `dist/`
is gitignored. If you consume `lumen-framework` straight from a git branch (not a
published tarball), make sure it gets built on install — a `prepare` script, or
publish a built package. Installing from a registry (which builds before
publish) is unaffected.

## The short version

Bump `pg`/`mysql2` and run Node 20 (required); delete `.babelrc` and the
babel / `source-map-support` deps (dead); make sure app source is plain JS with
no Flow (build constraint). Imports, runtime API, and app layout are all the
same.
