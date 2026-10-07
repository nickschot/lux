import { camelize } from 'inflection';
import type { Knex } from 'knex';

import { getDomain } from '../server';
import merge from '../../utils/merge';
import { freezeProps } from '../freezeable';
import type Serializer from '../serializer';
import type { Model, ModelClass, Query } from '../database';
import type { Request, Response } from '../server';

import findOne from './utils/find-one';
import findMany from './utils/find-many';
import paramsToQuery from './utils/params-to-query';
import resolveRelationships from './utils/resolve-relationships';
import validateRelationships from './utils/validate-relationships';
import { scopeFor } from './visibility';
import type { Visibility } from './visibility';
import type {
  Controller$opts,
  Controller$beforeAction,
  Controller$afterAction
} from './interfaces';

/**
 * ## Overview
 *
 * The Controller class is responsible for taking in requests from the outside
 * world and returning the appropriate response.
 *
 * Think of a Controller as a server at a restaurant. A client makes a request
 * to an application, that request is routed to the appropriate Controller and
 * then the Controller interprets the request and returns data relative to what
 * the client has request.
 *
 * #### Actions
 *
 * Controller actions are functions that call on a Controller in response to an
 * incoming HTTP request. The job of Controller actions are to return the data
 * that the Lumen Application will respond with.
 *
 * There is no special API for Controller actions. They are simply functions
 * that return a value. If an action returns a Query or Promise the resolved
 * value will be used rather than the immediate return value of the action.
 *
 * Below you will find a table showing the different types of responses you can
 * get from different action return values. Keep in mind, Lumen is agnostic to
 * whether or not the value is returned synchronously or resolved from a
 * Promise.
 *
 * | Return/Resolved Value        | Response                                   |
 * |------------------------------|--------------------------------------------|
 * | Array<Model> or Model        | Serialized JSON String                     |
 * | Array or Object Literal      | JSON String                                |
 * | String Literal               | Plain Text                                 |
 * | Number Literal               | [HTTP Status Code](https://goo.gl/T2lMc7)  |
 * | true                         | [204 No Content](https://goo.gl/GxKoqz)    |
 * | false                        | [401 Unauthorized](https://goo.gl/60QqCW)  |
 *
 * **Built-In Actions**
 *
 * Built-in actions refer to Controller actions that you get for free when
 * extending the Controller class (show, index, create, update, destroy). These
 * actions are highly optimized to load only the attributes and relationships
 * that are defined in the resolved Serializer for a Controller.
 *
 * If applicable, built-in actions support the following features described in
 * the [JSON API specification](http://jsonapi.org/):
 *
 * - [Sorting](http://jsonapi.org/format/#fetching-sorting)
 * - [Filtering](http://jsonapi.org/format/#fetching-filtering)
 * - [Pagination](http://jsonapi.org/format/#fetching-pagination)
 * - [Sparse Fieldsets](http://jsonapi.org/format/#fetching-sparse-fieldsets)
 * - [Including Related Resources](http://jsonapi.org/format/#fetching-includes)
 *
 * **Extending Built-In Actions**
 *
 * Considering the amount of functionality built-in actions provide, you will
 * rarely need to override the default behavior of a built-in action. In the
 * event that you do need to override a built-in action, you have the ability to
 * opt back into the built-in logic by calling the super class.
 *
 * Read actions such as index and show return a Query which allows us to chain
 * methods to the super call. In the following example  we will extend the
 * default behavior of the index action to only match records that meet an
 * additional hard-coded set of conditions. We will still be able to use all of
 * the functionality that the built-in index action provides.
 *
 * ```javascript
 * // app/controllers/posts.js
 * import { Controller } from 'lumen-framework';
 *
 * class PostsController extends Controller {
 *    index(request, response) {
 *      return super.index(request, response).where({
 *        isPublic: true
 *      });
 *    }
 *  }
 *
 *  export default PostsController;
 * ```
 *
 * A `where` like this only narrows the index: the excluded posts are still
 * served by `show` and reachable through relationships and `include`. To hide
 * records from every request, declare a visibility rule instead (see
 * `visibility`).
 *
 * **Custom Actions**
 *
 * Sometimes it is necessary to add a custom action to a Controller. Lumen allows
 * you to do so by adding an instance method to a Controller. In the following
 * example you will see how to add a custom action with the name `check` to a
 * Controller. We are implementing this action to use as a health check for the
 * application so we want to return the `Number` literal `204`.
 *
 * ```javascript
 * // app/controllers/health.js
 * import { Controller } from 'lumen-framework';
 *
 * class HealthController extends Controller {
 *   async check() {
 *     return 204;
 *   }
 * }
 *
 * export default HealthController;
 * ```
 *
 * The example above is nice but we can make the code a bit more concise with an
 * Arrow `Function`.
 *
 * ```javascript
 * // app/controllers/health.js
 * import { Controller } from 'lumen-framework';
 *
 * class HealthController extends Controller {
 *   check = async () => 204;
 * }
 *
 * export default HealthController;
 * ```
 *
 * Using an Arrow Function instead of a traditional method Controller can be
 * useful when immediately returning a value. However, there are a few downsides
 * to using an Arrow `Function` for a Controller action, such as not being able
 * to call the `super class`. This can be an issue if you are looking to extend
 * a built-in action.
 *
 * Another use case for a custom action could be to return a specific scope of
 * data from a `Model`. Let's implement
 * a custom `drafts` route on a `PostsController`.
 *
 * ```javascript
 * // app/controllers/posts.js
 * import { Controller } from 'lumen-framework';
 * import Post from 'app/models/posts';
 *
 * class PostsController extends Controller {
 *   drafts() {
 *     return Post.where({
 *       isPublic: false
 *     });
 *   }
 * }
 *
 * export default PostsController;
 * ```
 *
 * While the example above works, we would have to implement all the custom
 * logic that we get for free with built-in actions. Since we aren't getting too
 * crazy with our custom action we can likely just call the `index` action and
 * chain a `.where()` to it.
 *
 * ```javascript
 * // app/controllers/posts.js
 * import { Controller } from 'lumen-framework';
 *
 * class PostsController extends Controller {
 *   drafts(request, response) {
 *     return this.index(request, response).where({
 *       isPublic: false
 *     });
 *   }
 * }
 *
 * export default PostsController;
 * ```
 *
 * Now we can sort, filter, and paginate our custom `drafts` route!
 *
 * #### Middleware
 *
 * Middleware can be a very powerful tool in many Node.js server frameworks. Lumen
 * is no exception. Middleware can be used to execute logic before or after a
 * Controller action is executed.
 *
 * There are two hooks where you can execute middleware functions,
 * `beforeAction` and `afterAction`. Functions added to the `beforeAction` hook
 * will execute before the Controller action and functions added to the
 * `afterAction` hook will be executed after the `Controller` action.
 *
 * **Context**
 *
 * Middleware functions will be bound to the Controller they are added to upon
 * the start of an Application.
 *
 * Due to the lexical binding of arrow functions, if you need to use the `this`
 * keyword within a middleware function, declare the middleware function using
 * the `function` keyword and not as an arrow function.
 *
 * **Scoping Middleware**
 *
 * Middleware is scoped by Controller and includes a parent Controller's
 * middleware recursively until the parent Controller is the root
 * `ApplicationController`. This allows you to implement custom logic that can
 * be executed for resources, namespaces, or an entire Application.
 *
 * Let's say we want to require authentication for every route in our
 * Application. All we have to do is move our authentication middleware function
 * from the example above to the `ApplicationController`.
 *
 * ```javascript
 * // app/controllers/application.js
 * import { Controller } from 'lumen-framework';
 *
 * class ApplicationController extends Controller {
 *   beforeAction = [
 *     async function authenticate(request) {
 *       if (!request.currentUser) {
 *         // 401 Unauthorized
 *         return false;
 *       }
 *     }
 *   ];
 * }
 *
 * export default ApplicationController;
 * ```
 *
 * **Execuation Order**
 *
 * Understanding the execution order of middleware functions and a `Controller`
 * action is essential to productivity with Lumen. Depending on what you use case
 * is, you may want your function to execute at different times in the
 * `request` / `response` cycle.
 *
 * 1. Parent `Controller` `beforeAction` hooks
 * 2. `Controller` `beforeAction` hooks
 * 3. `Controller` Action
 * 4. `Controller` `afterAction` hooks
 * 5. Parent `Controller` `afterAction` hooks
 *
 * **Modules**
 *
 * It is considered a best practice to define your middleware functions in
 * separate file and export them for use throughout an Application. Typically
 * this is done within an `app/middleware` directory.
 *
 * ```javascript
 * // app/middleware/authenticate.js
 * export default async function authenticate(request) {
 *   if (!request.currentUser) {
 *     // 401 Unauthorized
 *     return false;
 *   }
 * }
 * ```
 *
 * This keeps the Controller code clean, easier to read, and easier to modify.
 *
 * ```javascript
 * // app/controllers/application.js
 * import { Controller } from 'lumen-framework';
 * import authenticate from 'app/middleware/authenticate';
 *
 * class ApplicationController extends Controller {
 *   beforeAction = [
 *     authenticate
 *   ];
 * }
 *
 * export default ApplicationController;
 * ```
 *
 * @class Controller
 * @public
 */
