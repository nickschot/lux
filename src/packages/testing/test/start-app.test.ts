import { it, describe, beforeAll, afterAll, expect } from 'vitest';

import { startApp } from '../index';
import type { StartedApp } from '../index';
import { copyTestApp } from '../../../../test/utils/copy-test-app';
import { readDocument } from '../../../../test/utils/expect-jsonapi-document';

// Boots copies of the compiled test-app (the shared one is `getTestApp()`'s),
// as an app's own tests would boot it.

describe('startApp()', () => {
  // The runner's own `NODE_ENV`, put back after each test changes it.
  const runnerEnv = process.env.NODE_ENV;

  afterAll(() => {
    process.env.NODE_ENV = runnerEnv;
  });

  describe('an app that boots', () => {
    let copy: ReturnType<typeof copyTestApp>;
    let started: StartedApp;

    beforeAll(async () => {
      copy = copyTestApp('start-app');

      // Unset, so that `startApp()` sets it, and `close()` unsets it again.
      delete process.env.NODE_ENV;
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

    it('boots in `test` when `NODE_ENV` is unset, and keeps it while running', () => {
      expect(process.env.NODE_ENV).to.equal('test');
    });

    it('refuses to start the same app twice in a process', async () => {
      await expect(startApp(copy.path)).rejects.toThrow(
        'was already started in this process'
      );
    });

    it('stops the server and restores `NODE_ENV` with `close()`', async () => {
      await started.close();

      expect(started.app.server.instance.listening).to.equal(false);
      expect(process.env).to.not.have.property('NODE_ENV');
    });
  });

  describe('an app that fails to boot', () => {
    let copy: ReturnType<typeof copyTestApp>;

    beforeAll(() => {
      copy = copyTestApp('start-app-failing');
      process.env.NODE_ENV = 'test';
    });

    afterAll(() => {
      copy?.remove();
    });

    // `nope` has no entry in the test-app's config/database.js.
    it('reports why, and restores `NODE_ENV`', async () => {
      await expect(startApp(copy.path, { env: 'nope' })).rejects.toThrow(
        'Database config not found for environment nope.'
      );

      expect(process.env.NODE_ENV).to.equal('test');
    });

    it('reports the failure on a retry too, not "already started"', async () => {
      const retry = startApp(copy.path, { env: 'nope' });

      await expect(retry).rejects.toThrow(
        'An earlier attempt in this process failed first, with: Database ' +
          'config not found for environment nope.'
      );
      await expect(retry).rejects.not.toThrow('already started');
    });
  });
});
