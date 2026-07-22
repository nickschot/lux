# Lumen

[![CI](https://github.com/nickschot/lux/actions/workflows/ci.yml/badge.svg)](https://github.com/nickschot/lux/actions/workflows/ci.yml) [![npm](https://www.npmjs.com/package/lumen-framework)

A MVC style framework for building highly performant, large scale JSON APIs that anybody who knows the JavaScript language and its modern features will understand.

\* _Inspired by [Rails](https://github.com/rails/rails/), [Ember](http://emberjs.com/), and [React](https://facebook.github.io/react/)._

**Disclaimer:**

This isn't another wrapper around [Express](http://expressjs.com/) or a framework for building frameworks. This also isn't a replacement for server-side frameworks that render DHTML.

[Check out the Medium Article!](https://trackchanges.postlight.com/not-another-node-js-framework-33103ebeedf8)

## What?

### Features

*   Automatic CRUD actions in controllers
*   Automatic pagination, sorting, filtering via query params in controllers
*   CLI for eliminating boiler plate
*   [JSON API](http://jsonapi.org/) 1.0 compliant out of the box
*   Optimized database queries based on serialized attributes and associations
*   Highly extensible - just write reusable JavaScript functions
*   Pairs nicely with client-side JavaScript applications 🍷
*   Easy to contribute
*   Routes are stored and accessed via a `Map` not an `Array`
*   Embraces ES2015 and beyond
    *   Classes
    *   Modules
    *   Promises & async/await
    *   Arrow Functions
    *   etc.


### Philosophies

##### Minimal API surface area

Lumen uses JavaScript's standard library rather than creating a ton of functions you'll have to learn and remember.

After your learn how to use it, you'll rarely need to look at the docs.

##### Pure functions are awesome

Or more appropriately somewhat pure functions are awesome.

Serving content is done by returning objects, arrays, or other primitives rather than calling `res.end(/* content */);` and returning nothing.

##### Convention over configuration

[Rails](http://rubyonrails.org/) and [Ember](http://emberjs.com/) are great because they make hard decisions for you and make it possible to submit a PR on your first day at a new company. This is rare with Node server frameworks.


## Why?

Frameworks like Rails are pretty great. You can build amazing applications in a reasonable amount of time without a ton of developers working on a project. They have their limitations though. They can be slow and sometimes hard to scale. Not to mention WebSocket support being so-so.

##### Node to the rescue.

It's fast, it allows the developer to get low level with a relatively simple API, WebSockets are stable and supported out of the box, and last but not least it's just JavaScript.

##### Not so fast (metaphorically speaking).

The last bit there "It's just JavaScript" has actually been somewhat of a double-edged sword. This has positioned Node as a "great prototyping tool" or "only used for micro services."

I can somewhat see why people would think that when returning a list of the first 10 records from a SQL database table looks like this:

```javascript
app.get('/posts', (req, res) => {
  Post.findAll()
    .then(posts => {
      res.status(200).json(posts);
    }, err => {
      console.error(err);
      res.status(500).send(err.message);
    });
});
```

Could you imagine how ugly that gets when you have to implement pagination, filtering, sorting, or—better yet—formatting the response for JSON API?

Also, where does that code live? In what file and folder would I find it? What pattern do you use for organizing this code?

😲 Ok ok give me back Rails I'll worry about performance and scaling later. After all, premature optimization is the root of all evil.

##### Problem.resolve();

Shouldn't there be a better way to do this? Can't I just return a promise or a JavaScript primitive instead of basically using the native Node http server API?

Fortunately ES2015+ has introduced great new features to the JavaScript language, especially when it comes to meta programming.

With Lumen your code from before can now look like this:

```javascript
class PostsController extends Controller {
  index(req, res) {
    return Post.all();
  }
}
```

Except CRUD actions are taken care of automatically so it would actually look like this:

```javascript
class PostsController extends Controller {

}
```

It's about time a Node server framework learned something from client-side JS frameworks.


## How?

### Installation

```bash
npm install -g lumen-framework
```

### Creating Your First Project

Use the `new` command to create your first project.

```bash
lumen new <app-name>
```

### Running

To run your application use the `serve` command.

```bash
cd <app-name>
lumen serve
```

## Useful Links

*   [JSON API](http://jsonapi.org/)
*   [Knex.js](http://knexjs.org/)
*   [Vitest](https://vitest.dev/)

## Attribution

Lumen is a fork of [**Lux**](https://github.com/postlight/lux), created by
[Zachary Golba](https://github.com/zacharygolba) and originally developed and maintained by
[Postlight](https://postlight.com/). Essentially all of the framework's design — the
convention-over-configuration approach, the automatic CRUD controllers, the JSON:API
serialization, the ORM built on Knex — is their work.

Upstream development stopped after `v1.2.3` (2018). This fork picks it up from there: it
was renamed to Lumen to avoid confusion with the original, since it is no longer a
drop-in continuation of it — the toolchain has been modernized (TypeScript, esbuild,
Vitest, Node 20+) and the public API has been allowed to change. Lumen is **not** an
official Postlight project, and the Postlight team provides no support for it.

The original is MIT licensed, and Lumen remains MIT licensed under the same terms. The
original copyright notice is retained in [LICENSE](./LICENSE) alongside that of this
fork's contributors.

*   Original repository: [postlight/lux](https://github.com/postlight/lux)
*   Original announcement: [Not Another Node.js Framework](https://trackchanges.postlight.com/not-another-node-js-framework-33103ebeedf8)