class Controller {
  /**
   * An array of custom query parameter keys that are allowed to reach a
   * Controller instance from an incoming `HTTP` request.
   *
   * For security reasons, query parameters passed to Controller actions from an
   * incoming request other than sort, filter, and page must have their key
   * whitelisted.
   *
   * ```javascript
   * class UsersController extends Controller {
   *   // Allow the following custom query parameters to be used for this
   *   // Controller's actions.
   *   query = [
   *     'cache'
   *   ];
   * }
   * ```
   *
   * @property query
   * @type {Array}
   * @default []
   * @public
   */
  query: Array<string> = [];

  /**
   * An array of sort query parameter values that are allowed to reach a
   * Controller instance from an incoming `HTTP` request.
   *
   * If you do not override this property all of the attributes specified in the
   * Serializer that represents a Controller's resource. If the Serializer
   * cannot be resolved, this property will default to an empty array.
   *
   * @property sort
   * @type {Array}
   * @default []
   * @public
   */
  sort: Array<string> = [];

  /**
   * An array of filter query parameter keys that are allowed to reach a
   * Controller instance from an incoming `HTTP` request.
   *
   * If you do not override this property all of the attributes specified in the
   * Serializer that represents a Controller's resource. If the Serializer
   * cannot be resolved, this property will default to an empty array.
   *
   * @property filter
   * @type {Array}
   * @default []
   * @public
   */
  filter: Array<string> = [];

