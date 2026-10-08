# social-network

A Lumen example application: users who write posts, comment, react, and follow
each other. It is small enough to read in one sitting and covers most of what
the framework does:

| Feature | Where to look |
|---|---|
| Models, relationships (including has-many-through) and hooks | `app/models/` (`post.js`, `user.js`, `action.js`) |
| Model scopes | `Post.scopes.isPublic` in `app/models/post.js` |
| Built-in CRUD, write allow-lists, narrowed `sort`/`filter`, `maxPerPage` | `app/controllers/posts.js` |
| A custom action | `login` in `app/controllers/users.js`, routed in `app/routes.js` |
| Namespaces (`/admin`, `/members`) | `app/routes.js`, `app/controllers/{admin,members}/` |
| Visibility rules: private posts never leave `/admin` | `app/controllers/application.js`, `admin/application.js`, `members/application.js` |
| A serializer per namespace | `app/serializers/admin/users.js`, `admin/posts.js` |
| `linksOnly` relationships | `app/serializers/members/posts.js` |
| Rejecting unlisted attributes | `app/controllers/admin/posts.js` |
| CORS and per-environment logging | `config/environments/` |
| Migrations and seed data | `db/` |

Relationship endpoints (`/posts/1/relationships/user`), related endpoints
(`/posts/1/comments`), compound documents (`?include=user,comments`) and
sparse fieldsets (`?fields[posts]=title`) need no code: every resource serves
them.

## Running it

The example lives in the Lumen repository and depends on the framework there
(`"lumen-framework": "link:../.."`), so build the framework first. In your own
app, depend on a released version instead.

```bash
pnpm install && pnpm build
```

```bash
cd examples/social-network && pnpm install
```

```bash
pnpm run db:setup
```

```bash
pnpm start
```

The API is on `http://localhost:4000` — try
`/posts?include=user&fields[posts]=title`, `/members/posts`, or
`/admin/posts` to see the private posts the others hide.

`pnpm run db:setup` resets, migrates and seeds the SQLite database with random
data; run it again for a clean slate. `pnpm run smoke` boots the app and checks
a set of representative requests — CI runs it on every change to the framework.
