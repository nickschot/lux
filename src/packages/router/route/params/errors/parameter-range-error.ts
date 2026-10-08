import { line } from '../../../../logger';
import createServerError from '../../../../server/utils/create-server-error';
import sourceFor from '../../../../server/utils/source-for';
import type { Server$ErrorSource } from '../../../../server';
import type Parameter from '../parameter';

/** @internal */
class ParameterRangeError extends RangeError {
  declare source: Server$ErrorSource;

  constructor({ path, min, max }: Parameter, actual: number) {
    const bounds = [
      min === undefined ? '' : `at least ${min}`,
      max === undefined ? '' : `at most ${max}`
    ]
      .filter(Boolean)
      .join(' and ');

    super(line`
      Expected value for parameter '${path}' to be ${bounds} but got
      ${String(actual)}.
    `);
    this.source = sourceFor(path);
  }
}

export default createServerError(ParameterRangeError, 400);
