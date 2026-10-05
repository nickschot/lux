import { posix } from 'path';

import { dasherize } from 'inflection';

import { VERSION } from '../jsonapi';
import { freezeProps } from '../freezeable';
import closestAncestor from '../loader/resolver/utils/closest-ancestor';
import type { Bundle$Namespace } from '../loader';
import underscore from '../../utils/underscore';
import { dasherizeKeys } from '../../utils/transform-keys';
import type { Model, ModelClass } from '../database';
import type {
  JSONAPI$Document,
  JSONAPI$DocumentLinks,
  JSONAPI$ResourceObject,
  JSONAPI$RelationshipObject,
  JSONAPI$RelationshipDocument
} from '../jsonapi';

import type {
  Serializer$fields,
  Serializer$opts,
  Serializer$routed
} from './interfaces';
import { Scope } from '../controller/visibility';
import loadLinkage from './utils/load-linkage';
import type { Linkage } from './utils/load-linkage';
import { createIncludeTree } from './utils/include-tree';
import type { IncludeTree } from './utils/include-tree';

/**
 * ## Overview
 *
 * The Serializer class is used to describe which attributes and relationships
 * to include for a particular resource.
 *
 * The attributes and relationships you declare in a Serializer will determine
 * the attributes and relationships that will be included in the response from
 * the resource that the Serializer represents.
 *
 * #### Attributes
 *
 * You can add attributes to your serializer using an array assigned to the
 * class property `attributes` like the example below.
 *
 * ```javascript
 * class UsersSerializer extends Serializer {
 *   attributes = [
 *     'name',
 *     'email',
 *     'username',
 *     'createdAt',
 *     'updatedAt'
 *   ];
 * }
 * ```
 *
 * Since the attributes required for a resource are declared ahead of time in a
 * Serializer, Lumen will optimize SQL queries for the resource to only include
 * what the Serializer needs to build the response.
 *
 * ```javascript
 * import { Serializer } from 'lumen-framework';
 *
 * class PostsSerializer extends Serializer {
 *   attributes = [
 *     'body',
 *     'title',
 *     'createdAt'
 *   ];
 * }
 *
 * export default PostsSerializer;
 * ```
 *
 * The Serializer above would result in resources returned from the `/posts`
 * endpoint to only include the `body`, `title`, and `createdAt` attributes. If
 * we wanted include an additional attribute such as `isPublic`, we would have
 * to add `'isPublic'` to the `attributes` property.
 *
 * ```javascript
 * import { Serializer } from 'lumen-framework';
 *
 * class PostsSerializer extends Serializer {
 *   attributes = [
 *     'body',
 *     'title',
 *     'isPublic',
 *     'createdAt'
 *   ];
 * }
 *
 * export default PostsSerializer;
 * ```
 *
 * #### Associations
 *
 * Similar to `attributes` you can declare associations by adding relationship
 * names to either the `hasOne` or `hasMany` property arrays on a Serializer.
 *
 * Serializers are not concerned with ownership when it comes to associations,
 * so both `hasOne` and `belongsTo` associations can be specified in the
 * `hasOne` array property.
 *
 * ```javascript
 * import { Model } from 'lumen-framework';
 *
 * class Post extends Model {
 *  static hasOne = {
 *    image: {
 *      inverse: 'post'
 *    }
 *  };
 *
 *  static hasMany = {
 *    tags: {
 *      inverse: 'posts',
 *      through: 'categorization'
 *    },
 *
 *    comments: {
 *      inverse: 'post'
 *    }
 *  };
 *
 *  static belongsTo = {
 *    user: {
 *      inverse: 'posts'
 *    }
 *  };
 * }
 *
 * export default Post;
 * ```
 *
 * To include the `user` and `image` associations in the response returned from
 * the `/posts` endpoint, we must specify both associations in the `hasOne`
 * property array of the Serializer.
 *
 * ```javascript
 * import { Serializer } from 'lumen-framework';
 *
 * class PostsSerializer extends Serializer {
 *  hasOne = [
 *    'user',
 *    'image'
 *  ];
 * }
 *
 * export default PostsSerializer;
 * ```
 *
 * If we wanted to also include the `tags` and `comments` in the response, we
 * have to add a `hasMany` array property containing `'tags'` and `'comments'`.
 *
 * ```javascript
 * import { Serializer } from 'lumen-framework';
 *
 * class PostsSerializer extends Serializer {
 *  hasOne = [
 *    'user',
 *    'image'
 *  ];
 *
 *  hasMany = [
 *    'tags',
 *    'comments'
 *  ];
 * }
 *
 * export default PostsSerializer;
 * ```
 *
 * You no longer need to specify that `tags` is a many to many relationship
 * using the `Categorization` model as a join table.
 *
 * #### Including Related Resources
 *
 * When requesting related resources for an endpoint, the included resource will
 * follow the serialization rules defined by the included resources Serializer.
 *
 * If we request that the `posts` association is included from the `/users`
 * endpoint, we will only get the `attributes` that the `PostsSerializer` has
 * defined even though the response is processed by the `UsersSerializer`.
 * The same goes for relationships: each included resource carries the
 * `relationships` its own Serializer declares in `hasOne` and `hasMany`.
 *
 * Included resources follow the request's namespace: from `/admin/posts`,
 * included comments are serialized by `AdminCommentsSerializer` when it
 * exists and by `CommentsSerializer` otherwise (the same fallback a
 * namespaced Controller uses), and their links point into `/admin`.
 *
 * Relationship paths may be nested, e.g. `/posts?include=comments.user`, up
 * to the controller's `maxIncludeDepth` (3 by default). The intermediate
 * resources (the comments) are included along with the leaves (their users).
 *
 * #### Sparse Fieldsets
 *
 * A request may narrow the fields of each resource type with `fields[TYPE]`
 * (e.g. `/posts?include=user&fields[posts]=title,user&fields[users]=name`).
 * A fieldset applies to every resource of its type in the document — primary
 * data and included resources alike — and selects attributes and
 * relationships: anything it does not name is left out, and an empty fieldset
 * leaves out all of them. It may name only fields the type's Serializer
 * declares (in `attributes`, `hasOne` or `hasMany`); any other name is
 * answered with `400 Bad Request`.
 *
 * #### Namespaces
 *
 * When using namespaces, you are not required to have a Serializer for each
 * resource as long as a Serializer for the given resource can be resolved
 * upstream.
 *
 * For example, if you have a `posts` resource and you decide to implement an
 * admin namespace, you only need to export an `AdminPostsSerializer` from
 * `app/serializers/admin/posts.js` if you want to specify different attributes
 * or relationships than the `PostsSerializer` exported from
 * `app/serializers/posts.js`.
 *
 * In the event that you do want to specify different attributes or
 * relationships that the `PostsSerializer` exported from
 * `app/serializers/posts.js`, you are not required to extend `PostsSerializer`.
 *
 * ```javascript
 * import { Serializer } from 'lumen-framework';
 *
 * class PostsSerializer extends Serializer {
 *   attributes = [
 *     'body',
 *     'title',
 *     'createdAt'
 *   ];
 *
 *   hasOne = [
 *     'user',
 *     'image'
 *   ];
 *
 *   hasMany = [
 *     'tags',
 *     'comments'
 *   ];
 * }
 *
 * export default PostsSerializer;
 * ```
 *
 * To add the `isPublic` attribute to the response payload of requests to a
 * `/admin/posts` endpoint we can do either of the following examples:
 *
 * ```javascript
 * // app/serializers/admin/posts.js
 * import PostsSerializer from 'app/serializers/posts';
 *
 * class AdminPostsSerializer extends PostsSerializer {
 *   attributes = [
 *     'body',
 *     'title',
 *     'isPublic',
 *     'createdAt'
 *   ];
 * }
 *
 * export default AdminPostsSerializer;
 * ```
 *
 * OR
 *
 * ```javascript
 * // app/serializers/admin/posts.js
 * import { Serializer } from 'lumen-framework';
 *
 * class AdminPostsSerializer extends Serializer {
 *   attributes = [
 *     'body',
 *     'title',
 *     'isPublic',
 *     'createdAt'
 *   ];
 *
 *   hasOne = [
 *     'user',
 *     'image'
 *   ];
 *
 *   hasMany = [
 *     'tags',
 *     'comments'
 *   ];
 * }
 *
 * export default AdminPostsSerializer;
 * ```
 *
 * Even with inheritance, the examples above are a tad repetitive. We can
 * improve this code by exporting constants from `app/serializers/posts.js`.
 *
 * ```javascript
 * import { Serializer } from 'lumen-framework';
 *
 * export const HAS_ONE = [
 *   'user',
 *   'image'
 * ];
 *
 * export const HAS_MANY = [
 *   'tags',
 *   'comments'
 * ];
 *
 * export const ATTRIBUTES = [
 *   'body',
 *   'title',
 *   'createdAt'
 * ];
 *
 * class PostsSerializer extends Serializer {
 *   hasOne = HAS_ONE;
 *   hasMany = HAS_MANY;
 *   attributes = ATTRIBUTES;
 * }
 *
 * export default PostsSerializer;
 * ```
 *
 * If we choose to use inheritance, our code can look like this:
 *
 * ```javascript
 * // app/serializers/admin/posts.js
 * import PostsSerializer, { ATTRIBUTES } from 'app/serializers/posts';
 *
 * class AdminPostsSerializer extends PostsSerializer {
 *   attributes = [
 *     ...ATTRIBUTES,
 *     'isPublic'
 *   ];
 * }
 *
 * export default AdminPostsSerializer;
 * ```
 *
 * If we choose not use inheritance, our code can look like this:
 *
 * ```javascript
 * // app/serializers/admin/posts.js
 * import { Serializer } from 'lumen-framework';
 * import { HAS_ONE, HAS_MANY, ATTRIBUTES } from 'app/serializers/posts';
 *
 * class AdminPostsSerializer extends PostsSerializer {
 *   hasOne = HAS_ONE;
 *   hasMany = HAS_MANY;
 *
 *   attributes = [
 *     ...ATTRIBUTES,
 *     'isPublic'
 *   ];
 * }
 *
 * export default AdminPostsSerializer;
 * ```
 *
 * @class Serializer
 * @public
 */
