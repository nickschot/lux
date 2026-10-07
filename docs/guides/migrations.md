# Migrations and seeds

The database schema is built by **migrations** — small files in
`db/migrate/`, applied in order and recorded so each runs once — and filled
with sample data by a **seed**, `db/seed.js`. Both are run with the `lumen`
command, and both use [Knex](https://knexjs.org/)'s schema builder and the
app's own models.

## Migrations

### Creating one

`lumen generate model` and `lumen generate resource` write a migration that
creates the model's table. For any other change, generate an empty one:

```bash
lumen generate migration add-published-at-to-posts
```

```
create db/migrate/2026100720143375-add-published-at-to-posts.js
```

The number is the migration's **version**: the UTC time it was generated
(`YYYYMMDDHHmmss` plus hundredths of a second). Migrations run in version
order, so a migration always runs after the ones generated before it.

### Writing one

A migration exports `up`, which makes the change, and `down`, which undoes
it. Each receives Knex's
[schema builder](https://knexjs.org/guide/schema-builder.html) and returns
its promise:

```javascript
// db/migrate/2026100720143375-add-published-at-to-posts.js
export function up(schema) {
  return schema.alterTable('posts', table => {
    table.datetime('published_at').index();
  });
}

export function down(schema) {
  return schema.alterTable('posts', table => {
    table.dropColumn('published_at');
  });
}
```

Column names are snake_case in migrations (`published_at`) and camelCase on
models (`post.publishedAt`). A generated table migration shows the
conventions:

```javascript
export function up(schema) {
  return schema.createTable('posts', table => {
    table.increments('id');
    table.string('title');
    table.text('body');
    table.integer('user_id').index();   // a belongs-to's foreign key
    table.timestamps();                  // created_at, updated_at

    table.index('created_at');
    table.index('updated_at');
  });
}

export function down(schema) {
  return schema.dropTable('posts');
}
```

A few things to keep in mind:

- **Index foreign keys and the columns clients sort or filter on** — every
  listed `sort` and `filter` attribute becomes an `ORDER BY` or `WHERE`.
- **Add a unique index where a value must be unique** (`table.unique(['email'])`):
  a violation is answered with `409 Conflict`, which a check in code can't
  guarantee under concurrent requests.
- **Never edit a migration that has run anywhere else**: it won't run again
  there. Add a new one.

### Running them

| Command | Does |
|---|---|
| `lumen db:migrate` | Applies every pending migration, in version order, printing the SQL. |
| `lumen db:rollback` | Runs `down` of the most recent migration, and forgets it. Run again to go back further. |

Applied migrations are recorded by version in a `migrations` table.

**The app refuses to start while a migration is pending:**

```
ERROR Error: The following migrations are pending 2026100720143375-add-published-at-to-posts.
Please run lumen db:migrate before starting your application.
```

## Seeds

`db/seed.js` exports a function that fills the database with data to develop
against. It runs **in one transaction** — passed as its argument — so a
failure leaves nothing half-seeded. Create records through
`Model.transacting(trx)`:

```javascript
// db/seed.js
import User from '../app/models/user';
import Post from '../app/models/post';

export default async function seed(trx) {
  const ada = await User.transacting(trx).create({
    name: 'Ada Lovelace',
    email: 'ada@example.com'
  });

  await Promise.all(
    ['Hello, world', 'Notes on the engine'].map(title =>
      Post.transacting(trx).create({
        title,
        body: 'Seeded.',
        userId: ada.id,
        publishedAt: new Date()
      })
    )
  );
}
```

```bash
lumen db:seed
```

Model hooks run for seeded records as for any other, inside the same
transaction. A seed is **not idempotent**: running it twice inserts
everything twice. Start from an empty database with `db:reset` (below) when
you want a clean slate. For lots of realistic data,
[`@faker-js/faker`](https://fakerjs.dev/) works well; the
[example app's seed](../../examples/social-network/db/seed.js) uses it.

## The database itself

| Command | Does |
|---|---|
| `lumen db:create` | Creates the database. |
| `lumen db:drop` | Deletes the database. |
| `lumen db:reset` | `db:drop`, then `db:create`: an **empty** database. Follow it with `db:migrate` (and `db:seed`). |

With SQLite the database is a file, `db/<database>_<environment>.sqlite`,
created on first use, so `db:create` is rarely needed. With PostgreSQL or
MySQL, create and drop the database with the server's own tools for now
(`createdb`, `CREATE DATABASE …`): these commands connect to the database they
create or drop, which fails
([#111](https://github.com/nickschot/lux/issues/111)).

A full rebuild of a development database:

```bash
lumen db:reset && lumen db:migrate && lumen db:seed
```

## Environments

Every `db:` command takes `--environment` (`-e`) and uses that environment's
entry in `config/database.js`; it defaults to `development`, or `NODE_ENV`
when set:

```bash
lumen db:migrate --environment production
```

Each environment has its own database, so the development database is never
touched by tests or production. `DATABASE_URL`, when set, overrides
`config/database.js` (see the deployment guide).
