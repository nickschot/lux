# Routing

Routes decide which URLs the API answers and which controller action handles
each one. They live in one file, `app/routes.js`, which exports a function;
inside it, `this` offers `resource`, `namespace` and the HTTP methods.

```javascript
export default function routes() {
  this.resource('users');
  this.resource('posts');
}
```

This guide uses the blog from [Getting started](getting-started.md) (users
and posts) and, for larger examples,
[examples/social-network](../../examples/social-network/app/routes.js).

## Resources

`this.resource('posts')` routes the five JSON:API actions to
`app/controllers/posts.js`:

| Method | Path | Action | Response |
|---|---|---|---|
| `GET` | `/posts` | `index` | A page of posts. |
| `GET` | `/posts/:id` | `show` | One post, or `404`. |
| `POST` | `/posts` | `create` | `201` with the new post and a `Location` header. |
| `PATCH` | `/posts/:id` | `update` | `200` with the post, or `204` when nothing changed. |
| `DELETE` | `/posts/:id` | `destroy` | `204`. |

Every path also answers:

- **`HEAD`**, which runs the `GET` action and sends its status and headers
  without a body;
- **`OPTIONS`**, with an `Allow` header listing the path's methods;
- any other method with **`405 Method Not Allowed`** and the same `Allow`
  header.

The name is the plural resource type, and it must match a controller: a
resource without `app/controllers/posts.js` stops the app at boot with
`Could not resolve controller by name 'posts'`. The model (`app/models/post.js`)
and serializer (`app/serializers/posts.js`) are found by the same name.

### Ids

If the model's primary key is an integer column, `:id` matches only integers:
`GET /posts/abc` is a `404`. A model with a string primary key (a uuid, a
slug) accepts any path segment as its id, percent-decoded, and the controller
receives it as a string.

### Limiting the actions

`only` keeps a subset of the actions:

```javascript
this.resource('notifications', {
  only: ['index', 'show']
});
```

`POST /notifications` is then a `405`, not a `404` — the path exists, the
method does not. `only: []` routes none of them, for a resource that has only
custom routes (see below).

## Relationship and related endpoints

For each relationship its serializer outputs, a resource also serves two
read-only endpoints. With `PostsSerializer` outputting `user` (to-one) and
`UsersSerializer` outputting `posts` (to-many):

| Path | Returns |
|---|---|
| `GET /posts/:id/relationships/user` | The **linkage**: `{ "type": "users", "id": "1" }`, or `null`. |
| `GET /posts/:id/user` | The **related** user itself, or `null`. |
| `GET /users/:id/relationships/posts` | The linkage of all the user's posts. |
| `GET /users/:id/posts` | The user's posts — sorted, filtered and paged like `GET /posts`. |

Every relationship in a response links to both (`links.self` and
`links.related`). Writing to them is a `405`; relationships are changed by
`PATCH`ing the resource.

A related endpoint is served by the related type's controller and serializer,
so `GET /users/1/posts` takes `PostsController`'s `sort`, `filter`, page size
and `include` rules. It only exists where the related type has a resource
with the matching action (`index` for to-many, `show` for to-one).

The `relationships` option narrows these endpoints to the relationships you
name, or turns them off:

```javascript
this.resource('posts', { relationships: ['user'] });
this.resource('users', { relationships: false });
```

A relationship left out keeps its linkage in documents and can still be
`include`d; it just has no endpoints and no links.

## Custom routes

Inside a resource, `member` and `collection` add routes that behave like the
built-in ones:

```javascript
this.resource('posts', function () {
  this.collection(function () {
    this.get('drafts');
  });

  this.member(function () {
    this.get('preview');
    this.post('publish');
  });
});
```

| Route | Path | Calls |
|---|---|---|
| `collection` → `get('drafts')` | `GET /posts/drafts` | `PostsController#drafts` |
| `member` → `get('preview')` | `GET /posts/:id/preview` | `PostsController#preview` |
| `member` → `post('publish')` | `POST /posts/:id/publish` | `PostsController#publish` |

A **collection** route takes the query parameters of `index` (`sort`,
`filter`, `page`, `include`, `fields`); a **member** route those of `show`,
plus the `:id`. Whatever the action returns — a `Query`, a model, an array of
models — is serialized like a built-in response. The easiest way to write one
is to start from the built-in action and narrow it (this assumes posts have
an `isPublic` column, as in the example app):

