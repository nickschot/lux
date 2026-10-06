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
// The links of the relationship `name` of the resource at `path` (`/posts/1`).
const linksFor = (path: string, name: string) => ({
  self: `${DOMAIN}${path}/relationships/${name}`,
  related: `${DOMAIN}${path}/${name}`
});
const sorted = (list: Array<Identifier>) =>
  [...list].sort((a, b) => Number(a.id) - Number(b.id));

describe('relationship endpoints over HTTP', () => {
  let server;
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
      const { status, res, body } = await request(
        'GET',
        `/posts/${idOf(post)}/relationships/user`
      );

      expect(status).to.equal(200);
      expect(res.headers.get('content-type')).to.equal(JSONAPI);
      expect(body).to.deep.equal({
        data: ref('users', author),
        links: linksFor(`/posts/${idOf(post)}`, 'user'),
        jsonapi: { version: '1.0' }
      });
    });

    it('serves an empty to-one relationship as `null`', async () => {
      const path = `/posts/${idOf(fixtures.emptyPost)}`;
      const { status, body } = await request(
        'GET',
        `${path}/relationships/user`
      );

      expect(status).to.equal(200);
      expect(body.data).to.equal(null);
      expect(body.links).to.deep.equal(linksFor(path, 'user'));
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
        '/posts/:dynamic/relationships/friend-requests',
        '/posts/:dynamic/friend-requests'
      ]);
      expect(links).to.deep.equal({
        links: linksFor('/posts/1', 'friend-requests')
      });
    });

    it('builds links in the request namespace', async () => {
      const { post, author } = fixtures;
      const path = `/admin/posts/${idOf(post)}`;
      const { status, body } = await request(
        'GET',
        `${path}/relationships/user`
      );

      expect(status).to.equal(200);
      expect(body.data).to.deep.equal(ref('users', author));
      expect(body.links).to.deep.equal(linksFor(path, 'user'));
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

      expect(comment.relationships.post.links).to.deep.equal(
        linksFor(`/comments/${idOf(commentA)}`, 'post')
      );
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
        // Nor a related endpoint for the post's image (see below).
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

  // `members` has a serializer for images that hides their `url`, but no
  // images controller. A related endpoint served by an ancestor namespace's
  // controller would format images with its serializer, URL and all.
  describe('a type without a controller in the namespace', () => {
    it('has no related endpoint, so its serializer cannot be bypassed', async () => {
      const Image = models.get('image') as ModelClass;
      const image = await Image.create({
        url: 'http://example.com/members-only.png',
        postId: fixtures.post.getPrimaryKey()
      });

      try {
        const path = `/members/posts/${idOf(fixtures.post)}`;
        const included = await request('GET', `${path}?include=image`);
        const related = await request('GET', `${path}/image`);
        const fields = await request('GET', `${path}/image?fields[images]=url`);

        expect(included.body.included[0].attributes).to.deep.equal({});
        expect(related.status).to.equal(404);
        expect(fields.status).to.equal(404);
      } finally {
        await image.destroy();
      }
    });
  });

  describe('related endpoints', () => {
    it('serves a to-one related resource', async () => {
      const { post, author } = fixtures;
      const path = `/posts/${idOf(post)}/user`;
      const { status, body } = await request('GET', path);

      expect(status).to.equal(200);
      expect(body.data).to.deep.include(ref('users', author));
      expect(body.data.attributes).to.have.all.keys(['name', 'email']);
      expect(body.links).to.deep.equal({ self: DOMAIN + path });
      expect(body).not.to.have.property('meta');
    });

    it('serves an empty to-one relationship as `null`', async () => {
      const path = `/posts/${idOf(fixtures.emptyPost)}/image`;
      const { status, body } = await request('GET', path);

      expect(status).to.equal(200);
      expect(body).to.deep.equal({
        data: null,
        links: { self: DOMAIN + path },
        jsonapi: { version: '1.0' }
      });
    });

    it('serves a to-many relationship as a collection', async () => {
      const { post, commentA, commentB } = fixtures;
      const { status, body } = await request(
        'GET',
        `/posts/${idOf(post)}/comments`
      );

      expect(status).to.equal(200);
      expect(
        sorted(body.data.map(({ id, type }) => ({ id, type })))
      ).to.deep.equal(
        sorted([ref('comments', commentA), ref('comments', commentB)])
      );
      expect(body.links).to.include.keys(['self', 'first', 'last']);
    });

    it('serves a to-many relationship through a join model', async () => {
      const { post, tagA, tagB } = fixtures;
      const { status, body } = await request(
        'GET',
        `/posts/${idOf(post)}/tags`
      );

      expect(status).to.equal(200);
      expect(
        sorted(body.data.map(({ id, type }) => ({ id, type })))
      ).to.deep.equal(sorted([ref('tags', tagA), ref('tags', tagB)]));
    });

    it('serves an empty to-many relationship as `[]`', async () => {
      const { status, body } = await request(
        'GET',
        `/posts/${idOf(fixtures.emptyPost)}/comments`
      );

      expect(status).to.equal(200);
      expect(body.data).to.deep.equal([]);
    });

    it("pages, sorts and filters like the related type's index", async () => {
      const { post, commentA, commentB } = fixtures;
      const path = `/posts/${idOf(post)}/comments`;
      const paged = await request('GET', `${path}?page[size]=1&sort=-message`);

      expect(paged.status).to.equal(200);
      // `Second.` sorts before `First.` descending.
      expect(paged.body.data.map(({ id }) => id)).to.deep.equal([
        idOf(commentB)
      ]);
      expect(paged.body.links.next).to.contain('page%5Bnumber%5D=2');
      expect(paged.body.links.last).to.contain('page%5Bnumber%5D=2');
      expect(paged.body.meta).to.deep.equal({ total: 2 });

      const filtered = await request('GET', `${path}?filter[message]=First.`);

      expect(filtered.body.data.map(({ id }) => id)).to.deep.equal([
        idOf(commentA)
      ]);
    });

    it("takes the related type's `include` and `fields`", async () => {
      const { post, author } = fixtures;
      const { status, body } = await request(
        'GET',
        `/posts/${idOf(post)}/comments?include=user&fields[comments]=message`
      );

      expect(status).to.equal(200);
      body.data.forEach(({ attributes }) => {
        expect(attributes).to.have.all.keys(['message']);
      });
      expect(body.included.map(({ id, type }) => ({ id, type }))).to.deep.equal(
        [ref('users', author)]
      );
    });

    it("validates query parameters against the related type's controller", async () => {
      const { post } = fixtures;
      const cases: Array<[string, string]> = [
        [`/posts/${idOf(post)}/comments?page[size]=101`, 'page[size]'],
        [`/posts/${idOf(post)}/comments?sort=nope`, 'sort'],
        // A to-one related resource takes no paging.
        [`/posts/${idOf(post)}/user?page[size]=1`, 'page']
      ];

      for (const [path, parameter] of cases) {
        const { status, body } = await request('GET', path);

        expect(status, path).to.equal(400);
        expect(body.errors[0].source, path).to.deep.equal({ parameter });
      }
    });

    it("serializes with the namespace's serializer", async () => {
      const { post } = fixtures;
      const path = `/admin/posts/${idOf(post)}/user`;
      const { status, body } = await request('GET', path);

      expect(status).to.equal(200);
      expect(body.data.attributes).to.have.all.keys([
        'name',
        'email',
        'created-at'
      ]);
      expect(body.links).to.deep.equal({ self: DOMAIN + path });
    });

    it('responds 404 to a resource that does not exist', async () => {
      const { status } = await request('GET', '/posts/99999999/comments');

      expect(status).to.equal(404);
    });

    it('answers HEAD like GET, without a body', async () => {
      const { status, body } = await request(
        'HEAD',
        `/posts/${idOf(fixtures.post)}/comments`
      );

      expect(status).to.equal(200);
      expect(body).to.equal(undefined);
    });

    it('responds 405 with `Allow` to a write', async () => {
      const { status, res } = await request(
        'POST',
        `/posts/${idOf(fixtures.post)}/comments`,
        { data: [] }
      );

      expect(status).to.equal(405);
      expect(res.headers.get('allow')).to.equal('GET, HEAD, OPTIONS');
    });

    it('serves every `related` link of a resource', async () => {
      const { post } = fixtures;
      const { body } = await request('GET', `/posts/${idOf(post)}`);

      for (const [name, { data, links }] of Object.entries<{
        data: Identifier | Array<Identifier> | null;
        links: { related: string };
      }>(body.data.relationships)) {
        const served = await request('GET', links.related);
        const identifiers = (value: unknown) =>
          sorted(
            (Array.isArray(value) ? value : value ? [value] : []).map(
              ({ id, type }) => ({ id, type })
            )
          );

        expect(links.related, name).to.equal(
          `${DOMAIN}/posts/${idOf(post)}/${name}`
        );
        expect(served.status, name).to.equal(200);
        expect(identifiers(served.body.data), name).to.deep.equal(
          identifiers(data)
        );
      }
    });
  });

  // `members/posts` serializes `comments` and `reactions` as links only.
  describe('`linksOnly` relationships', () => {
    it('are serialized without resource linkage', async () => {
      const { post, author } = fixtures;
      const path = `/members/posts/${idOf(post)}`;
      const { status, body } = await request('GET', path);
      const { relationships } = body.data;

      expect(status).to.equal(200);
      expect(relationships.comments).to.deep.equal({
        links: linksFor(path, 'comments')
      });
      expect(relationships.reactions).to.deep.equal({
        links: linksFor(path, 'reactions')
      });
      expect(relationships.user).to.deep.equal({
        data: ref('users', author),
        links: linksFor(path, 'user')
      });
      expect(relationships.tags.data).to.have.length(2);
    });

    it('skip loading their linkage', async () => {
      const countQueries = async (path: string) => {
        let count = 0;
        const onQuery = () => {
          count += 1;
        };

        store.connection.on('query', onQuery);

        try {
          expect((await request('GET', path)).status).to.equal(200);
        } finally {
          store.connection.removeListener('query', onQuery);
        }

        return count;
      };
      const id = idOf(fixtures.post);

      // One linkage query fewer for each of `comments` and `reactions`.
      expect(await countQueries(`/members/posts/${id}`)).to.equal(
        (await countQueries(`/posts/${id}`)) - 2
      );
    });

    it('can be loaded from their `related` link', async () => {
      const { post, commentA, commentB } = fixtures;
      const { body } = await request('GET', `/members/posts/${idOf(post)}`);
      const related = await request(
        'GET',
        body.data.relationships.comments.links.related
      );

      expect(related.status).to.equal(200);
      expect(
        sorted(related.body.data.map(({ id, type }) => ({ id, type })))
      ).to.deep.equal(
        sorted([ref('comments', commentA), ref('comments', commentB)])
      );
    });

    it('keep their linkage when included', async () => {
      const { post, commentA, commentB } = fixtures;
      const { body } = await request(
        'GET',
        `/members/posts/${idOf(post)}?include=comments`
      );
      const { relationships } = body.data;

      expect(sorted(relationships.comments.data)).to.deep.equal(
        sorted([ref('comments', commentA), ref('comments', commentB)])
      );
      expect(relationships.reactions).not.to.have.property('data');
      expect(body.included).to.have.length(2);
    });

    it('apply to included resources of the namespace', async () => {
      const { post, commentA } = fixtures;
      const { body } = await request(
        'GET',
        `/members/comments/${idOf(commentA)}?include=post`
      );
      const included = body.included.find(
        ({ type, id }) => type === 'posts' && id === idOf(post)
      );

      expect(included.relationships.comments).to.deep.equal({
        links: linksFor(`/members/posts/${idOf(post)}`, 'comments')
      });
    });

    it('apply to every resource of a collection', async () => {
      const { body } = await request('GET', '/members/posts?page[size]=5');

      body.data.forEach(({ relationships }) => {
        expect(relationships.comments).not.to.have.property('data');
        expect(relationships.reactions).not.to.have.property('data');
      });
    });

    it('keep their linkage where they have no related endpoint', () => {
      // Serializers are frozen, so `linksOnly` is shadowed, not assigned.
      const serializer = Object.create(models.get('post')!.serializer, {
        linksOnly: { value: ['comments'] }
      });
      const paths: Array<string> = [];
      const linksOnlyFor = (served: boolean) =>
        Array.from(
          serializer.linksOnlyFor(new Map(), 'members', (path: string) => {
            paths.push(path);
            return served;
          })
        );

      expect(linksOnlyFor(true)).to.deep.equal(['comments']);
      expect(linksOnlyFor(false)).to.deep.equal([]);
      expect(paths[0]).to.equal('/members/posts/:dynamic/comments');
    });
  });
});
