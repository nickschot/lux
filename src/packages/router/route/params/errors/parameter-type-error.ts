import { line } from '../../../../logger';
import createServerError from '../../../../server/utils/create-server-error';
import sourceFor from '../../../../server/utils/source-for';
import type { Server$ErrorSource } from '../../../../server';
import type { ParameterLike } from '../index';

/**
 * @private
 */
class ParameterTypeError extends TypeError {
  declare source: Server$ErrorSource;

  constructor(param: ParameterLike, actual: string) {
    const { type, path } = param;

    super(line`
      Expected type '${type || 'undefined'}' for parameter '${path}' but got
      '${actual}'.
    `);
    this.source = sourceFor(path);
  }
}

export default createServerError(ParameterTypeError, 400);
