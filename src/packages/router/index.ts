import { FreezeableMap } from '../freezeable';
import { REQUEST_METHODS } from '../server';
import type { Request, RequestMethod } from '../server';

import Namespace from './namespace';
import Route, { DYNAMIC_PATTERN } from './route';
import { build, define } from './definitions';
import createReplacer from './utils/create-replacer';
import type { Replacer } from './utils/create-replacer';
import type { Router$opts } from './interfaces';

/**
 * Remove each related route (`/posts/:dynamic/comments`) whose type is not
 * served the way it would serve it: its resource in the same namespace must
 * route `index` for a to-many relationship and `show` for a to-one. A type a
 * namespace does not list (or only lets clients `create`) stays unlisted.
 *
 * @internal
 */
function dropUnservedRelated(router: Router): void {
  router.forEach((route, key) => {
    const { type, controller, related, relationship = '', staticPath } = route;

    if (type !== 'related' || !related || !key.startsWith('GET:')) {
      return;
    }

    const toMany =
      controller.model.relationshipFor(relationship)?.type === 'hasMany';
    const base = related.namespace ? `/${related.namespace}` : '';
    const path = `${base}/${related.model.resourceName}`;

    if (!router.has(`GET:${toMany ? path : `${path}/:dynamic`}`)) {
      ['GET', 'HEAD', 'OPTIONS'].forEach(method => {
        router.delete(`${method}:${staticPath}`);
      });
    }
  });
}

/** @internal */
class Router extends FreezeableMap<string, Route> {
  declare replacer: Replacer;

  constructor({ routes, controller, controllers }: Router$opts) {
    const definitions = build(
      routes,
      new Namespace({
        controller,
        controllers,
        path: '/',
        name: 'root'
      })
    );

    super();
    define(this, definitions);
    dropUnservedRelated(this);

    Object.defineProperty(this, 'replacer', {
      value: createReplacer(controllers),
      writable: false,
      enumerable: false,
      configurable: false
    });

    this.freeze();
  }

  /**
   * The route key path of `pathname` and the ids in it. A path some route
   * defines as is (`/users/login`) is static, so it is never read as an id.
   */
  resolve(pathname: string): { staticPath: string; params: Array<string> } {
    if (REQUEST_METHODS.some(method => this.has(`${method}:${pathname}`))) {
      return { staticPath: pathname, params: [] };
    }

    return this.replacer(pathname);
  }

  match({ method, url }: Request): void | Route {
    const { staticPath, params } = this.resolve(url.pathname);

    url.params = params;

    return this.get(`${method}:${staticPath}`);
  }

  /**
   * The methods some route accepts at the request's path — empty when no
   * route has the path at all.
   */
  methodsFor({ url }: Request): Array<RequestMethod> {
    const { staticPath } = this.resolve(url.pathname);

    return REQUEST_METHODS.filter(method =>
      this.has(`${method}:${staticPath}`)
    );
  }
}

export default Router;
export { Route, DYNAMIC_PATTERN };

export type { Router$Namespace } from './interfaces';
export type { Resource$opts } from './resource';
export type { Namespace$opts } from './namespace';
export type { Action, Route$opts, Route$type } from './route';
