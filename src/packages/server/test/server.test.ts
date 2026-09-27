import fetch from 'node-fetch';
import { it, beforeAll, afterAll, describe, expect } from 'vitest';

import Server from '../index';

import { getTestApp } from '../../../../test/utils/get-test-app';

const PORT = 4100;
const DOMAIN = `http://localhost:${PORT}`;

describe('module "server"', () => {
  describe('class Server', () => {
    let subject;

    beforeAll(async () => {
      const { logger, router } = await getTestApp();

      subject = new Server({
        logger,
        router,
        cors: {
          enabled: false
        }
      });

      subject.listen(PORT);
    });

    afterAll(() => {
      subject.instance.close();
    });

    describe('#listen()', () => {
      it('enables incoming connections to reach the application', () => {
        return fetch(`${DOMAIN}/health`).then(({ status }) => {
          expect(status).to.equal(204);
        });
      });
    });

    describe('content negotiation', () => {
      const JSONAPI = 'application/vnd.api+json';

      it('responds 406 when every JSON:API Accept entry has params', async () => {
        const res = await fetch(`${DOMAIN}/health`, {
          headers: { Accept: `${JSONAPI}; charset=utf-8` }
        });

        expect(res.status).to.equal(406);
        expect(res.headers.get('content-type')).to.equal(JSONAPI);

        const { errors } = await res.json();

        expect(errors[0].status).to.equal('406');
      });

      it('accepts when one JSON:API Accept entry has no params', async () => {
        const { status } = await fetch(`${DOMAIN}/health`, {
          headers: { Accept: `${JSONAPI};charset=utf-8, ${JSONAPI}` }
        });

        expect(status).to.equal(204);
      });

      it('responds 415 for a Content-Type with media type params', async () => {
        const { status } = await fetch(`${DOMAIN}/tags`, {
          method: 'POST',
          headers: { 'Content-Type': `${JSONAPI}; foo=bar` },
          body: '{}'
        });

        expect(status).to.equal(415);
      });

      it('responds 415 for a Content-Type other than JSON:API', async () => {
        const { status } = await fetch(`${DOMAIN}/tags`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{}'
        });

        expect(status).to.equal(415);
      });

      it('passes a plain JSON:API Content-Type through to the route', async () => {
        // `{}` fails parameter validation *after* negotiation, so nothing is
        // written — a 400 here proves the Content-Type was accepted.
        const { status } = await fetch(`${DOMAIN}/tags`, {
          method: 'POST',
          headers: { 'Content-Type': JSONAPI },
          body: '{}'
        });

        expect(status).to.equal(400);
      });
    });
  });
});
