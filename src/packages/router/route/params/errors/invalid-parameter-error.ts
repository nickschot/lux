import createServerError from '../../../../server/utils/create-server-error';
import sourceFor from '../../../../server/utils/source-for';
import type { Server$ErrorSource } from '../../../../server';

/**
 * @private
 */
class InvalidParameterError extends TypeError {
  declare source: Server$ErrorSource;

  constructor(path: string) {
    super(`'${path}' is not a valid parameter for this resource.`);
    this.source = sourceFor(path);
  }
}

export default createServerError(InvalidParameterError, 400);
