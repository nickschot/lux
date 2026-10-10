import { line } from '../../../../logger';
import createServerError from '../../../../server/utils/create-server-error';
import sourceFor, { nameFor } from '../../../../server/utils/source-for';
import type { ServerErrorSource } from '../../../../server';
import type { ParameterLike } from '../index';

/** @internal */
class ParameterTypeError extends TypeError {
  declare source: ServerErrorSource;

  constructor(param: ParameterLike, actual: string) {
    const { type, path } = param;

    super(line`
      Expected type '${type || 'undefined'}' for parameter '${nameFor(path)}' but got
      '${actual}'.
    `);
    this.source = sourceFor(path);
  }
}

export default createServerError(ParameterTypeError, 400, { isPublic: true });
