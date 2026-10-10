import { it, describe, beforeAll, afterAll, expect } from 'vitest';

import { auditVisibility } from '../index';
import type Application from '../../application';
import type { Model, ModelClass } from '../../database';
import { getTestApp } from '../../../../test/utils/get-test-app';

// The test-app hides private posts everywhere but `admin`, and `members` also
// hides the comments on them. The seed is random and shared with other
// suites, so the audits request the fixture graph created here by id; the
// lists (`index`) cover the seed too, so what members may see of it is read
// from the database.

describe('auditVisibility()', () => {
  let app: Application;
  let models: Map<string, ModelClass>;
  const created: Array<Model> = [];
  const fixtures: Record<string, Model> = {};

  // Every type the test-app's serializers can reach, visible in full: the
  // audits below narrow posts and comments.
  const everything = {
    actions: true,
    categorizations: true,
    comments: true,
    friendships: true,
    images: true,
    notifications: true,
    posts: true,
    reactions: true,
    tags: true,
    users: true
  } as const;

  const idOf = (record: Model) => String(record.getPrimaryKey());

  // The fixture records to request each type's member routes with.
  const fixtureIds = () => ({
    posts: [idOf(fixtures.publicPost), idOf(fixtures.privatePost)],
    comments: [idOf(fixtures.publicComment), idOf(fixtures.privateComment)],
    users: [idOf(fixtures.author)],
    actions: [],
    friendships: [],
    images: [],
    notifications: [],
    reactions: [],
    tags: []
  });

  // `/members/tags` is a 400 without it.
  const MEMBER_QUERY = { tags: { fromDate: '2026-01-01' } };

  // What a member may see, from the database rather than the app's rules.
  let memberVisible: Record<string, true | ((id: string) => boolean)>;

  beforeAll(async () => {
    app = await getTestApp();
    models = app.models as unknown as Map<string, ModelClass>;

    const User = models.get('user') as ModelClass;
    const Post = models.get('post') as ModelClass;
    const Comment = models.get('comment') as ModelClass;

    await Post.transaction(async trx => {
      const create = async (model: ModelClass, attrs: object) => {
        const record = await model.transacting(trx).create(attrs);
        created.push(record);
        return record;
      };

      const author = await create(User, {
        name: 'Audrey Audit',
        email: 'audrey.audit@example.com',
        password: 'password-audrey'
      });
      const publicPost = await create(Post, {
        title: 'Audited in public',
        body: 'Members may see this one.',
        isPublic: true,
        userId: author.getPrimaryKey()
      });
      const privatePost = await create(Post, {
        title: 'Audited in private',
        body: 'Members may not.',
        isPublic: false,
        userId: author.getPrimaryKey()
      });
      const publicComment = await create(Comment, {
        postId: publicPost.getPrimaryKey(),
        userId: author.getPrimaryKey(),
        message: 'On the public post.'
      });
      const privateComment = await create(Comment, {
        postId: privatePost.getPrimaryKey(),
        userId: author.getPrimaryKey(),
        message: 'On the private post.'
      });

      Object.assign(fixtures, {
        author,
        publicPost,
        privatePost,
        publicComment,
        privateComment
      });
    });

    const publicPosts = new Set(
      ((await Post.where({ isPublic: true })) as unknown as Array<Model>).map(
        idOf
      )
    );
    const publicComments = new Set(
      (
        (await Comment.whereRaw(
          'comments.post_id IN (SELECT id FROM posts WHERE is_public = ?)',
          [true]
        )) as unknown as Array<Model>
      ).map(idOf)
    );

    memberVisible = {
      ...everything,
      posts: id => publicPosts.has(id),
      comments: id => publicComments.has(id)
    };
  });

  afterAll(async () => {
    const Action = models.get('action') as ModelClass;
    const Notification = models.get('notification') as ModelClass;

    // The test-app's hooks track every created post and comment as an Action
    // (and notify the owner), so remove those side effects as well.
    await Action.table()
      .whereIn(
        'trackable_id',
        created.map(record => record.getPrimaryKey())
      )
      .whereIn('trackable_type', ['Post', 'Comment'])
      .del();

    await Notification.table()
      .where('recipient_id', fixtures.author.getPrimaryKey())
      .del();

    for (const record of [...created].reverse()) {
      await record.destroy();
    }
  });

  it('finds nothing where the rules match the expectation', async () => {
    const { requests, violations } = await auditVisibility(app, {
      namespace: 'members',
      query: MEMBER_QUERY,
      visible: memberVisible,
      ids: fixtureIds()
    });

    expect(violations).to.deep.equal([]);

    // Each kind of read was requested, with and without includes.
    const post = idOf(fixtures.privatePost);

    expect(requests).to.include.members([
      `/members/posts/${post}`,
      `/members/posts/${post}/comments?page%5Bsize%5D=100`,
      `/members/posts/${post}/relationships/user`
    ]);

    // Includes go in one request, by their longest paths.
    const included = requests
      .filter(url => url.startsWith(`/members/posts/${post}?include=`))
      .map(url => new URLSearchParams(url.split('?')[1]).get('include'));

    expect(included).to.have.lengthOf(1);

    const paths = included[0]?.split(',') ?? [];

    expect(paths.some(path => path.startsWith('comments.'))).to.equal(true);
    expect(
      paths.filter(path => paths.some(other => other.startsWith(`${path}.`)))
    ).to.deep.equal([]);
    expect(requests.some(url => url.startsWith('/members/posts?'))).to.equal(
      true
    );
  });

  it('reports what a namespace shows beyond the expectation', async () => {
    const { violations } = await auditVisibility(app, {
      namespace: 'admin',
      visible: memberVisible,
      ids: fixtureIds()
    });

    const post = idOf(fixtures.privatePost);
    const comment = idOf(fixtures.privateComment);
    const found = (type: string, id: string) =>
      violations.filter(v => v.type === type && v.id === id).map(v => v.url);

    // As primary data, included, and as linkage.
    expect(found('posts', post)).to.include.members([
      `/admin/posts/${post}`,
      `/admin/comments/${comment}/post`,
      `/admin/comments/${comment}/relationships/post`
    ]);
    expect(
      found('posts', post).some(url =>
        url.startsWith(`/admin/comments/${comment}?include=`)
      )
    ).to.equal(true);
    expect(found('comments', comment)).to.include(
      `/admin/posts/${post}/comments?page%5Bsize%5D=100`
    );
    expect(violations.every(v => v.status === 200)).to.equal(true);
  });

  it('reports a type the expectation leaves out', async () => {
    const withoutUsers = Object.fromEntries(
      Object.entries(memberVisible).filter(([type]) => type !== 'users')
    );

    const { violations } = await auditVisibility(app, {
      namespace: 'members',
      query: MEMBER_QUERY,
      visible: withoutUsers,
      ids: fixtureIds()
    });

    expect(violations).to.not.be.empty;
    expect(violations.every(v => v.type === 'users')).to.equal(true);
  });

  it('accepts a list of ids', async () => {
    const { violations } = await auditVisibility(app, {
      namespace: 'members',
      query: MEMBER_QUERY,
      visible: {
        ...memberVisible,
        users: [idOf(fixtures.author)]
      },
      ids: { ...fixtureIds(), posts: [idOf(fixtures.publicPost)] }
    });

    // Lists name every user of the seed; requests by id only the author.
    expect(violations.every(v => v.type === 'users')).to.equal(true);
    expect(
      violations.some(
        v => v.url === `/members/posts/${idOf(fixtures.publicPost)}`
      )
    ).to.equal(false);
  });

  describe('`query`', () => {
    it('reports a read that requires parameters it was not given', async () => {
      const { violations } = await auditVisibility(app, {
        namespace: 'members',
        visible: memberVisible,
        ids: fixtureIds()
      });

      expect(violations).to.not.be.empty;
      expect(
        violations.every(
          v => v.status === 400 && v.url.startsWith('/members/tags?')
        )
      ).to.equal(true);
    });

    it('sends them to every read of the type, not to linkage', async () => {
      const { requests } = await auditVisibility(app, {
        namespace: 'members',
        query: MEMBER_QUERY,
        visible: memberVisible,
        ids: fixtureIds()
      });
      const post = idOf(fixtures.publicPost);
      const params = (url: string) =>
        new URLSearchParams(url.split('?')[1] ?? '');

      // The list, and the related endpoint that serves tags.
      ['/members/tags?', `/members/posts/${post}/tags?`].forEach(prefix => {
        const sent = requests.filter(url => url.startsWith(prefix));

        expect(sent, prefix).to.not.be.empty;
        sent.forEach(url => {
          expect(params(url).get('fromDate'), url).to.equal('2026-01-01');
        });
      });

      expect(requests).to.include(`/members/posts/${post}/relationships/tags`);
      expect(
        requests
          .filter(url => !/\/members\/(tags|posts\/\d+\/tags)\?/.test(url))
          .some(url => params(url).has('fromDate'))
      ).to.equal(false);
    });
  });

  it('returns every record it saw', async () => {
    const { seen } = await auditVisibility(app, {
      namespace: 'members',
      query: MEMBER_QUERY,
      visible: memberVisible,
      ids: fixtureIds()
    });

    expect(seen.posts).to.include(idOf(fixtures.publicPost));
    expect(seen.posts).to.not.include(idOf(fixtures.privatePost));
    expect(seen.comments).to.include(idOf(fixtures.publicComment));
    expect(seen.comments).to.not.include(idOf(fixtures.privateComment));
    expect(seen.users).to.include(idOf(fixtures.author));
    expect(new Set(seen.posts).size).to.equal(seen.posts.length);
  });

  it('reports what `onDocument` finds, as violations of the request', async () => {
    const author = idOf(fixtures.author);
    const checked: Array<string> = [];

    const { violations } = await auditVisibility(app, {
      namespace: 'members',
      query: MEMBER_QUERY,
      visible: memberVisible,
      ids: fixtureIds(),

      // Members should not see emails; the test-app shows them.
      async onDocument({ url, document }) {
        checked.push(url);

        const resources = [
          ...[document.data].flat(),
          ...((document.included as Array<unknown>) ?? [])
        ] as Array<{ type: string; id: string; attributes?: object }>;

        return resources
          .filter(
            r => r?.type === 'users' && r.attributes && 'email' in r.attributes
          )
          .map(r => `users ${r.id} shows its email`);
      }
    });

    expect(checked).to.include(`/members/users/${author}`);
    expect(violations).to.deep.include({
      url: `/members/users/${author}`,
      status: 200,
      message: `users ${author} shows its email`
    });
    expect(
      violations.every(v => v.message?.endsWith('shows its email'))
    ).to.equal(true);
  });

  describe('`origin`', () => {
    it('sends the requests there', async () => {
      // Nothing listens on port 1: every request fails, so none went to `app`.
      await expect(
        auditVisibility(app, {
          namespace: 'members',
          origin: 'http://localhost:1',
          visible: memberVisible,
          ids: fixtureIds()
        })
      ).rejects.toThrow();
    });

    it('is required when the application is not listening', async () => {
      const idle = {
        ...app,
        router: app.router,
        server: { instance: { address: () => null } }
      } as unknown as Application;

      await expect(
        auditVisibility(idle, { namespace: 'members', visible: everything })
      ).rejects.toThrow('the application is not listening');
    });
  });

  it('refuses a namespace that serves no reads', async () => {
    await expect(
      auditVisibility(app, { namespace: 'nope', visible: everything })
    ).rejects.toThrow("namespace '/nope' serves no index, show");
  });
});
