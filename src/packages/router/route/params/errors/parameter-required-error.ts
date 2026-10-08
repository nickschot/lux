import createServerError from '../../../../server/utils/create-server-error';
import sourceFor from '../../../../server/utils/source-for';
import type { Server$ErrorSource } from '../../../../server';

/** @internal */
class ParameterRequiredError extends TypeError {
  declare source: Server$ErrorSource;

  constructor(path: string) {
    super(`Missing required parameter '${path}'.`);
    this.source = sourceFor(path);
  }
}

export default createServerError(ParameterRequiredError, 400);
