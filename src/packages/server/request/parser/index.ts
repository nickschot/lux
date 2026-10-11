import type { Request } from '../interfaces';

import parseRead from './utils/parse-read';
import parseWrite, { parseJSON } from './utils/parse-write';

/**
 * The request's parameters: the query string's, and on `POST` and `PATCH`
 * the body's. A plain route's body is any JSON, kept as `request.body` and
 * not validated; a resource route's is a JSON:API document, normalized into
 * the parameters (`data`) and also kept as `request.body`. A body of more than
 * `maxBodySize` bytes is a `413`.
 *
 * @internal
 */
export function parseRequest(
  req: Request,
  maxBodySize?: number
): Promise<Record<string, unknown>> {
  switch (req.method) {
    case 'POST':
    case 'PATCH':
      if (req.route?.type === 'custom') {
        return parseJSON(req, maxBodySize).then(body => {
          req.body = body;
          return parseRead(req);
        });
      }

      return parseWrite(req, maxBodySize).then(params => ({
        ...parseRead(req),
        ...params
      }));

    default:
      return Promise.resolve(parseRead(req));
  }
}
