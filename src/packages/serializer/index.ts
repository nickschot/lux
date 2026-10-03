import { posix } from 'path';

import { dasherize } from 'inflection';

import { VERSION } from '../jsonapi';
import { freezeProps } from '../freezeable';
import closestAncestor from '../loader/resolver/utils/closest-ancestor';
import type { Bundle$Namespace } from '../loader';
import underscore from '../../utils/underscore';
import promiseHash from '../../utils/promise-hash';
import { dasherizeKeys } from '../../utils/transform-keys';
import type { Model, ModelClass } from '../database';
import type {
  JSONAPI$Document,
  JSONAPI$DocumentLinks,
  JSONAPI$ResourceObject,
  JSONAPI$RelationshipObject
} from '../jsonapi';

import type { Serializer$opts } from './interfaces';
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
 * When a request specifies the fields that it would like included in the
 * response, the fields **MUST** be declared in the `attributes` property array
 * of the resources Serializer, or they will be ignored.
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
   * @return {Promise} Resolves with a [JSON API](http://jsonapi.org) document
   * object.
   *
   * @private
   */
  async format({
    data,
    links,
    domain,
    include
  }: {
    data: T | Array<T>;
    links: JSONAPI$DocumentLinks;
    domain: string;
    include: Array<string>;
  }): Promise<JSONAPI$Document> {
    const tree = createIncludeTree(include);
    const related = new Map<string, Array<Model>>();
    const included = new Map<string, JSONAPI$ResourceObject>();
    const names = Array.from(tree.keys());
    let primary: Array<JSONAPI$ResourceObject>;
    let serialized: Record<string, unknown>;

    if (Array.isArray(data)) {
      primary = await Promise.all(
        data.map(item =>
          this.formatOne({
            item,
            domain,
            related,
            include: names
          })
        )
      );

      serialized = { data: primary };
    } else {
      const resource = await this.formatOne({
        domain,
        related,
        item: data,
        include: names,
        links: false
      });

      primary = [resource];
      serialized = { data: resource };
    }

    // Walk the include tree in request order, so `included` is deterministic.
    for (const [name, children] of tree) {
      const opts = this.model.relationshipFor(name);
      const records = related.get(name);

      if (opts && records) {
        await this.addIncluded({
          domain,
          records,
          included,
          model: opts.model,
          tree: children
        });
      }
    }

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
      links,

      jsonapi: {
        version: VERSION
      }
    } as JSONAPI$Document;
  }

  /**
   * Transform a single Model instance into a [JSON API](http://jsonapi.org)
   * resource object.
   *
   * Relationships are serialized in one of two ways. By default each one is
   * read from the Model instance (for primary data the query has already
   * loaded them). When `linkage` is given — as it is for included resources,
   * whose relationships are batch-loaded by `addIncluded()` — the resource
   * linkage is built from it instead, without touching the database.
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
   * @param {Array} options.include - An array of the relationship keys whose
   * related records should be collected into `options.related`.
   *
   * @param {Map} options.related - Collects, per relationship key in
   * `options.include`, the related Model instances that belong in the top
   * level included object of a [JSON API](http://jsonapi.org) document object.
   *
   * @param {Object} options.linkage - Pre-loaded resource linkage (related
   * primary keys per relationship key) to serialize relationships from.
   *
   * @param {String} options.namespace - The namespace to build links in.
   * Defaults to this Serializer's; included resources pass the namespace of
   * the request, so every link in a document points into the same namespace.
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
    include = [],
    related,
    linkage,
    namespace = this.namespace
  }: {
    item: T;
    links?: boolean;
    domain: string;
    include?: Array<string>;
    related?: Map<string, Array<Model>>;
    linkage?: Linkage;
    namespace?: string;
  }): Promise<JSONAPI$ResourceObject> {
    const { resourceName: type } = item;
    const id = String(item.getPrimaryKey());
    const names = [...this.hasOne, ...this.hasMany];
    let relationships: Record<string, JSONAPI$RelationshipObject>;

    const attributes = dasherizeKeys(
      item.getAttributes(
        ...Object.keys(item.rawColumnData).filter(key =>
          this.attributes.includes(key)
        )
      )
    );

    const serialized: JSONAPI$ResourceObject = {
      id,
      type,
      attributes: attributes as JSONAPI$ResourceObject['attributes']
    };

    if (linkage) {
      relationships = names.reduce<Record<string, JSONAPI$RelationshipObject>>(
        (hash, name) => ({
          ...hash,
          [dasherize(underscore(name))]: this.formatLinkage(
            domain,
            this.model.relationshipFor(name)?.model.resourceName,
            linkage[name],
            namespace
          )
        }),
        {}
      );
    } else {
      const collect = (name: string, records: Array<Model>) => {
        if (related && include.includes(name)) {
          related.set(name, [...(related.get(name) || []), ...records]);
        }
      };

      relationships = (await promiseHash(
        names.reduce<Record<string, unknown>>(
          (hash, name) => ({
            ...hash,

            [dasherize(underscore(name))]: (async () => {
              const value = (await Reflect.get(item, name)) as
                Model | Array<Model> | null | undefined;

              if (Array.isArray(value)) {
                collect(name, value);

                return {
                  data: value.map(
                    relatedItem =>
                      this.formatRelationship(relatedItem, domain).data
                  )
                };
              } else if (value && (value as { id?: unknown }).id != null) {
                collect(name, [value]);

                return this.formatRelationship(value, domain);
              }

              return {
                data: null
              };
            })()
          }),
          {}
        )
      )) as Record<string, JSONAPI$RelationshipObject>;
    }

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
   * Transform a single Model instance into a [JSON API](http://jsonapi.org)
   * relationship object.
   *
   * @method formatRelationship
   *
   * @param {Model} item - The Model instance to transform into the returned
   * [JSON API](http://jsonapi.org) relationship object.
   *
   * @param {String} domain - A string used to build links included in the
   * returned [JSON API](http://jsonapi.org) relationship object.
   *
   * @return {Object} A [JSON API](http://jsonapi.org) relationship object.
   *
   * @private
   */
  formatRelationship(item: Model, domain: string): JSONAPI$RelationshipObject {
    return this.formatLinkage(
      domain,
      item.resourceName,
      String(item.getPrimaryKey())
    );
  }

  /**
   * Build a [JSON API](http://jsonapi.org) relationship object from resource
   * linkage, in the same shape `formatRelationship()` produces from Model
   * instances: to-one relationships carry a `links` object, to-many ones only
   * `data`, and a missing to-one relationship is `{ data: null }`.
   *
   * @method formatLinkage
   * @private
   */
  formatLinkage(
    domain: string,
    type: string | undefined,
    linkage: Array<string> | string | null | undefined,
    namespace: string = this.namespace
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
      },
      links: {
        self: this.linkFor(domain, type, linkage, namespace)
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
    domain,
    included
  }: {
    model: ModelClass;
    records: Array<Model>;
    tree: IncludeTree;
    domain: string;
    included: Map<string, JSONAPI$ResourceObject>;
  }): Promise<void> {
    const serializer = this.serializerFor(model);
    const unique = Array.from(
      new Map(records.map(record => [record.getPrimaryKey(), record])).values()
    );

    if (!unique.length) {
      return;
    }

    const names = [...serializer.hasOne, ...serializer.hasMany];
    const linkage = await loadLinkage(model, unique, names);

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
            linkage: linkage.get(id),
            namespace: this.namespace
          })
        );
      }
    }

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
        // Load exactly the attributes the included resource will serialize.
        const attributes = this.serializerFor(next).attributes.filter(attr =>
          next.attributeNames.includes(attr)
        );

        const nextRecords = await next
          .select(next.primaryKey, ...attributes)
          .where({ [next.primaryKey]: Array.from(ids) });

        await this.addIncluded({
          domain,
          included,
          model: next,
          records: nextRecords,
          tree: children
        });
      }
    }
  }

  /**
   * Resolve the Serializer for `model` in this Serializer's namespace, the
   * way a namespaced Controller resolves its own: `admin/comments` if it
   * exists, otherwise the closest ancestor namespace's, down to the root
   * `comments` Serializer. Falls back to `model.serializer` when this
   * Serializer was not created by an application (e.g. in isolation).
   *
   * @method serializerFor
   * @private
   */
  serializerFor(model: ModelClass): Serializer<Model> {
    const { serializers, namespace } = this;

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
    if (namespace) {
      return `${domain}/${namespace}/${type}/${id}`;
    }

    return `${domain}/${type}/${id}`;
  }
}

/**
 * @private
 */
function resourceKey({ id, type }: { id: string; type: string }): string {
  return `${type}:${id}`;
}

export default Serializer;
