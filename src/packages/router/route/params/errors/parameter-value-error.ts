import { line } from '../../../../logger';
import createServerError from '../../../../server/utils/create-server-error';
import sourceFor, {
  memberPathFor,
  nameFor
} from '../../../../server/utils/source-for';
import type { Server$ErrorSource } from '../../../../server';
import type { ParameterLike } from '../index';

// Parameters whose values are member names or relationship paths, which the
// request parser camelized; the message names them as documents do.
const MEMBER_VALUED = new Set(['sort', 'fields', 'include']);

/** @internal */
class ParameterValueError extends TypeError {
  declare source: Server$ErrorSource;

  constructor(param: ParameterLike, actual: unknown) {
    const asSent = MEMBER_VALUED.has(param.path.split('.')[0] ?? '')
      ? memberPathFor
      : (value: unknown) => value;
    const expected = param.size ? Array.from(param.values(), asSent) : [];

    super(line`
      Expected value for parameter '${nameFor(param.path)}' to be one of
      [${expected.join(', ')}] but got ${String(asSent(actual))}.
    `);
    this.source = sourceFor(param.path);
  }
}

export default createServerError(ParameterValueError, 400, { isPublic: true });
