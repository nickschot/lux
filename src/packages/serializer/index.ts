import { posix } from 'path';

import { dasherize } from 'inflection';

import { VERSION } from '../jsonapi';
import { freezeProps } from '../freezeable';
import closestAncestor from '../loader/resolver/utils/closest-ancestor';
import type { BundleNamespace } from '../loader';
import underscore from '../../utils/underscore';
import { dasherizeKeys } from '../../utils/transform-keys';
import type { Model, ModelClass } from '../database';
import type {
  JsonApiDocument,
  JsonApiDocumentLinks,
  JsonApiResourceObject,
  JsonApiRelationshipObject,
  JsonApiRelationshipDocument
} from '../jsonapi';

import type {
  SerializerFields,
  SerializerOptions,
  SerializerRouted
} from './interfaces';
import { Scope } from '../controller/visibility';
import loadLinkage from './utils/load-linkage';
import type { Linkage } from './utils/load-linkage';
import { createIncludeTree } from './utils/include-tree';
import type { IncludeTree } from './utils/include-tree';

/**
 * The base class of an app's serializers. A serializer lists what a
 * resource looks like in a JSON:API document: its `attributes`, and its
 * relationships in `hasOne` (to-one, whether the model's relationship is
 * `hasOne` or `belongsTo`) and `hasMany`.
 *
 * ```javascript
 * // app/serializers/posts.js
 * import { Serializer } from 'lumen-framework';
 *
 * class PostsSerializer extends Serializer {
 *   attributes = ['title', 'body', 'createdAt'];
 *   hasOne = ['user'];
 *   hasMany = ['comments', 'tags'];
 * }
 *
 * export default PostsSerializer;
 * ```
 *
 * Lumen loads only the columns a serializer needs. The lists are also what
 * clients may ask for: `sort` and `filter` default to the attributes,
 * `include` accepts the relationships (nested up to the controller's
 * `maxIncludeDepth`), and `fields[posts]` may name any of them. Each included
 * resource is formatted by its own type's serializer.
 *
 * A namespace may have its own serializer for a type
 * (`app/serializers/admin/posts.js`), used for that type everywhere in the
 * namespace, included resources too; without one, the root serializer is used,
 * unless the namespace's `ApplicationController` sets `serializerFallback =
 * false`. See the
 * [serializers guide](https://github.com/nickschot/lux/blob/main/docs/guides/serializers.md).
 */
class Serializer<T extends Model> {
  /**
   * The to-one relationships to serialize — the model's `hasOne` and
   * `belongsTo` relationships alike.
   *
   * ```javascript
   * class PostsSerializer extends Serializer {
   *   hasOne = ['user', 'image'];
   * }
   * ```
   */
  hasOne: Array<string> = [];

  /**
   * The to-many relationships to serialize.
   *
   * ```javascript
   * class PostsSerializer extends Serializer {
   *   hasMany = ['comments', 'tags'];
   * }
   * ```
   */
  hasMany: Array<string> = [];

  /**
   * The model attributes to serialize, camelCase as on the model; documents
   * dasherize them (`createdAt` → `created-at`). Each must be a column of the
   * model's table: the app refuses to boot when one isn't (a getter, say).
   *
   * ```javascript
   * class PostsSerializer extends Serializer {
   *   attributes = ['title', 'body', 'createdAt'];
   * }
   * ```
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
   * Each name must be in `hasMany`, and have a related endpoint in at least
   * one namespace that formats this type with this Serializer (the related
   * type's resource routing `index`, this type's routing `show`), or the
   * application refuses to boot.
   */
  linksOnly: Array<string> = [];

  /**
   * Allow `attributes`, `hasOne` or `hasMany` to name `type` or `id`.
   *
   * JSON:API forbids a field with either name: they share a namespace with
   * the resource's own `type` and `id`. By default the application refuses
   * to boot when a serializer lists one. Set this for a serializer whose
   * clients already rely on such a field; the application then boots with a
   * warning, and the field is sent as before:
   *
   * ```javascript
   * class ReactionsSerializer extends Serializer {
   *   attributes = ['type', 'createdAt'];
   *
   *   // `type` breaks JSON:API, but our clients read it.
   *   allowReservedNames = true;
   * }
   * ```
   */
  allowReservedNames: boolean = false;

  /**
   * The resolved Model that a Serializer instance represents.
   *
   * @internal
   */
  declare model: ModelClass<T>;

  /**
   * A reference to the root Serializer for the namespace that a Serializer
   * instance is a member of.
   *
   * @internal
   */
  declare parent: Serializer<Model> | null;

  /**
   * The namespace that a Serializer instance is a member of.
   *
   * @internal
   */
  declare namespace: string;

  /**
   * Every Serializer of the application, keyed by namespaced path (`posts`,
   * `admin/posts`). Attached once all of them are built, and used by
   * `serializerFor()` to serialize related resources in this Serializer's
   * namespace.
   *
   * @internal
   */
  declare serializers?: BundleNamespace<Serializer<Model>>;

