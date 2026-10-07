import chalk from '../../../../utils/chalk';
import { DEBUG } from '../../constants';
import { infoTemplate, debugTemplate } from '../templates';
import type Logger from '../../index';
import type { Request, Response } from '../../../server';

import paramsFor from './params-for';

/**
 * @private
 */
export default function logText(
  logger: Logger,
  {
    startTime,
    request: req,
    response: res
  }: {
    request: Request;
    response: Response;
    startTime: number;
  }
): void {
  res.once('finish', () => {
    const endTime = Date.now();

    const {
      id: requestId,
      ip: remoteAddress,
      route,
      method,

      // `pathname`, not `path`: the query string would bypass the param filter;
      // query params are logged, filtered, under `params`.
      url: { pathname: path }
    } = req;

    const { stats, statusCode, statusMessage } = res;
    const params = paramsFor(logger, req);
    const statusColor = statusCode >= 200 && statusCode < 400 ? 'green' : 'red';

    let colorStr: (source: string) => string = chalk[statusColor];

    if (typeof colorStr === 'undefined') {
      colorStr = (str: string) => str;
    }

    const templateData = {
      path,
      stats,
      route,
      method,
      params,
      colorStr,
      startTime,
      endTime,
      statusCode: statusCode.toString(),
      statusMessage,
      remoteAddress
    };

    const context = { requestId };

    if (logger.level === DEBUG) {
      logger.debug(debugTemplate(templateData), context);
    } else {
      logger.info(infoTemplate(templateData), context);
    }
  });
}
