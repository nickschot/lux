import fetch from 'node-fetch';
import { dasherize } from 'inflection';
import { it, describe, beforeAll, afterAll, expect } from 'vitest';

import Server from '../../server';
import type { Model, ModelClass } from '../../database';
import underscore from '../../../utils/underscore';
import { getTestApp } from '../../../../test/utils/get-test-app';
import { getRelated } from '../../../../test/utils/get-related';

// End-to-end coverage of `?include=` through the real router, controllers and
// serializers of the test-app, over HTTP. The seed data is random and shared
// with other suites, so exact assertions only target a fixture graph created
// (and torn down) here; collection responses are checked against invariants
// that hold for any data.

// Bound to an ephemeral port in `beforeAll`, so the suite never collides with
// another listener; `links` are built from the request's host, so they follow.
let DOMAIN = '';

type Identifier = { id: string; type: string };
type Resource = Identifier & {
  attributes?: Record<string, unknown>;
  relationships?: Record<
    string,
    { data: Identifier | Array<Identifier> | null }
  >;
  links?: Record<string, string>;
};
type Document = {
  data: Resource | Array<Resource>;
  included?: Array<Resource>;
  errors?: Array<unknown>;
};

const keyFor = ({ id, type }: Identifier) => `${type}:${id}`;

const identifiersOf = (
  linkage: Identifier | Array<Identifier> | null
): Array<Identifier> => {
  if (!linkage) {
    return [];
  }

  return Array.isArray(linkage) ? linkage : [linkage];
};

const sortIdentifiers = (list: Array<Identifier>) =>
  [...list].sort((a, b) => keyFor(a).localeCompare(keyFor(b)));

async function get(path: string): Promise<{ status: number; body: Document }> {
  const res = await fetch(`${DOMAIN}${path}`, {
    headers: { Accept: 'application/vnd.api+json' }
  });

  return { status: res.status, body: (await res.json()) as Document };
}

/**
 * Invariants every compound document must satisfy (JSON:API 1.0, "Compound
 * Documents"): no resource appears twice, and every included resource is
 * reachable through resource linkage from the primary data (full linkage).
 */
function expectValidCompoundDocument({ data, included = [] }: Document) {
  const primary = Array.isArray(data) ? data : [data];
  const primaryKeys = new Set(primary.map(keyFor));
  const includedKeys = included.map(keyFor);

  expect(new Set(includedKeys).size).to.equal(includedKeys.length);
  includedKeys.forEach(key => expect(primaryKeys.has(key)).to.be.false);

  const linked = new Set<string>();

  [...primary, ...included].forEach(({ relationships = {} }) => {
    Object.values(relationships).forEach(({ data: linkage }) => {
      identifiersOf(linkage).forEach(identifier => {
        linked.add(keyFor(identifier));
      });
    });
  });

  includedKeys.forEach(key => expect(linked.has(key), key).to.be.true);
}

