import type { Request } from '../request/interfaces';

/**
 * The client's address. Behind a trusted proxy that is the *last*
 * `X-Forwarded-For` entry — the one the proxy appended; anything before it
 * came from the client and could be forged. Otherwise it is the connection's
 * own address.
 *
 * @private
 */
export default function clientIpFor(
  { headers, socket }: Request,
  trustProxy = false
): string | undefined {
  const forwarded = trustProxy ? headers.get('x-forwarded-for') : undefined;
  const proxied = forwarded?.split(',').pop()?.trim();

  return proxied || socket.remoteAddress;
}
