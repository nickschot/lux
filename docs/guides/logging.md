# Logging

Lumen logs every request, every server error, and — in development — every
SQL statement. Logging is configured per environment, in the `logging`
section of `config/environments/<environment>.js`, and writes to standard
output, so it works the same in a terminal, a container or a platform's log
viewer.

## Configuration

`lumen new` writes a configuration for each environment:

```javascript
// config/environments/development.js
export default {
  logging: {
    level: 'DEBUG',
    format: 'text',
    enabled: true,
    requestBody: true,

    filter: {
      params: []
    }
  }
};
```

```javascript
// config/environments/production.js
export default {
  logging: {
    level: 'INFO',
    format: 'json',
    enabled: true,
    requestBody: false,

    filter: {
      params: []
    }
  }
};
```

| Option | Values | Default | Effect |
|---|---|---|---|
| `enabled` | `true`, `false` | — | Whether anything is logged. The test environment turns it off. |
| `level` | `DEBUG`, `INFO`, `WARN`, `ERROR` | — | The least severe level written. An unknown level fails at boot. |
| `format` | `text`, `json` | — | Lines for people, or one JSON object per line for log services. |
| `requestBody` | `true`, `false` | on, except in production | Whether the request line's `params` include the request body. |
| `filter.params` | names | `[]` | More parameter names to filter (see below). |
| `timestamps` | `true`, `false` | `true` | Whether text lines start with the time; turn it off where the platform stamps every line itself. |

## What is logged

| Level | What |
|---|---|
| `DEBUG` | Each client error (4xx) as a one-line message: `RecordNotFoundError: Could not find Post with id 999.` Every SQL statement, with its values, when the database's `debug` is on (below). In text format, the request line is a detailed block. |
| `INFO` | One line per request. Startup messages. |
| `ERROR` | Each server error (5xx), with its stack. |

Client errors are not logged as errors: a `404` or a failed validation is the
client's, and already on the request line with its status. Only `5xx` — your
bugs and outages — are `ERROR`s, so alerting on them is meaningful.

### Text

At `INFO` each request is one line: the request id, method, path, status,
duration, controller action, client address, and the query parameters:

```text
INFO  [d07cc9f0] GET /posts 200 OK in 11 ms by PostsController#index from ::1 {"sort":"-title","fields":{"posts":["title"]}}
INFO  [b305229e] Synced posts
INFO  [b305229e] GET /sync 200 OK in 4 ms by ApplicationController#sync from ::1
ERROR [dd4b1787] Error: kaboom
    at ApplicationController.boom (app/controllers/application.js:10:11)
    …
INFO  [dd4b1787] GET /boom 500 Internal Server Error in 14 ms by ApplicationController#boom from ::1
```

The bracketed id — the first 8 characters of the request id — ties an error
and your own messages to their request. At `DEBUG` (development) the request
line becomes a block with the parameters, including the body, and timings.

### JSON

Each line is one object; the request line has every field a log service needs
to search and graph:

```json
{"timestamp":"2026-10-07T20:17:01.755Z","level":"INFO","requestId":"f2bd4bdd-2628-418c-97aa-b22fcff672a0","message":"Processed Request","method":"GET","path":"/posts/999","status":404,"durationMs":2,"controller":"PostsController","action":"show","params":{"id":999},"protocol":"HTTP/1.1","userAgent":"curl/8.7.1","remoteAddress":"::1"}
```

A server error carries its `name`, `message`, `stack` and the same
`requestId`:

```json
{"timestamp":"2026-10-07T20:17:01.764Z","level":"ERROR","requestId":"aaf6fcc6-6e5a-42cf-b4cf-66f490283aa3","message":"kaboom","name":"Error","stack":"Error: kaboom\n    at ApplicationController.boom (…)"}
```

## Request ids

Every request has an id. A well-formed incoming `X-Request-Id` header (up to
128 characters of `A-Z a-z 0-9 _ . : -`) is adopted, so an id set by a proxy
or another service carries through; otherwise a UUID is generated. The id is:

- sent back as the `X-Request-Id` response header;
- `request.id` in actions and hooks;
- on the request line and on every error line of that request.

## Credentials stay out of the logs

Any parameter whose name **contains** `password`, `secret` or `token`,
ignoring case, is logged as `[FILTERED]` — in the body, the query string and
nested inside arrays:

```json
"attributes": {
  "name": "Eve",
  "email": "eve@example.com",
  "password": "[FILTERED]"
}
```

`filter.params` adds names to that list; matching is by containment too, so
`email` also filters `recoveryEmail`:

```javascript
filter: {
  params: ['email', 'ssn']
}
```

Production leaves the request body out of the log entirely
(`requestBody: false`); query and route parameters are still logged, filtered.
The logged `path` never includes the query string.

## Logging from your code

The logger is `request.logger` in actions and hooks, and `Model.logger` on
every model. It has a method per level, and an optional second argument of
fields to add — written as top-level fields in JSON, left out of text:

```javascript
class ApplicationController extends Controller {
  sync(request) {
    request.logger.info('Synced posts', { requestId: request.id, count: 2 });
    return { synced: 2 };
  }
}
```

```json
{"timestamp":"2026-10-07T20:17:46.257Z","level":"INFO","requestId":"04702eec-d81e-4127-9c5f-cfc340708c1e","count":2,"message":"Synced posts"}
```

Pass `requestId` to tie a message to its request: it is a field in JSON, and
the bracketed id in text.

## The client's address

Behind a proxy or load balancer, every request comes from the proxy's
address. If exactly one proxy sits in front of the app and appends the
client's address to `X-Forwarded-For` (Heroku's router does), set
`server.trustProxy` so `remoteAddress` and `request.ip` are the client's:

```javascript
// config/environments/production.js
export default {
  server: {
    trustProxy: true
  },

  logging: { … }
};
```

Leave it off without such a proxy: clients can set the header to anything.

## SQL

SQL statements are logged at `DEBUG` when the database's `debug` setting is
on, which by default it is in development only. To see them in another
environment, set it in `config/database.js` and use `level: 'DEBUG'`:

```javascript
// config/database.js
export default {
  production: {
    driver: 'pg',
    database: 'blog_prod',
    debug: true
  }
};
```

Statements are logged **with their values**, and the parameter filter does
not apply to SQL — turn this on briefly and deliberately.

## Recipes

**Heroku, without a log service** — readable text, no duplicate timestamps,
the real client address:

```javascript
// config/environments/production.js
export default {
  server: { trustProxy: true },

  logging: {
    level: 'INFO',
    format: 'text',
    timestamps: false,
    enabled: true,
    requestBody: false,
    filter: { params: [] }
  }
};
```

**A log service** (Datadog, Loki, CloudWatch, …) — keep the generated
production configuration: `format: 'json'` at `INFO`, and search or graph on
`status`, `durationMs`, `controller`, `action` and `requestId`.
