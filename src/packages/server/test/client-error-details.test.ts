import { it, describe, beforeAll, afterAll, expect } from 'vitest';

import Server from '../index';
import setEnv from '../../../../test/utils/set-env';
import { getTestApp } from '../../../../test/utils/get-test-app';

// The framework's own client errors over HTTP, answered in production: their
// `detail` is kept, and names members as documents do (`created-at`).

const JSONAPI = 'application/vnd.api+json';

let DOMAIN = '';

async function errorFor(path: string) {
  const res = await fetch(`${DOMAIN}${path}`, { headers: { Accept: JSONAPI } });
  const { errors } = await res.json();

  return { status: res.status, error: errors[0] };
}

describe('client error details', () => {
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

    setEnv('production');
  });

  afterAll(() => {
    setEnv('test');
    server.instance.close();
  });

  it('lists the allowed sort values as documents name them', async () => {
    const { status, error } = await errorFor('/posts?sort=-is-public');

    expect(status).to.equal(400);
    expect(error.source).to.deep.equal({ parameter: 'sort' });
    expect(error.detail).to.equal(
      "Expected value for parameter 'sort' to be one of [body, title, " +
        'created-at, updated-at, -body, -title, -created-at, -updated-at] ' +
        'but got -is-public.'
    );
  });

  it('names a fieldset and its fields as documents do', async () => {
    const { error } = await errorFor('/posts?fields[posts]=is-public');

    expect(error.source).to.deep.equal({ parameter: 'fields[posts]' });
    expect(error.detail).to.match(
      /^Expected value for parameter 'fields\[posts\]' to be one of \[body, title, created-at, updated-at, .*\] but got is-public\.$/
    );
  });

  it('names an unknown filter as the client wrote it', async () => {
    const { error } = await errorFor('/posts?filter[is-hidden]=true');

    expect(error.detail).to.equal(
      "'filter[is-hidden]' is not a valid parameter for this resource."
    );
  });

  it('keeps the detail of a record that does not exist', async () => {
    const { status, error } = await errorFor('/posts/999999');

    expect(status).to.equal(404);
    expect(error.detail).to.equal('Could not find Post with id 999999.');
  });
});
