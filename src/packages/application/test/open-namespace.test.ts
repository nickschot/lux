import { createRequire } from 'node:module';
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from 'fs';
import { join as joinPath } from 'path';

import { it, describe, beforeAll, afterAll, expect } from 'vitest';

import type Application from '../index';
import type { ModelClass } from '../../database';
import { readDocument } from '../../../../test/utils/expect-jsonapi-document';

// A namespace without visibility rules, over HTTP and through the whole boot.
// The test-app declares rules at its root, so every namespace in it has some:
// this boots a second copy of it whose root `ApplicationController` declares
// none. `admin` (`static visibility = {}`) and `members` (which extends the
// original root class) keep theirs.

const nodeRequire = createRequire(__filename);
const TEST_APP = joinPath(
  __dirname,
  '..',
  '..',
  '..',
  '..',
  'test',
  'test-app'
);
const JSONAPI = 'application/vnd.api+json';

type TestAppModule = {
  config: Record<string, unknown>;
  database: Record<string, unknown>;
  Application: new (opts: Record<string, unknown>) => Promise<Application>;
};

// The test-app's bundle with its root ApplicationController swapped for one
// extending `Controller` without rules, as an app of its own: the app is
// loaded from `dist/bundle` under its path, its database driver from
// `node_modules` and its SQLite file from `db`, which link to the test-app's.
//
// The original bundle is copied, not required from the test-app: booting
// defines properties on the model classes, so the shared app (`getTestApp()`)
// and this one each need their own. The copy lives in the test-app's
// (ignored) `dist/`, so it resolves its dependencies as the original does.
function writeOpenApp(): string {
  const path = mkdtempSync(joinPath(TEST_APP, 'dist', 'open-namespace-'));

  mkdirSync(joinPath(path, 'dist'));
  ['db', 'node_modules'].forEach(dir =>
    symlinkSync(joinPath(TEST_APP, dir), joinPath(path, dir))
  );
  copyFileSync(
    joinPath(TEST_APP, 'dist', 'bundle.js'),
    joinPath(path, 'dist', 'original.js')
  );
  writeFileSync(
    joinPath(path, 'dist', 'bundle.js'),
    `
const bundle = require('./original');
const Controller = Object.getPrototypeOf(bundle.ApplicationController);

class ApplicationController extends Controller {}

// The root's custom action, which the routes name.
ApplicationController.prototype.webhooks =
  bundle.ApplicationController.prototype.webhooks;

module.exports = { ...bundle, ApplicationController };
`
  );

  return path;
}

describe('a namespace without visibility rules, over HTTP', () => {
  let path: string;
  let app: Application;
  let domain: string;
  let postId: string;

  // The status, after checking the body against the JSON:API schema.
  const statusOf = async (url: string) => {
    const res = await fetch(domain + url, { headers: { Accept: JSONAPI } });

    await readDocument(res);

    return res.status;
  };

  beforeAll(async () => {
    path = writeOpenApp();

    const {
      config,
      database,
      Application: TestApp
    } = nodeRequire(joinPath(path, 'dist', 'bundle')) as TestAppModule;

    app = await new TestApp({ ...config, database, path, port: 0 });

    if (!app.server.instance.listening) {
      await new Promise(resolve =>
        app.server.instance.once('listening', resolve)
      );
    }

    const { port } = app.server.instance.address() as { port: number };
    const Post = app.models.get('post') as ModelClass;
    const post = await Post.where({ isPublic: true }).first();

    if (!post) {
      throw new Error('The seed has no public post to request.');
    }

    domain = `http://localhost:${port}`;
    postId = String(post.getPrimaryKey());
  });

  afterAll(async () => {
    await app?.close();

    if (path) {
      rmSync(path, { recursive: true, force: true });
    }
  });

  it('gives the root namespace no rules, and admin its own', () => {
    expect(app.controllers.get('posts')?.hasVisibilityRules).to.equal(false);
    expect(app.controllers.get('admin/posts')?.hasVisibilityRules).to.equal(
      true
    );
  });

  it('includes 1 level deep', async () => {
    expect(await statusOf(`/posts/${postId}?include=comments`)).to.equal(200);
    expect(await statusOf(`/posts/${postId}?include=comments.post`)).to.equal(
      400
    );
  });

  it('serves no relationship or related endpoints', async () => {
    expect(await statusOf(`/posts/${postId}/comments`)).to.equal(404);
    expect(await statusOf(`/posts/${postId}/relationships/comments`)).to.equal(
      404
    );
  });

  it('keeps the full defaults in a namespace with rules', async () => {
    expect(
      await statusOf(`/admin/posts/${postId}?include=comments.post`)
    ).to.equal(200);
    expect(await statusOf(`/admin/posts/${postId}/comments`)).to.equal(200);
    expect(
      await statusOf(`/admin/posts/${postId}/relationships/comments`)
    ).to.equal(200);
  });
});
