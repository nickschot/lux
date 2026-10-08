import createServerError from '../utils/create-server-error';

/**
 * A request whose path exists, but not for its method. The responder's
 * caller sets the `Allow` header listing the methods that are.
 *
 * @internal
 */
class MethodNotAllowedError extends Error {
  constructor(method: string, allowed: Array<string>) {
    super(
      `${method} is not allowed here. Allowed methods: ${allowed.join(', ')}.`
    );
  }
}

export default createServerError(MethodNotAllowedError, 405);
