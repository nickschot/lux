# Deployment

A Lumen app runs in production the way it runs in development: `lumen serve`,
in the `production` environment, against a production database. This guide
covers what has to be in place, how the app starts and stops, and recipes for
Heroku and Docker.

## What production needs

- **Node.js 22.13 or later.** Pin it where your platform reads it: the
  `engines` field `lumen new` writes into `package.json`, `.nvmrc`, or the
  Docker base image.
- **The app's dependencies,** installed with `npm install` (or `pnpm install`).
  `lumen-framework` is one of them and provides the `lumen` command in
  `node_modules/.bin`, so no global install is needed: `npm start` runs
  `lumen serve`.
- **A production database,** configured in `config/database.js` or through
  `DATABASE_URL` (below), with its migrations applied.
- **`NODE_ENV=production`,** which selects `config/environments/production.js`
  and the `production` database entry.

## The production configuration

### Database

`config/database.js` has a `production` entry. Either spell out the
connection:

```javascript
// config/database.js
export default {
  production: {
    driver: 'pg',
    host: 'db.internal',
    port: 5432,
    database: 'blog_prod',
    username: 'blog',
    password: process.env.DATABASE_PASSWORD,
    ssl: true,
    pool: 10
  }
};
```

…or give a connection string, either per environment as `url` or for any
environment through the **`DATABASE_URL`** environment variable, which wins
over everything else:

```javascript
production: {
  driver: 'pg',
  url: process.env.DATABASE_URL
}
```

A URL gives the host, credentials and database, and replaces those
settings. The rest still comes from `config/database.js`: the `driver`
(`pg`, `mysql2` or `sqlite3`), `pool` (the connection pool size, per
process) and `ssl`, which is applied on top of the URL:

```javascript
production: {
  driver: 'pg',
  ssl: { rejectUnauthorized: false } // TLS, for a URL that has none
}
```

A TLS setting written in the URL itself (`?sslmode=require` for PostgreSQL,
`?ssl=…` for MySQL) takes precedence over `ssl`.

Keep secrets out of the repository: `config/*.js` are plain modules, so read
them from `process.env` as above.

### Environment

`config/environments/production.js` holds the logging settings (see
[Logging](logging.md)) and server settings. The generated file logs JSON at
`INFO` without request bodies, which suits a log service. Behind a single
proxy that adds the client's address to `X-Forwarded-For`, add
`server: { trustProxy: true }`.

To accept browser requests from another origin, enable CORS there too:

```javascript
export default {
  server: {
    cors: {
      enabled: true,
      origin: 'https://app.example.com',
      headers: ['Accept', 'Content-Type', 'Authorization'],
      methods: ['GET', 'POST', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']
    }
  },

  logging: { … }
};
```

## Migrations on deploy

Run migrations before the new version starts:

```bash
lumen db:migrate --environment production
```

The app **refuses to start** while a migration is pending, so a deploy that
skips this step fails loudly: `lumen serve` logs the error and exits with code
`1`.

Write migrations that the *previous* version of the app can run against: for
a moment during a deploy, old code runs on the new schema. Add a column
before using it, and remove one only after no deployed code reads it.

## Starting

```bash
NODE_ENV=production npm start
```

`lumen serve` builds the app into `dist/` and starts it:

| Setting | Default | |
|---|---|---|
| `PORT` (or `--port`) | `4000` | The port to listen on. Platforms set `PORT`. |
| `NODE_ENV` (or `--environment`) | `development` | Set it to `production`. |
| `--cluster` | off | One worker process per CPU core instead of one. |

Hot reloading is off outside development. Building at start needs nothing
beyond the installed dependencies; `lumen build` runs the same build on its
own, to fail a deploy early if the app doesn't compile.

**One process or a cluster.** Without `--cluster`, `lumen serve` runs one
worker. Where the platform scales by running more containers or dynos, one
worker each is simplest. On a single machine, `--cluster` uses every core.

**Failing to start.** When the app cannot start — a pending migration, an
unreachable database, a route naming a controller that doesn't exist —
`lumen serve` logs the error and exits with code `1`, so the platform reports
the deploy as failed instead of a process that serves nothing.

**Crashes.** A worker that crashes after it has started is replaced
automatically, and the error is logged. If the replacement cannot start
either, `lumen serve` exits with code `1`.

## Stopping

Platforms stop a process with `SIGTERM` on every deploy and restart (Ctrl-C
sends `SIGINT`). `lumen serve` then shuts down gracefully:

1. each worker stops accepting connections and closes idle keep-alive ones;
2. the requests in flight finish and are answered;
3. the database connections close, and the process exits with code `0`.

```text
INFO  Received SIGTERM; finishing requests in flight
INFO  Lumen Server stopped
```

A worker that hasn't finished after **8 seconds** is killed, so the process
always exits within the grace period platforms allow before they kill it
(Docker 10 s, Heroku and Kubernetes 30 s). Requests that may take longer need
a longer `server.shutdownTimeout`, in milliseconds, and a matching grace
period on the platform:

```javascript
// config/environments/production.js
export default {
  server: {
    shutdownTimeout: 25000 // Heroku allows 30 s
  },

  logging: { … }
};
```

## A health check

Load balancers and platforms probe an endpoint to decide whether an instance
is up. A plain route on the application controller is enough:

```javascript
// app/routes.js
export default function routes() {
  this.get('health');
  // …
}
```

```javascript
// app/controllers/application.js
import { Controller } from 'lumen-framework';

import User from '../models/user';

class ApplicationController extends Controller {
  async health() {
    await User.count(); // the database answers
    return { status: 'ok' };
  }
}
```

## Recipes

### Heroku

```text
# Procfile
release: npx lumen db:migrate
web: npm start
```

Heroku sets `NODE_ENV=production`, `PORT`, and — with a Postgres add-on —
`DATABASE_URL`, which Lumen uses automatically. Heroku Postgres requires TLS
with a certificate Node doesn't verify by default, and `DATABASE_URL`
carries no TLS settings, so the production entry sets them:

```javascript
// config/database.js
production: {
  driver: 'pg',
  pool: 10,
  ssl: { rejectUnauthorized: false }
}
```

Use the logging recipe from [Logging](logging.md#recipes): text without
timestamps, `trustProxy: true` for Heroku's router.

### Docker

```dockerfile
FROM node:22-slim

WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npx lumen build

EXPOSE 4000
CMD ["npm", "start"]
```

Run migrations as a separate step before starting new containers, with the
same image:

```bash
docker run --rm -e DATABASE_URL=… my-api npx lumen db:migrate
```

SQLite is a file inside the container: fine for a demo, but it is lost with
the container unless `db/` is a mounted volume. Use PostgreSQL or MySQL for
anything real.

## Installing Lumen from git

Installing `lumen-framework` from npm gets a built package. Installing it
from a git branch or a local path does not: the framework's `dist/` is built,
not committed, so build it after installing (for example with a `prepare`
script in the framework, or `pnpm build` in its checkout).
