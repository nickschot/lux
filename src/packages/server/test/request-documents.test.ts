import fetch from 'node-fetch';
import { it, describe, beforeAll, afterAll, expect } from 'vitest';

import Server from '../index';
import type { Model } from '../../database';
import { getTestApp } from '../../../../test/utils/get-test-app';

// JSON:API 1.0 request documents over HTTP, through the test-app's real
// routes: the members a document may carry, resource linkage validation, and
// values reaching the database exactly as sent. Writes only touch a fixture
// graph created (and torn down) here — other suites count the seeded rows.

const JSONAPI = 'application/vnd.api+json';

type ErrorObject = { status: string; source?: Record<string, string> };
type Document = {
  data?: {
    id: string;
    type: string;
    attributes?: Record<string, unknown>;
    relationships?: Record<string, { data: unknown }>;
  };
  errors?: Array<ErrorObject>;
};

let DOMAIN = '';

async function request(
  method: string,
  path: string,
  body?: unknown
): Promise<{ status: number; body: Document }> {
  const res = await fetch(`${DOMAIN}${path}`, {
    method,
    headers: { Accept: JSONAPI, 'Content-Type': JSONAPI },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await res.text();

  return { status: res.status, body: text ? JSON.parse(text) : {} };
}

describe('request documents over HTTP', () => {
  let server;
  let models;
  const created: Array<Model> = [];
  const fixtures: Record<string, Model> = {};
  const idOf = (record: Model) => String(record.getPrimaryKey());

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

    const User = models.get('user');
    const Post = models.get('post');
    const Comment = models.get('comment');
    const Tag = models.get('tag');
    const Categorization = models.get('categorization');

    await Post.transaction(async trx => {
      const create = async (model, attrs) => {
        const record = await model.transacting(trx).create(attrs);
        created.push(record);
        return record;
      };

      const author = await create(User, {
        name: 'Request Documents',
        email: 'request.documents@example.com',
        password: 'password-request-documents'
      });
      const post = await create(Post, {
        title: 'Mixed Case Title',
        body: 'Filtered by its exact title.',
        isPublic: true,
        userId: author.getPrimaryKey()
      });
      const otherPost = await create(Post, {
        title: 'Another post',
        body: 'Receives moved comments.',
        isPublic: true,
        userId: author.getPrimaryKey()
      });
      const comment = await create(Comment, {
        postId: post.getPrimaryKey(),
        userId: author.getPrimaryKey(),
        message: 'Move me.'
      });

      const [keptTag, droppedTag, addedTag] = await Promise.all(
        ['kept', 'dropped', 'added'].map(name =>
          create(Tag, { name: `request-documents-${name}` })
        )
      );

      for (const tag of [keptTag, droppedTag]) {
        await create(Categorization, {
          postId: post.getPrimaryKey(),
          tagId: tag.getPrimaryKey()
        });
      }

      Object.assign(fixtures, {
        author,
        post,
        otherPost,
        comment,
        keptTag,
        droppedTag,
        addedTag
      });
    });
  });

  afterAll(async () => {
    server.instance.close();

    const Action = models.get('action');
    const Notification = models.get('notification');

    // The test-app's hooks track created posts/comments as Actions (and
    // notify the owner), so remove those side effects as well.
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

    // Join rows written through the API, not created above.
    await models
      .get('categorization')
      .table()
      .whereIn(
        'post_id',
        created
          .filter(record => record.resourceName === 'posts')
          .map(record => record.getPrimaryKey())
      )
      .del();

    for (const record of [...created].reverse()) {
      await record.destroy();
    }
  });

  // Create a tag and register it for teardown.
  async function createTag(body: unknown) {
    const res = await request('POST', '/tags', body);

    if (res.status === 201 && res.body.data) {
      created.push(await models.get('tag').find(res.body.data.id));
    }

    return res;
  }

  describe('optional members', () => {
    it('accepts `meta`, `links` and `jsonapi` in a document', async () => {
      const { status } = await createTag({
        data: {
          type: 'tags',
          attributes: { name: 'request-documents-meta' },
          meta: { client: 'test' },
          links: { self: 'http://example.com' }
        },
        meta: { requestId: 'abc' },
        jsonapi: { version: '1.0' }
      });

      expect(status).to.equal(201);
    });

    it('accepts `meta` in a relationship object', async () => {
      const { comment, post } = fixtures;
      const { status } = await request('PATCH', `/comments/${idOf(comment)}`, {
        data: {
          id: idOf(comment),
          type: 'comments',
          relationships: {
            post: {
              data: { id: idOf(post), type: 'posts' },
              meta: { reason: 'test' }
            }
          }
        }
      });

      expect(status).to.be.oneOf([200, 204]);
    });

    it('still rejects a member the spec does not define', async () => {
      const { status, body } = await createTag({
        data: { type: 'tags', attributes: { name: 'x' } },
        bogus: true
      });

      expect(status).to.equal(400);
      expect(body.errors?.[0].source).to.deep.equal({ parameter: 'bogus' });
    });
  });

  describe('to-many resource linkage', () => {
    const patchComments = (data: unknown) => {
      const { otherPost } = fixtures;

      return request('PATCH', `/admin/posts/${idOf(otherPost)}`, {
        data: {
          id: idOf(otherPost),
          type: 'posts',
          relationships: { comments: { data } }
        }
      });
    };

    const pointerOf = (body: Document) => body.errors?.[0].source?.pointer;

    it('replaces the relationship given string ids', async () => {
      const { comment, otherPost } = fixtures;
      const { status, body } = await patchComments([
        { id: idOf(comment), type: 'comments' }
      ]);

      expect(status).to.equal(200);
      expect(body.data?.relationships?.comments.data).to.deep.equal([
        { id: idOf(comment), type: 'comments' }
      ]);

      const moved = await models.get('comment').find(idOf(comment));

      expect(String(moved.postId)).to.equal(idOf(otherPost));
    });

    it('rejects an identifier of the wrong type with 400', async () => {
      const { comment } = fixtures;
      const { status, body } = await patchComments([
        { id: idOf(comment), type: 'users' }
      ]);

      expect(status).to.equal(400);
      expect(pointerOf(body)).to.equal(
        '/data/relationships/comments/data/0/type'
      );
    });

    it('rejects an identifier without an id with 400', async () => {
      const { comment } = fixtures;
      const { status, body } = await patchComments([
        { id: idOf(comment), type: 'comments' },
        { type: 'comments' }
      ]);

      expect(status).to.equal(400);
      expect(pointerOf(body)).to.equal(
        '/data/relationships/comments/data/1/id'
      );
    });

    it('rejects an element that is not an identifier with 400', async () => {
      for (const element of ['x', null, 5]) {
        const { status, body } = await patchComments([element]);

        expect(status, String(element)).to.equal(400);
        expect(pointerOf(body), String(element)).to.equal(
          '/data/relationships/comments/data/0'
        );
      }
    });

    it('reports every invalid element', async () => {
      const { status, body } = await patchComments(['x', { type: 'comments' }]);

      expect(status).to.equal(400);
      expect(body.errors?.map(({ source }) => source?.pointer)).to.have.members(
        [
          '/data/relationships/comments/data/0',
          '/data/relationships/comments/data/1/id'
        ]
      );
    });

    it('rejects linkage that is not an array with 400', async () => {
      const { comment } = fixtures;
      const { status, body } = await patchComments({
        id: idOf(comment),
        type: 'comments'
      });

      expect(status).to.equal(400);
      expect(pointerOf(body)).to.equal('/data/relationships/comments/data');
    });
  });

  // Members the model has but `params` does not list. By default attributes
  // are dropped (ember-data sends read-only ones back) and relationships are
  // a 403; `/admin/posts` flips both. See nickschot/lux#47.
  describe('members the controller does not accept', () => {
    const commentsOf = async post =>
      (await models.get('comment').where({ postId: post.getPrimaryKey() }))
        .map(comment => idOf(comment))
        .sort();

    const patchCreatedAt = (path: string, id: string) =>
      request('PATCH', `${path}/${id}`, {
        data: {
          id,
          type: 'posts',
          attributes: {
            title: 'Renamed',
            'created-at': '2000-01-01T00:00:00.000Z'
          }
        }
      });

    it('ignores an attribute the model has by default', async () => {
      const { otherPost } = fixtures;
      const before = await models.get('post').find(idOf(otherPost));
      const { status, body } = await patchCreatedAt('/posts', idOf(otherPost));
      const after = await models.get('post').find(idOf(otherPost));

      expect(status).to.equal(200);
      expect(body.data?.attributes?.title).to.equal('Renamed');
      expect(after.createdAt.valueOf()).to.equal(before.createdAt.valueOf());
    });

    it('rejects it with 403 under `rejectUnlistedAttributes`', async () => {
      const { otherPost } = fixtures;
      const before = await models.get('post').find(idOf(otherPost));
      const { status, body } = await patchCreatedAt(
        '/admin/posts',
        idOf(otherPost)
      );
      const after = await models.get('post').find(idOf(otherPost));

      expect(status).to.equal(403);
      expect(body.errors?.[0].source).to.deep.equal({
        pointer: '/data/attributes/created-at'
      });
      expect(after.title).to.equal(before.title);
      expect(after.createdAt.valueOf()).to.equal(before.createdAt.valueOf());
    });

    it('rejects a relationship the model has with 403 by default', async () => {
      const { post } = fixtures;
      const before = await commentsOf(post);

      // `/posts` does not accept `comments` (only `/admin/posts` does).
      const { status, body } = await request('PATCH', `/posts/${idOf(post)}`, {
        data: {
          id: idOf(post),
          type: 'posts',
          relationships: { comments: { data: [] } }
        }
      });

      expect(status).to.equal(403);
      expect(body.errors?.[0].source).to.deep.equal({
        pointer: '/data/relationships/comments'
      });
      expect(await commentsOf(post)).to.deep.equal(before);
    });

    it('ignores it when `rejectUnlistedRelationships` is off', async () => {
      const { post } = fixtures;
      const reactionsOf = async () =>
        (await models.get('reaction').where({ postId: post.getPrimaryKey() }))
          .map(reaction => idOf(reaction))
          .sort();
      const before = await reactionsOf();

      // `/admin/posts` does not accept `reactions`.
      const { status } = await request('PATCH', `/admin/posts/${idOf(post)}`, {
        data: {
          id: idOf(post),
          type: 'posts',
          relationships: { reactions: { data: [] } }
        }
      });

      expect(status).to.be.oneOf([200, 204]);
      expect(await reactionsOf()).to.deep.equal(before);
    });

    it('still rejects a member the model does not have with 400', async () => {
      const { post } = fixtures;

      for (const path of ['/posts', '/admin/posts']) {
        const { status, body } = await request(
          'PATCH',
          `${path}/${idOf(post)}`,
          {
            data: {
              id: idOf(post),
              type: 'posts',
              attributes: { nope: true }
            }
          }
        );

        expect(status, path).to.equal(400);
        expect(body.errors?.[0].source, path).to.deep.equal({
          pointer: '/data/attributes/nope'
        });
      }
    });

    it('reports a 403 alongside a 400, answering 400', async () => {
      const { post } = fixtures;
      const before = await commentsOf(post);
      const { status, body } = await request('PATCH', `/posts/${idOf(post)}`, {
        data: {
          id: idOf(post),
          type: 'posts',
          attributes: { nope: true },
          relationships: { comments: { data: [] } }
        }
      });

      expect(status).to.equal(400);
      expect(
        body.errors?.map(({ status, source }) => [status, source.pointer])
      ).to.have.deep.members([
        ['400', '/data/attributes/nope'],
        ['403', '/data/relationships/comments']
      ]);
      expect(await commentsOf(post)).to.deep.equal(before);
    });
  });

  describe('to-many resource linkage through a join model', () => {
    const tagIdsOf = async (post: Model) => {
      const rows = await models
        .get('categorization')
        .select('tagId')
        .where({ postId: post.getPrimaryKey() });

      return rows.map(row => String(Reflect.get(row, 'tagId'))).sort();
    };

    const patchTags = (data: unknown) => {
      const { post } = fixtures;

      return request('PATCH', `/admin/posts/${idOf(post)}`, {
        data: {
          id: idOf(post),
          type: 'posts',
          relationships: { tags: { data } }
        }
      });
    };

    it('replaces the join rows, keeping the ones that stay', async () => {
      const { post, keptTag, addedTag } = fixtures;
      const keptRow = async () =>
        (
          await models.get('categorization').first().where({
            postId: post.getPrimaryKey(),
            tagId: keptTag.getPrimaryKey()
          })
        )?.getPrimaryKey();
      const keptRowId = await keptRow();
      const expected = [idOf(keptTag), idOf(addedTag)].sort();
      const { status, body } = await patchTags(
        expected.map(id => ({ id, type: 'tags' }))
      );

      expect(status).to.equal(200);
      expect(
        (body.data?.relationships?.tags.data as Array<{ id: string }>)
          .map(({ id }) => id)
          .sort()
      ).to.deep.equal(expected);
      expect(await tagIdsOf(post)).to.deep.equal(expected);
      expect(await keptRow()).to.equal(keptRowId);
    });

    it('creates the join rows of a new resource', async () => {
      const { author, keptTag } = fixtures;
      const { status, body } = await request('POST', '/admin/posts', {
        data: {
          type: 'posts',
          attributes: { title: 'Tagged on create', body: 'x', isPublic: true },
          relationships: {
            user: { data: { id: idOf(author), type: 'users' } },
            tags: { data: [{ id: idOf(keptTag), type: 'tags' }] }
          }
        }
      });
      const post = await models.get('post').find(body.data?.id);

      created.push(post);

      expect(status).to.equal(201);
      expect(await tagIdsOf(post)).to.deep.equal([idOf(keptTag)]);
    });

    it('clears the join rows with an empty array', async () => {
      const { post } = fixtures;
      const { status } = await patchTags([]);

      expect(status).to.equal(200);
      expect(await tagIdsOf(post)).to.deep.equal([]);
    });
  });

  describe('values', () => {
    it('stores a string attribute exactly as sent', async () => {
      // Used to be turned into a Date, failing the string column's type.
      const name = '2020-01-01T00:00:00.000Z';
      const { status, body } = await createTag({
        data: { type: 'tags', attributes: { name } }
      });

      expect(status).to.equal(201);
      expect(body.data?.attributes).to.deep.equal({ name });
    });

    it('filters on a value as written', async () => {
      // A comma-separated filter matches any of its values; they used to be
      // camelized (`Mixed Case Title` -> `mixed Case Title`) too.
      const { post } = fixtures;
      const res = await fetch(
        `${DOMAIN}/posts?filter[title]=Mixed Case Title,No Such Title`
      );
      const { data } = await res.json();

      expect(res.status).to.equal(200);
      expect(data.map(({ id }) => id)).to.deep.equal([idOf(post)]);
    });
  });
});