  constructor({ model, parent, namespace }: SerializerOptions<T>) {
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
   *
   * @param options - An options object used for building the
   * returned [JSON API](http://jsonapi.org) document object.
   *
   * @param options.data - The Model instance or array of
   * Model instances to transform into the returned [JSON API](
   * http://jsonapi.org) document object.
   *
   * @param options.links - An object containing links to include in
   * the top level links object of the returned [JSON API](http://jsonapi.org)
   * document object.
   *
   * @param options.domain - A string used to build links included in
   * the resource and relationship objects in the returned [JSON API](
   * http://jsonapi.org) document object.
   *
   * @param options.include - An array of relationship paths (e.g.
   * `'comments'` or `'comments.user'`) whose resources should be added to the
   * top level included object of the returned [JSON API](http://jsonapi.org)
   * document object. Intermediate resources of a nested path are included too.
   *
   * @param options.fields - The request's sparse fieldsets, keyed by
   * type. Each narrows the attributes and relationships of every resource of
   * its type in the document; primary data was already loaded with its own.
   *
   * @param options.scope - The visibility rules of the request. Every
   * related record loaded for the document — its linkage and `included` — is
   * narrowed by them; primary data was already loaded through them.
   *
   * @param options.meta - Top level meta information of the returned
   * document (`{ total }` for a page of a collection), if any.
   *
   * @param options.namespace - The namespace of the request, i.e. of
   * the Controller handling it. Every link in the document is built in it, and
   * included resources are serialized by their Serializer in it (falling back
   * to the root). Defaults to this Serializer's namespace — which is the root
   * one when a namespaced Controller has no Serializer of its own, so the
   * Controller passes its namespace explicitly.
   *
   * @param options.routed - Whether the application serves a path
   * (`/posts/:dynamic/relationships/user`). A relationship is only given the
   * links of the endpoints it is served by, since JSON:API requires every
   * relationship `self` link to be served. Without it, none are.
   *
   * @returns Resolves with a [JSON API](http://jsonapi.org) document
   * object.
   *
   * @internal
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
    meta?: JsonApiDocument['meta'];
    links: JsonApiDocumentLinks;
    domain: string;
    include: Array<string>;
    fields?: SerializerFields;
    scope?: Scope;
    namespace?: string;
    routed?: SerializerRouted;
  }): Promise<JsonApiDocument> {
    const tree = createIncludeTree(include);
    const included = new Map<string, JsonApiResourceObject>();
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
    } as JsonApiDocument;
  }

  /**
   * Transform a single Model instance into a [JSON API](http://jsonapi.org)
   * resource object. Its attributes are the ones loaded on `item`, declared by
   * this Serializer and kept by the request's fieldset for its type; its
   * relationships, those declared and kept, are built from `linkage`,
   * batch-loaded by `loadLinkage()`, without touching the database.
   *
   *
   * @param options - An options object used for building the returned
   * [JSON API](http://jsonapi.org) resource object.
   *
   * @param options.item - The Model instance to transform into the
   * returned [JSON API](http://jsonapi.org) resource object.
   *
   * @param options.links - An object containing links to include in
   * the top level links object of the returned [JSON API](http://jsonapi.org)
   * resource object.
   *
   * @param options.domain - A string used to build links included in
   * the top level links object or relationship links objects in the returned
   * [JSON API](http://jsonapi.org) resource object.
   *
   * @param options.linkage - The resource linkage (related primary
   * keys per relationship key) to serialize relationships from.
   *
   * @param options.fields - The request's sparse fieldsets, keyed by
   * type. Only the one for this resource's type applies.
   *
   * @param options.namespace - The namespace to build links in.
   * Defaults to this Serializer's; included resources pass the namespace of
   * the request, so every link in a document points into the same namespace.
   *
   * @param options.routed - Whether the application serves a path;
   * see `format()`.
   *
   * @param options.linksOnly - The relationships to serialize without
   * resource linkage; see `linksOnlyFor()`.
   *
   * @returns Resolves with a [JSON API](http://jsonapi.org) resource
   * object.
   *
   * @internal
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
    fields?: SerializerFields;
    namespace?: string;
    routed?: SerializerRouted;
    linksOnly?: Set<string>;
  }): Promise<JsonApiResourceObject> {
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

    const serialized: JsonApiResourceObject = {
      id,
      type,
      attributes: attributes as JsonApiResourceObject['attributes']
    };

    const relationships = names.reduce<
      Record<string, JsonApiRelationshipObject>
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
   * @internal
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
    routed?: SerializerRouted;
  }): Promise<JsonApiRelationshipDocument> {
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
   * @internal
   */
  linksOnlyFor(
    tree: IncludeTree,
    namespace: string,
    routed: SerializerRouted
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
   * @internal
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
    routed: SerializerRouted;
    namespace: string;
  }): Pick<JsonApiRelationshipObject, 'links'> {
    const segment = dasherize(underscore(name));
    const route = this.pathFor(type, ':dynamic', namespace);
    const base = domain + this.pathFor(type, id, namespace);
    const links: NonNullable<JsonApiRelationshipObject['links']> = {};

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
   * @internal
   */
  formatLinkage(
    type: string | undefined,
    linkage: Array<string> | string | null | undefined
  ): JsonApiRelationshipObject {
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
   * @internal
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
    fields: SerializerFields;
    routed: SerializerRouted;
    included: Map<string, JsonApiResourceObject>;
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
   * @internal
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
    fields: SerializerFields;
    routed: SerializerRouted;
    included: Map<string, JsonApiResourceObject>;
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
   * @internal
   */
  attributesFor(
    model: ModelClass,
    namespace: string,
    fields: SerializerFields
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
   * @internal
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

  /** @internal */
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
   * @internal
   */
  pathFor(type: string, id: string, namespace: string = this.namespace) {
    return namespace ? `/${namespace}/${type}/${id}` : `/${type}/${id}`;
  }
}

/** @internal */
function notRouted(): boolean {
  return false;
}

/** @internal */
function resourceKey({ id, type }: { id: string; type: string }): string {
  return `${type}:${id}`;
}

/**
 * The relationships of `names` whose linkage a document needs: those the
 * type's fieldset keeps (all of them without one), and those `include`
 * follows — which may be left out of the fieldset and still be included.
 *
 * @internal
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

export type { SerializerOptions } from './interfaces';
