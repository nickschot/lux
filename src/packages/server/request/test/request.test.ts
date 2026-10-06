import { createServer, request as httpRequest } from 'http';
import { parse as parseURL } from 'url';
import { it, describe, beforeAll, afterAll, expect } from 'vitest';

import { MIME_TYPE } from '../../../jsonapi';
import { getDomain, createRequest, parseRequest } from '../index';
import { MalformedRequestError } from '../parser/errors';

import { getTestApp } from '../../../../../test/utils/get-test-app';

const DOMAIN = 'http://localhost:4100';

// Plain `http.request`, not the global `fetch`: #getDomain() sends its own
// `Host` header, which the Fetch spec forbids and undici silently drops.
function send(url, { method = 'GET', headers = {}, body = undefined } = {}) {
  return new Promise((resolve, reject) => {
    const req = httpRequest(url, { method, headers }, res => {
      res.resume();
      res.on('end', resolve);
    });

    req.on('error', reject);
    req.end(body);
  });
}

describe('module "server/request"', () => {
  let test;
  let server;
  let handler;
  let appLogger;

  // One listener for the whole suite: a per-test `listen()` + `close()` races
  // itself because `close()` is asynchronous (see responder.test).
  //
  // The handler's outcome is captured and re-thrown in the test after the
  // response arrives. Previously the handler ran `fn(req).then(close, close)`,
  // which swallowed every rejection, so no assertion in this file could fail.
  beforeAll(async () => {
    const { logger, router } = await getTestApp();

    appLogger = logger;

    server = createServer((req, res) => {
      handler(createRequest(req, { logger, router }), res);
    });

    await new Promise(resolve => {
      server.listen(4100, resolve);
    });

    test = async (path, opts, fn) => {
      let outcome;

      handler = (req, res) => {
        outcome = Promise.resolve()
          .then(() => fn(req))
          .then(
            () => ({ ok: true }),
            error => ({ ok: false, error })
          );

        outcome.then(() => {
          res.statusCode = 200;
          res.end();
        });
      };

      await send(DOMAIN + path, opts);

      expect(outcome, 'request handler was never invoked').to.be.ok;

      const result = await outcome;

      if (!result.ok) {
        throw result.error;
      }
    };
  });

  afterAll(
    () =>
      new Promise(resolve => {
        server.close(resolve);
      })
  );

  describe('#getDomain()', () => {
    it('returns the domain (`${PROTOCOL}://${HOST}`) of a request', () => {
      return test(
        '/posts',
        {
          headers: {
            host: 'example.com'
          }
        },
        async req => {
          const result = getDomain(req);

          expect(result).to.equal('http://example.com');
        }
      );
    });
  });

  describe('#createRequest()', () => {
    it('can create a Request from an http.IncomingMessage', () => {
      return test(
        '/posts',
        {
          headers: {
            'x-test': 'true'
          }
        },
        async ({ url, route, method, logger, headers }) => {
          expect(url).to.deep.equal({
            ...parseURL('/posts', true),
            params: []
          });
          expect(route).to.be.ok;
          expect(method).to.equal('GET');
          expect(logger).to.equal(appLogger);
          expect(headers).to.be.an.instanceof(Map);
          expect(headers.get('x-test')).to.equal('true');
        }
      );
    });

    it('accepts an X-HTTP-Method-Override header', () => {
      return test(
        '/posts',
        {
          method: 'POST',
          headers: {
            'X-HTTP-Method-Override': 'PATCH'
          }
        },
        async ({ method }) => {
          expect(method).to.equal('PATCH');
        }
      );
    });
  });

  describe('#parseRequest()', () => {
    it('can parse params from a GET request', () => {
      const now = new Date().toISOString();
      const url =
        '/posts?' +
        'fields[posts]=body,title' +
        '&fields[users]=name' +
        '&include=user' +
        '&filter[is-public]=true' +
        '&filter[title]=123' +
        '&filter[body]=null' +
        `&filter[created-at]=${now}`;

      return test(
        url,
        {
          method: 'GET'
        },
        async req => {
          const params = await parseRequest(req);

          expect(params).to.deep.equal({
            fields: {
              posts: ['body', 'title'],
              users: ['name']
            },
            include: ['user'],
            filter: {
              body: null,
              title: 123,
              isPublic: true,
              createdAt: new Date(now)
            }
          });

          expect(params.filter.createdAt).to.be.an.instanceOf(Date);
        }
      );
    });

    it('can parse params from a POST request', () => {
      const now = new Date().toISOString();

      return test(
        '/posts?include=user',
        {
          method: 'POST',
          body: JSON.stringify({
            data: {
              type: 'posts',
              attributes: {
                title: 'New Post 1',
                'is-public': true,
                intString: '123',
                nullString: 'null',
                boolString: 'true',
                dateString: now
              },
              relationships: {
                user: {
                  data: {
                    type: 'users',
                    id: 1
                  }
                },
                tags: {
                  data: [
                    {
                      type: 'tags',
                      id: 1
                    },
                    {
                      type: 'tags',
                      id: 2
                    },
                    {
                      type: 'tags',
                      id: 3
                    }
                  ]
                }
              }
            }
          }),
          headers: {
            'Content-Type': MIME_TYPE
          }
        },
        async req => {
          const params = await parseRequest(req);

          expect(params).to.deep.equal({
            data: {
              type: 'posts',
              attributes: {
                title: 'New Post 1',
                isPublic: true,
                intString: '123',
                nullString: 'null',
                boolString: 'true',
                // Values arrive as sent: dates are parsed by parameter
                // validation, and only for date columns.
                dateString: now
              },
              relationships: {
                user: {
                  data: {
                    type: 'users',
                    id: 1
                  }
                },
                tags: {
                  data: [
                    {
                      type: 'tags',
                      id: 1
                    },
                    {
                      type: 'tags',
                      id: 2
                    },
                    {
                      type: 'tags',
                      id: 3
                    }
                  ]
                }
              }
            },
            include: ['user']
          });
        }
      );
    });

    it('can parse params from a PATCH request', () => {
      const now = new Date().toISOString();

      return test(
        '/posts/1?include=user',
        {
          method: 'PATCH',
          body: JSON.stringify({
            data: {
              id: 1,
              type: 'posts',
              attributes: {
                title: 'New Post 1',
                'is-public': true,
                intString: '123',
                nullString: 'null',
                boolString: 'true',
                dateString: now
              },
              relationships: {
                user: {
                  data: {
                    type: 'users',
                    id: 1
                  }
                },
                tags: {
                  data: [
                    {
                      type: 'tags',
                      id: 1
                    },
                    {
                      type: 'tags',
                      id: 2
                    },
                    {
                      type: 'tags',
                      id: 3
                    }
                  ]
                }
              }
            }
          }),
          headers: {
            'Content-Type': MIME_TYPE
          }
        },
        async req => {
          const params = await parseRequest(req);

          expect(params).to.deep.equal({
            data: {
              id: 1,
              type: 'posts',
              attributes: {
                title: 'New Post 1',
                isPublic: true,
                intString: '123',
                nullString: 'null',
                boolString: 'true',
                // Values arrive as sent: dates are parsed by parameter
                // validation, and only for date columns.
                dateString: now
              },
              relationships: {
                user: {
                  data: {
                    type: 'users',
                    id: 1
                  }
                },
                tags: {
                  data: [
                    {
                      type: 'tags',
                      id: 1
                    },
                    {
                      type: 'tags',
                      id: 2
                    },
                    {
                      type: 'tags',
                      id: 3
                    }
                  ]
                }
              }
            },
            include: ['user']
          });
        }
      );
    });

    it('rejects when a POST request body is invalid', () => {
      return test(
        '/posts',
        {
          method: 'POST',
          body: '{[{not json,,,,,}]}',
          headers: {
            'Content-Type': MIME_TYPE
          }
        },
        async req => {
          await expect(parseRequest(req)).rejects.toBeInstanceOf(
            MalformedRequestError
          );
        }
      );
    });

    it('rejects when a PATCH request body is invalid', () => {
      return test(
        '/posts',
        {
          method: 'PATCH',
          body: '{[{not json,,,,,}]}',
          headers: {
            'Content-Type': MIME_TYPE
          }
        },
        async req => {
          await expect(parseRequest(req)).rejects.toBeInstanceOf(
            MalformedRequestError
          );
        }
      );
    });
  });
});
