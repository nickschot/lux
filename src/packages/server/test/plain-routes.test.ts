import { it, describe, beforeAll, afterAll, expect } from 'vitest';

import Server from '../index';
import { getTestApp } from '../../../../test/utils/get-test-app';

// The test-app's plain routes on `posts` (neither `member` nor
// `collection`): `featured` returns a query of its own, `topRated` builds on
// the built-in `index`.

const JSONAPI = 'application/vnd.api+json';

let DOMAIN = '';

async function get(path: string) {
  const res = await fetch(`${DOMAIN}${path}`, { headers: { Accept: JSONAPI } });

  return { status: res.status, body: await res.json() };
}

describe('plain routes of a resource', () => {
  let server;
  let publicIds: Array<string>;

  beforeAll(async () => {
    const app = await getTestApp();

    server = new Server({
      logger: app.logger,
      router: app.router,
      cors: { enabled: false }
    });

    server.listen(0);
    await new Promise(resolve => server.instance.once('listening', resolve));
    DOMAIN = `http://localhost:${server.instance.address().port}`;

    publicIds = (
      await app.models.get('post').where({ isPublic: true }).select('id')
    ).map(post => String(post.getPrimaryKey()));
  });

  afterAll(() => {
    server.instance.close();
  });

  it('serializes the models a plain route returns', async () => {
    const { status, body } = await get('/posts/featured');

    expect(status).to.equal(200);
    expect(body.data).to.have.length(2);
    body.data.forEach(resource => {
      expect(resource.type).to.equal('posts');
      expect(publicIds).to.include(resource.id);
      expect(resource.attributes).to.have.all.keys(
        'body',
        'title',
        'created-at',
        'updated-at'
      );
    });
    expect(body.links.self).to.equal(`${DOMAIN}/posts/featured`);
  });

  it('lets a plain route build on a built-in action', async () => {
    const { status, body } = await get('/posts/top-rated');

    expect(status).to.equal(200);
    expect(body.data.length).to.be.within(1, 25);
    body.data.forEach(resource => {
      expect(resource.type).to.equal('posts');
      expect(publicIds).to.include(resource.id);
      expect(resource.attributes).to.have.property('title');
    });
  });

  it("still takes no query parameters but the controller's `query`", async () => {
    const { status, body } = await get('/posts/featured?sort=title');

    expect(status).to.equal(400);
    expect(body.errors[0].source).to.deep.equal({ parameter: 'sort' });
  });
});
