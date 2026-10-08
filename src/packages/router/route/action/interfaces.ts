import type { Request, Response } from '../../../server';

/**
 * A function called with a request and its response, as an action or hook
 * is: what {@link lumenify} returns.
 */
export type Action<T> = (
  req: Request,
  res: Response,
  data?: unknown
) => Promise<T>;
