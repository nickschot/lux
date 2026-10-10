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
  ControllerOptions,
  BeforeAction,
  AfterAction
} from './interfaces';

/**
 * The base class of an app's controllers. A controller handles the requests
 * for one resource; its built-in actions — `index`, `show`, `create`,
 * `update`, `destroy`, and the relationship endpoints' `showRelationship` and
 * `showRelated` — read and write records with sorting, filtering, paging,
 * `include` and sparse fieldsets, so a controller is mostly configuration:
 *
 * ```javascript
 * // app/controllers/posts.js
 * import { Controller } from 'lumen-framework';
 *
 * class PostsController extends Controller {
 *   params = ['title', 'body', 'user'];
 *   sort = ['title', 'createdAt'];
 *   maxPerPage = 50;
 * }
 *
 * export default PostsController;
 * ```
 *
 * Override a built-in action, or add a custom one, with a method that takes
 * `(request, response)`. `index` and `show` return a {@link Query}, so an
 * override can narrow it and keep everything else:
 *
 * ```javascript
 * class PostsController extends Controller {
 *   index(request, response) {
 *     return super.index(request, response).where({ isPublic: true });
 *   }
 * }
 * ```
 *
 * What an action returns becomes the response: a query, record or array of
 * records is serialized as a JSON:API document; another object or array is
 * sent as JSON, a string as the body; a number is that status, `true` a
 * `204 No Content`, `false` a `401 Unauthorized`, and `undefined` a
 * `404 Not Found`.
 *
 * A namespace's `ApplicationController` (`app/controllers/application.js`,
 * `app/controllers/admin/application.js`) holds what applies to the whole
 * namespace: its hooks run around every action in it, and it declares the
 * {@link Controller.visibility} rules and the settings
 * `rejectUnlistedAttributes`, `rejectUnlistedRelationships` and
 * `maxIncludeDepth` for every controller in it. See the
 * [controllers guide](https://github.com/nickschot/lux/blob/main/docs/guides/controllers.md).
 */
class Controller {
  /**
   * Query parameters an action may read beyond the JSON:API ones (`sort`,
   * `filter`, `page`, `include`, `fields`). Any other query parameter is a
   * `400 Bad Request`. A listed one arrives in `request.params`:
   *
   * ```javascript
   * class PostsController extends Controller {
   *   query = ['search'];
   *
   *   index(request, response) {
   *     const { search } = request.params;
   *     const posts = super.index(request, response);
   *
   *     return search ? posts.where({ body: search }) : posts;
   *   }
   * }
   * ```
   *
   * Name them with a character other than a–z (`search-term`, `searchTerm`):
   * JSON:API reserves all-lowercase names for itself, and Lumen warns about
   * them at boot.
   */
  query: Array<string> = [];

  /**
   * The attributes `?sort=` accepts, each also with `-` for descending.
   * Defaults to every attribute the controller's serializer outputs; anything
   * else is a `400 Bad Request`. Each must be a column of the model's table,
   * or the app refuses to boot.
   */
  sort: Array<string> = [];

  /**
   * The attributes `?filter[…]=` accepts. Defaults to every attribute the
   * controller's serializer outputs; anything else is a `400 Bad Request`.
   * Each must be a column of the model's table, or the app refuses to boot.
   */
  filter: Array<string> = [];

  /**
   * The attributes and relationships a `POST` or `PATCH` body may set.
   *
   * ```javascript
   * class PostsController extends Controller {
   *   params = ['title', 'body', 'user'];
   * }
   * ```
   *
   * An attribute the model has but this list doesn't name is ignored (dropped
   * from `request.params`), so clients may send read-only attributes back; a
   * relationship like that is answered with `403 Forbidden`.
   * {@link Controller.rejectUnlistedAttributes} and
   * {@link Controller.rejectUnlistedRelationships} change either. A member the
   * model doesn't have at all is a `400 Bad Request`.
   */
  params: Array<string> = [];

  /**
   * Hooks that run before each action, called with `(request, response)`.
   * Returning nothing lets the request continue; returning anything else ends
   * it, with that value as the response (`false` → `401 Unauthorized`, a
   * number → that status):
   *
   * ```javascript
   * async function requireUser(request) {
   *   if (!request.currentUser) {
   *     return false;
   *   }
   * }
   *
   * class PostsController extends Controller {
   *   beforeAction = [requireUser];
   * }
   * ```
   *
   * The hooks of a namespace's `ApplicationController` run around every action
   * in the namespace, before the controller's own. Hooks run after the
   * request's parameters are validated, and are called with `this` as the
   * controller that declares them (use `function`, not an arrow function, to
   * read it).
   */
  beforeAction: Array<BeforeAction> = [];

