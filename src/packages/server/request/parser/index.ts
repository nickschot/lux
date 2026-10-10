import type { Request } from '../interfaces';

import parseRead from './utils/parse-read';
import parseWrite, { parseJSON } from './utils/parse-write';

/**
 * The request's parameters: the query string's, and on `POST` and `PATCH`
 * the body's. A plain route's body is any JSON, kept as `request.body` and
 * not validated; a resource route's is a JSON:API document, normalized into
 * the parameters (`data`) and also kept as `request.body`.
 *
 * @internal
 */
export function parseRequest(req: Request): Promise<Record<string, unknown>> {
  switch (req.method) {
    case 'POST':
    case 'PATCH':
      if (req.route?.type === 'custom') {
        return parseJSON(req).then(body => {
          req.body = body;
          return parseRead(req);
        });
      }

      return parseWrite(req).then(params => ({
        ...parseRead(req),
        ...params
      }));

    default:
      return Promise.resolve(parseRead(req));
  }
}