class Serializer<T extends Model> {
  /**
   * An Array of the `hasOne` or `belongsTo` relationships on a Serializer
   * instance's Model to include in the
   * `relationships` resource object of a serialized payload.
   *
   * ```javascript
   * class PostsSerializer extends Serializer {
   *   hasOne = [
   *     'user'
   *   ];
   * }
   * ```
   *
   * @property hasOne
   * @type {Array}
   * @default []
   * @public
   */
  hasOne: Array<string> = [];

  /**
   * An Array of the `hasMany` relationships on a Serializer instance's Model to
   * include in the `relationships` resource object of a serialized payload.
   *
   * ```javscript
   * class PostsSerializer extends Serializer {
   *   hasMany = [
   *     'comments'
   *   ];
   * }
   * ```
   *
   * @property hasMany
   * @type {Array}
   * @default []
   * @public
   */
  hasMany: Array<string> = [];

  /**
   * An array of the `attributes` on a Serializer instance's Model to include in
   * the `attributes` resource object of a serialized payload.
   *
   * ```javscript
   * class PostsSerializer extends Serializer {
   *   attributes = [
   *     'body',
   *     'title'
   *   ];
   * }
   * ```
   *
   * @property attributes
   * @type {Array}
   * @default []
   * @public
   */
  attributes: Array<string> = [];