  /**
   * An array of parameter keys that are allowed to reach a Controller instance
   * from an incoming `POST` or `PATCH` request body.
   *
   * If you do not override this property all of the attributes specified in the
   * Serializer that represents a Controller's resource. If the Serializer
   * cannot be resolved, this property will default to an empty array.
   *
   * An attribute the model has but this list does not name is ignored
   * (dropped from `request.params`), so clients may send read-only attributes
   * back; a relationship like that is answered with `403 Forbidden`. See
   * `rejectUnlistedAttributes` and `rejectUnlistedRelationships` to change
   * either. A member the model does not have at all is answered with
   * `400 Bad Request`.
   *
   * @property params
   * @type {Array}
   * @default []
   * @public
   */
  params: Array<string> = [];

  /**
   * Functions to execute on each request handled by a `Controller` before the
   * `Controller` action is executed.
   *
   * Functions added to the `beforeAction` hook behave similarly to `Controller`
   * actions, however, they are expected to return `undefined`. If a middleware
   * function returns a value other than `undefined` the `request` / `response`
   * cycle will end before remaining middleware and/or Controller actions are
   * executed. This makes the `beforeAction` hook a very powerful tool for
   * dealing with many common tasks, such as authentication.
   *
   * Functions called from the `beforeAction` hook will have `request` and
   * `response` objects passed as arguments.
   *
   * **Example:**
   *
   * ```javascript
   * import { Controller } from 'lumen-framework';
   *
   * const UNSAFE_METHODS = /(?:POST|PATCH|DELETE)/i;
   *
   * function isAdmin(user) {
   *   if (user) {
   *     return user.isAdmin;
   *   }
   *
   *   return false;
   * }
   *
   * async function authentication(request) {
   *   const { method, currentUser } = request;
   *   const isUnsafe = UNSAFE_METHODS.test(method);
   *
   *   if (isUnsafe && !isAdmin(currentUser)) {
   *     return false; // 401 Unauthorized if the current user is not an admin.
   *   }
   * }
   *
   * class PostsController extends Controller {
   *   beforeAction = [
   *     authentication
   *   ];
   * }
   *
   * export default PostsController;
   * ```
   *
   * @property beforeAction
   * @type {Array}
   * @default []
   * @public
   */
  beforeAction: Array<Controller$beforeAction> = [];

