# The `lumen` command

Everything you do with a Lumen app outside its code — creating it, generating
files, running it, managing its database — goes through the `lumen` command,
installed with the framework:

```bash
npm install -g lumen-framework
```

Every command has a one-letter alias (`lumen s` for `lumen serve`), and
`--help`:

```bash
lumen serve --help
```

A mistyped command, a missing argument or an invalid option is an error, with
exit code `1`.

## Creating an app

### `lumen new <name>`

Creates the app in a new directory, initializes a git repository, and
installs its dependencies with npm.

| Option | Default | |
|---|---|---|
| `--database <driver>` | `sqlite` | `sqlite`, `postgres` or `mysql`; sets up `config/database.js` and adds the driver package. |

See [Getting started](getting-started.md) for what it creates.

## Generating and removing files

### `lumen generate <type> <name> [attributes...]`

Alias `lumen g`. Writes files from templates:

| Type | Writes |
|---|---|
| `resource` | A model, its migration, a controller, a serializer, and a route in `app/routes.js`. |
| `model` | A model and the migration creating its table. |
| `controller` | A controller (and the namespace's `application.js`, if missing). |
| `serializer` | A serializer (and the namespace's `application.js`, if missing). |
| `migration` | An empty migration. |
| `middleware` | A function in `app/middleware/`, for a `beforeAction` hook. |
| `util` | A function in `app/utils/`. |

`name` is the singular model name (`post`); the controller, serializer and
route are named in the plural (`posts`). Prefix it with a namespace to
generate into one: `lumen generate controller
admin/posts` writes `app/controllers/admin/posts.js`. A namespaced resource
does not add its route; Lumen prints the line to add yourself.

Attributes are `name:type`:

```bash
lumen generate resource post title:string body:text published:boolean user:belongs-to
```

- A column type (`string`, `text`, `integer`, `boolean`, `date`,
  `datetime`, … — any Knex column type) adds a column to the migration, a
  `params` entry to the controller and an attribute to the serializer.
- `belongs-to`, `has-one` or `has-many` declares a relationship on the model
  and the serializer; `belongs-to` also adds the foreign key column. See
  [Models](models.md#relationships) for the `inverse` the generator assumes.

### `lumen destroy <type> <name>`

Alias `lumen d`. Removes what `generate` wrote for that type and name, and
the route of a resource. (A namespaced resource currently keeps its model and
migration: [#115](https://github.com/nickschot/lux/issues/115).)

## Running the app

### `lumen serve`

Alias `lumen s`. Builds the app and starts the server.

| Option | Default | |
|---|---|---|
| `-p, --port <port>` | `4000` (or `PORT`) | The port to listen on. |
| `-e, --environment <env>` | `development` (or `NODE_ENV`) | Which `config/environments/*.js` and database to use. |
| `-H, --hot` | on in development | Rebuild and restart the workers when a file changes. |
| `-c, --cluster` | off | Run one worker process per CPU core instead of one. |
| `-w, --use-weak` | off | Build without strict mode. |

The app refuses to start while a migration is pending.

### `lumen build`

Alias `lumen b`. Compiles the app into `dist/` without starting it — what
`serve` does first. Use it to check that the app builds, or as a deploy
step (see the deployment guide). Takes `--use-weak`.

### `lumen console`

Alias `lumen c`. Starts a Node REPL with the app loaded — for trying queries
against a real database:

```text
> await User.where({ name: 'Ada Lovelace' }).first()
> await Post.count()
```

In scope: `app`, `logger`, `routes`, every model by class name (`User`,
`Post`), and every controller and serializer instance by class name. Takes
`--environment` and `--use-weak`.

## The database

| Command | Does |
|---|---|
| `lumen db:migrate` | Applies pending migrations. |
| `lumen db:rollback` | Undoes the most recent migration. |
| `lumen db:seed` | Runs `db/seed.js`. |
| `lumen db:create` | Creates the database. |
| `lumen db:drop` | Deletes the database. |
| `lumen db:reset` | Drops and recreates the database, empty. |

Each takes `--environment` (default `development`, or `NODE_ENV`) and
`--use-weak`, and builds the app first. See
[Migrations and seeds](migrations.md).

## Environment variables

| Variable | Used for |
|---|---|
| `NODE_ENV` | The environment, when `--environment` isn't given. |
| `PORT` | The port for `serve`, when `--port` isn't given. |
| `DATABASE_URL` | A connection string that overrides `config/database.js`. |

## Strict mode

The app is compiled as strict-mode JavaScript, which turns some silent
mistakes (assigning to an undeclared variable, writing a read-only property)
into errors. `--use-weak` turns that off — a stopgap for code that relies on
sloppy mode, not something to leave on.
