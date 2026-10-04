# Upgrading a Lumen app to the modernized framework

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

## 6. Compound documents (`?include=`) — response changes

`include` now produces JSON:API 1.0 compliant compound documents, so clients
that follow resource linkage (ember-data with async relationships) can resolve
relationships of included resources without extra requests. **Primary `data` is
byte-for-byte unchanged**; what changed is `included`:

- **Included resources carry `relationships`.** Each is serialized with its own
  serializer's `hasOne`/`hasMany`, in the same shape as primary data (to-one:
  `{ data, links }` or `{ data: null }`; to-many: `{ data: [...] }`). Before,
  included resources had no `relationships` member at all. The linkage is
  batch-loaded — one query per relationship per level, not one per record.
- **Nested paths are supported**, up to three levels by default:
  `include=comments.user`, `include=comments.reactions.user`. Change the limit
  with `maxIncludeDepth` on a controller (or on `ApplicationController` for the
  whole app); `maxIncludeDepth = 1` restores the old behaviour of direct
  relationships only. Intermediate resources are included too
  (`comments.user` also includes the comments), as the spec requires.
  `fields[type]` narrows every resource of that type in the document, at
  every level it appears (§11).
- **Included resources follow the request's namespace** — the namespace of
  the controller handling the request, at every level of the include tree. On
  `/admin/posts`, included comments use `AdminCommentsSerializer` if you have
  one, else `CommentsSerializer` (the same fallback namespaced controllers
  use), and all their links point into `/admin`. The `include` allow-list,
  `fields[...]` and the columns loaded for included types follow the same
  serializers. Before, included resources always used the root serializers and
  linked outside the namespace.
- **A fallback serializer does not leave the namespace.** A namespaced
  controller with no serializer of its own is still given the root one, but
  the request stays in its namespace: what it includes resolves to namespaced
  serializers, and its links — including the primary resource's relationship
  links, which used to be root links — point into the namespace. Note that the
  fallback serializer itself still applies its root `hasOne`/`hasMany`. To
  rule that out for a namespace, set `serializerFallback = false` on its
  `ApplicationController` (e.g. `app/controllers/admin/application.js`): the
  app then refuses to boot while any type the namespace can serialize or
  `include` has no serializer in that namespace, and lists each missing one
  with how it is reached.
- **Primary resources are no longer repeated in `included`** (e.g. a user in
  `/users?include=followers` who is also in the page).
- Unknown paths are still rejected with `400`; top-level names that were
  accepted before still are.

Client-side, nothing is required — but if you worked around the missing linkage
(extra `findRecord` calls, sync relationships), those can go.

## 7. Content negotiation — status code changes

`Accept` and `Content-Type` are now parsed as media types (whitespace, case,
quoted values, multiple `Accept` entries) instead of matched against one regex,
so the JSON:API 1.0 rules apply as written:

- **`Content-Type` that is not `application/vnd.api+json` → `415`** (was
  `400`), including a missing `Content-Type` on `POST`/`PATCH`.
- **`Content-Type: application/vnd.api+json` with *any* parameter → `415`.**
  Before, only `;charset=…` with no space was caught — `; charset=utf-8` or
  `;ext=…` got through.
- **`Accept` → `406` only if *every* `application/vnd.api+json` entry has
  parameters.** `Accept: application/vnd.api+json;charset=utf-8,
  application/vnd.api+json` used to be rejected and is now accepted; `;
  charset=utf-8` (with a space) or `;ext=…` alone used to be accepted and is
  now rejected. A `q` weight is not a media type parameter, and an `Accept`
  without the JSON:API type (`*/*`, `text/html`) is still accepted.

Clients that send exactly `application/vnd.api+json` (ember-data does) see no
change. If a client or test sent `application/json` bodies and asserted `400`,
expect `415`.

## 8. Error responses — status codes and `source`

Several client errors that came back as `400` or `500` now use the status
JSON:API 1.0 (or plain HTTP) calls for, and error objects say *what* was wrong:

| Situation | Was | Now |
|---|---|---|
| `POST` with `data.id` (client-generated IDs are unsupported) | `400` | `403` |
| `data.relationships.<name>` for a relationship the model has but the controller's `params` does not list | `400` | `403` |
| A relationship referencing a resource that does not exist (`POST`/`PATCH`) | `201`/`200`, dangling linkage saved | `404` |
| A model validator (`static validates`) fails | `500` | `422` |
| A unique constraint is violated on create/update | `500` (SQL in `detail` in development) | `409` |

A relationship name the model does not have at all is still `400`.

- **Error objects carry `source`** — `source.pointer` for request document
  members (`/data/attributes/password`, `/data/relationships/tags/data/1`) and
  `source.parameter` for query parameters (`page[size]`). Member names are
  dasherized, matching responses. Unlike `detail`, `source` is included in
  every environment. ember-data maps `422` + `source.pointer` onto
  `record.errors` for the attribute.
- **`ValidationError`'s message no longer includes the rejected value** — it
  ended up in logs and could be a password. It also exposes `key` and is now a
  server error (`statusCode: 422`); `instanceof ValidationError` still works.
