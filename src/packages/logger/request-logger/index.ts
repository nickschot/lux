import type Logger from '../index';

import logText from './utils/log-text';
import logJSON from './utils/log-json';
import type { RequestLoggerFn } from './interfaces';

/** @internal */
export function createRequestLogger(logger: Logger): RequestLoggerFn {
  return function request(req, res, { startTime }: { startTime: number }) {
    if (logger.format === 'json') {
      logJSON(logger, {
        startTime,
        request: req,
        response: res
      });
    } else {
      logText(logger, {
        startTime,
        request: req,
        response: res
      });
    }
  };
}
