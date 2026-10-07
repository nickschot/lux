import type Logger from '../../index';
import type { Request, Response } from '../../../server';

import paramsFor from './params-for';

const MESSAGE = 'Processed Request';

/**
 * @private
 */
export default function logJSON(
  logger: Logger,
  {
    startTime,
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
      id: requestId,
      ip: remoteAddress,
      route,
      method,
      headers,
      httpVersion,

      // `pathname`, not `path`: the query string would bypass the param filter;
      // query params are logged, filtered, under `params`.
      url: { pathname: path }
    } = req;

    const { statusCode: status } = res;
    const userAgent = headers.get('user-agent');
    const protocol = `HTTP/${httpVersion}`;

    logger.info(
      {
        message: MESSAGE,

        method,
        path,
        status,
        durationMs: Date.now() - startTime,
        controller: route?.controller.constructor.name,
        action: route?.action,
        params: paramsFor(logger, req),
        protocol,
        userAgent,
        remoteAddress
      },
      { requestId }
    );
  });
}