  /**
   * The `hasMany` relationships to serialize as links only: without resource
   * linkage (`data`), so a resource with many related records stays small and
   * their ids are not loaded. Clients load them from the relationship's
   * `related` link when needed (ember-data does so for an async `hasMany`).
   *
   * ```javascript
   * class PostsSerializer extends Serializer {
   *   hasMany = ['comments', 'tags'];
   *
   *   linksOnly = ['comments'];
   * }
   * ```
   *
   * ```json
   * "comments": {
   *   "links": {
   *     "self": "https://api.example.com/posts/1/relationships/comments",
   *     "related": "https://api.example.com/posts/1/comments"
   *   }
   * }
   * ```
   *
   * A relationship a request includes (`?include=comments`) keeps its `data`,
   * since JSON:API requires every included resource to be linked from the
   * document. So does one without a related endpoint where it is serialized
   * (a namespace without a resource for the type), which would otherwise be
   * left with nothing to load it from.
   *
   * Each name must be in `hasMany`, and its related type must have a
   * controller in this Serializer's namespace to serve the related endpoint,
   * or the application refuses to boot.
   *
   * @property linksOnly
   * @type {Array}
   * @default []
   * @public
   */
  linksOnly: Array<string> = [];

  /**
   * The resolved Model that a Serializer instance represents.
   *
   * @property model
   * @type {Model}
   * @private
   */
  declare model: ModelClass<T>;

