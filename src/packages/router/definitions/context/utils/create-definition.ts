import { dasherize, underscore } from 'inflection';

import { Route } from '../../../index';
import { normalizeName, normalizePath } from '../../../namespace';
import type { Request$method } from '../../../../server';
import type { Router$Namespace, Route$type } from '../../../index';

/**
 * @private
 */
export default function createDefinition({
  type,
  method,
  namespace
}: {
  type: Route$type;
  method: Request$method;
  namespace: Router$Namespace;
}) {
  return function define(name: string, action: string = normalizeName(name)) {
    const normalized = normalizeName(name);
    const { controller } = namespace;
    let { path } = namespace;

    if (type === 'member') {
      path += `/:id/${normalized}`;
    } else if (type === 'relationship') {
      path += `/:id/relationships/${dasherize(underscore(normalized))}`;
    } else {
      path += `/${normalized}`;
    }

    path = normalizePath(path);

    const opts = {
      type,
      path,
      action,
      method,
      controller,
      ...(type === 'relationship' && { relationship: normalized })
    };

    namespace.add(new Route(opts));

    // HEAD is GET without a body (Node drops it), so it runs the GET action.
    if (method === 'GET') {
      namespace.add(new Route({ ...opts, method: 'HEAD' }));
    }

    namespace.add(
      new Route({
        ...opts,
        type: 'custom',
        method: 'OPTIONS',
        action: 'preflight'
      })
    );
  };
}
