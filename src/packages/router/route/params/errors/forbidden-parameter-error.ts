import createServerError from '../../../../server/utils/create-server-error';
import sourceFor from '../../../../server/utils/source-for';
import type { Server$ErrorSource } from '../../../../server';

/**
 * JSON:API 1.0: "A server MUST return 403 Forbidden in response to an
 * unsupported request to update a resource or relationship." Used for members
 * the model knows about but the controller does not accept (`params`).
 *
 * @private
 */
class ForbiddenParameterError extends TypeError {
  declare source: Server$ErrorSource;

  constructor(path: string) {
    super(`Setting '${path}' is not supported for this resource.`);
    this.source = sourceFor(path);
  }
}

export default createServerError(ForbiddenParameterError, 403);