  /**
   * A reference to the root Serializer for the namespace that a Serializer
   * instance is a member of.
   *
   * @property parent
   * @type {?Serializer}
   * @private
   */
  declare parent: Serializer<Model> | null;

  /**
   * The namespace that a Serializer instance is a member of.
   *
   * @property namespace
   * @type {String}
   * @private
   */
  declare namespace: string;

  /**
   * Every Serializer of the application, keyed by namespaced path (`posts`,
   * `admin/posts`). Attached once all of them are built, and used by
   * `serializerFor()` to serialize related resources in this Serializer's
   * namespace.
   *
   * @property serializers
   * @type {Map}
   * @private
   */
  declare serializers?: Bundle$Namespace<Serializer<Model>>;

  constructor({ model, parent, namespace }: Serializer$opts<T>) {
    Object.assign(this, {
      model,
      parent,
      namespace
    });

    freezeProps(this, true, 'model', 'parent', 'namespace');
  }

  /**
   * Transform an array of Model instances or a single Model instance into a
   * [JSON API](http://jsonapi.org) document object.
   *
   * @method format
   *
   * @param {Object} options - An options object used for building the
   * returned [JSON API](http://jsonapi.org) document object.
   *
   * @param {Model|Array} options.data - The Model instance or array of
   * Model instances to transform into the returned [JSON API](
   * http://jsonapi.org) document object.
   *
   * @param {Object} options.links - An object containing links to include in
   * the top level links object of the returned [JSON API](http://jsonapi.org)
   * document object.
   *
   * @param {String} options.domain - A string used to build links included in
   * the resource and relationship objects in the returned [JSON API](
   * http://jsonapi.org) document object.
   *
   * @param {Array} options.include - An array of relationship paths (e.g.
   * `'comments'` or `'comments.user'`) whose resources should be added to the
   * top level included object of the returned [JSON API](http://jsonapi.org)
   * document object. Intermediate resources of a nested path are included too.
   *
   * @param {Object} options.fields - The request's sparse fieldsets, keyed by
   * type. Each narrows the attributes and relationships of every resource of
   * its type in the document; primary data was already loaded with its own.
   *
   * @param {Scope} options.scope - The visibility rules of the request. Every
   * related record loaded for the document — its linkage and `included` — is
   * narrowed by them; primary data was already loaded through them.
   *
   * @param {Object} options.meta - Top level meta information of the returned
   * document (`{ total }` for a page of a collection), if any.
   *
   * @param {String} options.namespace - The namespace of the request, i.e. of
   * the Controller handling it. Every link in the document is built in it, and
   * included resources are serialized by their Serializer in it (falling back
   * to the root). Defaults to this Serializer's namespace — which is the root
   * one when a namespaced Controller has no Serializer of its own, so the
   * Controller passes its namespace explicitly.
   *
   * @param {Function} options.routed - Whether the application serves a path
   * (`/posts/:dynamic/relationships/user`). A relationship is only given the
   * links of the endpoints it is served by, since JSON:API requires every
   * relationship `self` link to be served. Without it, none are.
   *
   * @return {Promise} Resolves with a [JSON API](http://jsonapi.org) document
   * object.
   *
   * @private
   */
  async format({
    data,
    meta,
    links,
    domain,
    include,
    fields = {},
    scope = Scope.none,
    namespace = this.namespace,
    routed = notRouted
  }: {
    data: T | Array<T>;
    meta?: JSONAPI$Document['meta'];
    links: JSONAPI$DocumentLinks;
    domain: string;
    include: Array<string>;
    fields?: Serializer$fields;
    scope?: Scope;
    namespace?: string;
    routed?: Serializer$routed;
  }): Promise<JSONAPI$Document> {
    const tree = createIncludeTree(include);
    const included = new Map<string, JSONAPI$ResourceObject>();
    const records = Array.isArray(data) ? data : [data];
    const names = [...this.hasOne, ...this.hasMany];
    const linksOnly = this.linksOnlyFor(tree, namespace, routed);

    // Primary data takes the same path as every include level: its linkage
    // is batch-loaded per relationship, then `included` is built from it.
    const linkage = await loadLinkage(
      this.model,
      records,
      linkedNames(names, fields[this.model.resourceName], tree).filter(
        name => !linksOnly.has(name)
      ),
      scope
    );
    const primary = await Promise.all(
      records.map(item =>
        this.formatOne({
          item,
          domain,
          fields,
          routed,
          linksOnly,
          namespace,
          linkage: linkage.get(String(item.getPrimaryKey())),
          links: Array.isArray(data) ? undefined : false
        })
      )
    );

    await this.includeRelated({
      tree,
      names,
      scope,
      domain,
      linkage,
      fields,
      routed,
      included,
      namespace,
      model: this.model
    });

    let serialized: Record<string, unknown> = {
      data: Array.isArray(data) ? primary : primary[0]
    };

    // A compound document must not repeat a primary resource in `included`.
    primary.forEach(resource => {
      included.delete(resourceKey(resource));
    });

    if (included.size) {
      serialized = {
        ...serialized,
        included: Array.from(included.values())
      };
    }

    // The document is assembled from dynamic model data; its pieces are typed
    // structurally above, so assert the fully-built JSON:API shape here.
    return {
      ...serialized,
      ...(meta && { meta }),
      links,

      jsonapi: {
        version: VERSION
      }
    } as JSONAPI$Document;
  }

