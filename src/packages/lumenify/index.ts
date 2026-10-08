import type { Action } from '../router';
import type { Request, Response } from '../server';

import createResponseProxy from './utils/create-response-proxy';

/**
 * Wrap Connect-style middleware — `(req, res, next)`, the Express
 * convention — as a {@link Controller.beforeAction} hook.
 *
 * ```javascript
 * import { Controller, lumenify } from 'lumen-framework';
 *
 * function poweredBy(req, res, next) {
 *   res.setHeader('X-Powered-By', 'lumen');
 *   next();
 * }
 *
 * class ApplicationController extends Controller {
 *   beforeAction = [lumenify(poweredBy)];
 * }
 * ```
 *
 * `next()` continues the request and `next(error)` ends it with that error;
 * ending the response in the middleware ends the request too.
 *
 * @param middleware - The middleware to wrap.
 * @returns A hook that resolves when the middleware calls `next`.
 */
export default function lumenify(
  middleware: (req: Request, res: Response, next: (err?: Error) => void) => void
): Action<unknown> {
  const result = function (req: Request, res: Response) {
    return new Promise<unknown>((resolve, reject) => {
      middleware(req, createResponseProxy(res, resolve), (err?: Error) => {
        if (err && err instanceof Error) {
          reject(err);
        } else {
          resolve(undefined);
        }
      });
    });
  };

  Object.defineProperty(result, 'name', {
    value: middleware.name
  });

  return result;
}
