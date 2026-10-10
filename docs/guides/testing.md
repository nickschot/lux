# Testing

`lumen-framework/testing` has helpers for an app's own tests: booting the
app in the test, and checking what each request can see. They are kept out of
the main entry, so they never reach the app's runtime bundle.

Any test runner works; the examples use Vitest.

## Booting the app: `startApp()`

`startApp(path)` boots the app at `path` from its compiled bundle
(`dist/bundle.js`), listening on a free port:

```javascript
import { startApp } from 'lumen-framework/testing';

let app, origin, close;

beforeAll(async () => {
  ({ app, origin, close } = await startApp(process.cwd()));
});

afterAll(() => close());

it('lists posts', async () => {
  const res = await fetch(`${origin}/posts`);

  expect(res.status).toBe(200);
});
```

- **Compile first.** The bundle is what `lumen build` writes, and the
  `lumen db:*` commands write it too, so a test setup that resets the
  database (`lumen db:reset && lumen db:seed`) already has one.
- **The environment** is `NODE_ENV`, which picks `config/environments/*.js`
  and the entry of `config/database.js`. `startApp()` sets it to `test` when
  it is unset; `env` sets another one. Compile for the same environment.
- **Once per process.** Booting sets up the app's model classes, which can
  happen only once in a process, so starting the same app again throws.
  Start it once (in a shared setup file, with your runner running test files
  in one process) and share it.
- `app` gives the tests the models (`app.models.get('post')`) for creating
  fixtures, and is what `auditVisibility()` reads the routes from.

## Checking what a request can see: `auditVisibility()`

[Visibility rules](controllers.md#visibility-rules) apply to every way a
request reaches records. Scoping in an `index` or `show` override, or in a
hook checking the action name, doesn't: it covers the primary data, but not
the records included with it or served by relationship and related
endpoints. `auditVisibility()` tests the result rather than the mechanism.

It requests every read a namespace serves: each list, each record by id,
each relationship and related endpoint, without `include` and with every
path it accepts, following every page. It reports each record in a response
that a list you write by hand doesn't allow, whether as primary data,
included or in a relationship's linkage:

```javascript
import { auditVisibility } from 'lumen-framework/testing';

it('shows a member only public posts and their comments', async () => {
  const { violations } = await auditVisibility(app, {
    namespace: 'members',
    headers: { Authorization: `Bearer ${memberToken}` },
    visible: {
      posts: [publicPost.id],
      comments: [commentOnPublicPost.id],
      users: true,
      tags: true
    }
  });

  expect(violations).toEqual([]);
});
```

### Options

- **`visible`** lists, per type, the ids the request may see, `true` for all
  of them, or a function taking an id. **A type left out may not appear at
  all**, so a relationship added later fails the test until you decide what
  it shows.
- **`headers`** are sent with every request: authenticate as the user the
  audit is for.
- **`ids`** narrows, per type, the ids each route that takes one is requested
  with. By default it is every id of the type in the database, visible or
  not, so keep the fixture database small or list them.
- **`query`** adds the query parameters a read requires, per type. They go
  to the type's list, its records by id and every related endpoint that
  serves it (`/posts/:id/comments` serves comments, with the comments
  controller's parameters):

  ```javascript
  query: { comments: { fromDate: '2026-01-01' } }
  ```

- **`origin`** sends the requests to a server you started yourself, such as
  `lumen serve` in another process: `origin: 'http://localhost:4000'`. The
  audit still reads the routes, include paths and ids from `app`, so boot it
  in the test as well; it needn't serve the requests.
- **`onDocument`** is called with each document a read answers with, as
  `{ url, status, document }`, for checks beyond which records appear, such
  as which fields a request sees of each. Return a message for each problem,
  or several as an array; each becomes a violation of that request:

  ```javascript
  onDocument({ document }) {
    const resources = [document.data, document.included ?? []].flat();

    return resources
      .filter(r => r?.type === 'users' && r.id !== me.id)
      .filter(r => 'email' in (r.attributes ?? {}))
      .map(r => `users ${r.id} shows its email`);
  }
  ```

### The result

- **`violations`**: each record a response named that `visible` doesn't
  allow (`{ url, status, type, id }`), each problem `onDocument` returned
  (`{ url, status, message }`), and each read that failed with a status
  other than `401`, `403` or `404` (`{ url, status }`), since that read went
  unchecked. A `404` for a hidden record passes.
- **`seen`**: every record the responses named, per type, each id once. Use
  it to check that the audit reached what the request should see, not just
  that it found nothing wrong:

  ```javascript
  expect(seen.posts).toEqual(expect.arrayContaining([String(publicPost.id)]));
  ```

- **`requests`**: every request made, as a path and query string.

Requests go one at a time, and custom routes aren't requested. A namespace
that serves no reads throws, so a mistyped `namespace` can't pass by
checking nothing.
