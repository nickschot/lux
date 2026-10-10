import type { Route } from '../../router';
import type { Request, Response } from '../../server';

export type RequestLoggerFn = (
  req: Request,
  res: Response,

  opts: {
    startTime: number;
  }
) => void;

type RequestLoggerStat = {
  type: string;
  name: string;
  duration: number;
  controller: string;
};

export type RequestLoggerTemplateData = {
  path: string;
  stats: Array<RequestLoggerStat>;
  route?: Route;
  method: string;
  params: Record<string, unknown>;
  startTime: number;
  endTime: number;
  statusCode: string;
  statusMessage: string;
  remoteAddress?: string;

  colorStr(source: string): string;
};