  /**
   * Functions to execute on each request handled by a `Controller` after the
   * `Controller` action is executed.
   *
   * Functions called from the `afterAction` hook will have `request` and
   * `response` objects passed as arguments as well as a third `payload`
   * argument. The `payload` argument is a reference to the resolved data of
   * the Controller action that was called within the current `request` /
   * `response` cycle. You need to explicitly return this `payload` in order for
   * the afterAction to resolve with it's data. If you return a modified value
   * from a function added to the `afterAction` hook, that value will be used
   * instead of the resolved data from the preceding Controller action.
   * Subsequent hooks called from an `afterAction` hook will will use the value
   * returned or resolved from the preceding hook. This makes `afterAction` a
   * great place to modify the data you are sending back to the client.
   *
   * **Example:**
   *
   * ```javascript
   * import { Controller } from 'lumen-framework';
   *
   * async function addCopyright(request, response, payload) {
   *   const { action } = request;
   *
   *   if (payload && action !== preflight) {
   *     return {
   *       ...payload,
   *       meta: {
   *         copyright: '2016 (c) Postlight'
   *       }
   *     };
   *   }
   *
   *   return payload;
   * }
   *
   * class ApplicationController extends Controller {
   *   afterAction = [
   *     addCopyright
   *   ];
   * }
   *
   * export default ApplicationController;
   * ```
   *
   * @property afterAction
   * @type {Array}
   * @default []
   * @public
   */
  afterAction: Array<Controller$afterAction> = [];

  /**
   * The default amount of items to include per each response of the index
   * action if a `?page[size]` query parameter is not specified.
   *
   * @property defaultPerPage
   * @type {Number}
   * @default 25
   * @public
   */
  defaultPerPage: number = 25;

  /**
   * The largest `?page[size]` the index action accepts. A larger one is
   * answered with `400 Bad Request` (as is a `page[size]` or `page[number]`
   * below 1).
   *
   * @property maxPerPage
   * @type {Number}
   * @default 100
   * @public
   */
  maxPerPage: number = 100;

  /**
   * Answer an attribute the model has but `params` does not list with
   * `403 Forbidden` (an unsupported update, per JSON:API) instead of ignoring
   * it. Off by default: clients like ember-data send every attribute back on
   * save, read-only ones (`createdAt`) included.
   *
   * Set it on `ApplicationController` to change it for the whole app, or on a
   * single controller to override it there.
   *
   * @property rejectUnlistedAttributes
   * @type {Boolean}
   * @default false
   * @public
   */
  rejectUnlistedAttributes: boolean = false;

  /**
   * Answer a relationship the model has but `params` does not list with
   * `403 Forbidden` (an unsupported update, per JSON:API). Turn it off to
   * ignore such relationships instead, for clients that send every
   * `belongsTo` back on save (ember-data):
   *
   * ```javascript
   * class ApplicationController extends Controller {
   *   rejectUnlistedRelationships = false;
   * }
   * ```
   *
   * @property rejectUnlistedRelationships
   * @type {Boolean}
   * @default true
   * @public
   */
  rejectUnlistedRelationships: boolean = true;

