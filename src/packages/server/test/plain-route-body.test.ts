import { it, describe, beforeAll, afterAll, expect } from 'vitest';

import Server from '../index';
import { getTestApp } from '../../../../test/utils/get-test-app';

// The test-app's plain `POST` routes, which answer with the body they
// received: `/posts/echo` on a resource, `/webhooks` at the top level.

const JSONAPI = 'application/vnd.api+json';

let DOMAIN = '';

async function post(path: string, body: string, contentType: string) {
  const res = await fetch(`${DOMAIN}${path}`, {
    method: 'POST',
    headers: { Accept: JSONAPI, 'Content-Type': contentType },
    body
  });

  return {
    status: res.status,
    contentType: res.headers.get('content-type'),
    body: await res.json()
  };
}

describe('the body of a plain route', () => {
  let server;

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
  });

  afterAll(() => {
    server.instance.close();
  });

  it('is any JSON, as sent, with Content-Type: application/json', async () => {
    const sent = { event: 'push', repository: { full_name: 'a/b' } };
    const res = await post(
      '/webhooks',
      JSON.stringify(sent),
      'application/json; charset=utf-8'
    );

    expect(res.status).to.equal(200);
    // Plain JSON, not a JSON:API document.
    expect(res.contentType).to.equal('application/json');
    expect(res.body).to.deep.equal({ received: sent });
  });

  it('may be an array, or sent as JSON:API, on a resource', async () => {
    const asJSON = await post('/posts/echo', '[1, 2]', 'application/json');
    const asJSONAPI = await post(
      '/posts/echo',
      JSON.stringify({ data: { type: 'anything' } }),
      JSONAPI
    );

    expect(asJSON.body).to.deep.equal({ received: [1, 2] });
    expect(asJSONAPI.status).to.equal(200);
    expect(asJSONAPI.body).to.deep.equal({
      received: { data: { type: 'anything' } }
    });
  });

  it('may be empty', async () => {
    const res = await post('/webhooks', '', 'application/json');

    expect(res.status).to.equal(200);
    expect(res.body).to.deep.equal({ received: null });
  });

  it('is a 400 when it is not JSON', async () => {
    const res = await post('/webhooks', '{nope', 'application/json');

    expect(res.status).to.equal(400);
    expect(res.body.errors[0].detail).to.include('is valid JSON');
  });

  it('is a 415 in another format', async () => {
    const res = await post(
      '/webhooks',
      'a=1',
      'application/x-www-form-urlencoded'
    );

    expect(res.status).to.equal(415);
    expect(res.body.errors[0].detail).to.include(
      `'${JSONAPI}' or 'application/json'`
    );
  });

  it('leaves a resource route requiring a JSON:API document', async () => {
    const res = await post(
      '/posts',
      JSON.stringify({ data: { type: 'posts' } }),
      'application/json'
    );

    expect(res.status).to.equal(415);
  });
});