  /**
   * Transform a single Model instance into a [JSON API](http://jsonapi.org)
   * resource object. Its attributes are the ones loaded on `item`, declared by
   * this Serializer and kept by the request's fieldset for its type; its
   * relationships, those declared and kept, are built from `linkage`,
   * batch-loaded by `loadLinkage()`, without touching the database.
   *
   * @method formatOne
   *
   * @param {Object} options - An options object used for building the returned
   * [JSON API](http://jsonapi.org) resource object.
   *
   * @param {Model} options.item - The Model instance to transform into the
   * returned [JSON API](http://jsonapi.org) resource object.
   *
   * @param {Object} options.links - An object containing links to include in
   * the top level links object of the returned [JSON API](http://jsonapi.org)
   * resource object.
   *
   * @param {String} options.domain - A string used to build links included in
   * the top level links object or relationship links objects in the returned
   * [JSON API](http://jsonapi.org) resource object.
   *
   * @param {Object} options.linkage - The resource linkage (related primary
   * keys per relationship key) to serialize relationships from.
   *
   * @param {Object} options.fields - The request's sparse fieldsets, keyed by
   * type. Only the one for this resource's type applies.
   *
   * @param {String} options.namespace - The namespace to build links in.
   * Defaults to this Serializer's; included resources pass the namespace of
   * the request, so every link in a document points into the same namespace.
   *
   * @param {Function} options.routed - Whether the application serves a path;
   * see `format()`.
   *
   * @param {Set} options.linksOnly - The relationships to serialize without
   * resource linkage; see `linksOnlyFor()`.
   *
   * @return {Promise} Resolves with a [JSON API](http://jsonapi.org) resource
   * object.
   *
   * @private
   */
  async formatOne({
    item,
    links,
    domain,
    linkage = {},
    fields = {},
    namespace = this.namespace,
    routed = notRouted,
    linksOnly = new Set()
  }: {
    item: T;
    links?: boolean;
    domain: string;
    linkage?: Linkage;
    fields?: Serializer$fields;
    namespace?: string;
    routed?: Serializer$routed;
    linksOnly?: Set<string>;
  }): Promise<JSONAPI$ResourceObject> {
    const { resourceName: type } = item;
    const id = String(item.getPrimaryKey());
    const fieldset = fields[type];
    const keep = (name: string) => !fieldset || fieldset.includes(name);
    const names = [...this.hasOne, ...this.hasMany].filter(keep);

    const attributes = dasherizeKeys(
      item.getAttributes(
        ...Object.keys(item.rawColumnData).filter(
          key => this.attributes.includes(key) && keep(key)
        )
      )
    );

    const serialized: JSONAPI$ResourceObject = {
      id,
      type,
      attributes: attributes as JSONAPI$ResourceObject['attributes']
    };

    const relationships = names.reduce<
      Record<string, JSONAPI$RelationshipObject>
    >(
      (hash, name) => ({
        ...hash,
        [dasherize(underscore(name))]: {
          ...(!linksOnly.has(name) &&
            this.formatLinkage(
              this.model.relationshipFor(name)?.model.resourceName,
              linkage[name]
            )),
          ...this.relationshipLinksFor({
            name,
            type,
            id,
            domain,
            routed,
            namespace
          })
        }
      }),
      {}
    );

    if (Object.keys(relationships).length) {
      serialized.relationships = relationships;
    }

    if (links || typeof links !== 'boolean') {
      serialized.links = {
        self: this.linkFor(domain, type, id, namespace)
      };
    }

    return serialized;
  }

