# Upgrading

What an app has to change, or check, when it moves to a new major version of
`lumen-framework`. This file lists only the differences; how each feature
works is in the [guides](docs/guides/README.md).

- [From 3.x to 4.0](#from-3x-to-40)
- [From Lux or Lumen 2.x to 3.x](#from-lux-or-lumen-2x-to-3x)

Every point is checked against `test/test-app`, the framework's test fixture.
[examples/social-network](examples/social-network) shows the features the way
an app would write them.

## From 3.x to 4.0

### In short

Required:

1. Run **Node 22.14 or later**, and update the database drivers. **SQLite
   apps:** switch from `sqlite3` to `better-sqlite3`
   ([Requirements](#requirements)).
2. Remove `"test": "lumen test"` from `package.json`: the command is gone
   ([CLI](#the-lumen-cli-and-generators)).
3. Fix any relationship the app now refuses to boot with ([Models](#models)),
   and check the order of the files in `db/migrate/`
   ([CLI](#the-lumen-cli-and-generators)).
4. Rename serializer fields named `type` or `id`, or opt them out with
   `allowReservedNames` ([Responses](#responses)).

Check, if it applies to your app:

5. **Namespaces whose `ApplicationController` declares no visibility
   rules** now follow their parent namespace's rules
   ([Controllers](#controllers)).
6. **Hooks that authorize by action name** must also allow
   `showRelationship` and `showRelated`, the actions of the new relationship
   endpoints ([Routing](#routing)).
7. **Custom actions that `.include()` relationships:** drop the call; the
   serializer loads relationships itself ([Controllers](#controllers)).
8. **Clients or tests asserting status codes or error `detail`s:** several
   changed ([Errors](#errors)). A string an action returns is now
   `text/plain` ([Responses](#responses)).
9. **Log parsing and alerting:** the text format changed, 4xx are no longer
   logged as errors, and `logging.level` must be uppercase
   ([Logging](#logging)).
10. **Model hooks comparing records with `===`:** a hook now receives a
    proxy of the record ([Models](#models)).

**ember-data clients** see no change: a `belongsTo` the controller's
`params` don't list is still a `403`, as in 3.x. To accept and ignore it
instead, set the new `rejectUnlistedRelationships = false`
([Requests](#requests)).

The rest is new behaviour that needs no change, such as visibility rules,
relationship endpoints, `linksOnly` and request ids. Each is listed below with
a link to its guide.

### Requirements

**Node 22.14 or later.** Node 20 reached end of life in April 2026. 22.14 is
the first 22.x with N-API 10, which better-sqlite3's prebuilt binary needs
(on 22.13 it crashes); `require()` of an ES module, which the framework's
ESM-only dependencies rely on, is stable since 22.13. Pin it with `engines`,
`.nvmrc` or `volta`.

**Database drivers.** Match these versions:

```jsonc
// package.json "dependencies"
"pg": "^8.23.1",
"mysql2": "^3.24.5",
"better-sqlite3": "^13.0.3",  // replaces sqlite3
"knex": "^3.3.0"              // was ^0.x
```

**SQLite: `better-sqlite3` replaces `sqlite3`.** node-sqlite3 is unmaintained
since its 6.0.0, and Lumen no longer accepts it: an app with
`driver: 'sqlite3'` refuses to boot, saying what to change. **Do:**

1. In `config/database.js`, set `driver: 'better-sqlite3'` for every
   environment.
2. Replace the dependency: remove `sqlite3`, add `better-sqlite3`. It ships
   prebuilt binaries; with pnpm, add
   `"pnpm": { "ignoredBuiltDependencies": ["better-sqlite3"] }` to
   `package.json` so it doesn't try to compile it.

The database files (`db/<database>_<environment>.sqlite`) stay where they
are and need no conversion. SQLite now always uses a single connection,
whatever `pool` says: better-sqlite3 is synchronous, so a second connection
waiting on the first's lock would block the process.

The drivers `mariasql`, `strong-oracle` and `oracle`, which knex 3 no longer
has, are no longer accepted either.

### Requests

See [Serializers: request documents](docs/guides/serializers.md#request-documents)
and [Controllers: accepting writes](docs/guides/controllers.md#accepting-writes-params).

- New: **plain routes take any JSON body.** A `POST` or `PATCH` to a route
  outside `member` and `collection` accepts `application/json` as well as
  the JSON:API type, and hands the body to the action unvalidated as
  `request.body`. It used to be a `415`, or a `400` for any member in it
  ([Routing](docs/guides/routing.md#plain-routes)). `request.body` holds the
  JSON:API document as sent on other routes too.
- **Members a model doesn't have are a `400`**, with a pointer
  (`/data/attributes/nope`). They used to be dropped silently.
- **Relationships the controller's `params` don't list are a `403`**, as in
  3.x. Attributes it doesn't list are still dropped. Two controller
  properties change this, for the whole app on `ApplicationController`:
  `rejectUnlistedAttributes` (default `false`) and
  `rejectUnlistedRelationships` (default `true`). ember-data sends every
  `belongsTo` back on save, so either mark the relationship
  `serialize: false` in the ember-data serializer, or set
  `rejectUnlistedRelationships = false`.
- **Request bodies keep their values.** Only the member names in
  `data.attributes` and `data.relationships` are camelized. Strings that look
  like dates stay strings unless the column is a date; keys inside object
  values and numeric strings inside arrays are left alone.
- **Query values keep their case:** `filter[title]=Mixed Case` used to look
  for `mixed Case`.
- **`meta`, `links` and `jsonapi` are accepted** in a request document
  instead of being a `400`.
- **To-many linkage is checked per element**, and a top-level array body is a
  `400`.
- **`page[size]` must be between 1 and the controller's `maxPerPage`**
  (default `100`), and `page[number]` at least 1. Anything else is a `400`.
  Set `maxPerPage` if clients need larger pages.
- **`fields[type]` names must exist:** unknown names, and `id`, are a `400`.
  Dasherized names (`created-at`) are accepted.

### Responses

See [Serializers and JSON:API](docs/guides/serializers.md).

- **A serializer field named `type` or `id` fails the boot.** JSON:API
  forbids both names for attributes and relationships, since they share a
  namespace with the resource's own `type` and `id`; Lumen used to send them
  anyway. **Do:** rename the column, or set `allowReservedNames = true` on the
  serializer to keep sending it, with a warning at boot
  ([Serializers](docs/guides/serializers.md#type-and-id)).
- **A serializer attribute that isn't a column fails the boot.** Listing a
  getter or other computed property in `attributes` used to be accepted and
  then silently ignored: missing from every response, while `sort` and
  `filter` (which default to the serializer's attributes) accepted it and
  did nothing. The same goes for a name listed in a controller's `sort` or
  `filter`. **Do:** remove such names, and add computed values in an
  `afterAction` hook or a custom action.
- **A sparse fieldset selects relationships too.** `fields[posts]=title`
  returns posts without `relationships`; name a relationship to keep it
  (`fields[posts]=title,user`). A fieldset applies to every resource of its
  type, at every level of `include`, and an empty one (`fields[users]=`)
  selects nothing.
- **Relationship objects link to their endpoints.** A to-one relationship
  used to carry `links.self` pointing at the related resource (`/users/2`).
  Every relationship now carries `links.self` (`/posts/1/relationships/user`)
  and `links.related` (`/posts/1/user`), when those endpoints are served.
  Clients that compare relationship objects as a whole must allow the extra
  member.
- **Pagination:** `links.self` is never `null`, page links keep the query
  string as the client wrote it, and an index response has
  `"meta": { "total": … }`.
- **A document's `links.self` is percent-encoded**, as page links already
  were: `?fields[users]=name` comes back as `?fields%5Busers%5D=name`, a valid
  URI. It used to repeat the request's query as sent. Clients that compare
  `links.self` with the URL they requested must decode it first.
- **A has-one with several candidate rows links the lowest id.** It used to
  be arbitrary.
- **A created resource's `links.self` equals its `Location`** (`/tags/101`).
  It used to be the collection's URL.
- **Plain routes serialize models too.** A route directly inside a resource
  (not in `member` or `collection`) used to send the models it returned as
  `[{}]`, and calling a built-in action in it (`this.index(request)`) was a
  `500`. Both now work like a `collection` route, with `index`'s defaults; the
  route still takes no query parameters but `query`
  ([Routing](docs/guides/routing.md#plain-routes)).
- **Custom collection actions built on `index` are paged like it.** A
  collection route returning `this.index(request).where(…)` was paged
  without saying so: only `links.self`, no `meta.total`. It now gets the page
  links and `meta.total`, as `index` does
  ([Routing](docs/guides/routing.md#custom-routes)).
- **JSON that isn't a JSON:API document is sent as `application/json`.** An
  object or array an action returns used to be labelled
  `application/vnd.api+json` whatever it held. Now only a JSON:API document
  (an object with a top-level `jsonapi`, `data` or `errors`) is; every
  document Lumen builds has `jsonapi`. A success status returned as a number
  (`return 202;`) has no `Content-Type`, as its body is empty. **Check:**
  clients that require the JSON:API type on such responses.
- **A string an action returns is sent as `text/plain; charset=utf-8`.** It
  used to be labelled `application/vnd.api+json`. A `Content-Type` the action
  sets itself is kept. **Check:** clients that read such a response.
- New, opt-in: a serializer's
  [`linksOnly`](docs/guides/serializers.md#links-only) sends a to-many
  relationship as links without its ids.

### Errors

See [Errors](docs/guides/errors.md).

| Situation | 3.x | 4.0 |
|---|---|---|
| A member the model doesn't have | dropped | `400` |
| A method the path doesn't support (`PUT /posts/1`) | `404` | `405`, with `Allow` |
| `HEAD` on a resource | `204`, the action not run | the `GET` action's status and headers |
| `page[size]` above `maxPerPage`, or below 1 | served | `400` |
| An unknown name in `fields[type]` | ignored | `400` |
| A string id (uuid primary key) on a member route | `404` | routed |

- **A request with several problems gets an error object for each**, every
  one with its own `status`. The response status is the one they share, or
  `400`. Clients reading only `errors[0]` keep working.
- **An error your code throws keeps its `id`, `code`, `title`, `meta` and
  `links.about`** in the error object. `detail` is still shown only in
  development, or when the message starts with `[public]`. The prefix and the
  whitespace after it are now stripped.
- **Lumen's own client errors keep their `detail` in production**: the
  parameter, media-type, `404`, `405` and `422` errors, whose messages only
  describe the request. The `409` for a unique constraint violation (the
  database driver's message) and errors from your code are still hidden.
- **Error messages name members as documents do:** `created-at`,
  `fields[posts]`, `filter[is-public]`, not `createdAt` or `fields.posts`.
  Clients that match on a `detail` must follow.

### Routing

See [Routing](docs/guides/routing.md).

- **New: relationship and related endpoints**
  (`GET /posts/1/relationships/user`, `GET /posts/1/user`) for every
  relationship a serializer outputs. Their actions are `showRelationship` and
  `showRelated`. A `beforeAction` hook that allows only some actions by name
  must allow these too, or check `request.route.type`. Limit the endpoints
  with the resource's `relationships` option. A custom member route of the
  same name (`this.get('comments')`) takes precedence over a related
  endpoint.
- **Resources with a non-numeric primary key are routable.** Integer keys
  still only match integers.
- **`OPTIONS` lists the path's methods in `Allow`.**
- **A path containing `id` outside its `:id` segment matches.** A `videos`
  resource, or `/posts/:id/provider`, used to answer `404` to everything.

### Controllers

See [Controllers](docs/guides/controllers.md).

- **Relationships are always loaded by the serializer.** Built-in actions no
  longer join them into the main query. A relationship a custom action
  pre-loads with `.include()` is no longer what gets serialized: drop the
  call. Records `super.index()` and `super.show()` return no longer carry
  related records in their column data; read them through the relationship
  (`await post.user`).
- **Namespace settings reach every controller.** `rejectUnlistedAttributes`,
  `rejectUnlistedRelationships` and `maxIncludeDepth` set on a namespace's
  `ApplicationController` used to apply only to controllers extending it.
  Generated controllers extend `Controller`, so an app-wide setting was
  ignored. A controller that doesn't set its own now follows its namespace.
- **A namespace's `ApplicationController` that extends its parent's no
  longer runs the parent's hooks twice.** Its `beforeAction` and
  `afterAction` replace the parent's; keep them with
  `beforeAction = [...this.beforeAction, requireAdmin]`.
- **Hooks are bound to the controller declaring them**, including the root
  `ApplicationController`'s, whose hooks ran with `this` undefined on its own
  routes.
- **Visibility rules follow the parent namespace** until a namespace's
  `ApplicationController` declares its own. One that extended `Controller`
  without declaring rules used to give its namespace none, so records the
  root's rules hide were visible there. **Do:** declare
  `static visibility = {};` where a namespace should see everything.
- New, opt-in: [visibility rules](docs/guides/controllers.md#visibility-rules),
  declared once per namespace, replace `super.index(request).where(…)`
  overrides and hooks that filter hidden records out of a response.
- New: [`maxPerPage`](docs/guides/controllers.md#reading-what-clients-may-ask-for)
  and the `rejectUnlisted*` properties above.

### Models

See [Models and queries](docs/guides/models.md).

- **New: `foreignKey`** sets a relationship's column when it doesn't follow
  the naming (`writer: { inverse: 'books', model: 'author', foreignKey:
  'written_by' }`). It was documented before but never read.
- **Relationships are checked at boot.** Each `inverse` must name a
  relationship on the related model that points back, of a kind that pairs
  with it, and each foreign key must be a column. A wrong one used to work
  until the first write that set the relationship, which failed with an
  unrelated-looking `500` (`Cannot destructure property 'type' of …`).
  **Do:** fix what the boot error lists. A relationship that never worked,
  such as a declared polymorphic one (`inverse: 'trackable'` with no
  `trackable` relationship on the other side), must be removed. `db:migrate`
  and `db:rollback` skip the check, so a migration adding a foreign key can
  still run.

- **Model hooks read inside their transaction.** Every query started from
  `Model.transacting(trx)` now runs in `trx` (`find`, `where`, `first`,
  `count`, scopes, included relationships); it used to forward only `create`.
  A hook's reads used to run on a second connection, so they couldn't see
  the write, and with a single connection (as SQLite now always has) the
  request hung until `Timeout acquiring a connection`. **Do:** read through the hook's
  `trx` (`Post.transacting(trx).find(comment.postId)`), and drop a `pool`
  raised only to avoid that hang.
- **A hook receives its record bound to the transaction.** In a hook,
  `await comment.post` and `comment.update({…})` run in the write's
  transaction. The record is a proxy of the instance being written:
  attributes read and assign as before, but `record === otherReference` is
  `false`. Compare primary keys instead. `record.transacting(trx)` binds
  relationship reads and `reload()` too.
- **Has-many-through writes work.** Writing `tags` through `categorizations`
  used to fail with a database error. A workaround that writes the join rows
  itself can go.
- **`ssl` applies with a database URL.** `DATABASE_URL`, or an environment's
  `url`, used to replace every connection setting in `config/database.js`,
  `ssl` included, so TLS could only be set in the URL or (for PostgreSQL)
  with `PGSSLMODE`. `ssl` is now applied on top of the URL, and may be the
  driver's TLS options (`{ rejectUnauthorized: false }`). A TLS setting in
  the URL itself still wins. **Check:** an app that sets `ssl` next to a URL
  now connects with it.
- **inflection 3:** `focus` pluralizes to `focuses` and singularizes to
  `focus` (it was `focu`). Only a model, table or relationship named after
  "focus" is affected.

### Logging

See [Logging](docs/guides/logging.md).

- **`logging.level` and `logging.format` are checked at boot.** Levels are
  `DEBUG`, `INFO`, `WARN` and `ERROR`, in uppercase; `level: 'info'` used to
  fall back to `DEBUG`, logging all SQL in production.
- **Only 5xx errors are logged as `ERROR`.** A 4xx is a one-line `DEBUG`
  message, so at `INFO` it doesn't appear apart from its request line.
  Adjust alerting that counted them.
- **The text request line changed** (`INFO  [8f1c2b9e] GET /posts 200 OK in
  2 ms by PostsController#index from …`), and each entry is one line off a
  terminal. Parse the JSON format, not text.
- **Production doesn't log request bodies.** Set
  `logging.requestBody: true` to keep logging them.
- **Parameters containing `password`, `secret` or `token` are always
  filtered**, matched by containment and ignoring case; `filter.params` adds
  to that list. The logged `path` no longer includes the query string.
- **SQL writes follow the database `debug` flag**, like reads, and SQL is
  logged as knex wrote it (it used to be uppercased, values included).
- **JSON lines** carry `durationMs`, `controller`, `action`, `requestId`, and
  an error's `name` and `stack`.
- New: [request ids](docs/guides/logging.md#request-ids),
  a context argument (`logger.info('Synced', { count: 2 })`),
  `logging.timestamps` and
  [`server.trustProxy`](docs/guides/logging.md#the-clients-address).

### The `lumen` CLI and generators

See [The `lumen` command](docs/guides/cli.md).

- **`lumen test` is gone.** It only printed "Coming Soon!". Drop
  `"test": "lumen test"` from `package.json` and use your own test runner.
- **Mistakes are errors**, with exit code `1`:

  | Invocation | 3.x | 4.0 |
  |---|---|---|
  | `lumen destroy model user` | did nothing (only `lumen d` worked) | destroys |
  | `lumen bogus` | exit 0, no output | an error, with a suggestion |
  | `lumen` | help, exit 0 | help, exit 1 |
  | `lumen new app --database oracle` (or `Postgres`) | a SQLite app | an error |
  | `-e`, `-p` or `--database` without a value | the value `true` | an error |
  | extra arguments (`lumen build now`) | ignored | an error |

- **Generated `belongsTo` relationships name the plural inverse.**
  `lumen generate model post user:belongs-to` used to write `inverse: 'post'`,
  and saving a post with a user failed with a `500`. Models generated
  earlier with that mistake now fail the boot (see [Models](#models)).
- **Generated migration versions sort by creation time.** Versions are now
  `YYYYMMDDHHmmssCC` in UTC. They used to mix the UTC date with the local
  time and drop digits, so a migration could run before the one creating its
  table. **Check** the order of the files in `db/migrate/`: rename a
  not-applied migration whose version sorts wrong. `lumen db:rollback` undoes
  the highest version, which may not be the newest migration.
- **`lumen destroy resource` undoes `generate resource`, namespaces
  included.** `destroy resource admin/tags` now also removes
  `app/models/tag.js` and its migration, which it used to leave behind. A
  model another namespace's resource still uses (`app/controllers/tags.js`)
  is kept, for a root resource too. `update app/routes.js` is printed only
  when the file changed.
- **`lumen new` names SQLite databases once.** It used to write
  `database: 'blog_dev'` (and `_test`, `_prod`), to which SQLite appends the
  environment again: `db/blog_dev_development.sqlite`. New apps get
  `database: 'blog'`, so `db/blog_development.sqlite`. Existing apps keep
  working as they are. **Optional:** set `database: 'blog'` for every
  environment in `config/database.js` and rename the files in `db/` to match.
- **`lumen db:create`, `db:drop` and `db:reset` work on PostgreSQL and
  MySQL.** They used to connect to the very database they create or drop,
  which failed. They now connect to the server (PostgreSQL's `postgres`
  database), quote the name, and on PostgreSQL 13+ drop a database that still
  has connections open. **Check:** scripts that create the database with
  `createdb` or `CREATE DATABASE` can use them instead.
- **`--use-weak` works in an app with a `tsconfig.json`.** A strict
  `tsconfig.json` above the app used to force strict mode.
- **`lumen serve` exits with code `1` when the app can't start** (a pending
  migration, an unreachable database, a broken route). It used to log the
  error, then "listening", and keep running with no worker. **Check:** a
  deploy that relied on the process staying up now fails, as it should.
- **`lumen serve` shuts down gracefully** on `SIGTERM` and `SIGINT`: workers
  stop accepting connections, finish the requests in flight, close their
  database connections and exit `0`. It used to exit at once, cutting off
  every request in flight on each deploy. A worker still busy after
  `server.shutdownTimeout` (new, default 8000 ms) is killed. Scripts and tests
  that construct an `Application` themselves can stop it the same way with
  the new `app.close()`.

### Types

Nothing to change. `lumen-framework` exports the types an app can name
(`Config`, `DatabaseConfig`, `LoggerConfig`, `RelationshipOptions`,
`ModelHooks`, `Visibility`, `BeforeAction`, `AfterAction`, `Request`,
`Response`, `Query` and more), listed in the API reference
(`pnpm docs:api`). Built-in actions declare their optional `response`
argument, so a TypeScript override can take it and pass it to `super`.

## From Lux or Lumen 2.x to 3.x

3.0 replaced the 2017-era toolchain (Node 6, Flow, Babel 6, Rollup) with
TypeScript and esbuild. The application API stayed the same; the build did
not.

- **Update the database driver.** `pg@7` never settles a connection on
  modern Node; knex reports it as
  `Timeout acquiring a connection. The pool is probably full`. Use `pg@8` and
  `mysql2@3`, and drop any server-side auth workarounds the old drivers
  needed.
- **Remove what the compiler ignores:** `.babelrc`, `babel-core`,
  `babel-preset-lux` and `source-map-support` (source maps are automatic).
- **App source must be plain JavaScript** that esbuild compiles: no Flow
  annotations, no Babel-only syntax such as legacy decorators. App files stay
  `.js`.
- **Installing the framework from git** needs a build step: see
  [Deployment](docs/guides/deployment.md#installing-lumen-from-git).

3.0.3 and 3.1 changed some responses:

- **Content negotiation follows JSON:API.** A request body whose
  `Content-Type` isn't exactly `application/vnd.api+json` is a `415` (it was
  a `400`). An `Accept` is a `406` only when every JSON:API entry in it has
  parameters.
- **Error statuses:** a client-generated id (`data.id` on `POST`) and a
  relationship the controller's `params` don't list are a `403`; a related
  resource that doesn't exist is a `404`; a failed model validation is a
  `422`; a unique constraint violation is a `409`. Error objects carry
  `source`, in every environment.
- **Compound documents follow JSON:API:** included resources carry
  `relationships`, nested `include` paths work up to `maxIncludeDepth`
  (default 3), included resources use the request's namespace's serializers,
  and primary resources are no longer repeated in `included`.
