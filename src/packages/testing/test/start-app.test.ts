import { it, describe, beforeAll, afterAll, expect } from 'vitest';

import { startApp } from '../index';
import type { StartedApp } from '../index';
import { copyTestApp } from '../../../../test/utils/copy-test-app';
import { readDocument } from '../../../../test/utils/expect-jsonapi-document';

// Boots a copy of the compiled test-app (the shared one is `getTestApp()`'s),
// as an app's own tests would boot it.

describe('startApp()', () => {
  let copy: ReturnType<typeof copyTestApp>;
  let started: StartedApp;

  beforeAll(async () => {
    copy = copyTestApp('start-app');
    started = await startApp(copy.path);
  });

  afterAll(async () => {
    if (started?.app.server.instance.listening) {
      await started.close();
    }

    copy?.remove();
  });

  it('listens on a free port and serves the app', async () => {
    expect(started.origin).to.match(/^http:\/\/localhost:\d+$/);
    expect(started.origin).to.not.equal('http://localhost:4000');

    const res = await fetch(`${started.origin}/tags?page[size]=1`, {
      headers: { Accept: 'application/vnd.api+json' }
    });

    expect(res.status).to.equal(200);
    expect((await readDocument(res)).data).to.be.an('array');
  });

  it('keeps a `NODE_ENV` that is already set', () => {
    expect(process.env.NODE_ENV).to.equal('test');
  });

  it('refuses to start the same app twice in a process', async () => {
    await expect(startApp(copy.path)).rejects.toThrow(
      'was already started in this process'
    );
  });

  it('stops the server and closes the database with `close()`', async () => {
    await started.close();

    expect(started.app.server.instance.listening).to.equal(false);
  });
});
