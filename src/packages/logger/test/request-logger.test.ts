import EventEmitter from 'events';

import { it, describe, beforeAll, expect } from 'vitest';

import { FORMATS } from '../constants';
import { createRequestLogger } from '../request-logger';
import sleep from '../../../utils/sleep';
import { getTestApp } from '../../../../test/utils/get-test-app';
import {
  createResponse,
  createRequestBuilder
} from '../../../../test/utils/mocks';

import Logger from '../index';

describe('module "logger/request-logger"', () => {
  describe('#createRequestLogger()', () => {
    FORMATS.forEach(format => {
      describe(`- format "${format}"`, () => {
        let subject;

        beforeAll(() => {
          const logger = new Logger({
            format,
            level: 'INFO',
            enabled: true,
            filter: {
              params: []
            }
          });

          subject = createRequestLogger(logger);
        });

        it('returns a request logger function', () => {
          expect(subject).to.be.a('function').with.lengthOf(3);
        });

        describe('- logger function', () => {
          let req;
          let res;

          beforeAll(async () => {
            const { router } = await getTestApp();
            const emitter = new EventEmitter();
            const createRequest = createRequestBuilder({
              path: '/',
              route: router.get('GET:/posts'),
              params: {}
            });

            req = createRequest();
            res = Object.assign(createResponse(), {
              on: (...args) => emitter.on(...args),
              once: (...args) => emitter.once(...args),
              emit: (...args) => emitter.emit(...args),
              removeListener: (...args) => emitter.removeListener(...args),
              removeAllListeners: (...args) =>
                emitter.removeAllListeners(...args)
            });
          });

          it('does not throw an error', async () => {
            expect(() => {
              subject(req, res, {
                startTime: Date.now()
              });
            }).to.not.throw(Error);

            await sleep(10);
            res.emit('finish');
            await sleep(10);
          });
        });
      });
    });

    describe('- logged JSON', () => {
      it('leaves the query string out and filters params', async () => {
        const { router } = await getTestApp();
        const emitter = new EventEmitter();
        const logger = new Logger({
          format: 'json',
          level: 'INFO',
          enabled: true,
          filter: { params: [] }
        });

        const req = createRequestBuilder({
          path: '/posts',
          route: router.get('GET:/posts'),
          params: { token: 'abc', page: { size: 1 } }
        })();

        Object.assign(req.url, {
          path: '/posts?token=abc&page[size]=1',
          search: '?token=abc&page[size]=1'
        });

        const res = Object.assign(createResponse(), {
          once: (...args) => emitter.once(...args)
        });

        const lines: string[] = [];
        const write = process.stdout.write;

        process.stdout.write = ((chunk: string) => {
          lines.push(chunk);
          return true;
        }) as typeof process.stdout.write;

        try {
          createRequestLogger(logger)(req, res, { startTime: Date.now() });
          emitter.emit('finish');
        } finally {
          process.stdout.write = write;
        }

        const { path, params } = JSON.parse(lines[0]);

        expect(path).to.equal('/posts');
        expect(params).to.deep.equal({
          token: '[FILTERED]',
          page: { size: 1 }
        });
      });
    });
  });
});
