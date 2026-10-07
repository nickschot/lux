# Getting started

This guide builds a small blog API — users who write posts — from an empty
directory to a running server, then walks through the requests it answers.
You will write no controller or serializer logic: everything here comes from
the files Lumen generates.

It takes about ten minutes. The finished API speaks
[JSON:API 1.0](https://jsonapi.org/format/1.0/), so any JSON:API client
(ember-data, orbit.js, …) can talk to it.

## Before you start

You need **Node.js 22.13 or later**:

```bash
node --version
```

Install the `lumen` command-line tool globally:

```bash
npm install -g lumen-framework
```

`lumen --help` lists every command, and `lumen <command> --help` the options
of one.

## Create a project

```bash
lumen new blog
```

This creates a `blog/` directory with the project skeleton, initializes a git
repository and installs the dependencies with npm. The project uses
**SQLite** unless you choose otherwise:

```bash
lumen new blog --database postgres
```

`--database` accepts `sqlite` (the default), `postgres` and `mysql`; the
matching driver (`sqlite3`, `pg` or `mysql2`) is added to `package.json`.

```bash
cd blog
```

## What's in the project

| Path | What it holds |
|---|---|
| `app/index.js` | The `Application` class. Usually left empty. |
| `app/routes.js` | The routes: which resources the API serves. |
| `app/models/` | One `Model` per database table: attributes come from the table, relationships are declared. |
| `app/controllers/` | One `Controller` per resource: which request members it accepts, and any action you override. |
| `app/serializers/` | One `Serializer` per resource: which attributes and relationships a response contains. |
| `config/environments/` | Per-environment settings: logging, CORS. `development.js` is used unless `NODE_ENV` says otherwise. |
| `config/database.js` | The database connection for each environment. |
| `db/migrate/` | Migrations, applied in order by `lumen db:migrate`. |
| `db/seed.js` | Sample data for `lumen db:seed`. |

`app/controllers/application.js` and `app/serializers/application.js` are the
base classes every other controller and serializer extends — the place for
behaviour shared by the whole API.

## Generate the resources

A *resource* is a model, its controller, its serializer, a migration for its
table and a route. `lumen generate resource` writes all five. Generate users,
who have many posts, and posts, which belong to a user:

```bash
lumen generate resource user name:string email:string posts:has-many
```

```bash
lumen generate resource post title:string body:text user:belongs-to
```

Each argument after the name is `name:type`. A type is either a column type
(`string`, `text`, `integer`, `boolean`, `date`, … — any
[Knex column type](https://knexjs.org/guide/schema-builder.html)) or a
relationship: `has-one`, `has-many` or `belongs-to`. A `belongs-to` also
adds the foreign key column (`user_id`) to the migration.

Here is what the second command wrote.

**The model**, `app/models/post.js`, declares the relationship. Attributes are
not listed: a model reads them from its table.

```javascript
import { Model } from 'lumen-framework';

class Post extends Model {
  static belongsTo = {
    user: {
      inverse: 'posts'
    }
  };
}

export default Post;
```

`inverse` names the relationship on the other side — `User`'s `posts`. The
generator assumes a `belongs-to` pairs with a `has-many`; if the other side is
a `has-one`, change it to the singular.

**The controller**, `app/controllers/posts.js`, lists the members a client
may send when it creates or updates a post. Everything else about reading and
writing posts is built in.

```javascript
import { Controller } from 'lumen-framework';

class PostsController extends Controller {
  params = [
    'title',
    'body',
    'user'
  ];
}

export default PostsController;
```

**The serializer**, `app/serializers/posts.js`, lists what a post looks like
in a response:

```javascript
import { Serializer } from 'lumen-framework';

class PostsSerializer extends Serializer {
  attributes = [
    'title',
    'body'
  ];

  hasOne = [
    'user'
  ];
}

export default PostsSerializer;
```

A `belongs-to` is serialized as a to-one relationship, so it goes under
`hasOne`.

**The route** was added to `app/routes.js`:

```javascript
export default function routes() {
  this.resource('users');
  this.resource('posts');
}
```

`this.resource('posts')` routes all of `GET /posts`, `GET /posts/:id`,
`POST /posts`, `PATCH /posts/:id` and `DELETE /posts/:id`, plus `HEAD` and
`OPTIONS`.

## Create the database

```bash
lumen db:migrate
```

This builds the app and applies the migrations in `db/migrate/`. With SQLite
the database is a file in `db/`, created on first use. With PostgreSQL or
MySQL, set the connection details in `config/database.js` and run
`lumen db:create` first.

## Start the server

```bash
lumen serve
```

The API listens on `http://localhost:4000`. `lumen serve --port 8080` picks
another port, and `lumen serve --hot` rebuilds and restarts when a file
changes. In development every request is logged with its SQL, parameters and
timing.

## Make some requests

JSON:API requests that carry a body must say so with the
`application/vnd.api+json` media type; a plain `application/json` request is
refused with `415 Unsupported Media Type`.

### Create a user

```bash
curl -X POST localhost:4000/users -H 'Content-Type: application/vnd.api+json' -d '{"data":{"type":"users","attributes":{"name":"Ada Lovelace","email":"ada@example.com"}}}'
```

The response is `201 Created`, with a `Location` header pointing at the new
user and the user itself:

```json
{
  "data": {
    "id": "1",
    "type": "users",
    "attributes": {
      "name": "Ada Lovelace",
      "email": "ada@example.com"
    },
    "relationships": {
      "posts": {
        "data": [],
        "links": {
          "self": "http://localhost:4000/users/1/relationships/posts",
          "related": "http://localhost:4000/users/1/posts"
        }
      }
    }
  },
  "links": {
    "self": "http://localhost:4000/users/1"
  },
  "jsonapi": {
    "version": "1.0"
  }
}
```

### Create a post that belongs to the user

The author goes in `relationships`, as a resource identifier:

```bash
curl -X POST localhost:4000/posts -H 'Content-Type: application/vnd.api+json' -d '{"data":{"type":"posts","attributes":{"title":"Hello, world","body":"My first post."},"relationships":{"user":{"data":{"type":"users","id":"1"}}}}}'
```

Create a second one the same way (say, titled "Another post") so the lists
below have something to sort and page.

### List posts with their authors

```bash
curl -g 'localhost:4000/posts?include=user&fields[posts]=title&fields[users]=name'
```

(`-g` stops curl from reading the square brackets as a pattern.)

- `include=user` adds each post's author to the response, under `included`.
- `fields[posts]=title` and `fields[users]=name` keep only those attributes
  — a *sparse fieldset*. Lumen selects only those columns from the database.

```json
{
  "data": [
    {
      "id": "1",
      "type": "posts",
      "attributes": { "title": "Hello, world" },
      "links": { "self": "http://localhost:4000/posts/1" }
    },
    {
      "id": "2",
      "type": "posts",
      "attributes": { "title": "Another post" },
      "links": { "self": "http://localhost:4000/posts/2" }
    }
  ],
  "included": [
    {
      "id": "1",
      "type": "users",
      "attributes": { "name": "Ada Lovelace" },
      "links": { "self": "http://localhost:4000/users/1" }
    }
  ],
  "meta": { "total": 2 },
  "links": {
    "self": "http://localhost:4000/posts?include=user&fields%5Bposts%5D=title&fields%5Busers%5D=name",
    "first": "http://localhost:4000/posts?include=user&fields%5Bposts%5D=title&fields%5Busers%5D=name",
    "last": "http://localhost:4000/posts?include=user&fields%5Bposts%5D=title&fields%5Busers%5D=name",
    "prev": null,
    "next": null
  },
  "jsonapi": { "version": "1.0" }
}
```

### Sort, filter and page

Every list takes the JSON:API query parameters:

| Parameter | Example | Effect |
|---|---|---|
| `sort` | `sort=-title` | Order by an attribute; `-` for descending. |
| `filter` | `filter[title]=Hello%20again,Third` | Only records whose attribute matches; a comma means *any of*. |
| `page` | `page[size]=10&page[number]=2` | Page through the results; `links` has `first`, `prev`, `next` and `last`. |
| `include` | `include=user` | Add related resources to the response. |
| `fields` | `fields[posts]=title` | Only these attributes, per type. |

```bash
curl -g 'localhost:4000/posts?page[size]=1'
```

`meta.total` counts all matching posts, and `links.next` is the URL of the
second page.

By default `sort` and `filter` accept any attribute the serializer outputs,
and `include` any relationship it outputs (up to three levels deep). Anything
else is a `400 Bad Request` that says what is allowed:

```bash
curl -g 'localhost:4000/posts?include=comments'
```

```json
{
  "errors": [
    {
      "status": "400",
      "title": "Bad Request",
      "source": { "parameter": "include" },
      "detail": "Expected value for parameter 'include' to be one of [user, user.posts, user.posts.user] but got comments."
    }
  ],
  "jsonapi": { "version": "1.0" }
}
```

### Follow a relationship

Every relationship in a response comes with two links, and both are real
endpoints:

```bash
curl -g 'localhost:4000/users/1/posts?sort=-title&fields[posts]=title'
```

The **related endpoint** returns the user's posts — sorted, filtered and
paged like `GET /posts`.

```bash
curl localhost:4000/posts/1/relationships/user
```

The **relationship endpoint** returns just the linkage:

```json
{
  "data": { "id": "1", "type": "users" },
  "links": {
    "self": "http://localhost:4000/posts/1/relationships/user",
    "related": "http://localhost:4000/posts/1/user"
  },
  "jsonapi": { "version": "1.0" }
}
```

### Update and delete

`PATCH` sends only what changes:

```bash
curl -X PATCH localhost:4000/posts/1 -H 'Content-Type: application/vnd.api+json' -d '{"data":{"id":"1","type":"posts","attributes":{"title":"Hello again"}}}'
```

The response is `200 OK` with the updated post.

```bash
curl -i -X DELETE localhost:4000/posts/2
```

The response is `204 No Content`. Asking for the post afterwards is a
`404 Not Found`, as a JSON:API error document:

```json
{
  "errors": [
    {
      "status": "404",
      "title": "Not Found",
      "detail": "Could not find Post with id 2."
    }
  ],
  "jsonapi": { "version": "1.0" }
}
```

## What you didn't write

The generated files are a few lines of declarations, and from them you got:

- create, read, update and delete for every resource, with `201`/`204`/`404`
  and a `Location` header where JSON:API asks for them;
- sorting, filtering and pagination, limited to what the serializer exposes;
- compound documents (`include`), with the database queries batched per
  relationship rather than one per record;
- sparse fieldsets, which also narrow the SQL `SELECT`;
- relationship and related endpoints for every relationship;
- JSON:API error documents for every failure, including unknown parameters,
  a wrong media type and unknown routes;
- request logging with SQL and timing in development.

## Next steps

- **[examples/social-network](../../examples/social-network/)** is a larger
  app with namespaces (`/admin`, `/members`), visibility rules, a serializer
  per namespace, custom actions and more. Its README maps each feature to the
  file that shows it.
- **[UPGRADING.md](../../UPGRADING.md)** describes routing, visibility rules,
  compound documents, relationship endpoints, error responses and logging in
  detail, until the guides on those topics are written.
- **The API reference**, built with `pnpm docs:api` in a checkout of the
  repository, documents every class and type `lumen-framework` exports.
