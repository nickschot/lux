/* eslint-disable @typescript-eslint/no-explicit-any --
 * `createResponse` receives the raw Node response object and augments it in
 * place into the framework's `Response` shape; the parameter is genuinely
 * untyped at that boundary.
 */
import type { Response, Response$opts } from './interfaces';

/**
 * @private
 */
export function createResponse(res: any, opts: Response$opts): Response {
  return Object.assign(res, opts, {
    stats: []
  });
}
