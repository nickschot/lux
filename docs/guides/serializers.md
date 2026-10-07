# Serializers and JSON:API

A serializer decides what a resource looks like in a response: which
attributes it has and which relationships it links to. Everything else about
the document — its JSON:API structure, links, `included` resources, sparse
fieldsets, pagination — Lumen builds from that declaration. A serializer also
decides what clients may ask for: by default, only what it outputs can be
sorted, filtered, included or selected.

This guide uses the blog from [Getting started](getting-started.md) and
examples from
[examples/social-network](../../examples/social-network/app/serializers/).

## The serializer file

`lumen generate resource post title:string body:text user:belongs-to` writes
`app/serializers/posts.js`:

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

The file name is the resource type, and the serializer is used wherever a
post appears in a response: as primary data, in `included`, and from related
endpoints.

## Attributes

`attributes` lists the model attributes a resource carries, by their
camelCase names in the model. In the document they are **dasherized**, as
JSON:API recommends:

```javascript
attributes = ['title', 'body', 'createdAt'];
```

```json
"attributes": {
  "title": "Hello, world",
  "body": "My first post.",
  "created-at": "2026-10-07T19:31:22.188Z"
}
```

Anything not listed stays out of every response — the way to keep a column
such as `passwordDigest` private. Lumen also selects only the listed columns
from the database.

Clients may send member names either way (`created-at` or `createdAt`) in
request bodies and in `sort`, `filter` and `fields`.

