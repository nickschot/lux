import { spy } from 'sinon';
import { it, describe, beforeAll, afterAll, beforeEach, expect } from 'vitest';

import Server from '../index';
import K from '../../../utils/k';

// Which errors the server logs, and at what level. The router is a stub whose
// one route rejects with whatever error the test sets.

class NotFoundError extends Error {
  statusCode = 404;
}

describe('server error logging', () => {
  let server;
  let logger;
  let domain = '';
  let thrown: Error;

  beforeAll(async () => {
    logger = { request: K, error: spy(), debug: spy() };

    const route = {
      action: 'index',
      controller: {},
      visit: () => Promise.reject(thrown)
    };

    server = new Server({
      logger,
      router: { match: () => route, methodsFor: () => ['GET'] },
      cors: { enabled: false }
    } as unknown as ConstructorParameters<typeof Server>[0]);

    server.listen(0);
    await new Promise(resolve => server.instance.once('listening', resolve));
    domain = `http://localhost:${server.instance.address().port}`;
  });

  afterAll(() => {
    server.instance.close();
  });

  beforeEach(() => {
    logger.error.resetHistory();
    logger.debug.resetHistory();
  });

  const get = (headers: Record<string, string> = {}) =>
    fetch(`${domain}/posts`, {
      headers: { Accept: 'application/vnd.api+json', ...headers }
    });

  it('logs a 5xx as an error, with the error itself', async () => {
    thrown = new Error('boom');

    expect((await get()).status).to.equal(500);
    expect(logger.error.calledOnceWith(thrown)).to.be.true;
    expect(logger.debug.called).to.be.false;
  });

  it('logs errors with the request id it answers with', async () => {
    thrown = new Error('boom');

    const res = await get({ 'X-Request-Id': 'trace-42' });

    expect(res.headers.get('X-Request-Id')).to.equal('trace-42');
    expect(logger.error.firstCall.args[1]).to.deep.equal({
      requestId: 'trace-42'
    });
  });

  it('logs a 4xx at debug, as a one-line message', async () => {
    thrown = new NotFoundError('Could not find post');

    expect((await get()).status).to.equal(404);
    expect(logger.error.called).to.be.false;
    expect(logger.debug.calledOnceWith('NotFoundError: Could not find post')).to
      .be.true;
  });
});
