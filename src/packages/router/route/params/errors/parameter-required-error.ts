import createServerError from '../../../../server/utils/create-server-error';
import sourceFor, { nameFor } from '../../../../server/utils/source-for';
import type { Server$ErrorSource } from '../../../../server';

/** @internal */
class ParameterRequiredError extends TypeError {
  declare source: Server$ErrorSource;

  constructor(path: string) {
    super(`Missing required parameter '${nameFor(path)}'.`);
    this.source = sourceFor(path);
  }
}

export default createServerError(ParameterRequiredError, 400, {
  isPublic: true
});
