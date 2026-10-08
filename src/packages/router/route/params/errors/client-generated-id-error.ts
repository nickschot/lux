import createServerError from '../../../../server/utils/create-server-error';
import sourceFor from '../../../../server/utils/source-for';
import type { Server$ErrorSource } from '../../../../server';

/**
 * JSON:API 1.0: "A server MUST return 403 Forbidden in response to an
 * unsupported request to create a resource with a client-generated ID."
 *
 * @internal
 */
class ClientGeneratedIdError extends TypeError {
  declare source: Server$ErrorSource;

  constructor() {
    super('Client-generated IDs are not supported for this resource.');
    this.source = sourceFor('data.id');
  }
}

export default createServerError(ClientGeneratedIdError, 403);
