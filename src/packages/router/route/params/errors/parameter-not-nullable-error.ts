import createServerError from '../../../../server/utils/create-server-error';
import sourceFor, { nameFor } from '../../../../server/utils/source-for';
import type { Server$ErrorSource } from '../../../../server';
import type { ParameterLike } from '../index';

/** @internal */
class ParameterNotNullableError extends TypeError {
  declare source: Server$ErrorSource;

  constructor({ path }: ParameterLike) {
    super(`Parameter '${nameFor(path)}' is not nullable.`);
    this.source = sourceFor(path);
  }
}

export default createServerError(ParameterNotNullableError, 400, {
  isPublic: true
});
