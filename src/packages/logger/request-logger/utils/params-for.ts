import omit from '../../../../utils/omit';
import type Logger from '../../index';
import type { Request } from '../../../server';

import filterParams from './filter-params';

/**
 * The top-level members of a JSON:API document — where a request body's
 * params live. Query params cannot share these names: the spec reserves
 * all-lowercase names for its own parameters, none of which are these.
 *
 * @internal
 */
const DOCUMENT_MEMBERS = [
  'data',
  'meta',
  'included',
  'links',
  'jsonapi',
  'errors'
] as const;

/**
 * The params a request is logged with: filtered, and without the body unless
 * the logger's `requestBody` is on.
 *
 * @internal
 */
export default function paramsFor(
  logger: Logger,
  req: Request
): Record<string, unknown> {
  let params = req.params as unknown as Record<string, unknown>;

  if (!logger.requestBody) {
    params = omit(params, ...DOCUMENT_MEMBERS);
  }

  return filterParams(params, ...logger.filter.params);
}