  /**
   * How many relationships deep an `?include` path may go on this
   * controller's routes. `comments.reactions.user` is 3 levels deep; with `1`
   * only direct relationships (`comments`) can be included. Paths deeper than
   * this are rejected with `400 Bad Request`.
   *
   * Set it on `ApplicationController` to change it for the whole app, or on a
   * single controller to override it there.
   *
   * ```javascript
   * class ApplicationController extends Controller {
   *   maxIncludeDepth = 2;
   * }
   * ```
   *
   * Every allowed path is enumerated up front from the serializers'
   * relationships, and each nested level costs its own queries per request, so
   * keep this small.
   *
   * @property maxIncludeDepth
   * @type {Number}
   * @default 3
   * @public
   */
  maxIncludeDepth: number = 3;

  /**
   * Whether a namespace may fall back to the root Serializer of a type it has
   * no Serializer for. Read from a namespace's `ApplicationController` and
   * applies to the whole namespace.
   *
   * By default `app/controllers/admin/comments.js` without an
   * `app/serializers/admin/comments.js` — or an included type without one —
   * is serialized by the root Serializer, with every attribute and
   * relationship it declares. For a namespace that must only expose what it
   * declares itself, turn the fallback off:
   *
   * ```javascript
   * // app/controllers/admin/application.js
   * class AdminApplicationController extends ApplicationController {
   *   serializerFallback = false;
   * }
   * ```
   *
   * The application then refuses to boot while any type the namespace can
   * serialize or `include` (down to each controller's `maxIncludeDepth`) has
   * no Serializer in that namespace, listing each missing one.
   *
   * @property serializerFallback
   * @type {Boolean}
   * @default true
   * @public
   */
  serializerFallback: boolean = true;

  /**
   * Which rows of each type a request may see, declared once per namespace on
   * its `ApplicationController`. Each rule receives a query of its type and
   * the request, and returns the query narrowed:
   *
   * ```javascript
   * // app/controllers/application.js
   * class ApplicationController extends Controller {
   *   static visibility = {
   *     posts: query => query.isPublic(),
   *     comments: (query, { currentUser }) =>
   *       query.where({ userId: currentUser.id })
   *   };
   * }
   * ```
   *
   * Lumen applies the rule wherever it loads rows of that type for a request
   * in the namespace: `index` and its page links, `show`, `update` and
   * `destroy` (a hidden record is `404 Not Found`, like a missing one), every
   * relationship's resource linkage, `included` resources at any depth, and
   * the related records referenced by a `create` or `update` (a hidden one is
   * reported as not found). A to-one relationship to a hidden record is
   * serialized as `null`; a to-many one leaves it out.
   *
   * Rules must be synchronous and may only add conditions (`where`, `not`,
   * `whereBetween`, `whereRaw`, or model scopes built from them). Load what
   * a rule needs in a `beforeAction` hook and read it from the request.
   *
   * A namespace's `ApplicationController` inherits its parent class's rules;
   * extend or replace them with `super`:
   *
   * ```javascript
   * // app/controllers/admin/application.js
   * class AdminApplicationController extends ApplicationController {
   *   static visibility = {}; // admins see everything
   * }
   * ```
   *
   * A namespace without an `ApplicationController` uses the closest ancestor
   * namespace's rules. Declaring `visibility` on any other controller is a
   * boot error: types are included across controllers, so a rule must hold
   * for the whole namespace.
   *
   * Rules do not apply to queries an application builds itself, such as a
   * custom action's `Post.where(...)` or a relationship read from a model
   * (`await post.comments`). Narrow those with `visible()`.
   *
   * **Visibility rules and model scopes**
   *
   * A model scope (`static scopes` on a Model, e.g. `Post.isPublic()`) is a
   * reusable piece of a query: it narrows the one query it is called on, and
   * only when application code calls it. A visibility rule is an access
   * policy: Lumen applies it to every query it issues for a request. The two
   * compose — a rule is usually written with a scope.
   *
   * |                   | Model scope          | Visibility rule         |
   * |-------------------|----------------------|-------------------------|
   * | Declared on       | the Model            | a namespace's           |
   * |                   |                      | `ApplicationController` |
   * | Applied           | where code calls it  | to every query Lumen    |
   * |                   |                      | issues for the request  |
   * | Sees the request  | no                   | yes                     |
   * | Per namespace     | no                   | yes                     |
   * | May use           | any query method     | conditions only         |
   * | `unscope()`       | removes it           | cannot remove it        |
   *
   * Scoping a built-in action is not the same as hiding records. With
   *
   * ```javascript
   * class PostsController extends Controller {
   *   index(request) {
   *     return super.index(request).isPublic();
   *   }
   * }
   * ```
   *
   * private posts are left out of `GET /posts`, but are still served by
   * `GET /posts/:id`, listed in the `posts` linkage of a user and in
   * `included` for `/users?include=posts`, linked from a comment's `post`,
   * and accepted as the `post` of a new comment. `posts: query =>
   * query.isPublic()` as a visibility rule closes every one of those paths.
   *
   * @property visibility
   * @type {Object}
   * @default {}
   * @public
   */
  static visibility: Visibility = {};

