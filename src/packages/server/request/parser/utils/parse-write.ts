import { MalformedRequestError } from '../errors';
import isObject from '../../../../../utils/is-object';
import { tryCatchSync } from '../../../../../utils/try-catch';
import type { Request } from '../../interfaces';

import normalizeDocument from './normalize-document';

/** @internal */
export default function parseWrite(
  req: Request
): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let body = '';
    const cleanUp = () => {
      req.removeAllListeners('end');
      req.removeAllListeners('data');
      req.removeAllListeners('error');
    };

    req.on('data', data => {
      body += data.toString();
    });

    req.once('end', () => {
      const parsed = tryCatchSync(() => JSON.parse(body));

      cleanUp();

      if (isObject(parsed)) {
        resolve(normalizeDocument(parsed) as Record<string, unknown>);
      } else {
        reject(new MalformedRequestError());
      }
    });

    req.once('error', err => {
      cleanUp();
      reject(err);
    });
  });
}
