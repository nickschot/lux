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
import ErrorList from '../../errors/error-list';
import UniqueConstraintError from '../../../database/errors/unique-constraint-error';
import { ParameterValueError } from '../../../router/route/params/errors';

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

        it('is plain text when no Content-Type is set', async () => {
          const result = await test((req, res) => {
            createResponder(req, res)('Hello World');
          });

          expect(result.status).to.equal(200);
          expect(result.headers.get('Content-Type')).to.equal(
            'text/plain; charset=utf-8'
          );
          expect(await result.text()).to.equal('Hello World');
        });

        it('keeps a Content-Type the action set', async () => {
          const result = await test((req, res) => {
            res.setHeader('Content-Type', 'text/csv');
            createResponder(req, res)('id,title\n1,Hello');
          });

          expect(result.headers.get('Content-Type')).to.equal('text/csv');
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

        it('omits details outside of development environments', async () => {
          setEnv('production');

          const result = await test((req, res) => {
            const respond = createResponder(req, res);

            respond(new Error('test'));
          });

          expect(result.status).to.equal(500);
          expect(await result.json()).to.deep.equal({
            errors: [
              {
                status: '500',
                title: 'Internal Server Error'
              }
            ],
            jsonapi: {
              version: VERSION
            }
          });
        });

        it('keeps `[public]` details outside of development environments', async () => {
          setEnv('production');

          const result = await test((req, res) => {
            const respond = createResponder(req, res);

            respond(new Error('[public] visible'));
          });

          expect(result.status).to.equal(500);
          expect(await result.json()).to.deep.equal({
            errors: [
              {
                status: '500',
                title: 'Internal Server Error',
                detail: 'visible'
              }
            ],
            jsonapi: {
              version: VERSION
            }
          });
        });
        it("keeps the framework's client error details outside of development environments", async () => {
          setEnv('production');

          const result = await test((req, res) => {
            const param = new Set(['title', '-title']) as never;

            Object.assign(param, { path: 'sort' });
            createResponder(req, res)(new ParameterValueError(param, 'body'));
          });

          expect(result.status).to.equal(400);
          expect((await result.json()).errors[0]).to.have.property(
            'detail',
            "Expected value for parameter 'sort' to be one of [title, -title] " +
              'but got body.'
          );
        });

        it("omits the database driver's message of a unique constraint violation outside of development environments", async () => {
          setEnv('production');

          const result = await test((req, res) => {
            createResponder(
              req,
              res
            )(
              new UniqueConstraintError('UNIQUE constraint failed: users.email')
            );
          });

          expect(result.status).to.equal(409);
          expect((await result.json()).errors[0]).not.to.have.property(
            'detail'
          );
        });
      });

      describe('- responding with errors carrying error object members', () => {
        it('passes `id`, `code`, `title`, `meta` and `links.about` through', async () => {
          const result = await test((req, res) => {
            const respond = createResponder(req, res);

            respond(
              Object.assign(new Error('test'), {
                statusCode: 422,
                id: 'abc',
                code: 'title-taken',
                title: 'Title taken',
                meta: { suggestion: 'Another title' },
                links: { about: 'https://example.com/errors/title-taken' }
              })
            );
          });

          expect(result.status).to.equal(422);
          expect(await result.json()).to.deep.equal({
            errors: [
              {
                id: 'abc',
                status: '422',
                code: 'title-taken',
                title: 'Title taken',
                meta: { suggestion: 'Another title' },
                links: { about: 'https://example.com/errors/title-taken' }
              }
            ],
            jsonapi: {
              version: VERSION
            }
          });
        });

        it('answers an `ErrorList` with one error object per error', async () => {
          const result = await test((req, res) => {
            const respond = createResponder(req, res);

            respond(
              new ErrorList([
                Object.assign(new Error('a'), {
                  statusCode: 403,
                  source: { pointer: '/data/relationships/tags' }
                }),
                Object.assign(new Error('b'), {
                  statusCode: 400,
                  source: { parameter: 'sort' }
                })
              ])
            );
          });

          // Mixed client errors: the most generally applicable status.
          expect(result.status).to.equal(400);
          expect((await result.json()).errors).to.deep.equal([
            {
              status: '403',
              title: 'Forbidden',
              source: { pointer: '/data/relationships/tags' }
            },
            {
              status: '400',
              title: 'Bad Request',
              source: { parameter: 'sort' }
            }
          ]);
        });

        it('keeps the shared status of an `ErrorList`', async () => {
          const result = await test((req, res) => {
            const respond = createResponder(req, res);

            respond(
              new ErrorList(
                ['a', 'b'].map(message =>
                  Object.assign(new Error(message), { statusCode: 422 })
                )
              )
            );
          });

          expect(result.status).to.equal(422);
          expect((await result.json()).errors).to.have.lengthOf(2);
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
