import type { Request, Response } from '../index';

import normalize from './utils/normalize';
import hasContentType from './utils/has-content-type';
import contentTypeFor from './utils/content-type-for';

/** @internal */
export function createResponder(req: Request, res: Response) {
  return function respond(data?: unknown) {
    const normalized = normalize(data);

    if (normalized.statusCode) {
      res.statusCode = normalized.statusCode;
    }

    // Labelled by what it is, unless the action set a Content-Type of its own
    // (CSV, HTML, …): a JSON:API document, other JSON, plain text, or nothing
    // for an empty body.
    if (res.statusCode !== 204 && !hasContentType(res)) {
      const contentType = contentTypeFor(normalized.body);

      if (contentType) {
        res.setHeader('Content-Type', contentType);
      }
    }

    res.end(normalized.data);
  };
}