  /**
   * Hooks that run after each action, called with
   * `(request, response, payload)`. `payload` is the action's result — for a
   * resource, the JSON:API document about to be sent. What a hook returns is
   * sent instead, and passed to the next hook, so return `payload` when
   * leaving it as it is:
   *
   * ```javascript
   * async function addVersion(request, response, payload) {
   *   if (payload && payload.jsonapi) {
   *     return { ...payload, meta: { ...payload.meta, apiVersion: '2' } };
   *   }
   *
   *   return payload;
   * }
   *
   * class ApplicationController extends Controller {
   *   afterAction = [addVersion];
   * }
   * ```
   *
   * A namespace `ApplicationController`'s `afterAction` hooks run after the
   * controller's own.
   */
  afterAction: Array<AfterAction> = [];

  /**
   * The page size of `index` when the request gives no `?page[size]=`.
   */
  defaultPerPage: number = 25;

  /**
   * The largest `?page[size]=` `index` accepts. A larger one is a
   * `400 Bad Request`, as is a `page[size]` or `page[number]` below 1.
   */
  maxPerPage: number = 100;

  /**
   * Answer an attribute the model has but `params` does not list with
   * `403 Forbidden` (an unsupported update, per JSON:API) instead of ignoring
   * it. Off by default: clients like ember-data send every attribute back on
   * save, read-only ones (`createdAt`) included.
   *
   * Set on a namespace's `ApplicationController`, it applies to every
   * controller in the namespace (and in namespaces nested in it) that does not
   * set it itself — whatever class those controllers extend.
   *
   * @default false
   */
  declare rejectUnlistedAttributes: boolean;

  /**
   * Answer a relationship the model has but `params` does not list with
   * `403 Forbidden` (an unsupported update, per JSON:API). Turn it off to
   * ignore such relationships instead, for clients that send every
   * `belongsTo` back on save (ember-data). Like `rejectUnlistedAttributes`,
   * setting it on a namespace's `ApplicationController` sets it for the whole
   * namespace:
   *
   * ```javascript
   * class ApplicationController extends Controller {
   *   rejectUnlistedRelationships = false;
   * }
   * ```
   *
   * @default true
   */
  declare rejectUnlistedRelationships: boolean;

  /**
   * How many relationships deep an `?include` path may go on this
   * controller's routes. `comments.reactions.user` is 3 levels deep; with `1`
   * only direct relationships (`comments`) can be included. Paths deeper than
   * this are rejected with `400 Bad Request`.
   *
   * Set on a namespace's `ApplicationController`, it applies to every
   * controller in the namespace (and in namespaces nested in it) that does not
   * set it itself — whatever class those controllers extend.
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
   * @default 3
   */
  declare maxIncludeDepth: number;

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
   * @default true
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
   * A nested namespace follows its parent namespace's rules unless its
   * `ApplicationController` declares its own — whether that class extends
   * `Controller` or the parent's `ApplicationController`, and also when the
   * namespace has no `ApplicationController`. Replace them, or build on them
   * through `super` in a class that extends the parent's:
   *
   * ```javascript
   * // app/controllers/admin/application.js
   * class AdminApplicationController extends Controller {
   *   static visibility = {}; // admins see everything
   * }
   *
   * // app/controllers/members/application.js
   * class MembersApplicationController extends ApplicationController {
   *   static visibility = { ...super.visibility, drafts: … };
   * }
   * ```
   *
   * Declaring `visibility` on any other controller is a boot error: types are
   * included across controllers, so a rule must hold for the whole
   * namespace.
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
   * @param query - A query of any type.
   * @param request - The request object.
   * @returns The same query, narrowed.
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
   * @internal
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
   * @internal
   */
  declare model: ModelClass<Model>;

  /**
   * A reference to the root Controller for the namespace that a Controller
   * instance is a member of.
   *
   * @internal
   */
  declare parent: Controller | null;

  /**
   * The namespace that a Controller instance is a member of.
   *
   * @internal
   */
  declare namespace: string;

  /**
   * The resolved Serializer for a Controller instance.
   *
   * @internal
   */
  declare serializer: Serializer<Model>;

  /**
   * A Map instance containing a reference to all the Controller within an
   * Application instance.
   *
   * @internal
   */
  declare controllers: Map<string, Controller>;

  /**
   * The visibility rules of this Controller's namespace, resolved at boot
   * from the `static visibility` of the closest `ApplicationController`, from
   * its own namespace's up, that declares rules.
   *
   * @internal
   */
  declare visibility: Visibility;

  /**
   * A boolean value representing whether or not a Controller instance has a
   * Model.
   *
   * @internal
   */
  declare hasModel: boolean;

  /**
   * A boolean value representing whether or not a Controller instance is within
   * a namespace.
   *
   * @internal
   */
  declare hasNamespace: boolean;

  /**
   * A boolean value representing whether or not a Controller instance has a
   * Serializer.
   *
   * @internal
   */
  declare hasSerializer: boolean;

