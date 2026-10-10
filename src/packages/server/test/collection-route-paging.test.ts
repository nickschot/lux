import { it, describe, beforeAll, afterAll, expect } from 'vitest';

import Server from '../index';
import { getTestApp } from '../../../../test/utils/get-test-app';
import { readDocument } from '../../../../test/utils/expect-jsonapi-document';

// The test-app's `GET /posts/recent`, a collection route whose action builds
// on `index`: it is paged like `index`, page links and total included.

const JSONAPI = 'application/vnd.api+json';

// Page links percent-encode the brackets, as `index`'s do.
const SIZE = 'page%5Bsize%5D=5';
const NUMBER = 'page%5Bnumber%5D';

let DOMAIN = '';

async function get(path: string) {
  const res = await fetch(`${DOMAIN}${path}`, { headers: { Accept: JSONAPI } });

  return { status: res.status, body: await readDocument(res) };
}

describe('a custom collection action built on index', () => {
  let server;
  let visible: number;

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

    // Every post the public namespace may see (its visibility rule).
    visible = await app.models.get('post').where({ isPublic: true }).count();
  });

  afterAll(() => {
    server.instance.close();
  });

  it('has page links and the total, like index', async () => {
    const { status, body } = await get('/posts/recent?page[size]=5');
    const last = Math.ceil(visible / 5);

    expect(visible).to.be.above(5);
    expect(status).to.equal(200);
    expect(body.data).to.have.length(5);
    expect(body.meta).to.deep.equal({ total: visible });
    expect(body.links).to.deep.equal({
      self: `${DOMAIN}/posts/recent?${SIZE}`,
      first: `${DOMAIN}/posts/recent?${SIZE}`,
      last: `${DOMAIN}/posts/recent?${SIZE}&${NUMBER}=${last}`,
      prev: null,
      next: `${DOMAIN}/posts/recent?${SIZE}&${NUMBER}=2`
    });
  });

  it('pages through the same records', async () => {
    const { body } = await get('/posts/recent?page[size]=5&page[number]=2');

    expect(body.links.prev).to.equal(`${DOMAIN}/posts/recent?${SIZE}`);
    expect(body.meta.total).to.equal(visible);
  });
});
