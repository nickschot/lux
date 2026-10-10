import createServerError from '../../../../server/utils/create-server-error';
import sourceFor, { nameFor } from '../../../../server/utils/source-for';
import type { Server$ErrorSource } from '../../../../server';

/** @internal */
class InvalidParameterError extends TypeError {
  declare source: Server$ErrorSource;

  constructor(path: string) {
    super(`'${nameFor(path)}' is not a valid parameter for this resource.`);
    this.source = sourceFor(path);
  }
}

export default createServerError(InvalidParameterError, 400, {
  isPublic: true
});