  /**
   * Narrow `query` with the visibility rule for its type that applies to
   * `request`'s namespace, as the built-in actions do.
   *
   * ```javascript
   * class PostsController extends Controller {
   *   drafts(request) {
   *     return this.visible(Post.where({ isPublic: false }), request);
   *   }
   * }
   * ```
   *
   * @param {Query} query - A query of any type.
   * @param {Request} request - The request object.
   * @return {Query} The same query, narrowed.
   * @public
   */
  visible<Q extends Query<unknown>>(query: Q, request: Request): Q {
    return scopeFor(this.visibility, request).apply(query);
  }

  /**
   * The Serializer to serialize (and validate the `fields` of) related
   * resources of this Controller's responses with: the related model's
   * Serializer in this Controller's namespace, falling back to the root one.
   *
   * Always this Controller's namespace — not its Serializer's, which is the
   * root one when the namespace has no Serializer for this resource.
   *
   * @private
   */
  serializerFor(model: ModelClass): Serializer<Model> {
    const { serializer, namespace } = this;

    return serializer
      ? serializer.serializerFor(model, namespace)
      : model.serializer;
  }

  /**
   * The resolved Model for a Controller instance.
   *
   * @property model
   * @type {Model}
   * @private
   */
  declare model: ModelClass<Model>;

  /**
   * A reference to the root Controller for the namespace that a Controller
   * instance is a member of.
   *
   * @property parent
   * @type {?Controller}
   * @private
   */
  declare parent: Controller | null;

  /**
   * The namespace that a Controller instance is a member of.
   *
   * @property namespace
   * @type {String}
   * @private
   */
  declare namespace: string;

  /**
   * The resolved Serializer for a Controller instance.
   *
   * @property serializer
   * @type {Serializer}
   * @private
   */
  declare serializer: Serializer<Model>;

  /**
   * A Map instance containing a reference to all the Controller within an
   * Application instance.
   *
   * @property controllers
   * @type {Map}
   * @private
   */
  declare controllers: Map<string, Controller>;

  /**
   * The visibility rules of this Controller's namespace, resolved at boot
   * from the `static visibility` of its (or the closest ancestor
   * namespace's) `ApplicationController`.
   *
   * @property visibility
   * @type {Object}
   * @private
   */
  declare visibility: Visibility;

  /**
   * A boolean value representing whether or not a Controller instance has a
   * Model.
   *
   * @property hasModel
   * @type {Boolean}
   * @private
   */
  declare hasModel: boolean;

  /**
   * A boolean value representing whether or not a Controller instance is within
   * a namespace.
   *
   * @property hasNamespace
   * @type {Boolean}
   * @private
   */
  declare hasNamespace: boolean;

  /**
   * A boolean value representing whether or not a Controller instance has a
   * Serializer.
   *
   * @property hasSerializer
   * @type {Boolean}
   * @private
   */
  declare hasSerializer: boolean;

  constructor({ model, namespace, serializer }: Controller$opts) {
    Object.assign(this, {
      model,
      namespace,
      serializer,
      // Replaced at boot with the namespace's rules (`resolveVisibility()`).
      visibility: (this.constructor as typeof Controller).visibility,
      hasModel: Boolean(model),
      hasNamespace: Boolean(namespace),
      hasSerializer: Boolean(serializer)
    });

    freezeProps(this, true, 'model', 'namespace', 'serializer');

    freezeProps(this, false, 'hasModel', 'hasNamespace', 'hasSerializer');
  }

