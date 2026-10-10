import { REQUEST_METHODS } from '../../../../server';
import type { RouteType, RouterNamespace } from '../../../index';

import createDefinition from './create-definition';

type DefinitionFn = (name: string, action?: string) => void;

/** @internal */
export default function createDefinitionGroup<T extends RouterNamespace>(
  type: RouteType,
  namespace: T
): Record<string, DefinitionFn> {
  return REQUEST_METHODS.reduce<Record<string, DefinitionFn>>(
    (methods, method) => ({
      ...methods,
      [method.toLowerCase()]: createDefinition({
        type,
        method,
        namespace
      })
    }),
    {}
  );
}