  /**
   * The document a relationship endpoint (`/posts/1/relationships/user`)
   * responds with: the relationship of `item` named `name` as resource
   * linkage, narrowed by `scope` like any other linkage, and its links.
   *
   * @method formatRelationship
   * @private
   */
  async formatRelationship({
    item,
    name,
    domain,
    scope = Scope.none,
    namespace = this.namespace,
    routed = notRouted
  }: {
    item: T;
    name: string;
    domain: string;
    scope?: Scope;
    namespace?: string;
    routed?: Serializer$routed;
  }): Promise<JSONAPI$RelationshipDocument> {
    const id = String(item.getPrimaryKey());
    const linkage = await loadLinkage(this.model, [item], [name], scope);
    const { links = {} } = this.relationshipLinksFor({
      id,
      name,
      domain,
      routed,
      namespace,
      type: item.resourceName
    });

    return {
      ...this.formatLinkage(
        this.model.relationshipFor(name)?.model.resourceName,
        linkage.get(id)?.[name]
      ),
      links,
      jsonapi: {
        version: VERSION
      }
    };
  }

  /**
   * The relationships of `linksOnly` to serialize without resource linkage at
   * one level of a document, whose include tree is `tree`: those not included
   * there (an included resource must be linked from the document) and with a
   * related endpoint in `namespace` to load them from.
   *
   * @method linksOnlyFor
   * @private
   */
  linksOnlyFor(
    tree: IncludeTree,
    namespace: string,
    routed: Serializer$routed
  ): Set<string> {
    const route = this.pathFor(this.model.resourceName, ':dynamic', namespace);

    return new Set(
      this.linksOnly.filter(
        name =>
          !tree.has(name) && routed(`${route}/${dasherize(underscore(name))}`)
      )
    );
  }

  /**
   * The `links` of the relationship `name` of the resource `type`/`id`: a
   * `self` link to its relationship endpoint (`/posts/1/relationships/user`)
   * and a `related` link to its related endpoint (`/posts/1/user`), each when
   * the application serves it in `namespace` (JSON:API requires every
   * relationship `self` link to be served). Without either the relationship
   * has no links.
   *
   * A related resource's own URL (`/users/2`) is never a relationship's
   * `related` link: that link must not change when the relationship's content
   * does.
   *
   * @method relationshipLinksFor
   * @private
   */
  relationshipLinksFor({
    id,
    type,
    name,
    domain,
    routed,
    namespace
  }: {
    id: string;
    type: string;
    name: string;
    domain: string;
    routed: Serializer$routed;
    namespace: string;
  }): Pick<JSONAPI$RelationshipObject, 'links'> {
    const segment = dasherize(underscore(name));
    const route = this.pathFor(type, ':dynamic', namespace);
    const base = domain + this.pathFor(type, id, namespace);
    const links: NonNullable<JSONAPI$RelationshipObject['links']> = {};

    if (routed(`${route}/relationships/${segment}`)) {
      links.self = `${base}/relationships/${segment}`;
    }

    if (routed(`${route}/${segment}`)) {
      links.related = `${base}/${segment}`;
    }

    return Object.keys(links).length ? { links } : {};
  }