  /**
   * This method supports filtering, sorting, pagination, including
   * relationships, and sparse fieldsets via query parameters. For more
   * information, see the [fetching resources](https://goo.gl/q7FVgZ) section of
   * the JSON API specification.
   *
   * @param {Request} request - The request object.
   * @param {Response} [response] - The response. Unused by the built-in action,
   *   but every action is called with it, so an override can take it.
   * @return {Promise} Resolves with an array of Model instances.
   * @public
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  index(request: Request, response?: Response): Query<Array<Model>> {
    return this.visible(findMany(this.model, request), request);
  }

  /**
   * This method supports including relationships, and sparse fieldsets via
   * query parameters. For more information, see the [fetching resources](
   * https://goo.gl/q7FVgZ) section of the JSON API specification.
   *
   * @param {Request} request - The request object.
   * @param {Response} [response] - The response. Unused by the built-in action,
   *   but every action is called with it, so an override can take it.
   * @return {Promise} Resolves with a Model instance with the id equal to the
   * id url parameter.
   * @public
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  show(request: Request, response?: Response): Query<Model> {
    return this.visible(findOne(this.model, request), request);
  }

  /**
   * Serve a relationship endpoint (`GET /posts/1/relationships/comments`):
   * resolve the resource that owns the relationship, which the response's
   * resource linkage is then loaded for. The relationship is the route's
   * (`request.route.relationship`). For more information, see the [fetching
   * relationships](https://jsonapi.org/format/1.0/#fetching-relationships)
   * section of the JSON API specification.
   *
   * The resource is resolved through this controller's `show`, with a
   * request for its primary key only, so whatever `show` enforces holds here
   * too: an override that narrows its query or rejects the request applies,
   * and a resource the request may not see is `404 Not Found`. Hooks see the
   * action `showRelationship` (`request.route.type` is `relationship`).
   *
   * @param {Request} request - The request object.
   * @param {Response} [response] - The response. Unused by the built-in action,
   *   but every action is called with it, so an override can take it.
   * @return {Promise} Resolves with the Model instance with the id equal to
   * the id url parameter.
   * @public
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  showRelationship(request: Request, response?: Response): Query<Model> {
    const fields = { [this.model.resourceName]: [] };

    // The request as `show` would get it for this resource, selecting no
    // attributes: the route's own params are not `show`'s.
    return this.show(
      Object.create(request, {
        params: { value: { id: request.params.id, fields } },
        defaultParams: { value: { fields } }
      })
    );
  }

  /**
   * Serve a related endpoint (`GET /posts/1/comments`): the resources the
   * relationship `request.route.relationship` of the resource with the id
   * url parameter points to. For more information, see the [fetching
   * resources](https://jsonapi.org/format/1.0/#fetching-resources) section of
   * the JSON API specification.
   *
   * The query parameters are those of the related type's controller: for a
   * to-many relationship they page, sort and filter like its `index`, for a
   * to-one one they include and select like its `show`. Visibility rules apply
   * to the related resources; the owning resource is resolved with
   * `showRelationship()` first, so one the request may not see is
   * `404 Not Found`.
   *
   * @param {Request} request - The request object.
   * @param {Response} [response] - The response. Unused by the built-in action,
   *   but every action is called with it, so an override can take it.
   * @return {Query} The related Model instances (to-many) or instance (to-one,
   * resolving to `undefined` when there is none).
   * @public
   */
  showRelated(
    request: Request,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    response?: Response
  ): Query<Array<Model>> | Query<Model> {
    const { model } = this;
    const {
      params: { id },
      route: { relationship = '' }
    } = request;
    const opts = model.relationshipFor(relationship);

    if (!opts) {
      throw new TypeError(`${model.name} has no relationship ${relationship}`);
    }

    const { type, through, model: related } = opts;
    let condition: Record<string, unknown>;

    // Each kind of relationship as a condition on the related table, so the
    // related ids are never loaded into memory (a to-many can be large).
    if (type === 'belongsTo') {
      condition = {
        [related.primaryKey]: (model.table() as Knex.QueryBuilder)
          .select(opts.foreignKey)
          .where(model.columnNameFor(model.primaryKey) as string, id)
      };
    } else if (through) {
      const inverse = related.relationshipFor(opts.inverse);

      condition = {
        [related.primaryKey]: (through.table() as Knex.QueryBuilder)
          .select(inverse?.foreignKey as string)
          .where(opts.foreignKey, id)
      };
    } else {
      condition = { [camelize(opts.foreignKey, true)]: id };
    }

    if (type === 'hasMany') {
      return this.visible(findMany(related, request).where(condition), request);
    }

    const { select } = paramsToQuery(
      related,
      merge(request.defaultParams, request.params)
    );

    return this.visible(
      related
        .select(...select)
        .where(condition)
        .first() as unknown as Query<Model>,
      request
    );
  }

