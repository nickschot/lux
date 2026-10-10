import { it, describe, beforeAll, afterAll, expect } from 'vitest';

import { startApp } from '../../testing';
import type Application from '../index';
import type { ModelClass } from '../../database';
import { readDocument } from '../../../../test/utils/expect-jsonapi-document';
import { copyTestApp } from '../../../../test/utils/copy-test-app';

// A namespace without visibility rules, over HTTP and through the whole boot.
// The test-app declares rules at its root, so every namespace in it has some:
// this boots a copy of it whose root `ApplicationController` declares none.
// `admin` (`static visibility = {}`) and `members` (which extends the
// original root class) keep theirs.

const JSONAPI = 'application/vnd.api+json';

// The root ApplicationController swapped for one extending `Controller`
// without rules.
const OPEN_ROOT = `
const bundle = require('./original');
const Controller = Object.getPrototypeOf(bundle.ApplicationController);

class ApplicationController extends Controller {}

// The root's custom action, which the routes name.
ApplicationController.prototype.webhooks =
  bundle.ApplicationController.prototype.webhooks;

module.exports = { ...bundle, ApplicationController };
`;

describe('a namespace without visibility rules, over HTTP', () => {
  let app: Application;
  let close: () => Promise<void>;
  let remove: () => void;
  let domain: string;
  let postId: string;

  // The status, after checking the body against the JSON:API schema.
  const statusOf = async (url: string) => {
    const res = await fetch(domain + url, { headers: { Accept: JSONAPI } });

    await readDocument(res);

    return res.status;
  };

  beforeAll(async () => {
    const copy = copyTestApp('open-namespace', OPEN_ROOT);

    remove = copy.remove;
    ({ app, origin: domain, close } = await startApp(copy.path));

    const Post = app.models.get('post') as ModelClass;
    const post = await Post.where({ isPublic: true }).first();

    if (!post) {
      throw new Error('The seed has no public post to request.');
    }

    postId = String(post.getPrimaryKey());
  });

  afterAll(async () => {
    await close?.();
    remove?.();
  });

  it('gives the root namespace no rules, and admin its own', () => {
    expect(app.controllers.get('posts')?.hasVisibilityRules).to.equal(false);
    expect(app.controllers.get('admin/posts')?.hasVisibilityRules).to.equal(
      true
    );
  });

  it('serves no includes', async () => {
    expect(await statusOf(`/posts/${postId}`)).to.equal(200);
    expect(await statusOf(`/posts/${postId}?include=comments`)).to.equal(400);
    expect(await statusOf(`/posts?include=user`)).to.equal(400);
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
