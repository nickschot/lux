import createServerError from '../../../../server/utils/create-server-error';
import { line } from '../../../../logger';

/**
 * @private
 */
class ResourceMismatchError extends TypeError {
  constructor(path: string, expected: unknown, actual: unknown) {
    let normalized = actual;

    if (typeof normalized === 'string') {
      normalized = `'${String(normalized)}'`;
    }

    super(line`
      Expected '${String(expected)}' for parameter '${path}' but got
      ${String(normalized)}.
    `);
  }
}

export default createServerError(ResourceMismatchError, 409);
