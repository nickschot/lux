# Lumen

[![CI](https://github.com/nickschot/lux/actions/workflows/ci.yml/badge.svg)](https://github.com/nickschot/lux/actions/workflows/ci.yml) [![npm](https://img.shields.io/npm/v/lumen-framework.svg?style=flat-square)](https://www.npmjs.com/package/lumen-framework)

An MVC-style Node.js framework for building [JSON:API 1.0](https://jsonapi.org/)
compliant REST APIs with very little code. Controllers get create, read, update
and delete for free — including pagination, sorting, filtering, sparse
fieldsets and compound documents — and the ORM sits on top of
[Knex](https://knexjs.org/).

```javascript
import { Controller } from 'lumen-framework';

class PostsController extends Controller {
  params = ['title', 'body'];
}

export default PostsController;
```

That controller, a model and a serializer are a complete `/posts` resource:
`GET /posts?sort=-title&page[size]=10&fields[posts]=title`, `GET /posts/1`,
`POST`, `PATCH` and `DELETE` all work.

## Features

- Automatic CRUD actions in controllers, overridable one at a time
- Pagination, sorting and filtering from query params, limited to the fields
  you allow
- JSON:API compound documents (`?include=`), sparse fieldsets, relationship
  and related endpoints
- Visibility rules declared once per namespace and applied to every query a
  request makes — listings, lookups, relationships and includes
- Database queries shaped by what the serializer actually outputs
- Structured request logging (JSON or plain text) with credential filtering
- A CLI that generates models, controllers, serializers, migrations and whole
  resources
- Written in TypeScript; type declarations ship with the package
- SQLite, PostgreSQL and MySQL via Knex

## Requirements

- Node.js **22.13** or later
- One of `sqlite3`, `pg` or `mysql2` (`lumen new` adds the one you pick)

## Getting started

```bash
npm install -g lumen-framework
```

```bash
lumen new blog
```

```bash
cd blog
```

```bash
lumen generate resource post title:string body:text
```

```bash
lumen db:migrate
```

```bash
lumen serve
```

The API is now on `http://localhost:4000`:

```bash
curl -X POST localhost:4000/posts -H 'Content-Type: application/vnd.api+json' -d '{"data":{"type":"posts","attributes":{"title":"Hello","body":"First post"}}}'
```

`lumen new --database postgres` (or `mysql`) starts a project on another
database; `lumen --help` and `lumen <command> --help` list every command and
option.

## Documentation

- [UPGRADING.md](UPGRADING.md) — what changes for apps moving to Lumen 4.0,
  and how to adapt. Until the guides land, it is also the most complete
  description of routing, visibility rules, compound documents, relationship
  endpoints, error responses and logging.
- [CHANGELOG.md](CHANGELOG.md) — release notes.
- [examples/social-network](examples/social-network/) — an example app that
  uses most of the framework, with a map of where each feature lives.

User guides and a generated API reference are in progress.

## Contributing

```bash
pnpm install
```

```bash
pnpm build && pnpm test
```

The test suite needs the fixture app's dependencies
(`pnpm --dir test/test-app install`) and builds a SQLite database on first
run. [RELEASE.md](RELEASE.md) describes how releases are cut.

## Attribution

Lumen is a fork of [**Lux**](https://github.com/postlight/lux), created by
[Zachary Golba](https://github.com/zacharygolba) and originally developed and maintained by
[Postlight](https://postlight.com/). Essentially all of the framework's design — the
convention-over-configuration approach, the automatic CRUD controllers, the JSON:API
serialization, the ORM built on Knex — is their work.

Upstream development stopped after `v1.2.3` (2018). This fork picks it up from there: it
was renamed to Lumen to avoid confusion with the original, since it is no longer a
drop-in continuation of it — the toolchain has been modernized (TypeScript, esbuild,
Vitest, Node 22+) and the public API has been allowed to change. Lumen is **not** an
official Postlight project, and the Postlight team provides no support for it.

The original is MIT licensed, and Lumen remains MIT licensed under the same terms. The
original copyright notice is retained in [LICENSE](./LICENSE) alongside that of this
fork's contributors.

*   Original repository: [postlight/lux](https://github.com/postlight/lux)
*   Original announcement: [Not Another Node.js Framework](https://trackchanges.postlight.com/not-another-node-js-framework-33103ebeedf8)
