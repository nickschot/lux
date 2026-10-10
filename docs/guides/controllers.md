# Controllers

A controller handles the requests for one resource. Most of what it does is
built in — reading, creating, updating and deleting records, with sorting,
filtering, paging, includes and sparse fieldsets — so a controller is mostly
**configuration**: which request members it accepts, what it lets clients sort
and filter on, and which records a request may see. When the built-ins are not
enough, you override an action or add your own.

This guide uses the blog from [Getting started](getting-started.md) and the
routes from [Routing](routing.md). Larger examples come from
[examples/social-network](../../examples/social-network/app/controllers/).

## The controller file

`lumen generate resource post …` writes `app/controllers/posts.js`:

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

The file name is the resource type (`posts`), and the class finds its model
(`Post`) and serializer (`PostsSerializer`) by that name.

Resource controllers extend **`Controller`**, as generated. What the
application controller declares — hooks, visibility rules and the
namespace-wide settings — reaches every controller in its namespace without
inheritance (see [Hooks](#hooks), [Visibility rules](#visibility-rules) and
[Namespace-wide settings](#namespace-wide-settings)).

## Accepting writes: `params`

`params` lists the attributes and relationships a client may set with
`POST` and `PATCH`. For anything else in the request body:

| The body contains | Default response | Setting |
|---|---|---|
| An attribute the model has, not in `params` (e.g. `createdAt`) | Ignored: dropped from the request, the write goes ahead | `rejectUnlistedAttributes = true` makes it a `403 Forbidden` |
| A relationship the model has, not in `params` | `403 Forbidden` | `rejectUnlistedRelationships = false` ignores it instead |
| A member the model does not have at all | `400 Bad Request` | — |

The defaults suit clients like ember-data, which send every attribute back on
save, read-only ones included. A rejected member is reported with a pointer to
it:

```json
{
  "errors": [
    {
      "status": "403",
      "title": "Forbidden",
      "source": { "pointer": "/data/relationships/posts" },
      "detail": "Setting 'data.relationships.posts' is not supported for this resource."
    }
  ],
  "jsonapi": { "version": "1.0" }
}
```

## Reading: what clients may ask for

| Property | Default | Controls |
|---|---|---|
| `sort` | every attribute the serializer outputs | The values `?sort=` accepts (each also with `-` for descending). |
| `filter` | every attribute the serializer outputs | The keys `?filter[…]=` accepts. |
| `defaultPerPage` | `25` | The page size when the request gives none. |
| `maxPerPage` | `100` | The largest `?page[size]=`; a larger one is a `400`. |
| `maxIncludeDepth` | `3` | How deep an `?include=` path may go (`comments.user` is 2). |
| `query` | `[]` | Extra query parameters an action may read, beyond the JSON:API ones. |

Anything outside these lists is a `400 Bad Request` naming the parameter, so
a typo never silently returns the wrong data. Narrow `sort` and `filter` to
what the database can do cheaply:

```javascript
class PostsController extends Controller {
  sort = ['title', 'createdAt'];
  filter = ['title'];
  maxPerPage = 50;
}
```

`query` lets an action read a parameter of its own. It arrives in
`request.params`:

```javascript
class PostsController extends Controller {
  query = ['search'];

  index(request, response) {
    const { search } = request.params;
    const posts = super.index(request, response);

    return search ? posts.where({ body: search }) : posts;
  }
}
```

Without `query = ['search']`, `GET /posts?search=…` is a `400`.

## Overriding a built-in action

`index` and `show` return a `Query`, so an override can call `super` and
narrow it — keeping sorting, filtering, paging, includes and fieldsets:

```javascript
class PostsController extends Controller {
  index(request, response) {
    return super.index(request, response).where({ isPublic: true });
  }
}
```

This narrows **only** `GET /posts`. The other posts are still served by
`GET /posts/:id`, in a user's `posts`, and in `?include=posts`. To keep
records from a request everywhere, use a [visibility rule](#visibility-rules).

The other built-ins are `create`, `update` and `destroy`. Each action is
called with `(request, response)`; see the `Controller` page of the API
reference for what each returns.

## Custom actions

A custom action is a method, routed by a `collection`, `member` or plain route
(see [Routing](routing.md#custom-routes)). Building on a built-in action is
usually simplest:

```javascript
class PostsController extends Controller {
  // GET /posts/mine — a collection route
  mine(request) {
    return this.index(request).where({ userId: request.currentUser.id });
  }
}
```

### What an action's return value becomes

An action may return a value or a promise of one:

| The action returns | The response |
|---|---|
| A `Query`, a model, or an array of models | A JSON:API document, formatted by the serializer. |
| An object or array | That value as JSON. |
| A string | That string as the body, as `text/plain` unless the action set a `Content-Type` (`response.setHeader('Content-Type', 'text/csv')`). |
| A number | That status code: an empty body for a success, a JSON:API error document for an error (`403` → `Forbidden`). |
| `true` | `204 No Content`. |
| `false` | `401 Unauthorized`. |
| `undefined` (nothing) | `404 Not Found`. |

To report a problem, return the status (`return 403;`) or throw: any error
becomes a JSON:API error document, a `500` unless it carries a status.

## The request and the response

The `request` an action receives carries:

| Property | Holds |
|---|---|
| `request.params` | The parsed, validated parameters: `id`, `data` (the body), `sort`, `filter`, `page`, `include`, `fields`, and any listed in `query`. |
| `request.headers` | The headers, as a **`Map`**: `request.headers.get('authorization')`. |
| `request.method` | `'GET'`, `'POST'`, … |
| `request.action` | The action's name (`'index'`, `'mine'`). |
| `request.url` | The parsed URL (`pathname`, `query`, …). |
| `request.id` | The request id, also sent as `X-Request-Id` and logged. |

Hooks may add their own properties — the common one is the signed-in user,
`request.currentUser` (see below).

The `response` is Node's response object. Use it for headers, or the status
of a response the return value does not decide:

```javascript
status(request, response) {
  response.setHeader('Cache-Control', 'max-age=60');
  return this.show(request);
}
```

## Hooks

`beforeAction` and `afterAction` are arrays of functions that run around
every action of a controller.

A **`beforeAction`** hook receives `(request, response)`. Returning nothing
lets the request continue; returning anything else **ends** it, with that
value as the response, using the same table as actions (`false` → `401`, a
number → that status). That makes it the place for authentication:

```javascript
// app/middleware/authenticate.js
import User from '../models/user';

export default async function authenticate(request) {
  const token = request.headers.get('authorization');

  if (token) {
    // `findByToken` stands for however your app looks up a user.
    request.currentUser = await User.findByToken(token);
  }
}
```

An **`afterAction`** hook receives `(request, response, payload)`, where
`payload` is the action's result — for a resource, the JSON:API document
about to be sent. Return it, changed or not; what you return is sent:

```javascript
async function addVersion(request, response, payload) {
  if (payload && payload.jsonapi) {
    return { ...payload, meta: { ...payload.meta, apiVersion: '2' } };
  }

  return payload;
}
```

Use `function`, not an arrow function, when a hook needs `this` (the
controller).

### Where hooks run

Hooks declared on a namespace's `ApplicationController` run around **every
action in that namespace**, before the controller's own:

1. the namespace `ApplicationController`'s `beforeAction` hooks;
2. the controller's `beforeAction` hooks;
3. the action;
4. the controller's `afterAction` hooks;
5. the namespace `ApplicationController`'s `afterAction` hooks.

So authentication for the whole API goes on `app/controllers/application.js`:

```javascript
import { Controller } from 'lumen-framework';

import authenticate from '../middleware/authenticate';

class ApplicationController extends Controller {
  beforeAction = [authenticate];
}

export default ApplicationController;
```

A nested namespace's `ApplicationController` adds its hooks inside its parent
namespace's in the same way. If it **extends** the parent's class instead
(`AdminApplicationController extends ApplicationController`, usually to build
on `super.visibility`), it already has the parent's hooks as inherited class
fields, so they are not added a second time — its arrays are the namespace's
hooks, like any subclass's:

```javascript
// app/controllers/admin/application.js
import ApplicationController from '../application';

import requireAdmin from '../../middleware/require-admin';

class AdminApplicationController extends ApplicationController {
  // Keeps the root's hooks; `beforeAction = [requireAdmin]` would replace them.
  beforeAction = [...this.beforeAction, requireAdmin];
}

export default AdminApplicationController;
```

A namespace without an `ApplicationController` of its own (controllers in
`app/controllers/admin/`, but no `admin/application.js`) runs its closest
ancestor namespace's hooks, so the root's authentication still applies there.

Hooks run after the request's parameters are validated, so a request rejected
with a `400` never reaches them.

### Connect-style middleware

`lumenify` wraps middleware written as `(req, res, next)` — the Express and
Connect convention — as a `beforeAction` hook:

```javascript
import { Controller, lumenify } from 'lumen-framework';

function poweredBy(req, res, next) {
  res.setHeader('X-Powered-By', 'lumen');
  next();
}

class ApplicationController extends Controller {
  beforeAction = [lumenify(poweredBy)];
}
```

`next(error)` ends the request with that error; ending the response in the
middleware ends the request too.

## Visibility rules

A visibility rule decides, once, which records of a type a request may see —
and Lumen applies it to **every** query it makes for that request: lists,
lookups by id, relationship linkage, related endpoints, `include`d resources
at any depth, and the related records a `create` or `update` refers to.

Rules are declared on a namespace's `ApplicationController`, as a static
`visibility` object keyed by type. Each rule receives a query of that type and
the request, and returns the query narrowed:

```javascript
// app/controllers/application.js
class ApplicationController extends Controller {
  beforeAction = [authenticate];

  static visibility = {
    posts: (query, request) =>
      request.currentUser ? query : query.where({ isPublic: true })
  };
}
```

With that rule, for a request without a signed-in user:

- `GET /posts` lists only public posts, and its `meta.total` and page links
  count only those;
- `GET /posts/7`, for a private post, is a `404 Not Found` — as if it did not
  exist;
- a user's `posts` linkage, `GET /users/1/posts` and `?include=posts` leave
  private posts out; a comment's `post` that is private serializes as `null`;
- creating a comment on a private post fails as if the post did not exist.

Rules must be **synchronous** and may only **add conditions** — `where`,
`not`, `whereBetween`, `whereRaw`, or model scopes built from them. Anything a
rule needs (the current user, their team) is loaded in a `beforeAction` hook
and read from the request.

### Per namespace

A nested namespace follows its parent namespace's rules until its
`ApplicationController` declares its own — also when the namespace has no
`ApplicationController`, or one that extends `Controller` only to add a hook.
Declaring rules replaces the parent's; to build on them, extend the parent's
class and use `super`. The example app hides private posts everywhere, shows
everything to admins, and hides more from members:

```javascript
// app/controllers/admin/application.js
class AdminApplicationController extends ApplicationController {
  static visibility = {}; // admins see everything
}
```

```javascript
// app/controllers/members/application.js
class MembersApplicationController extends ApplicationController {
  static visibility = {
    ...super.visibility,

    comments: query => query.whereRaw(
      'comments.post_id IN (SELECT id FROM posts WHERE is_public = ?)',
      [true]
    )
  };
}
```

Declaring `visibility` on any other controller is a boot error: a type can be
included from any controller in the namespace, so its rule must hold for the
whole namespace.

### Queries you build yourself

Rules apply to the queries Lumen makes. A custom action that builds its own —
`Post.where(…)`, or `await post.comments` — gets no rule applied. Pass it
through `visible()`:

```javascript
class PostsController extends Controller {
  drafts(request) {
    return this.visible(Post.where({ isPublic: false }), request);
  }
}
```

Building on `this.index(request)` or `this.show(request)` applies the rules
already.

### Rules and model scopes

A model scope (`static scopes` on a model) is a reusable piece of a query,
applied where code calls it. A visibility rule is an access policy, applied
to every query for the request. They compose — a rule is often written with a
scope:

```javascript
static visibility = {
  posts: query => query.isPublic()
};
```

## Namespace-wide settings

Some settings are read from a namespace's `ApplicationController` and apply to
every controller in it — and in namespaces nested in it — unless a controller
sets its own:

| Setting | Default | Effect |
|---|---|---|
| `rejectUnlistedAttributes` | `false` | `403` for an attribute not in `params`, instead of ignoring it. |
| `rejectUnlistedRelationships` | `true` | `403` for a relationship not in `params`; `false` ignores it. |
| `maxIncludeDepth` | `3` | How deep `?include=` may go. |

One more applies to its own namespace only, not to nested ones:
`serializerFallback` (default `true`) says whether the namespace may use the
root serializer for a type it has none for. `false` makes the app refuse to
boot until every type the namespace can return has a serializer in it.

```javascript
// app/controllers/application.js
class ApplicationController extends Controller {
  rejectUnlistedRelationships = false; // ember-data sends every belongsTo back
  maxIncludeDepth = 2;
}
```
