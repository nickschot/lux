import createServerError from '../../../../server/utils/create-server-error';
import sourceFor, { nameFor } from '../../../../server/utils/source-for';
import type { ServerErrorSource } from '../../../../server';

/**
 * JSON:API 1.0: "A server MUST return 403 Forbidden in response to an
 * unsupported request to update a resource or relationship." Used for members
 * the model knows about but the controller does not accept (`params`).
 *
 * @internal
 */
class ForbiddenParameterError extends TypeError {
  declare source: ServerErrorSource;

  constructor(path: string) {
    super(`Setting '${nameFor(path)}' is not supported for this resource.`);
    this.source = sourceFor(path);
  }
}

export default createServerError(ForbiddenParameterError, 403, {
  isPublic: true
});
