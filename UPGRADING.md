# Upgrading a Lumen app to the modernized framework

This branch replaces the framework's 2017-era toolchain (Node 6, Flow, Babel 6,
Rollup 0.43) with a modern one (Node 22, TypeScript, esbuild). The app-facing
**runtime API is unchanged** — the work below is about the build and the
runtime environment, not your application code's logic.

Every point is grounded in `test/test-app`, which is co-evolved with the
framework and is the canonical example app.

## 1. Hard requirements — these break if you skip them

**Node 22.13 or newer.** The toolchain targets it (`engines: ">= 22.13"`,
esbuild target `node22`). Pin your app to it (`.nvmrc` → `22`, `volta` → a
22.x release). Node 20 reached end-of-life in April 2026 and is no longer
supported. 22.13 is the first 22.x where `require()` of an ES module is
stable (22.12 allows it but prints an `ExperimentalWarning`), which the
framework's ESM-only dependencies rely on.

**Bump your database driver.** This is the one that breaks *silently*: `pg@7`
never settles a connection on modern Node — knex reports it as
`Timeout acquiring a connection. The pool is probably full`, which looks like a
pool bug but is a dead driver. Match the reference app:

```jsonc
// package.json "dependencies"
"pg": "^8.23.1",      // was ^7.x — REQUIRED on modern Node
"mysql2": "^3.24.5",  // was ^1.x
"sqlite3": "^6.0.1",  // was ^5.x
"knex": "^3.3.0"      // was ^0.x
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
  `{ data }` or `{ data: null }`; to-many: `{ data: [...] }`; see §14). Before,
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
  serializers, and its links point into the namespace. Note that the
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
| `data.relationships.<name>` for a relationship the model has but the controller's `params` does not list | `400` | `403` (see §15) |
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

## 12. Pagination — links and page limits

- **`links.self` is never `null`.** Past the last page it is the page that was
  requested (`prev`/`next` are `null` there, as before). Before, `self` was
  `null` whenever `page[number]` exceeded the last page.
- **Page links keep the request's query string as written.** Only
  `page[number]` changes between them. Before, links were rebuilt from the
  parsed params, so member names came back camelCased (`sort=-createdAt` for a
  request with `sort=-created-at`) and an empty value became `null`.
- **`page[size]` and `page[number]` must be at least 1**, and `page[size]` at
  most the controller's new **`maxPerPage`** (default `100`); anything else is
  a `400` with `source.parameter`. Before, `page[size]=0` returned an empty
  page with a `last` link to `page[number]=Infinity`, and any size was served.
  Set `maxPerPage` on a controller (or `ApplicationController`) if clients
  need larger pages.
- **Index responses carry the total in `meta`**: `"meta": { "total": 52 }`,
  the number of resources matching the request's filters and visibility rules
  across every page. It is the count the page links were already built from,
  so it costs no extra query. ember-data exposes it as the loaded
  collection's `meta.total`.

## 13. Request parsing — values arrive as sent

Requests are parsed more strictly by member name and more faithfully by
value.

- **Request bodies keep their values.** Only the names of
  `data.attributes` and `data.relationships` are camelized. Before, the whole
  body was rewritten:
  - every string that looked like an ISO date became a `Date` — so a string
    column could not store one (`400`);
  - keys *inside* object/JSON attribute values were camelized;
  - numeric strings inside array attributes became numbers.

  Dates are now parsed for **date columns only**, from any ISO 8601 string
  (`2020-01-01`, `2020-01-01T10:20:30+02:00`, …). Ids (`data.id` and resource
  linkage) are strings per the spec and are converted to a numeric primary
  key by its column type, as before.
- **Query values keep their case.** A comma-separated value is still a list
  (`filter[title]=a,b` matches either), but its items are no longer camelized
  (`filter[title]=Mixed Case` used to look for `mixed Case`). Values are
  coerced the same way for every method (`123`, `true`, `null`, ISO dates).
  `include` paths are camelized like other member names
  (`include=comments.blog-author`).
- **`meta` (and `links`, `jsonapi`) are accepted** at the top level, in
  `data` and in relationship objects, instead of being a `400`. They are not
  acted on; a controller can read the top-level ones from `request.params`.
- **To-many linkage is validated per element.** Each must be a resource
  identifier of the related type with an id — otherwise a `400` pointing at
  the element (`/data/relationships/comments/data/1/id`). Before, any array
  was accepted and passed to the ORM. A request body must be a JSON object;
  a top-level array is now a `400` like other malformed bodies.

## 14. Relationship links — removed, then back with their endpoints (§20, §21)

To-one relationships no longer carry a `links` member; like to-many ones, they
are just their linkage:

```json
"user": {
  "data": { "id": "2", "type": "users" }
}
```

They used to carry `links.self` pointing at the related resource's own URL
(`/users/2`). JSON:API gives relationship links specific meanings that URL
cannot meet:

- a relationship's `self` link is the relationship URL
  (`/posts/1/relationships/user`), and every one a response contains MUST be
  served;
- a `related` link MUST NOT change when the relationship's content does — but
  `/users/2` changes as soon as the post's user changes.

Lumen does not serve relationship or related endpoints yet, so it sends no
relationship links at all. Clients that read `relationships.*.links` must use
the linkage (`data`) instead — e.g. ember-data loads `data` and does not need
the link. The links come back, with proper URLs, once those endpoints exist.

Relationship endpoints now exist (§20), and every relationship links to its
own as `links.self`, and to its related endpoint (§21) as `links.related`.

## 15. Members the controller does not accept — configurable; unknown ones — `400`

A `POST`/`PATCH` body is checked against the model and the controller's
`params`:

- **An attribute the model has but `params` does not list is ignored**, as
  before — dropped before the action runs, and the request succeeds. Clients
  that send whole resources back keep working (ember-data serializes every
  attribute, read-only ones such as `created-at` included).
- **A relationship the model has but `params` does not list is a
  `403 Forbidden`** (JSON:API's answer to an unsupported update) with a
  pointer (`/data/relationships/comments`). It used to be a `400` (§8).
- **A member the model does not have is a `400 Bad Request`** with a pointer
  (`/data/attributes/nope`). Attributes like that used to be silently dropped.

Two new controller properties change the first two; set them on
`ApplicationController` for the whole app, or on a single controller:

| Property | Default | Effect |
|---|---|---|
| `rejectUnlistedAttributes` | `false` | `true`: unlisted attributes are a `403` too |
| `rejectUnlistedRelationships` | `true` | `false`: unlisted relationships are ignored |

**ember-data:** it sends every `belongsTo` back on save, so a controller
that does not accept one of them now answers `403`. Either mark it
`serialize: false` in the ember-data serializer
(`attrs = { user: { serialize: false } }`), or turn the check off:

```javascript
class ApplicationController extends Controller {
  rejectUnlistedRelationships = false;
}
```

The trade-offs between ignoring and rejecting are discussed in
nickschot/lux#47.

## 16. Has-many-through writes — fixed

Writing a has-many-through relationship (`tags` through `categorizations`)
with `create`/`update` — or a `POST`/`PATCH` whose controller accepts it —
used to fail with a database error: the ORM set the foreign key on the
related table (`tags.post_id`), which does not exist. It now replaces the join
rows: rows for related records no longer linked are deleted, missing ones are
created through the join model (so its timestamps and hooks apply), and rows
that stay are left untouched. No app change is needed; an app that worked
around this by writing join rows itself can drop the workaround.

## 17. Routing — string ids, 405, HEAD and OPTIONS

- **Resources with a non-numeric primary key are routable.** A request path
  used to match a member route only if the id was an integer, so a uuid or
  other string key gave `404` for every member route. Now a resource whose
  primary key column is not numeric accepts any path segment as its id
  (percent-decoded, passed to the controller as a string); integer keys still
  only match integers (`/posts/abc` stays a `404`). Paths a route defines
  literally (`/users/login`) are never read as ids.
- **`405 Method Not Allowed`, with `Allow`, for a method a path does not
  support** (`PUT /posts/1`, `GET /users/login`). It used to be a `404`.
- **`HEAD` runs the `GET` action** and answers with its status and headers,
  without a body. It used to answer `204` without running anything.
- **`OPTIONS` responses list the path's methods in `Allow`.**
- **A created resource's `links.self` equals its `Location`** (`/tags/101`).
  It used to be the collection's URL (`/tags`).
- **A route whose path contains the letters `id` outside its `:id` segment
  matches.** It used to be registered under a mangled path
  (`/videos/:id` as `/vdynamiceos/:dynamic`) and answer `404` to every
  request, so a `videos` or `guides` resource, or a custom route like
  `/posts/:id/provider`, could never be reached.

## 18. Error responses — every problem, richer error objects

- **A request with several problems gets one error object per problem.**
  Parameter validation used to stop at the first; now every invalid member
  is reported (`errors` holds e.g. a missing `data.type` *and* an unknown
  attribute), as does every invalid element of to-many linkage and every
  attribute a model validator rejects (one `422` each). Each error object has
  its own `status`; the response takes the shared one, or `400` when they
  differ (JSON:API: "the most generally applicable HTTP error code"). Clients
  that only read `errors[0]` keep working.
- **Errors can carry more of the error object.** An error thrown from an
  action (or hook) is rendered with the `id`, `code`, `title`, `meta` and
  `links.about` it has — e.g.

  ```js
  throw Object.assign(new Error('[public] That title is taken.'), {
    statusCode: 422,
    code: 'title-taken',
    source: { pointer: '/data/attributes/title' }
  });
  ```

  `detail` (the message) is still only exposed in development or with a
  `[public]` prefix. The prefix and any whitespace after it are stripped, so
  the example's `detail` is `That title is taken.` (it used to keep the
  leading space).
- **Type errors name arrays and dates** ("got 'array'") instead of the
  confusing "Expected type 'object' … but got 'object'".
- **A boot warning for custom `query` parameters named only with a-z**
  (`search`): JSON:API reserves that shape for its own parameters and requires
  implementation-specific ones to contain another character (`searchTerm`,
  `search-term`). They keep working.

## 19. Build strictness — the CLI flag alone decides

- **Your app's `tsconfig.json` no longer affects `dist/bundle.js`.** esbuild
  used to pick up any `tsconfig.json` above the app and apply its `strict`
  (→ `alwaysStrict`) even to `.js` files, so `--use-weak` was silently ignored
  in an app with a strict config. Strict mode is now the CLI default, and
  `--use-weak` really turns it off. No action needed unless you relied on that
  override.

## 20. Relationship endpoints — `GET /posts/1/relationships/user`

Every resource with a `show` route now also serves a **relationship endpoint**
for each relationship its Serializer exposes, as JSON:API describes under
"Fetching Relationships":

```
GET /posts/1/relationships/user       → { "data": { "id": "2", "type": "users" }, … }
GET /posts/1/relationships/comments   → { "data": [{ "id": "7", "type": "comments" }], … }
```

- The response is the relationship's resource linkage (`null` or `[]` when
  empty) with `links.self`. To-many linkage is not paginated, like the linkage
  already embedded in resources.
- The path dasherizes the relationship name (`friendRequests` →
  `/relationships/friend-requests`), like the document's member names.
- Visibility rules apply as for `show` and `include`: a resource the request
  may not see is a `404`, and hidden related records are left out of the
  linkage. An unknown relationship is a `404`; `HEAD` and `OPTIONS` work; a
  write is a `405` (relationship writes come later). Query parameters are a
  `400`.
- **The owning resource is resolved through the controller's `show`** (with
  a request for its primary key only), so a check in an overridden `show` —
  narrowing its query, or rejecting the request — applies here too. Override
  `showRelationship(request)` to resolve it differently; the relationship is
  `request.route.relationship`.
- **Hooks see the action `showRelationship`**, not `show`. A `beforeAction`
  that authorizes by action name (`request.route.action === 'show'`) must
  allow it too, or test `request.route.type === 'relationship'`.
- The linkage it serves was already readable through `?include=` under the
  same visibility rules.

**Relationship objects now carry `links.self`** pointing at that endpoint —
in the request's namespace, and only when the endpoint is served (an included
type without a resource in the namespace has no links):

```json
"user": {
  "data": { "id": "2", "type": "users" },
  "links": { "self": "https://api.example.com/posts/1/relationships/user" }
}
```

Clients that compare relationship objects as a whole must allow the extra
member; ember-data keeps reading `data`.

## 21. Related endpoints — `GET /posts/1/comments`

Next to each relationship endpoint, a resource now serves a **related
endpoint**: the related resources themselves, as JSON:API's `related` links
describe.

```
GET /posts/1/user       → { "data": { "id": "2", "type": "users", … } }   (or null)
GET /posts/1/comments   → { "data": [{ "id": "7", "type": "comments", … }], "links": { "first": …, "next": … } }
```

- It is served by the **related type's controller in the same namespace**
  (`admin/users` for `/admin/posts/1/user`). A to-many related endpoint pages,
  sorts and filters like that controller's `index` (`?page[size]`, `?sort`,
  `?filter`, its `maxPerPage`, and `meta.total`), a to-one like its `show`;
  both take its `include` and `fields`, and the resources are formatted by its
  Serializer — the same one `?include=` uses in that namespace.
- **It exists only where the related type is listed**: the namespace needs a
  controller for the type (with a model and a Serializer), and its resource
  must route `index` (to-many) or `show` (to-one). Otherwise the relationship
  gets no related endpoint and no `related` link — so a namespace never serves
  a type it does not list itself, nor through an ancestor namespace's
  controller and Serializer.
- The relationship is a condition on the related table, so a large to-many
  relationship never loads its ids into memory, and paging counts only what
  the request may see.
- Visibility rules apply to the related resources; a resource the request may
  not see is a `404`. `HEAD` and `OPTIONS` work; a write is a `405`.
- **Hooks:** the owning controller's `beforeAction` hooks run, then the
  related controller's (each hook once, when both inherit it as the same
  function), then the owner's `afterAction` hooks. The action is
  `showRelated` (`request.route.type` is `related`): a hook that authorizes by
  action name must allow it.
- **Controller code:** the owning resource is resolved through
  `showRelationship(request)`, and so through the owner's `show` (§20). The
  related controller's `index` and `show` are *not* called: a check written
  in an override of those does not apply here — move it into a visibility rule
  or a `beforeAction` hook, or override `showRelated(request)` on the owning
  controller.

**Relationship objects now carry `links.related`** as well, under the same
rule as `self`: only when the endpoint is served. Unlike the link removed in
§14, it does not change when the relationship's content does.

```json
"user": {
  "data": { "id": "2", "type": "users" },
  "links": {
    "self": "https://api.example.com/posts/1/relationships/user",
    "related": "https://api.example.com/posts/1/user"
  }
}
```

**Choosing which relationships are routed.** A resource's new
`relationships` option narrows the relationship and related endpoints (§20,
§21) to those named, or turns them off with `false`; their links go with
them:

```javascript
this.resource('posts', { relationships: ['user', 'tags'] });
this.resource('reports', { relationships: false });
```

It defaults to `true`: every relationship the resource's Serializer exposes.
Naming one it does not expose is a boot error. A relationship left out keeps
its linkage in documents and stays includable — use the Serializer (or
`linksOnly`) to change what documents contain.

A custom member route on a resource (`this.get('comments')` in its `member`
block) takes precedence over the related endpoint of the same name, and the
`related` link then points at it — rename one of them.

## 22. `linksOnly` — to-many relationships as links, without their ids

A Serializer can now list `hasMany` relationships to serialize **without
resource linkage**, only their links (§20, §21). A resource with many related
records then stays small, and their ids are not loaded at all (one query
fewer per relationship):

```javascript
class PostsSerializer extends Serializer {
  hasMany = ['comments', 'tags'];

