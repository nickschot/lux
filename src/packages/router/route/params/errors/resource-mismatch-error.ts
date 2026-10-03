import createServerError from '../../../../server/utils/create-server-error';
import sourceFor from '../../../../server/utils/source-for';
import { line } from '../../../../logger';
import type { Server$ErrorSource } from '../../../../server';

/**
 * @private
 */
class ResourceMismatchError extends TypeError {
  declare source: Server$ErrorSource;

  constructor(path: string, expected: unknown, actual: unknown) {
    let normalized = actual;

    if (typeof normalized === 'string') {
      normalized = `'${String(normalized)}'`;
    }

    super(line`
      Expected '${String(expected)}' for parameter '${path}' but got
      ${String(normalized)}.
    `);
    this.source = sourceFor(path);
  }
}

export default createServerError(ResourceMismatchError, 409);