An attribute must be a **column** of the model's table. A getter or other
computed property listed in `attributes` is silently left out of the output
([#104](https://github.com/nickschot/lux/issues/104)); compute such values in
an `afterAction` hook or a custom action instead.

## Relationships

Relationships are listed by kind:

| Serializer list | Model relationships | In the document |
|---|---|---|
| `hasOne` | `belongsTo` and `hasOne` | `"data": { "type": "users", "id": "1" }`, or `null` |
| `hasMany` | `hasMany` (including through a join model) | `"data": [ { "type": "posts", "id": "1" }, … ]` |

```javascript
class UsersSerializer extends Serializer {
  attributes = ['name', 'email'];

  hasMany = ['posts', 'comments'];
}
```

Each relationship carries its **resource linkage** (`data`) and two links,
both served by the API (see [Routing](routing.md#relationship-and-related-endpoints)):

```json
"relationships": {
  "posts": {
    "data": [
      { "id": "1", "type": "posts" },
      { "id": "2", "type": "posts" }
    ],
    "links": {
      "self": "http://localhost:4000/users/1/relationships/posts",
      "related": "http://localhost:4000/users/1/posts"
    }
  }
}
```

Linkage respects [visibility rules](controllers.md#visibility-rules): a
to-one relationship to a record the request may not see is `null`, and a
to-many one leaves it out. A relationship not listed in the serializer is not
in the document, cannot be `include`d, and has no endpoints.

### Links only

A to-many relationship can be large. `linksOnly` serializes it **without its
linkage** — only the links — so the response stays small and the related ids
are not loaded at all:

```javascript
class UsersSerializer extends Serializer {
  hasMany = ['posts'];

  linksOnly = ['posts'];
}
```

```json
"posts": {
  "links": {
    "self": "http://localhost:4000/users/1/relationships/posts",
    "related": "http://localhost:4000/users/1/posts"
  }
}
```

Clients load the records from the `related` link, paged like an index;
ember-data does this by itself for an async `hasMany`. A request that
includes the relationship (`?include=posts`) still gets its `data`, since
every included resource must be linked from the document.

The names in `linksOnly` must be in `hasMany`, and the related endpoint must
exist (the related type routes `index`, this type routes `show`); otherwise
the app refuses to boot and says which name is wrong.

## The document

A response to `GET /posts?page[size]=1` has this shape:

```json
{
  "data": [
    {
      "id": "1",
      "type": "posts",
      "attributes": { "title": "Hello, world", "body": "My first post." },
      "relationships": {
        "user": {
          "data": { "id": "1", "type": "users" },
          "links": {
            "self": "http://localhost:4000/posts/1/relationships/user",
            "related": "http://localhost:4000/posts/1/user"
          }
        }
      },
      "links": { "self": "http://localhost:4000/posts/1" }
    }
  ],
  "meta": { "total": 2 },
  "links": {
    "self": "http://localhost:4000/posts?page%5Bsize%5D=1",
    "first": "http://localhost:4000/posts?page%5Bsize%5D=1",
    "last": "http://localhost:4000/posts?page%5Bsize%5D=1&page%5Bnumber%5D=2",
    "prev": null,
    "next": "http://localhost:4000/posts?page%5Bsize%5D=1&page%5Bnumber%5D=2"
  },
  "jsonapi": { "version": "1.0" }
}
```

- **`id`** is always a string, **`type`** the plural resource type.
- **`links.self`** of each resource is its URL in the request's namespace.
- **`meta.total`** (lists only) counts every matching record across all
  pages, after filters and visibility rules.
- The **page links** keep the request's query string as written; only
  `page[number]` changes between them.

## Compound documents: `include`

`?include=` adds related resources under `included`, each formatted by its
**own** type's serializer:

```bash
curl -g 'localhost:4000/posts/1?include=user.posts&fields[posts]=title,user&fields[users]=name'
```

- Paths may be **nested** (`user.posts`, `comments.reactions.user`), up to
  the controller's `maxIncludeDepth` (3 by default). The resources along the
  way are included too: `comments.user` includes the comments as well as
  their users.
- Each resource appears **once**: a resource that is already primary data is
  not repeated in `included`.
- Included resources carry their own `relationships`, so a client can follow
  linkage between them without further requests. Their linkage is loaded in
  one query per relationship per level, not one per record.
- The allowed paths are derived from the serializers: only relationships a
  serializer outputs can be followed. Anything else is a `400` listing the
  allowed paths.

## Sparse fieldsets: `fields`

`?fields[TYPE]=` narrows every resource of that type in the document —
primary data and `included` alike — to the named **attributes and
relationships**:

| Request | Result |
|---|---|
| `fields[posts]=title` | Posts with only a `title` attribute and **no** `relationships`. |
| `fields[posts]=title,user` | `title` plus the `user` relationship. |
| `fields[users]=` (empty) | Users with `"attributes": {}` and no relationships. |
| `fields[posts]=nope` | `400 Bad Request`: the fieldset may only name what the serializer outputs. |

A relationship left out of a fieldset can still be `include`d. The fieldset
also narrows the SQL: Lumen selects only the columns it needs.

## A serializer per namespace

A namespace uses its own serializer for a type when it has one —
`app/serializers/admin/users.js` for `/admin/users` — and the root one
otherwise. Extending the root serializer keeps the two in step:

```javascript
// app/serializers/admin/users.js
import UsersSerializer from '../users';

// Admins also see a user's email address and when they signed up.
class AdminUsersSerializer extends UsersSerializer {
  attributes = [...this.attributes, 'email', 'createdAt'];
}

export default AdminUsersSerializer;
```

Everything a request in the namespace returns uses the namespace's
serializers — including `included` resources of other types — and links
point into the namespace (`/admin/users/1`). The root serializer is a
fallback: a type the namespace has no serializer for is formatted with the
root one, with every attribute and relationship that one outputs. For a
namespace that must never expose more than it declares itself, turn the
fallback off on its `ApplicationController`:

```javascript
// app/controllers/admin/application.js
class AdminApplicationController extends ApplicationController {
  serializerFallback = false;
}
```

The app then refuses to boot until every type the namespace can return or
include has a serializer in `app/serializers/admin/`, and lists the missing
ones.

## Request documents

Lumen enforces the JSON:API rules for what clients send:

| The request | The response |
|---|---|
| A body without `Content-Type: application/vnd.api+json`, or with any media type parameter | `415 Unsupported Media Type` |
| `Accept` where every `application/vnd.api+json` entry has parameters | `406 Not Acceptable` (an `Accept` without the JSON:API type, such as `*/*`, is fine) |
| `data.type` that is not the resource's type | `409 Conflict` |
| `data.id` on `PATCH` that does not match the URL | `409 Conflict` |
| `data.id` on `POST` (a client-generated id) | `403 Forbidden` — ids are always generated by the database |
| A malformed body, or a to-many linkage element without `type` and `id` | `400 Bad Request` with a `source.pointer` |

Member names in a body may be dasherized or camelCase. Values arrive as
sent: strings stay strings (a date column parses ISO 8601 strings; nothing
else does), and ids in resource linkage are strings, converted to the
primary key's column type.

Every error response is a JSON:API error document, and several problems with
one request are reported together:

```json
{
  "errors": [
    {
      "status": "409",
      "title": "Conflict",
      "source": { "pointer": "/data/type" },
      "detail": "Expected 'posts' for parameter 'data.type' but got 'users'."
    },
    {
      "status": "400",
      "title": "Bad Request",
      "source": { "pointer": "/data/attributes/name" },
      "detail": "'data.attributes.name' is not a valid parameter for this resource."
    }
  ],
  "jsonapi": { "version": "1.0" }
}
```
