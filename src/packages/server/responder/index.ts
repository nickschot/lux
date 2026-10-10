import { MIME_TYPE } from '../../jsonapi';
import type { Request, Response } from '../index';

import normalize from './utils/normalize';
import hasContentType from './utils/has-content-type';

/** @internal */
export function createResponder(req: Request, res: Response) {
  return function respond(data?: unknown) {
    const normalized = normalize(data);

    if (normalized.statusCode) {
      res.statusCode = normalized.statusCode;
    }

    // A string an action returns is its body as is: plain text, unless the
    // action set a Content-Type of its own (CSV, HTML, …).
    if (res.statusCode !== 204 && !hasContentType(res)) {
      res.setHeader(
        'Content-Type',
        typeof data === 'string' ? 'text/plain; charset=utf-8' : MIME_TYPE
      );
    }

    res.end(normalized.data);
  };
}