  /**
   * Create and return a single Model instance that the Controller instance
   * represents. For more information, see the [creating resources](
   * https://goo.gl/4Obc9t) section of the JSON API specification.
   *
   * @param {Request} request - The request object.
   * @param {Response} response - The response object.
   * @return {Promise} Resolves with the newly created Model instance.
   * @public
   */
  async create(request: Request, response: Response): Promise<Model> {
    const { model } = this;

    const {
      url: { pathname },
      params: {
        data: { attributes, relationships }
      }
    } = request;

    await validateRelationships(
      model,
      relationships,
      scopeFor(this.visibility, request)
    );

    const record = await model.create({
      ...attributes,
      ...resolveRelationships(model, relationships)
    });

    response.setHeader(
      'Location',
      `${getDomain(request) + pathname}/${record.getPrimaryKey()}`
    );

    response.statusCode = 201;

    return record.unwrap();
  }

  /**
   * Update and return a single Model instance that the Controller instance
   * represents. For more information, see the [updating resources](
   * https://goo.gl/o2ZdOR)section of the JSON API specification.
   *
   * @param {Request} request - The request object.
   * @param {Response} [response] - The response. Unused by the built-in action,
   *   but every action is called with it, so an override can take it.
   * @return {Promise} Resolves with the updated Model if changes occur.
   * Resolves with the number `204` if no changes occur.
   * @public
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  update(request: Request, response?: Response): Promise<number | Model> {
    const { model } = this;

    return this.visible(findOne(model, request), request)
      .then(async record => {
        const {
          params: {
            data: { attributes, relationships }
          }
        } = request;

        await validateRelationships(
          model,
          relationships,
          scopeFor(this.visibility, request)
        );

        return record.update({
          ...attributes,
          ...resolveRelationships(model, relationships)
        });
      })
      .then(record => {
        if (record.didPersist) {
          return record.unwrap();
        }

        return 204;
      });
  }

  /**
   * Destroy a single Model instance that the Controller instance represents.
   * For more information, see the [deleting resources](https://goo.gl/nUZn8t)
   * section of the JSON API specification.
   *
   * @param {Request} request - The request object.
   * @param {Response} [response] - The response. Unused by the built-in action,
   *   but every action is called with it, so an override can take it.
   * @return {Promise} Resolves with the number `204`.
   * @public
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  destroy(request: Request, response?: Response): Promise<number> {
    return this.visible(findOne(this.model, request), request)
      .then(record => record.destroy())
      .then(() => 204);
  }

  /**
   * Respond to HEAD or OPTIONS requests.
   *
   * @param {Request} [request] - The request. Unused.
   * @param {Response} [response] - The response. Unused by the built-in action,
   *   but every action is called with it, so an override can take it.
   * @return {Promise} Resolves with the number `204`.
   * @public
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  preflight(request?: Request, response?: Response): Promise<number> {
    return Promise.resolve(204);
  }
}

export default Controller;
export { BUILT_IN_ACTIONS } from './constants';

export { Scope } from './visibility';
export type { Visibility } from './visibility';
export type {
  Controller$opts,
  Controller$builtIn,
  Controller$beforeAction,
  Controller$afterAction
} from './interfaces';