```javascript
class PostsController extends Controller {
  drafts(request) {
    return this.index(request).where({ isPublic: false });
  }

  preview(request) {
    return this.show(request);
  }

  async publish(request) {
    const post = await this.show(request);

    return post.update({ isPublic: true });
  }
}
```

A `POST` or `PATCH` member or collection route expects a JSON:API document
as its body, like `create` and `update`; an empty body is a `400`.

The methods available are `get`, `post`, `patch` and `delete`. `HEAD`,
`OPTIONS` and `405` are handled for custom routes too.

### Action names

The action is the route's name **exactly as written**. `this.get('top-rated')`
calls a method named `'top-rated'`, not `topRated`. Pass the action as the
second argument when they differ:

```javascript
this.collection(function () {
  this.get('top-rated', 'topRated');
});
```

### Plain routes

`this.get('stats')` directly inside a resource — not in `member` or
`collection` — adds `GET /posts/stats` as a **plain** route. A plain route
gets no query parameters and its result is sent as is, not serialized:

```javascript
class PostsController extends Controller {
  stats() {
    return Post.count().then(count => ({ count }));
  }
}
```

```json
{ "count": 2 }
```

Use plain routes for responses that are not JSON:API resources. Returning
models from one, or calling `this.index(request)` in it, does not work (the
models are not serialized, and the built-in actions need the query
parameters a plain route does not have) — use a `collection` or `member`
route instead.

A plain route at the top level is handled by the application controller:

```javascript
export default function routes() {
  this.get('health'); // ApplicationController#health
}
```

What an action's return value becomes — a number is a status code, `true` a
`204`, a string the body — is covered in
[Controllers](controllers.md#what-an-actions-return-value-becomes).

## Namespaces

A namespace serves resources under a path prefix, with its own controllers
and, optionally, its own serializers:

```javascript
export default function routes() {
  this.resource('posts');

  this.namespace('admin', function () {
    this.resource('posts');
    this.resource('users');
  });
}
```

`GET /admin/posts` is handled by `app/controllers/admin/posts.js`. A
namespace needs:

- **`app/controllers/admin/application.js`** — the namespace's base
  controller. Without it the app stops at boot with
  `Could not resolve controller by name 'admin/application'`.
- **a controller for each resource** in it, under `app/controllers/admin/`.

Serializers are optional: a namespace without `app/serializers/admin/posts.js`
uses the root `PostsSerializer`. A namespaced serializer is how one API shows
more (or less) of a resource than another — in the example app, admins see a
user's email and members don't.

A namespaced controller usually extends the root one, so it inherits its
`params` and custom actions:

```javascript
// app/controllers/admin/posts.js
import PostsController from '../posts';

class AdminPostsController extends PostsController {
  params = [...this.params, 'isPublic'];
}

export default AdminPostsController;
```

The `beforeAction` and `afterAction` hooks of the namespace's
`ApplicationController` run around every action in the namespace, which makes
it the place to require an admin login.

Namespaces are separate APIs. A namespace serves only the resources listed
inside it — `/admin/health` is a `404` even if `/health` exists — and
everything a request in it returns stays in it: included resources use the
namespace's serializers, and links point into the namespace. Namespaces can
nest (`this.namespace('v2', …)` inside another), giving `/api/v2/posts`.

**Visibility rules** build on this: a namespace's `ApplicationController` can
declare which records each request may see, and every query in that
namespace — lists, lookups, relationships, includes — applies them. The
example app hides private posts everywhere except `/admin`. See
[Controllers → Visibility rules](controllers.md#visibility-rules).

## A complete example

The routes of [examples/social-network](../../examples/social-network/app/routes.js),
abridged:

```javascript
export default function routes() {
  this.resource('actions', {
    only: ['show', 'index']
  });

  this.resource('comments');

  this.resource('friendships', {
    only: ['create', 'destroy']
  });

  this.resource('posts');

  // POST /users/login => UsersController#login
  this.resource('users', function () {
    this.collection(function () {
      this.post('login');
    });
  });

  // /admin/* sees everything, with its own controllers and serializers.
  this.namespace('admin', function () {
    this.resource('comments');
    this.resource('posts');
    this.resource('users');
  });

  // /members/* is a narrower API with stricter visibility rules.
  this.namespace('members', function () {
    this.resource('comments');
    this.resource('posts');
    this.resource('users', {
      only: ['show', 'index']
    });
  });
}
```