describe('compound documents over HTTP', () => {
  let server;
  let models;
  let store;
  const fixtures: Record<string, Model> = {};
  const created: Array<Model> = [];

  const idOf = (record: Model) => String(record.getPrimaryKey());
  const ref = (type: string, record: Model): Identifier => ({
    id: idOf(record),
    type
  });

  // A relationship object: its linkage, and links to the relationship and
  // related endpoints of the resource at `path` (`/posts/1`).
  const relationship = (path: string, name: string, data: unknown) => ({
    data,
    links: {
      self: `${DOMAIN}${path}/relationships/${name}`,
      related: `${DOMAIN}${path}/${name}`
    }
  });

  const modelFor = (type: string): ModelClass => {
    const model = Array.from(models.values() as Iterable<ModelClass>).find(
      ({ resourceName }) => resourceName === type
    );

    if (!model) {
      throw new Error(`No model for type "${type}".`);
    }

    return model;
  };

  /**
   * The test-app's root visibility rule, restated independently of Lumen's
   * implementation: private posts are hidden outside `admin`.
   */
  const isVisible = (record: Model) =>
    record.resourceName !== 'posts' || Reflect.get(record, 'isPublic') === true;

  /**
   * The oracle: every relationship of every resource — primary data and
   * included alike — must agree with what the model's own lazy relationship
   * getters load from the database, less what the root visibility rule hides
   * (the getters know nothing of requests). Holds for any data, so it also
   * checks collections over the random seed.
   */
  async function expectLinkageMatchesDatabase({
    data,
    included = []
  }: Document) {
    const resources = [
      ...(Array.isArray(data) ? data : data ? [data] : []),
      ...included
    ];

    for (const { id, type, relationships = {} } of resources) {
      const model = modelFor(type);
      const record = await model.find(id);
      const { hasOne, hasMany } = model.serializer;

      for (const name of [...hasOne, ...hasMany]) {
        const key = dasherize(underscore(name));
        const value = await getRelated(record, name);
        const expected = identifiersOf(
          Array.isArray(value)
            ? value.filter(isVisible).map(item => ref(item.resourceName, item))
            : value && isVisible(value)
              ? ref(value.resourceName, value)
              : null
        );

        expect(relationships, `${type}:${id}`).to.have.property(key);
        expect(
          sortIdentifiers(identifiersOf(relationships[key].data)),
          `${type}:${id} ${key}`
        ).to.deep.equal(sortIdentifiers(expected));
      }
    }
  }

  /** Count the SQL queries issued while serving one request. */
  async function countQueries(path: string): Promise<number> {
    let count = 0;
    const onQuery = () => {
      count += 1;
    };

    store.connection.on('query', onQuery);

    try {
      const { status } = await get(path);
      expect(status).to.equal(200);
    } finally {
      store.connection.removeListener('query', onQuery);
    }

    return count;
  }

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

    const User = models.get('user');
    const Post = models.get('post');
    const Tag = models.get('tag');
    const Image = models.get('image');
    const Comment = models.get('comment');
    const Reaction = models.get('reaction');
    const Friendship = models.get('friendship');
    const Categorization = models.get('categorization');

    await Post.transaction(async trx => {
      const create = async (model, attrs) => {
        const record = await model.transacting(trx).create(attrs);
        created.push(record);
        return record;
      };

      const author = await create(User, {
        name: 'Ada Author',
        email: 'ada.author@example.com',
        password: 'password-ada'
      });
      const commenter = await create(User, {
        name: 'Cody Commenter',
        email: 'cody.commenter@example.com',
        password: 'password-cody'
      });

      // author follows commenter
      const friendship = await create(Friendship, {
        followerId: author.getPrimaryKey(),
        followeeId: commenter.getPrimaryKey()
      });

      const post = await create(Post, {
        title: 'Compound documents',
        body: 'A post with every kind of relationship.',
        isPublic: true,
        userId: author.getPrimaryKey()
      });
      const emptyPost = await create(Post, {
        title: 'Lonely post',
        body: 'No relationships at all.',
        isPublic: true
      });

      const postId = post.getPrimaryKey();

      const image = await create(Image, {
        postId,
        url: 'http://example.com/image.png'
      });

      const tagA = await create(Tag, { name: 'compound-a' });
      const tagB = await create(Tag, { name: 'compound-b' });

      for (const tag of [tagA, tagB]) {
        await create(Categorization, { postId, tagId: tag.getPrimaryKey() });
      }

      const commentByCommenter = await create(Comment, {
        postId,
        userId: commenter.getPrimaryKey(),
        message: 'First!'
      });
      const commentByAuthor = await create(Comment, {
        postId,
        userId: author.getPrimaryKey(),
        message: 'Thanks for reading.'
      });

      const postReaction = await create(Reaction, {
        postId,
        userId: commenter.getPrimaryKey(),
        type: ':tada:'
      });
      const commentReaction = await create(Reaction, {
        commentId: commentByCommenter.getPrimaryKey(),
        userId: author.getPrimaryKey(),
        type: ':heart:'
      });

      Object.assign(fixtures, {
        author,
        commenter,
        friendship,
        post,
        emptyPost,
        image,
        tagA,
        tagB,
        commentByCommenter,
        commentByAuthor,
        postReaction,
        commentReaction
      });
    });
  });

  afterAll(async () => {
    server.instance.close();

    const Action = models.get('action');
    const Notification = models.get('notification');

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
      .whereIn('recipient_id', [
        fixtures.author.getPrimaryKey(),
        fixtures.commenter.getPrimaryKey()
      ])
      .del();

    // Reverse creation order destroys dependants before what they point at.
    for (const record of [...created].reverse()) {
      await record.destroy();
    }
  });

  describe('primary data', () => {
    it('serializes the resource linkage of a member', async () => {
      const { post, author, image, tagA, tagB } = fixtures;
      const { status, body } = await get(`/posts/${idOf(post)}`);

      expect(status).to.equal(200);
      expect(body).to.not.have.property('included');

      const data = body.data as Resource;

      expect(data).to.have.all.keys([
        'id',
        'type',
        'attributes',
        'relationships'
      ]);
      expect(data.id).to.equal(idOf(post));
      expect(data.type).to.equal('posts');
      expect(data.attributes).to.have.all.keys([
        'title',
        'body',
        'created-at',
        'updated-at'
      ]);
      expect(data.attributes).to.include({
        title: 'Compound documents',
        body: 'A post with every kind of relationship.'
      });

      const { relationships = {} } = data;

      expect(relationships).to.have.all.keys([
        'user',
        'image',
        'comments',
        'reactions',
        'tags'
      ]);

      const path = `/posts/${idOf(post)}`;

      expect(relationships.user).to.deep.equal(
        relationship(path, 'user', ref('users', author))
      );
      expect(relationships.image).to.deep.equal(
        relationship(path, 'image', ref('images', image))
      );
      expect(relationships.tags).to.have.all.keys(['data', 'links']);
      expect(
        sortIdentifiers(relationships.tags.data as Array<Identifier>)
      ).to.deep.equal(sortIdentifiers([ref('tags', tagA), ref('tags', tagB)]));
      expect(
        sortIdentifiers(relationships.comments.data as Array<Identifier>)
      ).to.deep.equal(
        sortIdentifiers([
          ref('comments', fixtures.commentByCommenter),
          ref('comments', fixtures.commentByAuthor)
        ])
      );
      expect(relationships.reactions.data).to.deep.equal([
        ref('reactions', fixtures.postReaction)
      ]);
    });

    it('serializes empty relationships', async () => {
      const path = `/posts/${idOf(fixtures.emptyPost)}`;
      const { body } = await get(path);
      const { relationships } = body.data as Resource;

      expect(relationships).to.deep.equal({
        user: relationship(path, 'user', null),
        image: relationship(path, 'image', null),
        comments: relationship(path, 'comments', []),
        reactions: relationship(path, 'reactions', []),
        tags: relationship(path, 'tags', [])
      });
    });

    it('is identical with or without `include`', async () => {
      const path = `/posts/${idOf(fixtures.post)}`;
      const [plain, compound] = await Promise.all([
        get(path),
        get(`${path}?include=user,image,comments,reactions,tags`)
      ]);

      expect(compound.body.data).to.deep.equal(plain.body.data);
    });

    it('serializes self-referential has-many-through linkage', async () => {
      const { author, commenter } = fixtures;
      const [authorDoc, commenterDoc] = await Promise.all([
        get(`/users/${idOf(author)}`),
        get(`/users/${idOf(commenter)}`)
      ]);

      const authorRels = (authorDoc.body.data as Resource).relationships || {};
      const commenterRels =
        (commenterDoc.body.data as Resource).relationships || {};

      expect(authorRels.followees.data).to.deep.equal([
        ref('users', commenter)
      ]);
      expect(authorRels.followers.data).to.deep.equal([]);
      expect(commenterRels.followers.data).to.deep.equal([
        ref('users', author)
      ]);
      expect(commenterRels.followees.data).to.deep.equal([]);
    });
  });

  describe('included resources', () => {
    it('includes each requested relationship exactly once', async () => {
      const { post, author, image, tagA, tagB } = fixtures;
      const { status, body } = await get(
        `/posts/${idOf(post)}?include=user,image,comments,reactions,tags`
      );

      expect(status).to.equal(200);
      expectValidCompoundDocument(body);

      expect(
        sortIdentifiers(
          (body.included || []).map(({ id, type }) => ({ id, type }))
        )
      ).to.deep.equal(
        sortIdentifiers([
          ref('users', author),
          ref('images', image),
          ref('tags', tagA),
          ref('tags', tagB),
          ref('comments', fixtures.commentByCommenter),
          ref('comments', fixtures.commentByAuthor),
          ref('reactions', fixtures.postReaction)
        ])
      );
    });

    it('serializes included attributes with their own serializer', async () => {
      const { post, author, image } = fixtures;
      const { body } = await get(
        `/posts/${idOf(post)}?include=user,image,comments`
      );
      const byKey = new Map(
        (body.included || []).map(resource => [keyFor(resource), resource])
      );

      const user = byKey.get(keyFor(ref('users', author)));
      const img = byKey.get(keyFor(ref('images', image)));
      const comment = byKey.get(
        keyFor(ref('comments', fixtures.commentByCommenter))
      );

      expect(user?.attributes).to.deep.equal({
        name: 'Ada Author',
        email: 'ada.author@example.com'
      });
      expect(img?.attributes).to.deep.equal({
        url: 'http://example.com/image.png'
      });
      expect(comment?.attributes).to.have.all.keys([
        'edited',
        'message',
        'created-at',
        'updated-at'
      ]);
      expect(comment?.attributes).to.have.property('message', 'First!');
      expect(user?.links).to.deep.equal({
        self: `${DOMAIN}/users/${idOf(author)}`
      });
    });

    it('rejects an unknown relationship with 400', async () => {
      const { status } = await get(
        `/posts/${idOf(fixtures.post)}?include=nope`
      );

      expect(status).to.equal(400);
    });

    it('produces valid compound documents for collections', async () => {
      const { status, body } = await get(
        '/posts?include=user,comments,tags&page[size]=10'
      );

      expect(status).to.equal(200);
      expect(body.data).to.be.an('array');
      expectValidCompoundDocument(body);
    });
  });

  describe('relationships of included resources', () => {
    it("serializes them with the included resource's serializer", async () => {
      const { post, commenter, commentByCommenter, commentReaction } = fixtures;
      const { body } = await get(`/posts/${idOf(post)}?include=comments`);
      const comment = (body.included || []).find(
        resource =>
          keyFor(resource) === keyFor(ref('comments', commentByCommenter))
      );

      expect(comment).to.have.all.keys([
        'id',
        'type',
        'attributes',
        'relationships',
        'links'
      ]);
      const path = `/comments/${idOf(commentByCommenter)}`;

      expect(comment?.relationships).to.deep.equal({
        post: relationship(path, 'post', ref('posts', post)),
        user: relationship(path, 'user', ref('users', commenter)),
        reactions: relationship(path, 'reactions', [
          ref('reactions', commentReaction)
        ])
      });
    });

    it('serializes empty relationships of included resources', async () => {
      const { post, commentByAuthor } = fixtures;
      const { body } = await get(`/posts/${idOf(post)}?include=comments`);
      const comment = (body.included || []).find(
        resource =>
          keyFor(resource) === keyFor(ref('comments', commentByAuthor))
      );

      expect(comment?.relationships?.reactions).to.deep.equal(
        relationship(`/comments/${idOf(commentByAuthor)}`, 'reactions', [])
      );
    });

    it('serializes has-many-through relationships of included resources', async () => {
      const { post, tagA, tagB } = fixtures;
      const { body } = await get(`/posts/${idOf(post)}?include=tags`);

      [tagA, tagB].forEach(tag => {
        const resource = (body.included || []).find(
          ({ id, type }) => type === 'tags' && id === idOf(tag)
        );

        expect(resource?.relationships).to.deep.equal({
          posts: relationship(`/tags/${idOf(tag)}`, 'posts', [
            ref('posts', post)
          ])
        });
      });
    });

    it('matches the database for every relationship of a member', async () => {
      const { body } = await get(
        `/posts/${idOf(fixtures.post)}?include=user,image,comments,reactions,tags`
      );

      await expectLinkageMatchesDatabase(body);
    });

    it('matches the database for every relationship of a collection', async () => {
      const { body } = await get(
        '/posts?include=user,image,comments,reactions,tags&page[size]=10'
      );

      expectValidCompoundDocument(body);
      await expectLinkageMatchesDatabase(body);
    });

    it('matches the database for self-referential relationships', async () => {
      const { body } = await get(
        '/users?include=followers,followees,comments&page[size]=10'
      );

      expectValidCompoundDocument(body);
      await expectLinkageMatchesDatabase(body);
    });

    it('batch-loads included resources instead of querying per record', async () => {
      // Sequential on purpose: the listener counts every query on the shared
      // connection, so overlapping requests would count each other's.
      const cost = async (query: string) => {
        const few = await countQueries(`/posts?${query}&page[size]=10`);
        const many = await countQueries(`/posts?${query}&page[size]=25`);

        return { few, many };
      };

      // Both page sizes are large enough that every include level is
      // non-empty over the seed — an empty level skips its queries, which is
      // not an N+1.
      const base = await cost('');
      const compound = await cost('include=user,comments,tags,comments.user');

      // Neither primary data nor `include` may cost queries per record.
      expect(base.many).to.equal(base.few);
      expect(compound.many).to.equal(compound.few);
    });
  });

  describe('nested include paths', () => {
    it('applies `fields[type]` at every level the type appears', async () => {
      const { post, author, commenter } = fixtures;
      const { status, body } = await get(
        `/posts/${idOf(post)}?include=user,comments.user&fields[users]=name`
      );

      expect(status).to.equal(200);
      expectValidCompoundDocument(body);

      // The author is reached directly, the commenter only through comments.
      [author, commenter].forEach(user => {
        const resource = (body.included || []).find(
          item => keyFor(item) === keyFor(ref('users', user))
        );

        expect(resource?.attributes).to.have.all.keys(['name']);
      });
    });

    it('includes the intermediate and the leaf resources', async () => {
      const { post, author, commenter, commentByAuthor, commentByCommenter } =
        fixtures;
      const { status, body } = await get(
        `/posts/${idOf(post)}?include=comments.user`
      );

      expect(status).to.equal(200);
      expectValidCompoundDocument(body);
      expect(
        sortIdentifiers(
          (body.included || []).map(({ id, type }) => ({ id, type }))
        )
      ).to.deep.equal(
        sortIdentifiers([
          ref('comments', commentByCommenter),
          ref('comments', commentByAuthor),
          ref('users', commenter),
          ref('users', author)
        ])
      );

      const user = (body.included || []).find(
        resource => keyFor(resource) === keyFor(ref('users', commenter))
      );

      expect(user?.attributes).to.deep.equal({
        name: 'Cody Commenter',
        email: 'cody.commenter@example.com'
      });
      expect(user?.relationships).to.have.all.keys([
        'posts',
        'comments',
        'followees',
        'followers',
        'reactions'
      ]);

      await expectLinkageMatchesDatabase(body);
    });

    it('supports paths three relationships deep', async () => {
      const { post, author, commentReaction } = fixtures;
      const { status, body } = await get(
        `/posts/${idOf(post)}?include=comments.reactions.user`
      );

      expect(status).to.equal(200);
      expectValidCompoundDocument(body);

      const keys = (body.included || []).map(keyFor);

      expect(keys).to.include(keyFor(ref('reactions', commentReaction)));
      expect(keys).to.include(keyFor(ref('users', author)));
    });

    it('does not repeat primary data in `included`', async () => {
      const { author, commenter } = fixtures;
      // author -> followees (commenter) -> followers (author, the primary data)
      const { body } = await get(
        `/users/${idOf(author)}?include=followees.followers`
      );

      expectValidCompoundDocument(body);
      expect((body.included || []).map(keyFor)).to.deep.equal([
        keyFor(ref('users', commenter))
      ]);
    });

    it('matches the database for nested includes of a collection', async () => {
      const { body } = await get(
        '/posts?include=comments.user,comments.reactions,tags.posts&page[size]=5'
      );

      expectValidCompoundDocument(body);
      await expectLinkageMatchesDatabase(body);
    });

    it('rejects an unknown nested relationship with 400', async () => {
      const { status } = await get(
        `/posts/${idOf(fixtures.post)}?include=comments.nope`
      );

      expect(status).to.equal(400);
    });

    it('rejects paths deeper than three relationships with 400', async () => {
      const { status } = await get(
        `/posts/${idOf(fixtures.post)}?include=comments.reactions.user.posts`
      );

      expect(status).to.equal(400);
    });
  });

  // JSON:API 1.0, "Sparse Fieldsets": a fieldset names the fields — attributes
  // and relationships — of every resource of its type in the document.
  describe('sparse fieldsets', () => {
    const findIn = (body: Document, identifier: Identifier) =>
      (body.included || []).find(item => keyFor(item) === keyFor(identifier));

    it('leaves out relationships the fieldset does not name', async () => {
      const { post } = fixtures;
      const { status, body } = await get(
        `/posts/${idOf(post)}?fields[posts]=title`
      );
      const data = body.data as Resource;

      expect(status).to.equal(200);
      expect(data.attributes).to.have.all.keys(['title']);
      expect(data).not.to.have.property('relationships');
    });

    it('keeps the relationships the fieldset names', async () => {
      const { post, author } = fixtures;
      const { status, body } = await get(
        `/posts/${idOf(post)}?fields[posts]=title,user`
      );
      const data = body.data as Resource;

      expect(status).to.equal(200);
      expect(data.attributes).to.have.all.keys(['title']);
      expect(data.relationships).to.have.all.keys(['user']);
      expect(data.relationships?.user.data).to.deep.equal(ref('users', author));
    });

    it('accepts dasherized member names', async () => {
      const { post } = fixtures;
      const { status, body } = await get(
        `/posts/${idOf(post)}?fields[posts]=created-at`
      );

      expect(status).to.equal(200);
      expect((body.data as Resource).attributes).to.have.all.keys([
        'created-at'
      ]);
    });

    it('applies to included resources of the primary type', async () => {
      const { commentByAuthor, commentByCommenter } = fixtures;
      const { status, body } = await get(
        `/comments/${idOf(commentByAuthor)}?include=post.comments` +
          '&fields[comments]=message'
      );
      const included = findIn(body, ref('comments', commentByCommenter));

      expect(status).to.equal(200);
      expect(included?.attributes).to.deep.equal({ message: 'First!' });
      expect(included).not.to.have.property('relationships');
    });

    it('applies to types reached only through a nested include', async () => {
      const { commentByAuthor, tagA } = fixtures;
      const { status, body } = await get(
        `/comments/${idOf(commentByAuthor)}?include=post.tags` +
          '&fields[tags]=name'
      );
      const tag = findIn(body, ref('tags', tagA));

      expect(status).to.equal(200);
      expect(tag?.attributes).to.deep.equal({ name: 'compound-a' });
      expect(tag).not.to.have.property('relationships');
    });

    it('applies several fieldsets at once', async () => {
      const { post, author } = fixtures;
      const { status, body } = await get(
        `/posts/${idOf(post)}?fields[posts]=title,user&fields[users]=name` +
          '&include=user'
      );

      expect(status).to.equal(200);
      expect((body.data as Resource).attributes).to.have.all.keys(['title']);
      expect(findIn(body, ref('users', author))?.attributes).to.deep.equal({
        name: 'Ada Author'
      });
    });

    it('selects no fields with an empty fieldset', async () => {
      const { post, author } = fixtures;
      const { status, body } = await get(
        `/posts/${idOf(post)}?include=user&fields[users]=`
      );
      const user = findIn(body, ref('users', author));

      expect(status).to.equal(200);
      expect(user?.attributes).to.deep.equal({});
      expect(user).not.to.have.property('relationships');
    });

    it('still includes a relationship the fieldset leaves out', async () => {
      const { post, author } = fixtures;
      const { status, body } = await get(
        `/posts/${idOf(post)}?include=user&fields[posts]=title`
      );

      expect(status).to.equal(200);
      expect(body.data).not.to.have.property('relationships');
      expect(findIn(body, ref('users', author))).to.be.ok;
    });

    it('rejects an unknown field of a known type with 400', async () => {
      const { post } = fixtures;
      const { status, body } = await get(
        `/posts/${idOf(post)}?fields[posts]=title,bogus`
      );

      expect(status).to.equal(400);
      expect(body.errors).to.have.lengthOf(1);
      expect(body.errors?.[0]).to.have.nested.property(
        'source.parameter',
        'fields[posts]'
      );
    });

    it('rejects the primary key, which is not a field, with 400', async () => {
      const { post } = fixtures;
      const { status } = await get(`/posts/${idOf(post)}?fields[posts]=id`);

      expect(status).to.equal(400);
    });

    it('ignores fieldsets for types the response cannot contain', async () => {
      const { post } = fixtures;
      const { status } = await get(
        `/posts/${idOf(post)}?fields[bogus]=anything`
      );

      expect(status).to.equal(200);
    });
  });

  describe('namespaces', () => {
    // AdminUsersSerializer adds `createdAt` to UsersSerializer's attributes, so
    // the attributes tell which serializer formatted an included user.
    const byKey = (body: Document) =>
      new Map(
        (body.included || []).map(resource => [keyFor(resource), resource])
      );

    it('serializes included resources with the namespaced serializer', async () => {
      const { post, author, commenter } = fixtures;
      const { status, body } = await get(
        `/admin/posts/${idOf(post)}?include=user,comments.user`
      );

      expect(status).to.equal(200);
      expectValidCompoundDocument(body);

      const included = byKey(body);

      [author, commenter].forEach(user => {
        const resource = included.get(keyFor(ref('users', user)));

        expect(resource?.attributes).to.have.all.keys([
          'name',
          'email',
          'created-at'
        ]);
        expect(resource?.links).to.deep.equal({
          self: `${DOMAIN}/admin/users/${idOf(user)}`
        });
      });
    });

    it('builds every link of included resources in the request namespace', async () => {
      const { post, commenter, commentByCommenter } = fixtures;
      const { body } = await get(`/admin/posts/${idOf(post)}?include=comments`);
      const comment = byKey(body).get(
        keyFor(ref('comments', commentByCommenter))
      );

      expect(comment?.links).to.deep.equal({
        self: `${DOMAIN}/admin/comments/${idOf(commentByCommenter)}`
      });
      const path = `/admin/comments/${idOf(commentByCommenter)}`;

      expect(comment?.relationships?.user).to.deep.equal(
        relationship(path, 'user', ref('users', commenter))
      );
      expect(comment?.relationships?.post).to.deep.equal(
        relationship(path, 'post', ref('posts', post))
      );
    });

    it("accepts the namespaced serializer's attributes in `fields`", async () => {
      const { post, author } = fixtures;
      const { status, body } = await get(
        `/admin/posts/${idOf(post)}?include=user&fields[users]=createdAt`
      );

      expect(status).to.equal(200);
      expect(
        byKey(body).get(keyFor(ref('users', author)))?.attributes
      ).to.have.all.keys(['created-at']);
    });

    // `admin/comments` deliberately has no serializer of its own, so
    // AdminCommentsController falls back to the root CommentsSerializer (whose
    // namespace is ""). The request is still in `admin`, so everything it
    // includes must resolve there — not in the fallback serializer's root.
    describe('from a controller without a namespaced serializer', () => {
      it('resolves included serializers in the request namespace', async () => {
        const { post, author, commenter, commentByCommenter } = fixtures;
        const { status, body } = await get(
          `/admin/comments/${idOf(commentByCommenter)}?include=user,post.user`
        );

        expect(status).to.equal(200);
        expectValidCompoundDocument(body);

        const included = byKey(body);

        [author, commenter].forEach(user => {
          const resource = included.get(keyFor(ref('users', user)));

          expect(resource?.attributes).to.have.all.keys([
            'name',
            'email',
            'created-at'
          ]);
          expect(resource?.links).to.deep.equal({
            self: `${DOMAIN}/admin/users/${idOf(user)}`
          });
        });

        expect(included.get(keyFor(ref('posts', post)))?.links).to.deep.equal({
          self: `${DOMAIN}/admin/posts/${idOf(post)}`
        });
      });

      it("builds the primary resource's links in the request namespace", async () => {
        const { post, commenter, commentByCommenter } = fixtures;
        const { body } = await get(
          `/admin/comments/${idOf(commentByCommenter)}`
        );
        const { relationships } = body.data as Resource;
        const path = `/admin/comments/${idOf(commentByCommenter)}`;

        expect(relationships?.user).to.deep.equal(
          relationship(path, 'user', ref('users', commenter))
        );
        expect(relationships?.post).to.deep.equal(
          relationship(path, 'post', ref('posts', post))
        );
      });

      it('gives included resources only the namespaced relationships', async () => {
        const { commenter, commentByCommenter } = fixtures;
        const { body } = await get(
          `/admin/comments/${idOf(commentByCommenter)}?include=user`
        );

        // AdminUsersSerializer: hasMany = ['posts', 'comments'] — not the root
        // serializer's followees/followers/reactions.
        expect(
          byKey(body).get(keyFor(ref('users', commenter)))?.relationships
        ).to.have.all.keys(['posts', 'comments']);
      });

      it('only allows include paths the namespace exposes', async () => {
        const { commentByCommenter, post } = fixtures;
        const id = idOf(commentByCommenter);

        // `user.followers` exists through UsersSerializer, not through
        // AdminUsersSerializer: allowed publicly, rejected under `/admin` —
        // directly below the fallback serializer and one level further down.
        expect(
          (await get(`/comments/${id}?include=user.followers`)).status
        ).to.equal(200);
        expect(
          (await get(`/admin/comments/${id}?include=user.followers`)).status
        ).to.equal(400);
        expect(
          (
            await get(
              `/admin/posts/${idOf(post)}?include=comments.user.followers`
            )
          ).status
        ).to.equal(400);
        expect(
          (await get(`/admin/comments/${id}?include=user.posts`)).status
        ).to.equal(200);
      });

      it('validates `fields` against the namespaced serializers', async () => {
        const { commenter, commentByCommenter } = fixtures;
        const { status, body } = await get(
          `/admin/comments/${idOf(commentByCommenter)}?include=user&fields[users]=createdAt`
        );

        expect(status).to.equal(200);
        expect(
          byKey(body).get(keyFor(ref('users', commenter)))?.attributes
        ).to.have.all.keys(['created-at']);
      });

      it('loads first-level includes with the namespaced attributes', async () => {
        const { commenter, commentByCommenter } = fixtures;
        const { body } = await get(
          `/admin/comments/${idOf(commentByCommenter)}?include=user`
        );

        expect(byKey(body).get(keyFor(ref('users', commenter)))?.attributes)
          .to.have.property('created-at')
          .that.is.a('string');
      });
    });

    it('keeps using the root serializers outside the namespace', async () => {
      const { post, author } = fixtures;
      const { body } = await get(`/posts/${idOf(post)}?include=user`);
      const user = byKey(body).get(keyFor(ref('users', author)));

      expect(user?.attributes).to.deep.equal({
        name: 'Ada Author',
        email: 'ada.author@example.com'
      });
      expect(user?.links).to.deep.equal({
        self: `${DOMAIN}/users/${idOf(author)}`
      });
    });
  });
});