  constructor({ model, namespace, serializer }: ControllerOptions) {
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
   * `GET /posts`: the records, sorted, filtered and paged by the request's
   * query parameters, with its `include` and `fields`. Visibility rules apply.
   *
   * @param request - The request.
   * @param response - The response. Unused by the built-in action, but every
   * action is called with it, so an override can take it.
   * @returns A query of the page of records; narrow it in an override.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  index(request: Request, response?: Response): Query<Array<Model>> {
    return this.visible(findMany(this.model, request), request);
  }

  /**
   * `GET /posts/1`: the record with the route's id, with the request's
   * `include` and `fields`. Visibility rules apply; a record the request may
   * not see, like a missing one, is a `404 Not Found`.
   *
   * @param request - The request.
   * @param response - The response. Unused by the built-in action, but every
   * action is called with it, so an override can take it.
   * @returns A query of the record; narrow it in an override.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  show(request: Request, response?: Response): Query<Model> {
    return this.visible(findOne(this.model, request), request);
  }

  /**
   * `GET /posts/1/relationships/comments`, a relationship endpoint: resolves
   * the resource that owns the relationship (`request.route.relationship`),
   * whose resource linkage is the response.
   *
   * The resource is resolved through this controller's `show`, asking for its
   * primary key only, so whatever `show` enforces holds here too: an override
   * that narrows its query or rejects the request applies, and a resource the
   * request may not see is a `404 Not Found`. Hooks see the action
   * `showRelationship` (`request.route.type` is `relationship`).
   *
   * @param request - The request.
   * @param response - The response. Unused by the built-in action, but every
   * action is called with it, so an override can take it.
   * @returns A query of the owning record.
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
   * `GET /posts/1/comments`, a related endpoint: the resources the
   * relationship `request.route.relationship` of the record with the route's id
   * points to.
   *
   * The query parameters are those of the related type's controller: for a
   * to-many relationship they page, sort and filter like its `index`, for a
   * to-one one they include and select like its `show`. Visibility rules apply
   * to the related resources; the owning record is resolved with
   * {@link Controller.showRelationship} first, so one the request may not see
   * is a `404 Not Found`. Hooks see the action `showRelated`
   * (`request.route.type` is `related`).
   *
   * @param request - The request.
   * @param response - The response. Unused by the built-in action, but every
   * action is called with it, so an override can take it.
   * @returns A query of the related records (to-many), or of the related record
   * (to-one, resolving with `undefined` when there is none).
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
   * `POST /posts`: creates a record from the request body's attributes and
   * relationships, after checking that every related record exists and is
   * visible (a `404 Not Found` otherwise). Answers `201 Created` with a
   * `Location` header.
   *
   * @param request - The request.
   * @param response - The response, for the status and `Location` header.
   * @returns Resolves with the new record.
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
   * `PATCH /posts/1`: updates the record with the route's id from the request
   * body, after checking that every related record exists and is visible.
   * A record the request may not see is a `404 Not Found`.
   *
   * @param request - The request.
   * @param response - The response. Unused by the built-in action, but every
   * action is called with it, so an override can take it.
   * @returns Resolves with the updated record, or with `204` (`204 No Content`)
   * when nothing changed.
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
   * `DELETE /posts/1`: deletes the record with the route's id. A record the
   * request may not see is a `404 Not Found`.
   *
   * @param request - The request.
   * @param response - The response. Unused by the built-in action, but every
   * action is called with it, so an override can take it.
   * @returns Resolves with `204` (`204 No Content`).
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  destroy(request: Request, response?: Response): Promise<number> {
    return this.visible(findOne(this.model, request), request)
      .then(record => record.destroy())
      .then(() => 204);
  }

  /**
   * Answers `OPTIONS` requests: `204 No Content`, with the path's methods in
   * `Allow`.
   *
   * @param request - The request. Unused.
   * @param response - The response. Unused by the built-in action, but every
   * action is called with it, so an override can take it.
   * @returns Resolves with `204`.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  preflight(request?: Request, response?: Response): Promise<number> {
    return Promise.resolve(204);
  }
}

/**
 * The defaults of the settings a controller inherits from its namespace's
 * `ApplicationController` (`NAMESPACE_SETTINGS`). They live on the prototype,
 * not in field initializers, so that only a controller that sets one has it
 * as an own property — which is how `createController` tells "set here" from
 * "take the namespace's".
 */
Object.defineProperties(Controller.prototype, {
  rejectUnlistedAttributes: { value: false, writable: true },
  rejectUnlistedRelationships: { value: true, writable: true },
  maxIncludeDepth: { value: 3, writable: true }
});

export default Controller;
export { BUILT_IN_ACTIONS, NAMESPACE_SETTINGS } from './constants';

export { Scope } from './visibility';
export type { Visibility } from './visibility';
export type {
  ControllerOptions,
  BuiltInAction,
  BeforeAction,
  AfterAction
} from './interfaces';
