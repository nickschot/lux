import { UNIQUE_CONSTRAINT, UNIQUE_CONSTRAINT_CODES } from '../../constants';
import { UniqueConstraintError } from '../../errors';

/**
 * knex prefixes a failed statement's error message with the SQL (and its
 * bound values) as `<sql> - <driver message>`; keep only the driver message.
 *
 * @private
 */
function driverMessage(message: string): string {
  const index = message.lastIndexOf(' - ');

  return index >= 0 ? message.slice(index + 3) : message;
}

/**
 * Map a database write error to the server error it should surface as.
 *
 * @private
 */
export default function processWriteError(err: unknown): unknown {
  if (!(err instanceof Error)) {
    return err;
  }

  const { code } = err as { code?: unknown };
  const { message } = err;

  if (
    UNIQUE_CONSTRAINT_CODES.has(String(code)) ||
    UNIQUE_CONSTRAINT.test(message)
  ) {
    return new UniqueConstraintError(driverMessage(message));
  }

  return err;
}

/**
 * `.catch()` handler for a write: rethrows the mapped error.
 *
 * @private
 */
export function rethrowWriteError(err: unknown): never {
  throw processWriteError(err);
}
