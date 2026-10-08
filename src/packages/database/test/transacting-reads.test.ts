import { it, describe, beforeAll, expect } from 'vitest';

import { getTestApp } from '../../../../test/utils/get-test-app';
import runHooks from '../model/utils/run-hooks';
import type Model from '../model';
import type { ModelClass } from '../interfaces';

// Reads inside a transaction see what it has written. Every test rolls its
// transaction back, so nothing leaks into other suites' fixtures.
describe('module "database" reads in a transaction', () => {
  const ROLLBACK = new Error('rollback');
  let Post: ModelClass;
  let Comment: ModelClass;
  let Image: ModelClass;
  let Tag: ModelClass;
  let Categorization: ModelClass;

  // Run `fn` in a transaction, then roll it back.
  const inRolledBackTransaction = async (
    fn: (trx: unknown) => Promise<void>
  ) => {
    await Post.transaction(async trx => {
      await fn(trx);
      throw ROLLBACK;
    }).catch(err => {
      if (err !== ROLLBACK) {
        throw err;
      }
    });
  };

  const createPost = (trx: unknown) =>
    Post.transacting(trx).create({
      title: 'Written in a transaction',
      body: 'Not committed.',
      isPublic: true
    });

  beforeAll(async () => {
    const { models } = await getTestApp();

    Post = models.get('post') as ModelClass;
    Comment = models.get('comment') as ModelClass;
    Image = models.get('image') as ModelClass;
    Tag = models.get('tag') as ModelClass;
    Categorization = models.get('categorization') as ModelClass;
  });

  it('finds a record the transaction created', async () => {
    let id: unknown;

    await inRolledBackTransaction(async trx => {
      const post = await createPost(trx);

      id = post.getPrimaryKey();

      const found = await Post.transacting(trx).find(id);

      expect(found.getPrimaryKey()).to.equal(id);
      expect((found as unknown as { title: string }).title).to.equal(
        'Written in a transaction'
      );
    });

    // Rolled back: it never existed outside the transaction.
    await expect(Post.find(id)).rejects.toThrow();
  });

  it('binds every query-starting static, scopes included', async () => {
    await inRolledBackTransaction(async trx => {
      const post = await createPost(trx);
      const id = post.getPrimaryKey();
      const bound = Post.transacting(trx);

      expect(await bound.where({ id })).to.have.lengthOf(1);
      expect(await bound.first().where({ id })).to.not.be.undefined;
      expect(await bound.where({ id }).count()).to.equal(1);

      const scoped = (
        bound as unknown as { isPublic(): ReturnType<typeof Post.where> }
      ).isPublic();

      expect(await scoped.where({ id })).to.have.lengthOf(1);
    });
  });

  it('binds a query built another way with Query#transacting', async () => {
    await inRolledBackTransaction(async trx => {
      const post = await createPost(trx);
      const id = post.getPrimaryKey();

      expect(await Post.where({ id }).transacting(trx)).to.have.lengthOf(1);
    });
  });

  it('loads included relationships in the transaction', async () => {
    await inRolledBackTransaction(async trx => {
      const post = await createPost(trx);
      const id = post.getPrimaryKey();

      await Comment.transacting(trx).create({
        postId: id,
        message: 'Also not committed.',
        edited: false
      });

      const found = await Post.transacting(trx).find(id).include('comments');
      const comments = await (
        found as unknown as {
          comments: Promise<Array<unknown>>;
        }
      ).comments;

      expect(comments).to.have.lengthOf(1);
    });
  });

  // A post, with a comment, an image and a tag, all uncommitted.
  const createGraph = async (trx: unknown) => {
    const post = await createPost(trx);
    const postId = post.getPrimaryKey();
    const comment = await Comment.transacting(trx).create({
      postId,
      message: 'Uncommitted comment.',
      edited: false
    });
    const image = await Image.transacting(trx).create({
      postId,
      url: 'https://example.com/uncommitted.png'
    });
    const tag = await Tag.transacting(trx).create({ name: 'uncommitted' });

    await Categorization.transacting(trx).create({
      postId,
      tagId: tag.getPrimaryKey()
    });

    return { post, comment, image, tag };
  };

  const read = (record: Model, key: string) =>
    (record as unknown as Record<string, Promise<unknown>>)[key];

  const idsOf = (records: unknown) =>
    (records as Array<Model>).map(record => record.getPrimaryKey());

  describe('relationship reads on record.transacting(trx)', () => {
    it('reads every kind of relationship in the transaction', async () => {
      await inRolledBackTransaction(async trx => {
        const { post, comment, image, tag } = await createGraph(trx);
        // Fresh records: nothing loaded or cached on them yet.
        const freshPost = await Post.transacting(trx).find(
          post.getPrimaryKey()
        );
        const freshComment = await Comment.transacting(trx).find(
          comment.getPrimaryKey()
        );
        const bound = freshPost.transacting(trx);

        // belongsTo
        const owner = (await read(
          freshComment.transacting(trx),
          'post'
        )) as Model;
        expect(owner.getPrimaryKey()).to.equal(post.getPrimaryKey());

        // hasMany
        expect(idsOf(await read(bound, 'comments'))).to.deep.equal([
          comment.getPrimaryKey()
        ]);

        // hasOne
        const found = (await read(bound, 'image')) as Model;
        expect(found.getPrimaryKey()).to.equal(image.getPrimaryKey());

        // hasMany through a join model
        expect(idsOf(await read(bound, 'tags'))).to.deep.equal([
          tag.getPrimaryKey()
        ]);
      });
    });

    it('reloads in the transaction', async () => {
      await inRolledBackTransaction(async trx => {
        const post = await createPost(trx);
        const reloaded = await post.transacting(trx).reload();

        expect(reloaded.getPrimaryKey()).to.equal(post.getPrimaryKey());
      });
    });
  });

  describe('model hooks', () => {
    it('receive the record bound to the transaction', async () => {
      await inRolledBackTransaction(async trx => {
        const { comment, post } = await createGraph(trx);
        const fresh = await Comment.transacting(trx).find(
          comment.getPrimaryKey()
        );
        let owner: Model | undefined;

        await runHooks(fresh, trx, async record => {
          owner = (await read(record, 'post')) as Model;
        });

        expect(owner?.getPrimaryKey()).to.equal(post.getPrimaryKey());
      });
    });

    it('keep related records in the transaction', async () => {
      await inRolledBackTransaction(async trx => {
        const { comment, image } = await createGraph(trx);
        const fresh = await Comment.transacting(trx).find(
          comment.getPrimaryKey()
        );
        let found: Model | undefined;

        // `image` is not the inverse of `comment.post`, so reading it is a
        // query of its own — not a value the first read already set.
        await runHooks(fresh, trx, async record => {
          const post = (await read(record, 'post')) as Model;

          found = (await read(post, 'image')) as Model;
        });

        expect(found?.getPrimaryKey()).to.equal(image.getPrimaryKey());
      });
    });

    it('write attributes through to the record', async () => {
      await inRolledBackTransaction(async trx => {
        const post = await createPost(trx);

        await runHooks(post, trx, async record => {
          (record as unknown as { title: string }).title = 'Changed by a hook';
        });

        expect((post as unknown as { title: string }).title).to.equal(
          'Changed by a hook'
        );
        expect(post.dirtyAttributes.has('title')).to.be.true;
      });
    });

    it('can update the record within the transaction', async () => {
      await inRolledBackTransaction(async trx => {
        const post = await createPost(trx);

        await runHooks(post, trx, async record => {
          await record.update({ title: 'Updated in a hook' });
        });

        const found = await Post.transacting(trx).find(post.getPrimaryKey());

        expect((found as unknown as { title: string }).title).to.equal(
          'Updated in a hook'
        );
      });
    });
  });
});
