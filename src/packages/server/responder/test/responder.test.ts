import fetch from 'node-fetch';
import { createServer } from 'http';
import {
  it,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
  describe,
  expect
} from 'vitest';

import { MIME_TYPE, VERSION } from '../../../jsonapi';
import { createRequest } from '../../request';
import { createResponse } from '../../response';
import { createResponder } from '../index';

import setEnv from '../../../../../test/utils/set-env';
import { getTestApp } from '../../../../../test/utils/get-test-app';

const DOMAIN = 'http://localhost:4100';

describe('module "server/responder"', () => {
  let test;
  let server;
  let handler;

  // One server for the whole suite. The original created and closed one per
  // test on port 4100, but `close()` is asynchronous, so each request raced
  // the previous server's shutdown — under Vitest every *other* test lost the
  // race and failed with "socket hang up". Reusing one listener removes the
  // race entirely; the per-test behaviour under assertion is unchanged.
  beforeAll(async () => {
    const { logger, router } = await getTestApp();

    server = createServer((req, res) => {
      handler(
        createRequest(req, {
          logger,
          router
        }),
        createResponse(res, {
          logger
        })
      );
    });

    await new Promise(resolve => {
      server.listen(4100, resolve);
    });

    test = fn => {
      handler = fn;
      return fetch(DOMAIN);
    };
  });

  afterAll(
    () =>
      new Promise(resolve => {
        server.close(resolve);
      })
  );

  describe('#createResponder()', () => {
    it('creates a #respond() function', () => {
      return test((req, res) => {
        const result = createResponder(req, res);

        expect(result).to.be.a('function');
        expect(result.length).to.equal(1);
        expect(result).to.not.throw(Error);
      });
    });

    describe('#respond()', () => {
      describe('- responding with a string', () => {
        it('works as expected', async () => {
          const result = await test((req, res) => {
            const respond = createResponder(req, res);

            res.setHeader('Content-Type', 'text/plain');

            respond('Hello World');
          });

          expect(result.status).to.equal(200);
          expect(result.headers.get('Content-Type')).to.equal('text/plain');
          expect(await result.text()).to.equal('Hello World');
        });
      });

      describe('- responding with a number', () => {
        it('works with `204`', async () => {
          const result = await test((req, res) => {
            const respond = createResponder(req, res);

            respond(204);
          });

          expect(result.status).to.equal(204);
          expect(result.headers.get('Content-Type')).to.be.null;
          expect(await result.text()).to.equal('');
        });

        it('works with `400`', async () => {
          const result = await test((req, res) => {
            const respond = createResponder(req, res);

            respond(400);
          });

          expect(result.status).to.equal(400);
          expect(result.headers.get('Content-Type')).to.equal(MIME_TYPE);
          expect(await result.json()).to.deep.equal({
            errors: [
              {
                status: '400',
                title: 'Bad Request'
              }
            ],
            jsonapi: {
              version: VERSION
            }
          });
        });
      });

      describe('- responding with a boolean', () => {
        it('works with `true`', async () => {
          const result = await test((req, res) => {
            const respond = createResponder(req, res);

            respond(true);
          });

          expect(result.status).to.equal(204);
          expect(result.headers.get('Content-Type')).to.be.null;
          expect(await result.text()).to.equal('');
        });

        it('works with `false`', async () => {
          const result = await test((req, res) => {
            const respond = createResponder(req, res);

            respond(false);
          });

          expect(result.status).to.equal(401);
          expect(result.headers.get('Content-Type')).to.equal(MIME_TYPE);
          expect(await result.json()).to.deep.equal({
            errors: [
              {
                status: '401',
                title: 'Unauthorized'
              }
            ],
            jsonapi: {
              version: VERSION
            }
          });
        });
      });

      describe('- responding with an object', () => {
        it('works with `null`', async () => {
          const result = await test((req, res) => {
            const respond = createResponder(req, res);

            respond(null);
          });

          expect(result.status).to.equal(404);
          expect(result.headers.get('Content-Type')).to.equal(MIME_TYPE);
          expect(await result.json()).to.deep.equal({
            errors: [
              {
                status: '404',
                title: 'Not Found'
              }
            ],
            jsonapi: {
              version: VERSION
            }
          });
        });

        it('works with an object', async () => {
          const result = await test((req, res) => {
            const respond = createResponder(req, res);

            respond({ test: true });
          });

          expect(result.status).to.equal(200);
          expect(result.headers.get('Content-Type')).to.equal(MIME_TYPE);
          expect(await result.json()).to.deep.equal({ test: true });
        });

        it('works with an array', async () => {
          const result = await test((req, res) => {
            const respond = createResponder(req, res);

            respond(['test', true]);
          });

          expect(result.status).to.equal(200);
          expect(result.headers.get('Content-Type')).to.equal(MIME_TYPE);
          expect(await result.json()).to.deep.equal(['test', true]);
        });
      });

      describe('- responding with an error', () => {
        beforeEach(() => {
          setEnv('development');
        });

        afterEach(() => {
          setEnv('test');
        });

        it('works with vanilla errors', async () => {
          const result = await test((req, res) => {
            const respond = createResponder(req, res);

            respond(new Error('test'));
          });

          expect(result.status).to.equal(500);
          expect(result.headers.get('Content-Type')).to.equal(MIME_TYPE);
          expect(await result.json()).to.deep.equal({
            errors: [
              {
                status: '500',
                title: 'Internal Server Error',
                detail: 'test'
              }
            ],
            jsonapi: {
              version: VERSION
            }
          });
        });

        it('works with errors containing a `statusCode` property', async () => {
          const result = await test((req, res) => {
            const respond = createResponder(req, res);

            class ForbiddenError extends Error {
              statusCode = 403;
            }

            respond(new ForbiddenError('test'));
          });

          expect(result.status).to.equal(403);
          expect(result.headers.get('Content-Type')).to.equal(MIME_TYPE);
          expect(await result.json()).to.deep.equal({
            errors: [
              {
                status: '403',
                title: 'Forbidden',
                detail: 'test'
              }
            ],
            jsonapi: {
              version: VERSION
            }
          });
        });
      });

      describe('- responding with undefined', () => {
        it('works as expected', async () => {
          const result = await test((req, res) => {
            const respond = createResponder(req, res);

            respond();
          });

          expect(result.status).to.equal(404);
          expect(result.headers.get('Content-Type')).to.equal(MIME_TYPE);
          expect(await result.json()).to.deep.equal({
            errors: [
              {
                status: '404',
                title: 'Not Found'
              }
            ],
            jsonapi: {
              version: VERSION
            }
          });
        });
      });
    });
  });
});
