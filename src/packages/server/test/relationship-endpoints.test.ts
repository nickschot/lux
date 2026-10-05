import fetch from 'node-fetch';
import { it, describe, beforeAll, afterAll, expect } from 'vitest';

import Server from '../index';
import type { Model, ModelClass } from '../../database';
import { getTestApp } from '../../../../test/utils/get-test-app';

// Relationship endpoints (`/posts/1/relationships/comments`) over HTTP, and
// the relationship `self` links that point at them. The database is shared
// with other suites, so assertions target a fixture graph created (and
// removed) here.

const JSONAPI = 'application/vnd.api+json';

let DOMAIN = '';

type Identifier = { id: string; type: string };

async function request(method: string, path: string, body?: unknown) {
  const res = await fetch(path.startsWith('http') ? path : DOMAIN + path, {
    method,
    headers: { Accept: JSONAPI, 'Content-Type': JSONAPI },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await res.text();

  return {
    res,
    status: res.status,
    body: text ? JSON.parse(text) : undefined
  };
}

const idOf = (record: Model) => String(record.getPrimaryKey());
const ref = (type: string, record: Model): Identifier => ({
  id: idOf(record),
  type
});
const sorted = (list: Array<Identifier>) =>
  [...list].sort((a, b) => Number(a.id) - Number(b.id));

describe('relationship endpoints over HTTP', () => {
  let server;
  let models: Map<string, ModelClass>;
  const created: Array<Model> = [];
  const fixtures: Record<string, Model> = {};

  beforeAll(async () => {
    const app = await getTestApp();

    ({ models } = app);

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
    const Categorization = models.get('categorization') as ModelClass;

    await Post.transaction(async trx => {
      const create = async (model: ModelClass, attrs: object) => {
        const record = await model.transacting(trx).create(attrs);
        created.push(record);
        return record;
      };

      const author = await create(User, {
        name: 'Rhea Relationship',
        email: 'rhea.relationship@example.com',
        password: 'password-rhea'
      });
      const post = await create(Post, {
        title: 'Relationship endpoints',
        body: 'A post with relationships.',
        isPublic: true,
        userId: author.getPrimaryKey()
      });
      const emptyPost = await create(Post, {
        title: 'No relationships',
        body: 'A post without any.',
        isPublic: true
      });
      const tags = [
        await create(Tag, { name: 'relationship-a' }),
        await create(Tag, { name: 'relationship-b' })
      ];

      for (const tag of tags) {
        await create(Categorization, {
          postId: post.getPrimaryKey(),
          tagId: tag.getPrimaryKey()
        });
      }

      const comments = [
        await create(Comment, {
          postId: post.getPrimaryKey(),
          userId: author.getPrimaryKey(),
          message: 'First.'
        }),
        await create(Comment, {
          postId: post.getPrimaryKey(),
          userId: author.getPrimaryKey(),
          message: 'Second.'
        })
      ];

      Object.assign(fixtures, {
        author,
        post,
        emptyPost,
        tagA: tags[0],
        tagB: tags[1],
        commentA: comments[0],
        commentB: comments[1]
      });
    });
  });

  afterAll(async () => {
    server.instance.close();

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

  describe('GET', () => {
    it('serves a to-one relationship', async () => {
      const { post, author } = fixtures;
      const path = `/posts/${idOf(post)}/relationships/user`;
      const { status, res, body } = await request('GET', path);

      expect(status).to.equal(200);
      expect(res.headers.get('content-type')).to.equal(JSONAPI);
      expect(body).to.deep.equal({
        data: ref('users', author),
        links: { self: DOMAIN + path },
        jsonapi: { version: '1.0' }
      });
    });

    it('serves an empty to-one relationship as `null`', async () => {
      const path = `/posts/${idOf(fixtures.emptyPost)}/relationships/user`;
      const { status, body } = await request('GET', path);

      expect(status).to.equal(200);
      expect(body.data).to.equal(null);
      expect(body.links).to.deep.equal({ self: DOMAIN + path });
    });

    it('serves a to-many relationship', async () => {
      const { post, commentA, commentB } = fixtures;
      const { status, body } = await request(
        'GET',
        `/posts/${idOf(post)}/relationships/comments`
      );

      expect(status).to.equal(200);
      expect(sorted(body.data)).to.deep.equal(
        sorted([ref('comments', commentA), ref('comments', commentB)])
      );
    });

    it('serves a to-many relationship through a join model', async () => {
      const { post, tagA, tagB } = fixtures;
      const { status, body } = await request(
        'GET',
        `/posts/${idOf(post)}/relationships/tags`
      );

      expect(status).to.equal(200);
      expect(sorted(body.data)).to.deep.equal(
        sorted([ref('tags', tagA), ref('tags', tagB)])
      );
    });

    it('serves an empty to-many relationship as `[]`', async () => {
      const { status, body } = await request(
        'GET',
        `/posts/${idOf(fixtures.emptyPost)}/relationships/comments`
      );

      expect(status).to.equal(200);
      expect(body.data).to.deep.equal([]);
    });

    it('serves the inverse of a relationship', async () => {
      const { author, post } = fixtures;
      const { status, body } = await request(
        'GET',
        `/users/${idOf(author)}/relationships/posts`
      );

      expect(status).to.equal(200);
      expect(body.data).to.deep.equal([ref('posts', post)]);
    });

    it('dasherizes the relationship name in links', () => {
      const paths: Array<string> = [];
      const serializer = models.get('post')!.serializer;
      const links = serializer.relationshipLinksFor({
        id: '1',
        type: 'posts',
        name: 'friendRequests',
        domain: DOMAIN,
        namespace: '',
        routed: path => {
          paths.push(path);
          return true;
        }
      });

      expect(paths).to.deep.equal([
        '/posts/:dynamic/relationships/friend-requests'
      ]);
      expect(links).to.deep.equal({
        links: { self: `${DOMAIN}/posts/1/relationships/friend-requests` }
      });
    });

    it('builds links in the request namespace', async () => {
      const { post, author } = fixtures;
      const path = `/admin/posts/${idOf(post)}/relationships/user`;
      const { status, body } = await request('GET', path);

      expect(status).to.equal(200);
      expect(body.data).to.deep.equal(ref('users', author));
      expect(body.links).to.deep.equal({ self: DOMAIN + path });
    });

    it('responds 404 to a resource that does not exist', async () => {
      const { status } = await request(
        'GET',
        '/posts/99999999/relationships/user'
      );

      expect(status).to.equal(404);
    });

    it('responds 404 to a relationship the resource does not have', async () => {
      const { status } = await request(
        'GET',
        `/posts/${idOf(fixtures.post)}/relationships/nope`
      );

      expect(status).to.equal(404);
    });

    it('responds 400 to a query parameter', async () => {
      const { status, body } = await request(
        'GET',
        `/posts/${idOf(fixtures.post)}/relationships/user?include=user`
      );

      expect(status).to.equal(400);
      expect(body.errors[0].source).to.deep.equal({ parameter: 'include' });
    });
  });

  describe('the owning resource', () => {
    it("is resolved through the controller's `show`", async () => {
      const app = await getTestApp();
      const requests: Array<unknown> = [];
      // Controllers are frozen, so `show` is shadowed rather than assigned.
      const controller = Object.create(app.controllers.get('posts'), {
        show: {
          value: req => {
            requests.push({ params: req.params, defaults: req.defaultParams });
            throw new Error('rejected by show');
          }
        }
      });

      expect(() =>
        controller.showRelationship({
          params: { id: 7, include: ['user'] }
        })
      ).to.throw('rejected by show');
      expect(requests).to.deep.equal([
        {
          params: { id: 7, fields: { posts: [] } },
          defaults: { fields: { posts: [] } }
        }
      ]);
    });
  });

  describe('methods', () => {
    it('answers HEAD like GET, without a body', async () => {
      const path = `/posts/${idOf(fixtures.post)}/relationships/comments`;
      const { status, body } = await request('HEAD', path);

      expect(status).to.equal(200);
      expect(body).to.equal(undefined);
    });

    it('responds 405 with `Allow` to a write', async () => {
      for (const method of ['PATCH', 'POST', 'DELETE']) {
        const { status, res } = await request(
          method,
          `/posts/${idOf(fixtures.post)}/relationships/comments`,
          { data: [] }
        );

        expect(status, method).to.equal(405);
        expect(res.headers.get('allow'), method).to.equal('GET, HEAD, OPTIONS');
      }
    });
  });

  describe('relationship links', () => {
    it('links every relationship of a resource to its endpoint', async () => {
      const { post } = fixtures;
      const { body } = await request('GET', `/posts/${idOf(post)}`);
      const { relationships } = body.data;

      expect(Object.keys(relationships)).to.have.members([
        'user',
        'image',
        'comments',
        'reactions',
        'tags'
      ]);

      // Every `self` link is served, with the linkage of the resource.
      for (const [name, { data, links }] of Object.entries<{
        data: unknown;
        links: { self: string };
      }>(relationships)) {
        const served = await request('GET', links.self);

        expect(links.self, name).to.equal(
          `${DOMAIN}/posts/${idOf(post)}/relationships/${name}`
        );
        expect(served.status, name).to.equal(200);
        expect(served.body.data, name).to.deep.equal(data);
      }
    });

    it('links the relationships of included resources', async () => {
      const { post, commentA } = fixtures;
      const { body } = await request(
        'GET',
        `/posts/${idOf(post)}?include=comments`
      );
      const comment = body.included.find(
        ({ id, type }) => type === 'comments' && id === idOf(commentA)
      );

      expect(comment.relationships.post.links).to.deep.equal({
        self: `${DOMAIN}/comments/${idOf(commentA)}/relationships/post`
      });
    });

    it('leaves out links to endpoints the namespace does not serve', async () => {
      // `members` has no `images` resource, so an included image's
      // relationships have no endpoint to link to.
      const Image = models.get('image') as ModelClass;
      const image = await Image.create({
        url: 'http://example.com/relationship.png',
        postId: fixtures.post.getPrimaryKey()
      });

      try {
        const { status, body } = await request(
          'GET',
          `/members/posts/${idOf(fixtures.post)}?include=image`
        );
        const included = body.included.find(({ type }) => type === 'images');

        expect(status).to.equal(200);
        expect(body.data.relationships.image.links).to.deep.equal({
          self: `${DOMAIN}/members/posts/${idOf(fixtures.post)}/relationships/image`
        });
        expect(included.relationships.post).to.deep.equal({
          data: ref('posts', fixtures.post)
        });
      } finally {
        await image.destroy();
      }
    });
  });
});
