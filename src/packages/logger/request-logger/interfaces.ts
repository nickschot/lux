import type { Route } from '../../router';
import type { Request, Response } from '../../server';

export type Logger$RequestLogger = (
  req: Request,
  res: Response,

  opts: {
    startTime: number;
  }
) => void;

type RequestLogger$stat = {
  type: string;
  name: string;
  duration: number;
  controller: string;
};

export type RequestLogger$templateData = {
  path: string;
  stats: Array<RequestLogger$stat>;
  route?: Route;
  method: string;
  params: Record<string, unknown>;
  startTime: number;
  endTime: number;
  statusCode: string;
  statusMessage: string;
  remoteAddress: string;

  colorStr(source: string): string;
};
