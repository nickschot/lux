import { Route } from '../../../index';
import { normalizeName, normalizePath } from '../../../namespace';
import type { Request$method } from '../../../../server';
import type { Router$Namespace, Route$opts, Route$type } from '../../../index';

/**
 * Add the route `opts` describes to `namespace`, along with a `HEAD` route
 * for a `GET` and an `OPTIONS` route for its path.
 *
 * @private
 */
export function addRoute(namespace: Router$Namespace, opts: Route$opts) {
  namespace.add(new Route(opts));

  // HEAD is GET without a body (Node drops it), so it runs the GET action.
  if (opts.method === 'GET') {
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
}

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
    } else {
      path += `/${normalized}`;
    }

    addRoute(namespace, {
      type,
      action,
      method,
      controller,
      path: normalizePath(path)
    });
  };
}
