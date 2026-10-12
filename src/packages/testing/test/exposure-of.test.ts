import { it, describe, beforeAll, expect } from 'vitest';

import { exposureOf } from '../index';
import type Application from '../../application';
import type { NamespaceExposure } from '../index';
import { getTestApp } from '../../../../test/utils/get-test-app';

// The test-app hides private posts everywhere but `admin` (`{}`); `members`
// also hides the comments on them, shows posts' comments and reactions as
// links only, and requires `fromDate` to list tags.

describe('exposureOf()', () => {
  let app: Application;
  let members: NamespaceExposure;

  beforeAll(async () => {
    app = await getTestApp();
    members = exposureOf(app, 'members');
  });

  it('names the namespace and its visibility settings', () => {
    expect(members.namespace).to.equal('/members');
    expect(members.visibilityRules).to.equal(true);
    expect(members.strictVisibility).to.equal(false);
  });

  it('lists its routes, with their actions, without HEAD and OPTIONS', () => {
    expect(members.routes).to.include.members([
      'GET /members/posts → index',
      'GET /members/posts/:id → show',
      'POST /members/posts → create',
      'PATCH /members/posts/:id → update',
      'DELETE /members/posts/:id → destroy',
      'GET /members/posts/:id/relationships/user → showRelationship',
      'GET /members/posts/:id/user → showRelated'
    ]);
    expect(
      members.routes.some(route => /^(HEAD|OPTIONS) /.test(route))
    ).to.equal(false);
    expect(
      members.routes.every(route => route.includes(' /members/'))
    ).to.equal(true);
  });

  it('lists what each controller lets a client ask for', () => {
    const posts = app.controllers.get('members/posts');

    expect(members.controllers.posts.sort).to.deep.equal(
      [...(posts?.sort ?? [])].sort()
    );
    expect(members.controllers.posts.filter).to.deep.equal(
      [...(posts?.filter ?? [])].sort()
    );
    expect(members.controllers.posts.include).to.include.members([
      'comments',
      'comments.user',
      'comments.reactions.user'
    ]);
    expect(members.controllers.tags.query).to.deep.equal(['fromDate']);
  });

  it('lists `params` for controllers with write routes only', () => {
    expect(members.controllers.posts.params).to.be.an('array').that.is.not
      .empty;
    // Tags are read-only in `members`.
    expect(members.controllers.tags).to.not.have.property('params');
  });

  it('lists every type it can reach, with its rule and serializer', () => {
    const { types } = members;

    expect(types.posts).to.deep.include({
      rule: 'narrows',
      linksOnly: ['comments', 'reactions']
    });
    expect(types.posts.attributes).to.include.members(['title', 'body']);
    expect(types.posts.relationships).to.include.members(['user', 'comments']);
    expect(types.comments.rule).to.equal('narrows');
    expect(types.tags.rule).to.equal('none');
    // Images have no route in `members`, but posts link to them.
    expect(members.controllers).to.not.have.property('images');
    expect(types).to.have.property('images');
  });

  it('reports each namespace by its own rules', () => {
    const root = exposureOf(app, '');
    const admin = exposureOf(app, 'admin');

    expect(root.namespace).to.equal('/');
    // The root ApplicationController's own route.
    expect(root.routes).to.include('POST /webhooks → webhooks');
    expect(root.types.posts.rule).to.equal('narrows');
    expect(root.types.comments.rule).to.equal('none');
    expect(admin.visibilityRules).to.equal(true);
    expect(admin.types.posts.rule).to.equal('none');
  });

  it('reports every namespace, by path, without a namespace', () => {
    const all = exposureOf(app);

    expect(Object.keys(all)).to.deep.equal(['/', '/admin', '/members']);
    expect(all['/members']).to.deep.equal(members);
  });

  it('sorts every list and key, so it compares and snapshots stably', () => {
    const isSorted = (list: Array<string>) =>
      list.every((item, i) => i === 0 || list[i - 1] <= item);

    expect(isSorted(members.routes)).to.equal(true);
    expect(isSorted(Object.keys(members.controllers))).to.equal(true);
    expect(isSorted(Object.keys(members.types))).to.equal(true);
    Object.values(members.types).forEach(type => {
      expect(isSorted(type.attributes)).to.equal(true);
      expect(isSorted(type.relationships)).to.equal(true);
    });
    expect(JSON.stringify(exposureOf(app))).to.equal(
      JSON.stringify(exposureOf(app))
    );
  });

  it('refuses a namespace that serves no routes', () => {
    expect(() => exposureOf(app, 'nope')).to.throw(
      "exposureOf: namespace '/nope' serves no routes."
    );
  });
});
