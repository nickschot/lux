import { EventEmitter } from 'events';

import { it, describe, expect } from 'vitest';

import { readBody } from '../utils/parse-write';
import type { Request } from '../../interfaces';

// A request whose body arrives in the given chunks, with the given headers.
function requestOf(
  chunks: Array<Buffer>,
  headers: Record<string, string> = {}
): Request & EventEmitter {
  const req = Object.assign(new EventEmitter(), {
    headers: new Map(Object.entries(headers))
  });

  setImmediate(() => {
    chunks.forEach(chunk => req.emit('data', chunk));
    req.emit('end');
  });

  return req as unknown as Request & EventEmitter;
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

  describe('with a limit', () => {
    const tooLarge = {
      statusCode: 413,
      message: 'The request body is larger than the 8 bytes it may be.'
    };

    it('reads a body of up to `limit` bytes', async () => {
      expect(await readBody(requestOf([Buffer.from('12345678')]), 8)).to.equal(
        '12345678'
      );
    });

    it('refuses one whose Content-Length is larger, without reading it', async () => {
      const req = requestOf([Buffer.from('123456789')], {
        'content-length': '9'
      });

      await expect(readBody(req, 8)).rejects.toMatchObject(tooLarge);
      expect(req.listenerCount('data')).to.equal(0);
    });

    it('stops reading one that grows larger without a Content-Length', async () => {
      const req = requestOf([Buffer.from('12345'), Buffer.from('6789')]);

      await expect(readBody(req, 8)).rejects.toMatchObject(tooLarge);
      expect(req.listenerCount('data')).to.equal(0);
    });

    it('counts bytes, not characters', async () => {
      // Four characters, eight bytes.
      const req = requestOf([Buffer.from('éééé!')]);

      await expect(readBody(req, 8)).rejects.toMatchObject(tooLarge);
    });
  });
});
