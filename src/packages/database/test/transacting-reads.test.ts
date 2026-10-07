import { it, describe, beforeAll, expect } from 'vitest';

import { getTestApp } from '../../../../test/utils/get-test-app';
import type { ModelClass } from '../interfaces';

// Reads inside a transaction see what it has written. Every test rolls its
// transaction back, so nothing leaks into other suites' fixtures.
describe('module "database" reads in a transaction', () => {
  const ROLLBACK = new Error('rollback');
  let Post: ModelClass;
  let Comment: ModelClass;

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
});