  linksOnly = ['comments'];
}
```

```json
"comments": {
  "links": {
    "self": "https://api.example.com/posts/1/relationships/comments",
    "related": "https://api.example.com/posts/1/comments"
  }
}
```

- Clients load the records from the `related` link when they need them,
  paged like an index. ember-data does this by itself for an async `hasMany`
  whose payload has a `related` link and no `data`.
- **A relationship the request includes keeps its `data`** (`?include=comments`):
  JSON:API requires every included resource to be linked from the document.
- **So does one without a related endpoint where it is serialized** — e.g. an
  included type in a namespace that has no resource for it — since it would be
  left with nothing to load it from.
- It applies wherever the Serializer is used: primary data and included
  resources alike. The relationship endpoint (§20) still returns the full
  linkage.
- **Boot check:** each name must be in the Serializer's `hasMany`, and have a
  related endpoint in at least one namespace that uses the Serializer for its
  type — there, the related type's resource must route `index` and this
  type's must route `show`. Otherwise the application refuses to boot,
  listing each problem. (In a namespace without that endpoint the
  relationship keeps its `data`, as above.)

Nothing changes unless a Serializer sets `linksOnly`.

## 23. inflection 3 — one word inflects differently

Lumen derives table names, resource `type`s and relationship keys from model
names with [inflection](https://github.com/dreamerslab/node.inflection), now
on v3 (was v1). Across every word in v1's rule tables, plus common model names,
exactly one result changed — v1 got it wrong:

| Call | v1 | v3 |
|---|---|---|
| `pluralize('focus')` | `focus` | `focuses` |
| `singularize('focus')` | `focu` | `focus` |
| `classify('focus')` | `Focu` | `Focus` |

Nothing changes unless a model, table or relationship is named after "focus";
if one is, its derived table name or `type` changes with it.

## 24. The `lumen` CLI — mistakes are errors now

The CLI moved from commander 2 to 15. Every command, alias and flag is the
same; what changed is that mistakes it used to swallow now fail with a message
and exit code `1` — worth knowing if a script depends on the old exit codes.

| Invocation | Before | Now |
|---|---|---|
| `lumen destroy model user` | did nothing, exit 0 (only `lumen d` worked) | destroys, like `lumen d` |
| `lumen bogus` | no output, exit 0 | `error: unknown command 'bogus'`, with a "did you mean" suggestion |
| `lumen` (no command) | help, exit 0 | help, exit 1 |
| `lumen new app --database oracle` | silently created a sqlite app | error: allowed choices are `postgres`, `sqlite`, `mysql` |
| `lumen new app --database Postgres` | silently created a sqlite app | the same error — values are lowercase |
| `-e`/`-p`/`--database` with no value | set the value to `true` (e.g. `NODE_ENV=true`) | error: argument missing |
| extra arguments (`lumen build now`) | ignored | error: too many arguments |

## 25. Logging — safer in production, quieter and more useful

- **Credentials are filtered without configuration.** Params whose name
  contains `password`, `secret` or `token` are always logged as
  `[FILTERED]`; `logging.filter.params` adds to that list instead of being
  the only line of defence (it used to default to `[]`, so a fresh app logged
  passwords). Matching is now by *containment, ignoring case* — `password`
  also covers `passwordConfirmation` and `new-password` — and reaches into
  arrays (`data: [{ attributes: { secret } }]`). If a name in your filter list
  is a substring of a param you *do* want to see, rename one of them.
- **The logged `path` no longer has the query string.** Query params are
  already logged, filtered, under `params`; the raw `?token=…` used to
  bypass the filter through `path`.
- **An unknown `logging.level` or `logging.format` fails at boot** (for an
  enabled logger). `level: 'info'` (lowercase) used to fall back to `DEBUG`
  without a word — in production that logs every SQL statement with its
  values. Levels are `DEBUG`, `INFO`, `WARN`, `ERROR`; formats `text`, `json`.

## The short version

Bump `pg`/`mysql2` and run Node 22.13+ (required); delete `.babelrc` and the
babel / `source-map-support` deps (dead); make sure app source is plain JS with
no Flow (build constraint). Imports, runtime API, and app layout are all the
same.