  /**
   * Build a [JSON API](http://jsonapi.org) relationship object from resource
   * linkage: `{ data }`, where `data` is an identifier (or `null`) for a
   * to-one relationship and an array of them for a to-many one. Its links
   * come from `relationshipLinksFor()`.
   *
   * @method formatLinkage
   * @private
   */
  formatLinkage(
    type: string | undefined,
    linkage: Array<string> | string | null | undefined
  ): JSONAPI$RelationshipObject {
    if (Array.isArray(linkage)) {
      return {
        data: type ? linkage.map(id => ({ id, type })) : []
      };
    }

    if (linkage == null || !type) {
      return {
        data: null
      };
    }

    return {
      data: {
        id: linkage,
        type
      }
    };
  }

  /**
   * Add `records` (instances of `model`) to `included` as resource objects,
   * then recurse into the relationships named in `tree`. Each is serialized by
   * `model`'s Serializer in this Serializer's namespace (`serializerFor()`), so
   * `/admin/posts?include=comments` uses `AdminCommentsSerializer` when there
   * is one and `CommentsSerializer` otherwise. The relationships of every level
   * are batch-loaded with one query per relationship, not one per record.
   *
   * @method addIncluded
   * @private
   */
  async addIncluded({
    model,
    records,
    tree,
    scope,
    domain,
    fields,
    routed,
    included,
    namespace
  }: {
    model: ModelClass;
    records: Array<Model>;
    tree: IncludeTree;
    scope: Scope;
    domain: string;
    fields: Serializer$fields;
    routed: Serializer$routed;
    included: Map<string, JSONAPI$ResourceObject>;
    namespace: string;
  }): Promise<void> {
    // Resolved in the request's namespace at every level — never in that of
    // whichever (possibly root, fallback) Serializer serialized the parent.
    const serializer = this.serializerFor(model, namespace);
    const unique = Array.from(
      new Map(records.map(record => [record.getPrimaryKey(), record])).values()
    );

    if (!unique.length) {
      return;
    }

    const names = [...serializer.hasOne, ...serializer.hasMany];
    const linksOnly = serializer.linksOnlyFor(tree, namespace, routed);
    const linkage = await loadLinkage(
      model,
      unique,
      linkedNames(names, fields[model.resourceName], tree).filter(
        name => !linksOnly.has(name)
      ),
      scope
    );

    for (const item of unique) {
      const id = String(item.getPrimaryKey());
      const key = resourceKey({ id, type: item.resourceName });

      // Reached through more than one path: the first serialization wins, the
      // linkage is identical either way.
      if (!included.has(key)) {
        included.set(
          key,
          await serializer.formatOne({
            item,
            domain,
            fields,
            routed,
            linksOnly,
            linkage: linkage.get(id),
            namespace
          })
        );
      }
    }

    await this.includeRelated({
      tree,
      names,
      model,
      scope,
      domain,
      fields,
      routed,
      linkage,
      included,
      namespace
    });
  }

