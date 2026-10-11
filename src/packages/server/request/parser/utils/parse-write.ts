import { MalformedRequestError } from '../errors';
import isObject from '../../../../../utils/is-object';
import { tryCatchSync } from '../../../../../utils/try-catch';
import type { Request } from '../../interfaces';

import normalizeDocument from './normalize-document';

/**
 * The request body, read to the end as text. The bytes are decoded once, at
 * the end: a chunk may end inside a multi-byte character.
 *
 * @internal
 */
export function readBody(req: Request): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Array<Buffer> = [];
    const cleanUp = () => {
      req.removeAllListeners('end');
      req.removeAllListeners('data');
      req.removeAllListeners('error');
    };

    req.on('data', (data: Buffer | string) => {
      chunks.push(typeof data === 'string' ? Buffer.from(data) : data);
    });

    req.once('end', () => {
      cleanUp();
      resolve(Buffer.concat(chunks).toString('utf8'));
    });

    req.once('error', err => {
      cleanUp();
      reject(err);
    });
  });
}

/**
 * A plain route's body: any JSON, as sent, or `undefined` when there is
 * none. Nothing in it is validated or renamed.
 *
 * @internal
 */
export async function parseJSON(req: Request): Promise<unknown> {
  const body = await readBody(req);

  if (!body.trim()) {
    return undefined;
  }

  const parsed = tryCatchSync(() => ({ value: JSON.parse(body) as unknown }));

  if (!parsed) {
    throw new MalformedRequestError('valid JSON');
  }

  return parsed.value;
}

/**
 * A JSON:API document's members, normalized into the request's parameters.
 * The document as sent is also `request.body`.
 *
 * @internal
 */
export default async function parseWrite(
  req: Request
): Promise<Record<string, unknown>> {
  const body = await readBody(req);
  const parsed = tryCatchSync(() => JSON.parse(body) as unknown);

  if (!isObject(parsed)) {
    throw new MalformedRequestError();
  }

  req.body = parsed;

  return normalizeDocument(parsed) as Record<string, unknown>;
}
