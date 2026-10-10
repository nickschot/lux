import type { ServerError } from '../interfaces';

/** @internal */
function isServerError(error: unknown): error is ServerError {
  return (
    error instanceof Error &&
    typeof (error as { statusCode?: unknown }).statusCode === 'number'
  );
}

/**
 * The status of a response reporting `errors`: theirs when they agree, else
 * the most generally applicable one — JSON:API 1.0: "When a server encounters
 * multiple problems for a single request, the most generally applicable HTTP
 * error code SHOULD be used" — `400` for client errors, `500` otherwise.
 *
 * @internal
 */
function statusFor(errors: Array<ServerError>): number {
  const codes = new Set(errors.map(({ statusCode }) => statusCode));

  if (codes.size === 1) {
    return errors[0]!.statusCode;
  }

  return Array.from(codes).every(code => code >= 400 && code < 500) ? 400 : 500;
}

/**
 * Several problems with one request, reported together: each becomes its own
 * error object in the response's `errors`.
 *
 * @internal
 */
class ErrorList extends Error implements ServerError {
  declare errors: Array<ServerError>;

  declare statusCode: number;

  constructor(errors: Array<ServerError>) {
    const flat = errors.flatMap(error =>
      error instanceof ErrorList ? error.errors : [error]
    );

    super(flat.map(({ message }) => message).join('\n'));

    this.errors = flat;
    this.statusCode = statusFor(flat);
  }

  /**
   * The error to throw for `errors`: the only one, or a list of them.
   */
  static from(errors: Array<ServerError>): ServerError {
    return errors.length === 1 ? errors[0]! : new ErrorList(errors);
  }
}

/**
 * Run each of `steps`, collecting the server errors (those with a
 * `statusCode`) they throw instead of stopping at the first; anything else
 * is a bug and is rethrown at once. Throws the collected errors, if any.
 *
 * @internal
 */
export function collectErrors(
  steps: Array<() => void>,
  errors: Array<ServerError> = []
): void {
  steps.forEach(step => {
    try {
      step();
    } catch (error) {
      if (!isServerError(error)) {
        throw error;
      }

      errors.push(error);
    }
  });

  if (errors.length) {
    throw ErrorList.from(errors);
  }
}

export default ErrorList;
