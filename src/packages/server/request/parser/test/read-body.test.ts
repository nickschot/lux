import { EventEmitter } from 'events';

import { it, describe, expect } from 'vitest';

import { readBody } from '../utils/parse-write';
import type { Request } from '../../interfaces';

// A request whose body arrives in the given chunks.
function requestOf(chunks: Array<Buffer>): Request {
  const req = new EventEmitter();

  setImmediate(() => {
    chunks.forEach(chunk => req.emit('data', chunk));
    req.emit('end');
  });

  return req as unknown as Request;
}

describe('module "server/request/parser" #readBody()', () => {
  it('reads the chunks to the end, as text', async () => {
    const body = await readBody(
      requestOf([Buffer.from('{"a":'), Buffer.from('1}')])
    );

    expect(body).to.equal('{"a":1}');
  });

  it('keeps a character split across two chunks', async () => {
    // "é" is two bytes in UTF-8; the first chunk ends between them.
    const bytes = Buffer.from('{"name":"José"}');
    const split = bytes.indexOf(0xa9);

    const body = await readBody(
      requestOf([bytes.subarray(0, split), bytes.subarray(split)])
    );

    expect(body).to.equal('{"name":"José"}');
  });
});
