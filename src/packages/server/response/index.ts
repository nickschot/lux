/* eslint-disable @typescript-eslint/no-explicit-any --
 * `createResponse` receives the raw Node response object and augments it in
 * place into the framework's `Response` shape; the parameter is genuinely
 * untyped at that boundary.
 */
import type { Response, ResponseOptions } from './interfaces';

/** @internal */
export function createResponse(res: any, opts: ResponseOptions): Response {
  return Object.assign(res, opts, {
    stats: []
  });
}
