import { it, describe, beforeAll, afterAll, expect } from 'vitest';

import Controller from '../index';
import Server from '../../server';
import { Query } from '../../database';
import { Scope, scopeFor } from '../visibility';
import { VisibilityRuleError } from '../visibility/errors';
import resolveVisibility from '../../application/utils/resolve-visibility';
import type { Model, ModelClass } from '../../database';
import type { Request } from '../../server';
import { getTestApp } from '../../../../test/utils/get-test-app';

// The test-app hides private posts everywhere but `admin`
// (`app/controllers/application.js`); its `members` namespace extends that
// rule to hide the comments on them too (`members/application.js`). `admin`
// lifts every rule, so each hidden record stays reachable there. The seed is random and
// shared with other suites, so exact assertions target a fixture graph created
// (and torn down) here.

const JSONAPI = 'application/vnd.api+json';

type Identifier = { id: string; type: string };
type Resource = Identifier & {
  relationships?: Record<
    string,
    { data: Identifier | Array<Identifier> | null }
  >;
};
type Document = {
  data: Resource | Array<Resource>;
  included?: Array<Resource>;
  links?: Record<string, string | null>;
  errors?: Array<{ status: string; source?: Record<string, string> }>;
};

let DOMAIN = '';

async function request(
  path: string,
  { method = 'GET', body }: { method?: string; body?: unknown } = {}
): Promise<{ status: number; body: Document | null }> {
  const res = await fetch(`${DOMAIN}${path}`, {
    method,
    headers: {
      Accept: JSONAPI,
      ...(body ? { 'Content-Type': JSONAPI } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await res.text();

  return {
    status: res.status,
    body: text ? (JSON.parse(text) as Document) : null
  };
}

const idOf = (record: Model) => String(record.getPrimaryKey());
const ref = (type: string, record: Model): Identifier => ({
  id: idOf(record),
  type
});
const keyOf = ({ id, type }: Identifier) => `${type}:${id}`;
const keysOf = (data: Identifier | Array<Identifier> | null | undefined) =>
  (Array.isArray(data) ? data : data ? [data] : []).map(keyOf).sort();

describe('visibility rules', () => {
  let server: Server;
  let models: Map<string, ModelClass>;
  let store;
  const created: Array<Model> = [];
  const fixtures: Record<string, Model> = {};

  beforeAll(async () => {
    const app = await getTestApp();
    ({ models, store } = app);

    server = new Server({
      logger: app.logger,
      router: app.router,
      cors: { enabled: false }
    });

    server.listen(0);
    await new Promise(resolve => server.instance.once('listening', resolve));
    DOMAIN = `http://localhost:${server.instance.address().port}`;

    const User = models.get('user') as ModelClass;
    const Post = models.get('post') as ModelClass;
    const Tag = models.get('tag') as ModelClass;
    const Comment = models.get('comment') as ModelClass;
    const Reaction = models.get('reaction') as ModelClass;
    const Categorization = models.get('categorization') as ModelClass;

    await Post.transaction(async trx => {
      const create = async (model: ModelClass, attrs: object) => {
        const record = await model.transacting(trx).create(attrs);
        created.push(record);
        return record;
      };

      const author = await create(User, {
        name: 'Vera Visible',
        email: 'vera.visible@example.com',
        password: 'password-vera'
      });
      const publicPost = await create(Post, {
        title: 'Public',
        body: 'Everyone sees this.',
        isPublic: true,
        userId: author.getPrimaryKey()
      });
      const privatePost = await create(Post, {
        title: 'Private',
        body: 'Members must not see this.',
        isPublic: false,
        userId: author.getPrimaryKey()
      });
      const tag = await create(Tag, { name: 'visibility' });

      for (const post of [publicPost, privatePost]) {
        await create(Categorization, {
          postId: post.getPrimaryKey(),
          tagId: tag.getPrimaryKey()
        });
      }

      const visibleComment = await create(Comment, {
        postId: publicPost.getPrimaryKey(),
        userId: author.getPrimaryKey(),
        message: 'On the public post.'
      });
      const hiddenComment = await create(Comment, {
        postId: privatePost.getPrimaryKey(),
        userId: author.getPrimaryKey(),
        message: 'On the private post.'
      });
      // Reactions have no rule: visible, but pointing at a hidden post.
      const reaction = await create(Reaction, {
        postId: privatePost.getPrimaryKey(),
        userId: author.getPrimaryKey(),
        type: ':tada:'
      });

      Object.assign(fixtures, {
        author,
        publicPost,
        privatePost,
        tag,
        visibleComment,
        hiddenComment,
        reaction
      });
    });
  });

  afterAll(async () => {
    server.instance.close();

    const Action = models.get('action') as ModelClass;
    const Notification = models.get('notification') as ModelClass;

    // The test-app's hooks track every created post/comment/reaction as an
    // Action (and notify the owner), so remove those side effects as well.
    await Action.table()
      .whereIn(
        'trackable_id',
        created.map(record => record.getPrimaryKey())
      )
      .whereIn('trackable_type', ['Post', 'Comment', 'Reaction'])
      .del();

    await Notification.table()
      .where('recipient_id', fixtures.author.getPrimaryKey())
      .del();

    for (const record of [...created].reverse()) {
      await record.destroy();
    }
  });

  describe('primary data', () => {
    it('leaves hidden records out of index', async () => {
      const { publicPost, privatePost } = fixtures;
      const { status, body } = await request(
        '/members/posts?page[size]=100&fields[posts]=title'
      );
      const keys = keysOf(body?.data as Array<Resource>);

      expect(status).to.equal(200);
      expect(keys).to.include(keyOf(ref('posts', publicPost)));
      expect(keys).not.to.include(keyOf(ref('posts', privatePost)));
    });

    it('counts only visible records in the page links', async () => {
      const Post = models.get('post') as ModelClass;
      const visible = await Post.where({ isPublic: true }).count();
      const { body } = await request('/members/posts?page[size]=1');
      const last = new URL(String(body?.links?.last)).searchParams;

      expect(Number(last.get('page[number]'))).to.equal(visible);
      expect(body?.meta).to.deep.equal({ total: visible });
    });

    it('responds 404 for a hidden record, as for a missing one', async () => {
      const { publicPost, privatePost } = fixtures;

      expect(
        (await request(`/members/posts/${idOf(publicPost)}`)).status
      ).to.equal(200);
      expect(
        (await request(`/members/posts/${idOf(privatePost)}`)).status
      ).to.equal(404);
      // The root rule is what `members` inherits.
      expect((await request(`/posts/${idOf(privatePost)}`)).status).to.equal(
        404
      );
      // Admins see everything.
      expect(
        (await request(`/admin/posts/${idOf(privatePost)}`)).status
      ).to.equal(200);
    });

    it('cannot update or destroy a hidden record', async () => {
      const { privatePost } = fixtures;
      const id = idOf(privatePost);
      const patch = await request(`/members/posts/${id}`, {
        method: 'PATCH',
        body: { data: { id, type: 'posts', attributes: { title: 'Edited' } } }
      });
      const destroy = await request(`/members/posts/${id}`, {
        method: 'DELETE'
      });
      const Post = models.get('post') as ModelClass;

      expect(patch.status).to.equal(404);
      expect(destroy.status).to.equal(404);
      expect(await Post.find(privatePost.getPrimaryKey())).to.have.property(
        'title',
        'Private'
      );
    });
  });

  describe('relationships', () => {
    it('leaves hidden records out of to-many linkage and `included`', async () => {
      const { author, publicPost, visibleComment } = fixtures;
      const { status, body } = await request(
        `/members/users/${idOf(author)}?include=posts,comments`
      );
      const data = body?.data as Resource;

      expect(status).to.equal(200);
      expect(keysOf(data.relationships?.posts.data)).to.deep.equal([
        keyOf(ref('posts', publicPost))
      ]);
      expect(keysOf(data.relationships?.comments.data)).to.deep.equal([
        keyOf(ref('comments', visibleComment))
      ]);
      expect(keysOf(body?.included)).to.deep.equal(
        [ref('comments', visibleComment), ref('posts', publicPost)]
          .map(keyOf)
          .sort()
      );
    });

    it('serializes a to-one pointing at a hidden record as `null`', async () => {
      const { reaction } = fixtures;
      const { status, body } = await request(
        `/members/reactions/${idOf(reaction)}?include=post`
      );
      const data = body?.data as Resource;

      expect(status).to.equal(200);
      expect(data.relationships?.post?.data).to.equal(null);
      expect(body).not.to.have.property('included');
    });

    it('leaves hidden records out of has-many-through linkage', async () => {
      const { tag, publicPost } = fixtures;
      const { status, body } = await request(
        `/members/tags/${idOf(tag)}?include=posts`
      );
      const data = body?.data as Resource;

      expect(status).to.equal(200);
      expect(keysOf(data.relationships?.posts.data)).to.deep.equal([
        keyOf(ref('posts', publicPost))
      ]);
      expect(keysOf(body?.included)).to.deep.equal([
        keyOf(ref('posts', publicPost))
      ]);
    });

    it('hides records at every level of a nested include', async () => {
      const { author, publicPost, visibleComment, hiddenComment } = fixtures;
      const { status, body } = await request(
        `/members/users/${idOf(author)}?include=posts.comments`
      );
      const keys = keysOf(body?.included);

      expect(status).to.equal(200);
      expect(keys).to.include(keyOf(ref('posts', publicPost)));
      expect(keys).to.include(keyOf(ref('comments', visibleComment)));
      expect(keys).not.to.include(keyOf(ref('comments', hiddenComment)));
    });

    it('reports a hidden related record on a write as not found', async () => {
      const { author, privatePost } = fixtures;
      const { status, body } = await request('/members/comments', {
        method: 'POST',
        body: {
          data: {
            type: 'comments',
            attributes: { message: 'Sneaky.' },
            relationships: {
              post: { data: { id: idOf(privatePost), type: 'posts' } },
              user: { data: { id: idOf(author), type: 'users' } }
            }
          }
        }
      });

      expect(status).to.equal(404);
      expect(body?.errors?.[0].source).to.deep.equal({
        pointer: '/data/relationships/post/data'
      });
    });

    it('costs no queries per record', async () => {
      const countQueries = async (path: string) => {
        let count = 0;
        const onQuery = () => {
          count += 1;
        };

        store.connection.on('query', onQuery);

        try {
          expect((await request(path)).status).to.equal(200);
        } finally {
          store.connection.removeListener('query', onQuery);
        }

        return count;
      };
      const query = 'include=user,comments,tags,comments.user';

      expect(
        await countQueries(`/members/posts?${query}&page[size]=10`)
      ).to.equal(await countQueries(`/members/posts?${query}&page[size]=25`));
    });
  });

  describe('relationship endpoints', () => {
    it('responds 404 for a hidden resource', async () => {
      const { status } = await request(
        `/members/posts/${idOf(fixtures.privatePost)}/relationships/user`
      );

      expect(status).to.equal(404);
    });

    it('serves a to-one pointing at a hidden record as `null`', async () => {
      const { status, body } = await request(
        `/members/reactions/${idOf(fixtures.reaction)}/relationships/post`
      );

      expect(status).to.equal(200);
      expect(body?.data).to.equal(null);
    });

    it('leaves hidden records out of a to-many', async () => {
      const { tag, publicPost } = fixtures;
      const { status, body } = await request(
        `/members/tags/${idOf(tag)}/relationships/posts`
      );

      expect(status).to.equal(200);
      expect(keysOf(body?.data as unknown as Array<Identifier>)).to.deep.equal([
        keyOf(ref('posts', publicPost))
      ]);
    });

    it('applies the rules of the request namespace', async () => {
      const { tag, publicPost, privatePost } = fixtures;
      const { body } = await request(
        `/admin/tags/${idOf(tag)}/relationships/posts`
      );

      expect(
        keysOf(body?.data as unknown as Array<Identifier>).sort()
      ).to.deep.equal(
        [
          keyOf(ref('posts', publicPost)),
          keyOf(ref('posts', privatePost))
        ].sort()
      );
    });
  });

  describe('related endpoints', () => {
    it('responds 404 for a hidden resource', async () => {
      const { status } = await request(
        `/members/posts/${idOf(fixtures.privatePost)}/comments`
      );

      expect(status).to.equal(404);
    });

    it('serves a to-one pointing at a hidden record as `null`', async () => {
      const { status, body } = await request(
        `/members/reactions/${idOf(fixtures.reaction)}/post`
      );

      expect(status).to.equal(200);
      expect(body?.data).to.equal(null);
    });

    it('leaves hidden records out of a to-many, and its count', async () => {
      const { tag, publicPost } = fixtures;
      const { status, body } = await request(
        `/members/tags/${idOf(tag)}/posts?page[size]=1`
      );

      expect(status).to.equal(200);
      expect(keysOf(body?.data as unknown as Array<Identifier>)).to.deep.equal([
        keyOf(ref('posts', publicPost))
      ]);
      expect(body?.links?.next).to.equal(null);
    });

    it('applies the rules of the request namespace', async () => {
      const { tag } = fixtures;
      const { body } = await request(`/admin/tags/${idOf(tag)}/posts`);

      expect(body?.data).to.have.length(2);
    });
  });

  describe('class Scope', () => {
    let Post: ModelClass;
    let Comment: ModelClass;
    const req = { id: 'request' } as unknown as Request;

    beforeAll(() => {
      Post = models.get('post') as ModelClass;
      Comment = models.get('comment') as ModelClass;
    });

    it('runs each rule once per request, with the request', () => {
      const calls: Array<unknown> = [];
      const scope = new Scope(
        {
          posts: (query, request) => {
            calls.push(request);
            return query.where({ isPublic: true });
          }
        },
        req
      );

      scope.apply(Post.select('id'));
      const query = scope.apply(Post.select('id'));

      expect(calls).to.deep.equal([req]);
      expect(query.snapshots).to.deep.include([
        'where',
        { 'posts.is_public': true }
      ]);
      expect(scope.covers(Post)).to.equal(true);
      expect(scope.covers(Comment)).to.equal(false);
    });

    it('is shared by every lookup for the same request', () => {
      expect(scopeFor({}, req)).to.equal(scopeFor({}, req));
    });

    it('leaves types without a rule alone', () => {
      const query = Scope.none.apply(new Query(Comment));

      expect(query.snapshots).to.deep.equal([]);
    });

    it('cannot be unscoped', async () => {
      const scope = new Scope({ posts: query => query.isPublic() }, req);
      const query = scope.apply(Post.select('id')).unscope('isPublic');

      expect(query.snapshots).to.deep.include([
        'where',
        { 'posts.is_public': true }
      ]);
    });

    [
      ['an async rule', async (query: Query<Array<Model>>) => query],
      ['a query of another type', () => new Query(Comment)],
      ['an order', (query: Query<Array<Model>>) => query.order('title')],
      ['a select', (query: Query<Array<Model>>) => query.select('title')],
      ['a limit', (query: Query<Array<Model>>) => query.limit(1)]
    ].forEach(([label, rule]) => {
      it(`rejects ${label as string}`, () => {
        const scope = new Scope({ posts: rule as never }, req);

        expect(() => scope.apply(Post.select('id'))).to.throw(
          VisibilityRuleError
        );
      });
    });
  });

  describe('boot', () => {
    let Post: ModelClass;
    const posts = (query: Query<Array<Model>>) => query.isPublic();

    beforeAll(() => {
      Post = models.get('post') as ModelClass;
    });

    // What an app's controllers are: subclasses, so the default `{}` stays
    // on `Controller` itself rather than looking declared.
    class PlainController extends Controller {}

    const build = (
      entries: Array<[string, typeof Controller]>
    ): Map<string, Controller> =>
      new Map(
        entries.map(([key, Class]) => [
          key,
          new Class({ model: key.endsWith('posts') ? Post : undefined })
        ])
      );

    it('gives a namespace without an ApplicationController its ancestor rules', () => {
      class ApplicationController extends Controller {
        static override visibility = { posts };
      }
      class AdminApplicationController extends ApplicationController {
        static override visibility = {};
      }

      const controllers = build([
        ['application', ApplicationController],
        ['posts', PlainController],
        ['admin/application', AdminApplicationController],
        ['admin/posts', PlainController],
        ['members/posts', PlainController],
        ['members/v2/posts', PlainController]
      ]);

      resolveVisibility(controllers, models.values());

      expect(controllers.get('posts')?.visibility).to.have.all.keys(['posts']);
      expect(controllers.get('admin/posts')?.visibility).to.deep.equal({});
      expect(controllers.get('members/posts')?.visibility).to.have.all.keys([
        'posts'
      ]);
      expect(controllers.get('members/v2/posts')?.visibility).to.have.all.keys([
        'posts'
      ]);
    });

    it("gives a namespace whose ApplicationController declares no rules its parent namespace's", () => {
      class ApplicationController extends Controller {
        static override visibility = { posts };
      }
      // Extends `Controller`, not the root's class, and declares nothing:
      // e.g. an ApplicationController that only adds a hook.
      class MembersApplicationController extends Controller {}
      class MembersV2ApplicationController extends Controller {}

      const controllers = build([
        ['application', ApplicationController],
        ['members/application', MembersApplicationController],
        ['members/posts', PlainController],
        ['members/v2/application', MembersV2ApplicationController],
        ['members/v2/posts', PlainController]
      ]);

      resolveVisibility(controllers, models.values());

      expect(controllers.get('members/posts')?.visibility).to.deep.equal({
        posts
      });
      expect(controllers.get('members/v2/posts')?.visibility).to.deep.equal({
        posts
      });
    });

    it('lets an ApplicationController that extends `Controller` declare none', () => {
      class ApplicationController extends Controller {
        static override visibility = { posts };
      }
      class AdminApplicationController extends Controller {
        static override visibility = {};
      }

      const controllers = build([
        ['application', ApplicationController],
        ['admin/application', AdminApplicationController],
        ['admin/posts', PlainController]
      ]);

      resolveVisibility(controllers, models.values());

      expect(controllers.get('admin/posts')?.visibility).to.deep.equal({});
    });

    it('gives a controller outside any namespace tree no rules', () => {
      class ApplicationController extends Controller {
        static override visibility = { posts };
      }

      // `dirname('/')` is `/`: the walk must stop there, not spin forever.
      const controllers = build([
        ['application', ApplicationController],
        ['/posts', PlainController]
      ]);

      resolveVisibility(controllers, models.values());

      expect(controllers.get('/posts')?.visibility).to.deep.equal({});
    });

    it('inherits and extends rules through `super`', () => {
      const comments = (query: Query<Array<Model>>) => query;

      class ApplicationController extends Controller {
        static override visibility = { posts };
      }
      class MembersApplicationController extends ApplicationController {
        static override visibility = { ...super.visibility, comments };
      }

      const controllers = build([
        ['application', ApplicationController],
        ['members/application', MembersApplicationController],
        ['members/posts', PlainController]
      ]);

      resolveVisibility(controllers, models.values());

      expect(controllers.get('members/posts')?.visibility).to.deep.equal({
        posts,
        comments
      });
    });

    it('refuses rules it cannot apply', () => {
      class ApplicationController extends Controller {
        static override visibility = {
          post: posts,
          comments: 'nope'
        } as never;
      }
      class PostsController extends ApplicationController {
        static override visibility = { posts };
      }

      const controllers = build([
        ['application', ApplicationController],
        ['posts', PostsController]
      ]);

      expect(() => resolveVisibility(controllers, models.values()))
        .to.throw(TypeError)
        .with.property('message')
        .that.includes('posts: declare rules on the namespace')
        .and.includes('no model for type "post"')
        .and.includes('the rule for "comments" is not a function');
    });
  });
});
