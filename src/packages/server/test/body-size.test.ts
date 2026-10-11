import { it, describe, beforeAll, afterAll, expect } from 'vitest';

import Server from '../index';
import type Application from '../../application';
import { getTestApp } from '../../../../test/utils/get-test-app';
import { readDocument } from '../../../../test/utils/expect-jsonapi-document';

// The size limit on request bodies (nickschot/lux#174), with the server's
// lowered to 1 KiB. The test-app's PostsController allows 64 KiB.

const JSONAPI = 'application/vnd.api+json';
const LIMIT = 1024;

let DOMAIN = '';

// A JSON body of about `size` bytes.
const jsonOf = (size: number) => JSON.stringify({ padding: 'x'.repeat(size) });

async function post(
  path: string,
  body: string | ReadableStream<Uint8Array>,
  contentType = 'application/json'
) {
  const res = await fetch(`${DOMAIN}${path}`, {
    method: 'POST',
    headers: { Accept: JSONAPI, 'Content-Type': contentType },
    body,
    // A stream is sent chunked, without a Content-Length.
    ...(typeof body === 'string' ? {} : { duplex: 'half' })
  } as RequestInit);

  return {
    status: res.status,
    connection: res.headers.get('connection'),
    body: await readDocument(res)
  };
}

describe('the size of request bodies', () => {
  let app: Application;
  let server: Server;

  beforeAll(async () => {
    app = await getTestApp();

    server = new Server({
      logger: app.logger,
      router: app.router,
      cors: { enabled: false },
      maxBodySize: LIMIT
    });

    server.listen(0);
    await new Promise(resolve => server.instance.once('listening', resolve));

    const { port } = server.instance.address() as { port: number };

    DOMAIN = `http://localhost:${port}`;
  });

  afterAll(() => {
    server.instance.close();
  });

  it('reads a body within the limit', async () => {
    const res = await post('/webhooks', jsonOf(100));

    expect(res.status).to.equal(200);
  });

  it('refuses a larger one with a 413, and closes the connection', async () => {
    const res = await post('/webhooks', jsonOf(2 * LIMIT));

    expect(res.status).to.equal(413);
    expect(res.connection).to.equal('close');
    expect(res.body.errors).to.deep.equal([
      {
        status: '413',
        title: 'Payload Too Large',
        detail: `The request body is larger than the ${LIMIT} bytes it may be.`
      }
    ]);
  });

  it('refuses a larger one sent without a Content-Length', async () => {
    const chunk = new TextEncoder().encode('x'.repeat(512));
    let sent = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (sent === 0) {
          controller.enqueue(new TextEncoder().encode('{"padding":"'));
        }

        if (sent < 4) {
          sent += 1;
          controller.enqueue(chunk);
        } else {
          controller.enqueue(new TextEncoder().encode('"}'));
          controller.close();
        }
      }
    });

    const res = await post('/webhooks', stream);

    expect(res.status).to.equal(413);
  });

  it('applies to resource routes too', async () => {
    const res = await post(
      '/comments',
      JSON.stringify({
        data: {
          type: 'comments',
          attributes: { message: 'x'.repeat(2 * LIMIT) }
        }
      }),
      JSONAPI
    );

    expect(res.status).to.equal(413);
  });

  it("lets a controller's `maxBodySize` allow more on its routes", async () => {
    const res = await post('/posts/echo', jsonOf(2 * LIMIT));

    expect(res.status).to.equal(200);
    expect(res.body.received.padding).to.have.lengthOf(2 * LIMIT);
  });

  it('defaults to 1 MiB', () => {
    const subject = new Server({
      logger: app.logger,
      router: app.router,
      cors: { enabled: false }
    });

    expect(subject.maxBodySize).to.equal(1024 * 1024);
  });

  it('refuses a limit that is not a number of bytes', () => {
    [0, -1, 1.5, '1mb', null].forEach(maxBodySize => {
      expect(
        () =>
          new Server({
            logger: app.logger,
            router: app.router,
            cors: { enabled: false },
            maxBodySize: maxBodySize as number
          }),
        String(maxBodySize)
      ).to.throw(
        TypeError,
        '`server.maxBodySize` must be a positive whole number'
      );
    });
  });
});
