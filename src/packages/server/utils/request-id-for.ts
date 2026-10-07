import { randomUUID } from 'crypto';

import type { Request } from '../request/interfaces';

/**
 * What a client-sent `X-Request-Id` may look like to be adopted. Anything
 * else — too long, or with characters that could forge log lines — is
 * replaced rather than written to the logs.
 *
 * @private
 */
const REQUEST_ID = /^[\w.:-]{1,128}$/;

/**
 * The id a request is logged and answered with: the client's (or a proxy's)
 * own `X-Request-Id` when it is well-formed, so a request can be traced
 * across services, otherwise a fresh UUID.
 *
 * @private
 */
export default function requestIdFor({ headers }: Request): string {
  const id = headers.get('x-request-id');

  return id && REQUEST_ID.test(id) ? id : randomUUID();
}
