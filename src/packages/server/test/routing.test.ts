import { it, describe, beforeAll, afterAll, expect } from 'vitest';

import Server from '../index';
import { getTestApp } from '../../../../test/utils/get-test-app';

// Routing over HTTP through the test-app's real routes: ids that are not
// integers, methods a path does not support, HEAD and OPTIONS, and the links
// of a created resource. Writes only touch rows created (and removed) here.

const JSONAPI = 'application/vnd.api+json';

let DOMAIN = '';

function request(method: string, path: string, body?: unknown) {
  return fetch(`${DOMAIN}${path}`, {
    method,
    headers: { Accept: JSONAPI, 'Content-Type': JSONAPI },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
}

describe('routing over HTTP', () => {
  let server;
  let models;

  beforeAll(async () => {
    const app = await getTestApp();

    ({ models } = app);

    server = new Server({
      logger: app.logger,
      router: app.router,
      cors: { enabled: false }
    });

    server.listen(0);
    await new Promise(resolve => server.instance.once('listening', resolve));
    DOMAIN = `http://localhost:${server.instance.address().port}`;

    await models
      .get('language')
      .table()
      .insert([
        { id: 'pt-BR', name: 'Portuguese (Brazil)' },
        { id: 'routing-delete-me', name: 'Doomed' }
      ]);
  });

  afterAll(async () => {
    server.instance.close();

    await models
      .get('language')
      .table()
      .whereIn('id', ['pt-BR', 'routing-delete-me'])
      .del();
  });

  describe('a resource with a string primary key', () => {
    it('shows a resource by its string id', async () => {
      const res = await request('GET', '/languages/pt-BR');
      const { data } = await res.json();

      expect(res.status).to.equal(200);
      expect(data).to.deep.include({
        id: 'pt-BR',
        type: 'languages',
        attributes: { name: 'Portuguese (Brazil)' }
      });
    });

    it('updates a resource by its string id', async () => {
      const res = await request('PATCH', '/languages/pt-BR', {
        data: {
          id: 'pt-BR',
          type: 'languages',
          attributes: { name: 'Português (Brasil)' }
        }
      });
      const { data } = await res.json();

      expect(res.status).to.equal(200);
      expect(data.attributes).to.deep.equal({ name: 'Português (Brasil)' });
    });

    it('destroys a resource by its string id', async () => {
      const res = await request('DELETE', '/languages/routing-delete-me');

      expect(res.status).to.equal(204);
      expect(
        await models.get('language').first().where({ id: 'routing-delete-me' })
      ).to.not.be.ok;
    });

    it('responds 404 to an id that does not exist', async () => {
      const res = await request('GET', '/languages/xx-XX');

      expect(res.status).to.equal(404);
    });
  });

  describe('a resource with an integer primary key', () => {
    it('responds 404 to an id that is not an integer', async () => {
      const res = await request('GET', '/posts/abc');

      expect(res.status).to.equal(404);
    });
  });

  describe('methods', () => {
    it('responds 405 with `Allow` to a method the path does not support', async () => {
      const res = await request('PUT', '/posts/1');
      const { errors } = await res.json();

      expect(res.status).to.equal(405);
      expect(errors[0].status).to.equal('405');
      expect(res.headers.get('allow')).to.equal(
        'GET, HEAD, PATCH, DELETE, OPTIONS'
      );
    });

    it('responds 405 to GET on a path only defined for POST', async () => {
      const res = await request('GET', '/users/login');

      expect(res.status).to.equal(405);
      expect(res.headers.get('allow')).to.equal('POST, OPTIONS');
    });

    it('still responds 404 to a path no route has', async () => {
      const res = await request('GET', '/nope');

      expect(res.status).to.equal(404);
      expect(res.headers.get('allow')).to.equal(null);
    });

    it('answers HEAD like GET, without a body', async () => {
      const [head, get] = await Promise.all([
        request('HEAD', '/posts?page[size]=1'),
        request('GET', '/posts?page[size]=1')
      ]);

      expect(head.status).to.equal(200);
      expect(head.status).to.equal(get.status);
      expect(head.headers.get('content-type')).to.equal(
        get.headers.get('content-type')
      );
      expect(await head.text()).to.equal('');
    });

    it('answers HEAD for a missing resource with 404', async () => {
      const res = await request('HEAD', '/languages/xx-XX');

      expect(res.status).to.equal(404);
    });

    it('lists the allowed methods in response to OPTIONS', async () => {
      const res = await request('OPTIONS', '/posts');

      expect(res.status).to.equal(204);
      expect(res.headers.get('allow')).to.equal('GET, HEAD, POST, OPTIONS');
    });
  });

  describe('a collection', () => {
    const ids = ['meta-a', 'meta-b'];

    beforeAll(async () => {
      await models
        .get('language')
        .table()
        .insert(ids.map(id => ({ id, name: `Meta ${id}` })));
    });

    afterAll(async () => {
      await models.get('language').table().whereIn('id', ids).del();
    });

    it('carries the total across every page in `meta`', async () => {
      const total = await models.get('language').count();
      const res = await request('GET', '/languages?page[size]=1');
      const { data, meta } = await res.json();

      expect(total).to.be.above(1);
      expect(data).to.have.lengthOf(1);
      expect(meta).to.deep.equal({ total });
    });

    it('counts only the resources that match the filter', async () => {
      const res = await request(
        'GET',
        '/languages?filter[name]=Meta meta-a,Meta meta-b&page[size]=1'
      );
      const { data, meta } = await res.json();

      expect(data).to.have.lengthOf(1);
      expect(meta).to.deep.equal({ total: 2 });
    });

    it('carries no `meta` for a single resource', async () => {
      const res = await request('GET', '/languages/meta-a');

      expect(res.status).to.equal(200);
      expect(await res.json()).not.to.have.property('meta');
    });
  });

  describe('a created resource', () => {
    it('links to itself where `Location` points', async () => {
      const res = await request('POST', '/tags', {
        data: { type: 'tags', attributes: { name: 'routing-created' } }
      });
      const { data, links } = await res.json();

      await models.get('tag').table().where('id', data.id).del();

      expect(res.status).to.equal(201);
      expect(res.headers.get('location')).to.equal(`${DOMAIN}/tags/${data.id}`);
      expect(links.self).to.equal(res.headers.get('location'));
    });
  });
});
