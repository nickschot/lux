import { FreezeableMap } from '../freezeable';
import { REQUEST_METHODS } from '../server';
import type { Request, Request$method } from '../server';

import Namespace from './namespace';
import Route, { DYNAMIC_PATTERN } from './route';
import { build, define } from './definitions';
import createReplacer from './utils/create-replacer';
import type { Replacer } from './utils/create-replacer';
import type { Router$opts } from './interfaces';

/**
 * @private
 */
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

    Reflect.defineProperty(this, 'replacer', {
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

    Reflect.set(url, 'params', params);

    return this.get(`${method}:${staticPath}`);
  }

  /**
   * The methods some route accepts at the request's path — empty when no
   * route has the path at all.
   */
  methodsFor({ url }: Request): Array<Request$method> {
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
