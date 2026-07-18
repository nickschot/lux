import chalk from 'chalk';

import { DEBUG } from '../../constants';
import { infoTemplate, debugTemplate } from '../templates';
import type Logger from '../../index';
import type { Request, Response } from '../../../server';

import filterParams from './filter-params';

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
      route,
      method,

      url: { path },

      connection: { remoteAddress }
    } = req;

    const { stats, statusCode, statusMessage } = res;
    const params = filterParams(req.params, ...logger.filter.params);
    const statusColor = statusCode >= 200 && statusCode < 400 ? 'green' : 'red';

    let colorStr: (source: string) => string = Reflect.get(chalk, statusColor);

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

    if (logger.level === DEBUG) {
      logger.debug(debugTemplate(templateData));
    } else {
      logger.info(infoTemplate(templateData));
    }
  });
}
