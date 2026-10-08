import type { Response } from '../../server';

/**
 * Create a Proxy that will trap typical node middleware callback invocations
 * and route them to the appropriate Promise callback (resolve or reject).
 *
 * @internal
 */
export default function createResponseProxy(
  res: Response,
  resolve: (result: unknown) => void
): Response {
  return new Proxy(res, {
    get(target, key) {
      switch (key) {
        case 'end':
        case 'send':
        case 'json':
          return resolve;

        default:
          // eslint-disable-next-line no-restricted-properties -- proxy forwarding
          return Reflect.get(target, key);
      }
    }
  });
}