- **The related-resource check is one query per relationship** in the request,
  run by the built-in `create`/`update` actions. Custom actions that write
  relationships don't get it automatically.

Attributes the controller does not accept are still silently dropped (clients
such as ember-data send every attribute, including read-only ones).

## 9. Relationship loading — one batched path

Built-in actions no longer join relationships into the primary query.
`index`/`show`/`update`/`destroy` load only the primary rows; the serializer
then batch-loads the resource linkage of primary data and builds `included`
the same way it already did for nested include levels — one query per
relationship, never one per record.

- **Responses are unchanged**, with two corrections: a has-one with several
  candidate rows now always links the lowest id (the join picked an arbitrary
  one, and could repeat the primary row), and `fields[type]` now applies to
  every included resource of that type, not only those reached through a
  direct relationship. (§11 extends this to the primary type and to
  relationships.)
- **Query count per request is constant**, typically a few queries more than
  before (the has-one and the belongs-to linkage are no longer folded into the
  join), while self-referential relationships (`/users?include=followers`) stop
  costing a query per record.
- **Custom actions:** a relationship pre-loaded with `.include()` on a query a
  custom action returns is no longer what gets serialized — linkage and
  `included` are always loaded by the serializer. Drop the `.include()`.
  Likewise, records returned by `super.index()`/`super.show()` no longer carry
  related records in their column data; read them through the relationship
  (`await post.user`).

## 10. Visibility rules — replace hand-rolled scoping (opt-in)

Nothing changes until you declare rules. A namespace's `ApplicationController`
can now say, once, which rows of each type its requests may see:

```js
// app/controllers/application.js
class ApplicationController extends Controller {
  static visibility = {
    posts: query => query.isPublic(),
    comments: (query, request) => query.where({ userId: request.viewerId })
  };
}

// app/controllers/admin/application.js
class AdminApplicationController extends ApplicationController {
  static visibility = {}; // or { ...super.visibility, tags: ... }
}
```

Lumen applies a type's rule wherever it loads that type for a request in the
namespace: `index` (and its page links), `show`/`update`/`destroy` (hidden →
`404`), the resource linkage of every relationship (a hidden to-one is `null`,
a hidden to-many member is left out), `included` at any depth, and the related
records a `create`/`update` references (hidden → `404`, like a missing one).
That makes these idioms redundant — delete them once a rule covers the type:

- `super.index(req).where(...)` / a scoped `show` override for visibility;
- pruning ids out of relationship linkage;
- `afterAction` hooks that filter hidden records out of the payload.

The reference app shows the swap: `PostsController#index`'s `.isPublic()` and
`AdminPostsController`'s `.unscope('isPublic')` became a `posts` rule on the
root `ApplicationController` and `static visibility = {}` on the admin one —
which also closed the gaps the old idiom left (`GET /posts/:id` of a private
post, and private posts reachable through `/users?include=posts`).

Rules must return the query they are given synchronously and may only add
conditions (`where`, `not`, `whereBetween`, `whereRaw`, model scopes built
from them); anything else throws when the rule first runs. Compute what a rule
needs in a `beforeAction` and read it from the request. Declaring
`visibility` on any controller other than a namespace's
`ApplicationController` — or for an unknown type, or with a non-function
rule — fails the boot. A namespace without an `ApplicationController` uses the
closest ancestor namespace's rules.

Rules do not reach queries your code builds itself (`Post.where(...)` in a
custom action, `await post.comments`); narrow those with
`this.visible(query, request)`.

## 11. Sparse fieldsets — now per the spec

`fields[TYPE]` now behaves as JSON:API 1.0 specifies. Requests without
`fields` are unaffected.

- **A fieldset selects relationships too.** `fields[posts]=title` returns
  posts with only a `title` attribute and **no `relationships`**; name a
  relationship to keep it (`fields[posts]=title,user`). Before, every
  relationship was always serialized and relationship names were silently
  dropped from the fieldset. A relationship left out of the fieldset can still
  be `include`d.
- **It applies to every resource of its type**, including included resources
  of the primary type (`/comments/1?include=post.comments&fields[comments]=message`
  narrows the included comments as well as the primary one).
- **Every type the response can contain is accepted** — the resource's own,
  and every type reachable through `include` down to `maxIncludeDepth` (before:
  only direct relationships; others were silently ignored). Fieldsets for
  types the response cannot contain are still ignored.
- **Unknown field names are a `400`** with `source.parameter` (`fields[posts]`),
  like an unknown `include` or `sort`. Before, they were silently dropped. The
  primary key is not a field: `fields[posts]=id` is now a `400` too.
- **An empty fieldset selects no fields** (`fields[users]=` → `attributes: {}`
  and no `relationships`). Before, included resources fell back to all
  attributes.
- **Member names may be dasherized** (`fields[posts]=created-at`), as they
  appear in responses. Before, only the camelCase spelling matched.

## The short version

Bump `pg`/`mysql2` and run Node 20 (required); delete `.babelrc` and the
babel / `source-map-support` deps (dead); make sure app source is plain JS with
no Flow (build constraint). Imports, runtime API, and app layout are all the
same.
