import { REQUEST_METHODS } from '../../../../server';
import type { Route$type, Router$Namespace } from '../../../index';

import createDefinition from './create-definition';

type DefinitionFn = (name: string, action?: string) => void;

/**
 * @private
 */
export default function createDefinitionGroup<T extends Router$Namespace>(
  type: Route$type,
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
