import type { Request, Response } from '../../../server';

export type Action<T> = (
  req: Request,
  res: Response,
  data?: unknown
) => Promise<T>;