  /**
   * Load the records `linkage` points to through each relationship named in
   * `tree` — one query per relationship, selecting the attributes their
   * Serializer (narrowed by the request's `fields[type]`) will serialize —
   * and add them to `included` with `addIncluded()`. Only the relationships in
   * `names`, those the parent's Serializer exposes, are followed. The tree is
   * walked in request order, so `included` is deterministic.
   *
   * @method includeRelated
   * @private
   */
  async includeRelated({
    model,
    names,
    linkage,
    tree,
    scope,
    domain,
    fields,
    routed,
    included,
    namespace
  }: {
    model: ModelClass;
    names: Array<string>;
    linkage: Map<string, Linkage>;
    tree: IncludeTree;
    scope: Scope;
    domain: string;
    fields: Serializer$fields;
    routed: Serializer$routed;
    included: Map<string, JSONAPI$ResourceObject>;
    namespace: string;
  }): Promise<void> {
    for (const [name, children] of tree) {
      const opts = model.relationshipFor(name);

      if (!opts || !names.includes(name)) {
        continue;
      }

      const { model: next } = opts;
      const ids = new Set<string>();

      linkage.forEach(({ [name]: value }) => {
        (Array.isArray(value) ? value : [value]).forEach(relatedId => {
          if (relatedId != null) {
            ids.add(relatedId);
          }
        });
      });

      if (ids.size) {
        // The linkage is already narrowed; applying the rules again costs
        // nothing and keeps a hidden record out even if it were not.
        const records = await scope.apply(
          next
            .select(
              next.primaryKey,
              ...this.attributesFor(next, namespace, fields)
            )
            .where({ [next.primaryKey]: Array.from(ids) })
        );

        await this.addIncluded({
          scope,
          domain,
          fields,
          routed,
          records,
          included,
          namespace,
          model: next,
          tree: children
        });
      }
    }
  }

  /**
   * The attributes to load for included resources of `model`: those its
   * Serializer in `namespace` declares, narrowed to the request's
   * `fields[type]` when there is one — possibly to none.
   *
   * @method attributesFor
   * @private
   */
  attributesFor(
    model: ModelClass,
    namespace: string,
    fields: Serializer$fields
  ): Array<string> {
    const attributes = this.serializerFor(model, namespace).attributes.filter(
      attr => model.attributeNames.includes(attr)
    );
    const fieldset = fields[model.resourceName];

    return fieldset
      ? attributes.filter(attr => fieldset.includes(attr))
      : attributes;
  }

  /**
   * Resolve the Serializer for `model` in `namespace` (this Serializer's by
   * default), the way a namespaced Controller resolves its own:
   * `admin/comments` if it exists, otherwise the closest ancestor namespace's,
   * down to the root `comments` Serializer. Falls back to `model.serializer`
   * when this Serializer was not created by an application (e.g. in
   * isolation).
   *
   * Pass the request's namespace when there is one: a Serializer's own
   * namespace is the root one whenever it is a namespaced Controller's
   * fallback.
   *
   * @method serializerFor
   * @private
   */
  serializerFor(
    model: ModelClass,
    namespace: string = this.namespace
  ): Serializer<Model> {
    const { serializers } = this;

    if (serializers) {
      const key = posix.join(namespace || '.', model.resourceName);
      const serializer =
        serializers.get(key) || closestAncestor(serializers, key);

      if (serializer) {
        return serializer;
      }
    }

    return model.serializer;
  }

  /**
   * @private
   */
  linkFor(
    domain: string,
    type: string,
    id: string,
    namespace: string = this.namespace
  ): string {
    return domain + this.pathFor(type, id, namespace);
  }

  /**
   * The path of the resource `type`/`id` in `namespace`.
   *
   * @private
   */
  pathFor(type: string, id: string, namespace: string = this.namespace) {
    return namespace ? `/${namespace}/${type}/${id}` : `/${type}/${id}`;
  }
}

/**
 * @private
 */
function notRouted(): boolean {
  return false;
}

/**
 * @private
 */
function resourceKey({ id, type }: { id: string; type: string }): string {
  return `${type}:${id}`;
}

/**
 * The relationships of `names` whose linkage a document needs: those the
 * type's fieldset keeps (all of them without one), and those `include`
 * follows — which may be left out of the fieldset and still be included.
 *
 * @private
 */
function linkedNames(
  names: Array<string>,
  fieldset: Array<string> | undefined,
  tree: IncludeTree
): Array<string> {
  return names.filter(
    name => !fieldset || fieldset.includes(name) || tree.has(name)
  );
}

export default Serializer;
