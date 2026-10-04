import fetch from 'node-fetch';
import { it, beforeAll, afterAll, describe, expect } from 'vitest';

import Server from '../../server';
import validateRelationships from '../utils/validate-relationships';

import { getTestApp } from '../../../../test/utils/get-test-app';

const PORT = 4110;
const DOMAIN = `http://localhost:${PORT}`;
const MIME_TYPE = 'application/vnd.api+json';

// Every request here is rejected before anything is written — the suites that
// count seeded rows (query.test) depend on that.
async function request(method: string, path: string, body?: unknown) {
  const res = await fetch(`${DOMAIN}${path}`, {
    method,
    headers: { 'Content-Type': MIME_TYPE },
    body: body === undefined ? undefined : JSON.stringify(body)
  });

  const { errors } = await res.json();

  return { status: res.status, error: errors[0] };
}

describe('module "controller"', () => {
  describe('error responses', () => {
    let app;
    let server;

    beforeAll(async () => {
      app = await getTestApp();

      const { logger, router } = app;

      server = new Server({ logger, router, cors: { enabled: false } });
      server.listen(PORT);
    });

    afterAll(() => {
      server.instance.close();
    });

    it('responds 403 to a client-generated id on create', async () => {
      const { status, error } = await request('POST', '/tags', {
        data: { id: '9999', type: 'tags', attributes: { name: 'x' } }
      });

      expect(status).to.equal(403);
      expect(error.status).to.equal('403');
      expect(error.source).to.deep.equal({ pointer: '/data/id' });
    });

    it('responds 400 to a relationship the model does not have', async () => {
      const { status, error } = await request('PATCH', '/posts/1', {
        data: {
          id: '1',
          type: 'posts',
          relationships: { nope: { data: null } }
        }
      });

      expect(status).to.equal(400);
      expect(error.source).to.deep.equal({
        pointer: '/data/relationships/nope'
      });
    });

    it('responds 400 to an attribute the model does not have', async () => {
      for (const method of ['POST', 'PATCH']) {
        const { status, error } = await request(
          method,
          method === 'POST' ? '/tags' : '/tags/1',
          {
            data: {
              ...(method === 'PATCH' && { id: '1' }),
              type: 'tags',
              attributes: { name: 'x', nope: true }
            }
          }
        );

        expect(status, method).to.equal(400);
        expect(error.source, method).to.deep.equal({
          pointer: '/data/attributes/nope'
        });
      }
    });

    it('reports every problem with a request at once', async () => {
      const res = await fetch(`${DOMAIN}/posts/1`, {
        method: 'PATCH',
        headers: { 'Content-Type': MIME_TYPE },
        body: JSON.stringify({
          data: {
            id: '1',
            type: 'posts',
            relationships: { tags: { data: [] }, nope: { data: null } }
          }
        })
      });
      const { errors } = await res.json();

      // A 403 and a 400: the response takes the more general 400.
      expect(res.status).to.equal(400);
      expect(
        errors.map(({ status, source }) => [status, source.pointer])
      ).to.have.deep.members([
        ['403', '/data/relationships/tags'],
        ['400', '/data/relationships/nope']
      ]);
    });

    it('responds 404 to a related resource that does not exist', async () => {
      const { status, error } = await request('POST', '/posts', {
        data: {
          type: 'posts',
          attributes: { title: 't', body: 'b' },
          relationships: { user: { data: { type: 'users', id: '99999' } } }
        }
      });

      expect(status).to.equal(404);
      expect(error.source).to.deep.equal({
        pointer: '/data/relationships/user/data'
      });
    });

    it('responds 404 to a missing related resource on update', async () => {
      const { status } = await request('PATCH', '/posts/1', {
        data: {
          id: '1',
          type: 'posts',
          relationships: { image: { data: { type: 'images', id: '99999' } } }
        }
      });

      expect(status).to.equal(404);
    });

    it('responds 422 with a pointer when a model validation fails', async () => {
      const { status, error } = await request('POST', '/users', {
        data: {
          type: 'users',
          attributes: { name: 'n', email: 'validation@test.dev', password: 'x' }
        }
      });

      expect(status).to.equal(422);
      expect(error.source).to.deep.equal({
        pointer: '/data/attributes/password'
      });
    });

    it('responds 409 to a unique constraint violation', async () => {
      const { email } = await app.models.get('user').select('email').first();
      const { status } = await request('POST', '/users', {
        data: {
          type: 'users',
          attributes: { name: 'n', email, password: 'long-enough' }
        }
      });

      expect(status).to.equal(409);
    });

    it('points query parameter errors at the parameter', async () => {
      const res = await fetch(`${DOMAIN}/posts?page%5Bsize%5D=abc`);
      const { errors } = await res.json();

      expect(res.status).to.equal(400);
      expect(errors[0].source).to.deep.equal({ parameter: 'page[size]' });
    });

    it('responds 400 to a page size or number out of range', async () => {
      const cases: Array<[string, string]> = [
        ['page%5Bsize%5D=0', 'page[size]'],
        ['page%5Bsize%5D=101', 'page[size]'],
        ['page%5Bnumber%5D=0', 'page[number]']
      ];

      for (const [query, parameter] of cases) {
        const res = await fetch(`${DOMAIN}/posts?${query}`);
        const { errors } = await res.json();

        expect(res.status, query).to.equal(400);
        expect(errors[0].source, query).to.deep.equal({ parameter });
      }
    });

    it('accepts a page size up to `maxPerPage`', async () => {
      const res = await fetch(`${DOMAIN}/posts?page%5Bsize%5D=100`);

      expect(res.status).to.equal(200);
    });
  });

  describe('#validateRelationships()', () => {
    it('points at the index of a missing to-many member', async () => {
      const { models } = await getTestApp();
      const Post = models.get('post');

      const err = await validateRelationships(Post, {
        tags: {
          data: [
            { type: 'tags', id: '1' },
            { type: 'tags', id: '99999' }
          ]
        }
      }).catch(e => e);

      expect(err).to.have.property('statusCode', 404);
      expect(err.source).to.deep.equal({
        pointer: '/data/relationships/tags/data/1'
      });
    });

    it('resolves when every related resource exists', async () => {
      const { models } = await getTestApp();
      const Post = models.get('post');

      await validateRelationships(Post, {
        user: { data: { type: 'users', id: 1 } },
        image: { data: null },
        tags: { data: [] }
      });
    });
  });
});
