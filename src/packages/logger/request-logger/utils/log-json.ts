import type Logger from '../../index';
import type { Request, Response } from '../../../server';

import filterParams from './filter-params';

const MESSAGE = 'Processed Request';

/**
 * @private
 */
export default function logJSON(
  logger: Logger,
  {
    request: req,
    response: res
  }: {
    startTime: number;
    request: Request;
    response: Response;
  }
): void {
  res.once('finish', () => {
    const {
      method,
      headers,
      httpVersion,

      url: { path },

      connection: { remoteAddress }
    } = req;

    const { statusCode: status } = res;
    const userAgent = headers.get('user-agent');
    const protocol = `HTTP/${httpVersion}`;
    const params = filterParams(req.params, ...logger.filter.params);

    logger.info({
      message: MESSAGE,

      method,
      path,
      params,
      status,
      protocol,
      userAgent,
      remoteAddress
    });
  });
}
