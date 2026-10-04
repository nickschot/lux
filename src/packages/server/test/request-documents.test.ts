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

      Object.assign(fixtures, { author, post, otherPost, comment });
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
