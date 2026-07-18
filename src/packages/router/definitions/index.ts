import Route from '../route';
import Resource from '../resource';
import type Router from '../index';
import type { Router$Namespace } from '../index';

import { contextFor } from './context';
import type { DefinitionContext } from './context';

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
