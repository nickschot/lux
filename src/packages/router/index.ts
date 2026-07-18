import { FreezeableMap } from '../freezeable';
import type { Request } from '../server';

import Namespace from './namespace';
import Route, { DYNAMIC_PATTERN } from './route';
import { build, define } from './definitions';
import createReplacer from './utils/create-replacer';
import type { Router$opts } from './interfaces';

/**
 * @private
 */
class Router extends FreezeableMap<string, Route> {
  replacer!: RegExp;

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

  match({ method, url }: Request): void | Route {
    const params: Array<string> = [];
    const staticPath = url.pathname.replace(this.replacer, (str, g1, g2) => {
      params.push(g2);
      return `${g1}/:dynamic`;
    });

    Reflect.set(url, 'params', params);

    return this.get(`${method}:${staticPath}`);
  }
}

export default Router;
export { Route, DYNAMIC_PATTERN };

export type { Router$Namespace } from './interfaces';
export type { Resource$opts } from './resource';
export type { Namespace$opts } from './namespace';
export type { Action, Route$opts, Route$type } from './route';
