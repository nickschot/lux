import type { Action } from '../router';
import type { Request, Response } from '../server';

import createResponseProxy from './utils/create-response-proxy';

/**
 * Convert traditional node HTTP server middleware into a lumen compatible
 * function for use in Controller#beforeAction.
 *
 * @module lumen-framework
 * @namespace Lux
 * @function lumenify
 */
export default function lumenify(
  middleware: (req: Request, res: Response, next: (err?: Error) => void) => void
): Action<unknown> {
  const result = function (req: Request, res: Response) {
    return new Promise<unknown>((resolve, reject) => {
      Reflect.apply(middleware, null, [
        req,
        createResponseProxy(res, resolve),
        (err?: Error) => {
          if (err && err instanceof Error) {
            reject(err);
          } else {
            resolve(undefined);
          }
        }
      ]);
    });
  };

  Reflect.defineProperty(result, 'name', {
    value: middleware.name
  });

  return result;
}
