# Errors

Every failed request is answered with a JSON:API **error document**: an
`errors` array of error objects, and a status code. Lumen produces them for
everything it checks itself — routing, media types, parameters, request
bodies, validations, database constraints — and for anything your code
returns or throws.

## What clients receive

```json
{
  "errors": [
    {
      "status": "422",
      "title": "Unprocessable Entity",
      "source": { "pointer": "/data/attributes/email" },
      "detail": "Validation failed for email."
    }
  ],
  "jsonapi": { "version": "1.0" }
}
```

| Member | Holds | Sent |
|---|---|---|
| `status` | The HTTP status, as a string. | Always |
| `title` | The status's name (`Unprocessable Entity`), or the error's own `title`. | Always |
| `source` | What in the request was wrong: `pointer` into the request body (`/data/attributes/email`), or `parameter` for a query parameter (`sort`). | Always |
| `detail` | The error's message. | For Lumen's own client errors, always; for any other error, **in development only**, unless the message is marked public (below). |
| `id`, `code`, `meta`, `links.about` | Whatever the error carries. | Always, when present |

**Lumen's own client errors keep their `detail` in every environment:** the
parameter, media-type, `404`, `405` and `422` errors in the table below.
Their messages only describe the request: the names a client sent, the names
it may send instead, and the record it asked for. Names are written as in
documents (`created-at`, `fields[posts]`):

```json
{
  "errors": [
    {
      "status": "400",
      "title": "Bad Request",
      "source": { "parameter": "sort" },
      "detail": "Expected value for parameter 'sort' to be one of [title, created-at, -title, -created-at] but got body."
    }
  ],
  "jsonapi": { "version": "1.0" }
}
```

**Any other error's `detail` is hidden outside development**, because its
message can contain anything: SQL, a connection string, internal names. That
includes the `409` for a unique constraint violation, whose message comes from
the database driver. In production it carries only what is safe:

```json
{
  "errors": [
    {
      "status": "409",
      "title": "Conflict"
    }
  ],
  "jsonapi": { "version": "1.0" }
}
```

`source`, when the error has one, says what in the request was wrong in
every environment; the logs (see [Logging](logging.md)) keep the full
error.

## What Lumen reports

| Status | When | Covered in |
|---|---|---|
| `400 Bad Request` | An unknown or invalid query parameter (`sort`, `filter`, `include`, `fields`, `page`); a malformed body or an unknown member in it. | [Controllers](controllers.md#reading-what-clients-may-ask-for), [Serializers](serializers.md#request-documents) |
| `401 Unauthorized` | An action or hook returned `false`. | [Controllers](controllers.md#hooks) |
| `403 Forbidden` | A relationship (or, with `rejectUnlistedAttributes`, an attribute) not in `params`; a client-generated id. | [Controllers](controllers.md#accepting-writes-params) |
| `404 Not Found` | An unknown route; a record that doesn't exist — or that a visibility rule hides; a relationship in a body pointing at a missing record. | [Routing](routing.md), [Controllers](controllers.md#visibility-rules) |
| `405 Method Not Allowed` | A method the path doesn't route, with an `Allow` header. | [Routing](routing.md#resources) |
| `406 Not Acceptable` | An `Accept` header whose every JSON:API entry has parameters. | [Serializers](serializers.md#request-documents) |
| `409 Conflict` | `data.type` or `data.id` not matching the resource; a unique constraint violation. | [Serializers](serializers.md#request-documents), [Models](models.md#errors-from-the-database) |
| `415 Unsupported Media Type` | A body without `Content-Type: application/vnd.api+json` (a [plain route](routing.md#plain-routes) also takes `application/json`). | [Serializers](serializers.md#request-documents) |
| `422 Unprocessable Entity` | A model validation failed. | [Models](models.md#validations) |
| `500 Internal Server Error` | Any other error. | — |

**Several problems, one response.** Lumen checks the whole request before
answering, so a body with a missing `data.type` *and* an unknown attribute
gets one error object for each. The response's status is the one they share,
or `400` when they differ.

## Reporting errors from your code

### Return a status

An action or `beforeAction` hook that returns a number answers with that
status; an error status gets an error document with its standard title:

```javascript
class PostsController extends Controller {
  async destroy(request, response) {
    if (!request.currentUser?.isAdmin) {
      return 403;
    }

    return super.destroy(request, response);
  }
}
```

`false` is a shorthand for `401`.

### Throw an error

Anything thrown from an action, a hook or a model becomes an error document:
a `500`, unless the error has a `statusCode`. Give it any of the members in
the table above:

```javascript
throw Object.assign(new Error('[public] You have no credits left.'), {
  statusCode: 402,
  code: 'credits-exhausted',
  title: 'Out of credits',
  source: { parameter: 'plan' },
  meta: { credits: 0 },
  links: { about: 'https://example.com/docs/credits' }
});
```

```json
{
  "errors": [
    {
      "status": "402",
      "code": "credits-exhausted",
      "title": "Out of credits",
      "source": { "parameter": "plan" },
      "detail": "You have no credits left.",
      "links": { "about": "https://example.com/docs/credits" },
      "meta": { "credits": 0 }
    }
  ],
  "jsonapi": { "version": "1.0" }
}
```

**`[public]`** at the start of the message makes it the `detail` in every
environment (the prefix is removed). Use it for messages written for the
client; leave it off anything that might contain internals.

A small error class keeps this tidy:

```javascript
// app/utils/client-error.js
export default class ClientError extends Error {
  constructor(statusCode, message, members = {}) {
    super(`[public] ${message}`);
    Object.assign(this, { statusCode, ...members });
  }
}
```

```javascript
throw new ClientError(409, 'That title is taken.', {
  source: { pointer: '/data/attributes/title' }
});
```

### Errors in model hooks

An error thrown from a model hook fails the write: the transaction is rolled
back — the record, and everything the hook did through it or `trx` — and the
request is answered with the error, by the same rules. A `beforeSave` that
throws a `statusCode: 422` error with a `source.pointer` reads to a client
exactly like a failed validation.
