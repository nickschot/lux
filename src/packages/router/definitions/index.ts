import Route from '../route';
import Resource from '../resource';
import type Router from '../index';
import type Controller from '../../controller';
import type { Router$Namespace } from '../index';

import { contextFor } from './context';
import createDefinitionGroup from './context/utils/create-definition-group';
import type { DefinitionContext } from './context';

/**
 * The relationships of `controller`'s model its Serializer exposes.
 *
 * @private
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
 * @private
 */
export function build<T extends Router$Namespace>(
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

    // A relationship endpoint (`/posts/1/relationships/comments`) for each
    // relationship the resource's Serializer exposes, wherever it is shown.
    // Anything it serves can already be read through `?include=`.
    if (only.has('show')) {
      const { controller } = namespace;
      const relationships = createDefinitionGroup('relationship', namespace);

      relationshipsFor(controller).forEach(name => {
        relationships.get(name, 'showRelationship');
      });
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
    Reflect.apply(builder, context, []);
  }

  return namespace;
}

/**
 * @private
 */
export function define<T extends Router$Namespace>(router: Router, parent: T) {
  parent.forEach(child => {
    if (child instanceof Route) {
      const { method, staticPath } = child;

      router.set(`${method}:${staticPath}`, child);
    } else {
      define(router, child);
    }
  });
}
