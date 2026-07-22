/* eslint-disable @typescript-eslint/no-explicit-any --
 * This is the route-definition DSL. `DefinitionContext` collects handler
 * methods with genuinely heterogeneous signatures behind a single index
 * signature, and `resource(...args)` accepts the untyped variadic argument
 * forms the public `resource()` route helper supports; both are normalized at
 * the boundary (see normalize-resource-args). Precise typing here would require
 * full variadic modeling for no real safety gain in internal code.
 */
import Resource from '../../resource';
import Namespace from '../../namespace';
import K from '../../../../utils/k';
import type { Router$Namespace } from '../../index';
import type { Router$DefinitionBuilder } from '../interfaces';
import ControllerMissingError from '../../../../errors/controller-missing-error';

import createDefinitionGroup from './utils/create-definition-group';
import normalizeResourceArgs from './utils/normalize-resource-args';

export type DefinitionContext = {
  [key: string]: (...args: Array<any>) => unknown;
};

/**
 * @private
 */
export function contextFor(build: Router$DefinitionBuilder<Router$Namespace>) {
  return {
    create(namespace: Router$Namespace): DefinitionContext {
      let context: DefinitionContext = {
        member: K,
        resource: K,
        namespace: K,
        collection: K,
        ...createDefinitionGroup('custom', namespace)
      };

      if (namespace instanceof Resource) {
        context = {
          ...context,

          member(builder: () => void) {
            const childCtx = createDefinitionGroup('member', namespace);

            Reflect.apply(builder, childCtx, []);
          },

          collection(builder: () => void) {
            const childCtx = createDefinitionGroup('collection', namespace);

            Reflect.apply(builder, childCtx, []);
          }
        };
      } else {
        context = {
          ...context,

          namespace(name: string, builder?: () => void) {
            const { isRoot, controllers } = namespace;
            let { path } = namespace;

            path = isRoot ? `/${name}` : `${path}/${name}`;

            const controllerKey = `${path.substr(1)}/application`;
            const controller = controllers.get(controllerKey);

            if (!controller) {
              throw new ControllerMissingError(controllerKey);
            }

            const child = new Namespace({
              name,
              path,
              namespace,
              controller,
              controllers
            });

            build(builder, child);
            namespace.add(child);
          },

          resource(...args: Array<any>) {
            const { controllers } = namespace;
            const [opts, builder] = normalizeResourceArgs(args);
            let path;

            if (namespace.isRoot) {
              path = opts.path;
            } else {
              path = namespace.path + opts.path;
            }

            const controllerKey = path
              .split('/')
              .filter(Boolean)
              .reduce<Array<string>>(
                (arr, str, index, parts) => [
                  ...arr,
                  index === parts.length - 1 ? opts.name : str
                ],
                []
              )
              .join('/');

            const controller = controllers.get(controllerKey);

            if (!controller) {
              throw new ControllerMissingError(controllerKey);
            }

            const child = new Resource({
              ...opts,
              path,
              namespace,
              controller,
              controllers
            });

            build(builder, child);
            namespace.add(child);
          }
        };
      }

      return context;
    }
  };
}
