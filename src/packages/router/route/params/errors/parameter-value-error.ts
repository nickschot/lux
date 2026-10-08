import { line } from '../../../../logger';
import createServerError from '../../../../server/utils/create-server-error';
import sourceFor from '../../../../server/utils/source-for';
import type { Server$ErrorSource } from '../../../../server';
import type { ParameterLike } from '../index';

/** @internal */
class ParameterValueError extends TypeError {
  declare source: Server$ErrorSource;

  constructor(param: ParameterLike, actual: unknown) {
    super(line`
      Expected value for parameter '${param.path}' to be one of
      [${param.size ? Array.from(param.values()).join(', ') : ''}] but got
      ${String(actual)}.
    `);
    this.source = sourceFor(param.path);
  }
}

export default createServerError(ParameterValueError, 400);
