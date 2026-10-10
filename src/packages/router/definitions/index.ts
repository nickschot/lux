import { posix } from 'path';

import { dasherize, underscore } from 'inflection';

import Route from '../route';
import Resource from '../resource';
import { normalizePath } from '../namespace';
import type Router from '../index';
import type Controller from '../../controller';
import type { RouterNamespace } from '../index';

import { contextFor } from './context';
import { addRoute } from './context/utils/create-definition';
import type { DefinitionContext } from './context';

/**
 * The relationships of `controller`'s model its Serializer exposes.
 *
 * @internal
 */
function relationshipsFor(controller: Controller): Array<string> {
  const { model, serializer, hasModel, hasSerializer } = controller;

  if (!hasModel || !hasSerializer) {
    return [];
  }

  return [...serializer.hasOne, ...serializer.hasMany].filter(name =>
    Boolean(model.relationshipFor(name))
  );
}

/**
 * The controller of the type `controller`'s relationship `name` points to, in
 * `controller`'s own namespace (`admin/users` for `admin/posts`). Only one
 * there can serve related resources: an ancestor namespace's would serialize
 * them with its own Serializers and accept its own `fields` and `include`,
 * which `?include=` in this namespace does not use. It needs a model and a
 * Serializer.
 *
 * @internal
 */
function relatedControllerFor(
  controller: Controller,
  controllers: Map<string, Controller>,
  name: string
): Controller | undefined {
  const opts = controller.model.relationshipFor(name);

  if (!opts) {
    return undefined;
  }

  const related = controllers.get(
    posix.join(controller.namespace || '.', opts.model.resourceName)
  );

  return related?.hasModel && related.hasSerializer ? related : undefined;
}

/**
 * For each relationship the resource's Serializer exposes — narrowed by its
 * `relationships` option (`false` for none, or a list of names) — a
 * relationship endpoint (`/posts/1/relationships/comments`) and, when the
 * related type has a controller, a related endpoint (`/posts/1/comments`).
 * Naming a relationship the Serializer does not expose is a boot error.
 *
 * @internal
 */
function defineRelationships(namespace: Resource): void {
  const { controller, controllers, path, relationships } = namespace;
  const exposed = relationshipsFor(controller);

  if (Array.isArray(relationships)) {
    const unknown = relationships.filter(name => !exposed.includes(name));

    if (unknown.length) {
      throw new TypeError(
        `The \`relationships\` of resource '${path}' must be ones its ` +
          `Serializer exposes, but ${unknown
            .map(name => `'${name}'`)
            .join(', ')} ${unknown.length === 1 ? 'is' : 'are'} not.`
      );
    }
  }

  const served = Array.isArray(relationships)
    ? exposed.filter(name => relationships.includes(name))
    : relationships
      ? exposed
      : [];

  served.forEach(name => {
    const segment = dasherize(underscore(name));
    const related = relatedControllerFor(controller, controllers, name);

    addRoute(namespace, {
      controller,
      type: 'relationship',
      path: normalizePath(`${path}/:id/relationships/${segment}`),
      action: 'showRelationship',
      method: 'GET',
      relationship: name
    });

    if (related) {
      addRoute(namespace, {
        controller,
        related,
        type: 'related',
        path: normalizePath(`${path}/:id/${segment}`),
        action: 'showRelated',
        method: 'GET',
        relationship: name
      });
    }
  });
}

/** @internal */
export function build<T extends RouterNamespace>(
  builder: (() => void) | undefined,
  namespace: T
): T {
  const context = contextFor(build).create(namespace);

  if (namespace instanceof Resource) {
    const { only } = namespace;

    context.member(function member(this: DefinitionContext) {
      if (only.has('show')) {
        this.get('/', 'show');
      }

      if (only.has('update')) {
        this.patch('/', 'update');
      }

      if (only.has('destroy')) {
        this.delete('/', 'destroy');
      }
    });

    // Relationships are served wherever the resource is shown.
    if (only.has('show')) {
      defineRelationships(namespace);
    }

    context.collection(function collection(this: DefinitionContext) {
      if (only.has('index')) {
        this.get('/', 'index');
      }

      if (only.has('create')) {
        this.post('/', 'create');
      }
    });
  }

  if (builder) {
    builder.call(context);
  }

  return namespace;
}

/** @internal */
export function define<T extends RouterNamespace>(router: Router, parent: T) {
  parent.forEach(child => {
    if (child instanceof Route) {
      const { method, staticPath } = child;

      router.set(`${method}:${staticPath}`, child);
    } else {
      define(router, child);
    }
  });
}
