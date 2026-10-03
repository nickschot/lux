import fetch from 'node-fetch';
import { it, beforeAll, afterAll, describe, expect } from 'vitest';

import Server from '../../server';

import { getTestApp } from '../../../../test/utils/get-test-app';

const PORT = 4101;
const DOMAIN = `http://localhost:${PORT}`;
const FIXTURE_TITLE = 'absent-has-one fixture';

describe('module "serializer"', () => {
  describe('absent has-one relationships', () => {
    let server;
    let store;
    let Post;
    let postId;

    // Counts the SQL statements issued while serving one request. Callers must
    // await each count before starting the next one, since the listener sees
    // every query on the shared connection.
    const countQueries = async (path: string) => {
      let count = 0;
      const onQuery = () => {
        count += 1;
      };

      store.connection.on('query', onQuery);

      try {
        const res = await fetch(`${DOMAIN}${path}`);

        expect(res.status).to.equal(200);
        await res.json();
      } finally {
        store.connection.removeListener('query', onQuery);
      }

      return count;
    };

    beforeAll(async () => {
      const app = await getTestApp();
      const { logger, router } = app;

      store = app.store;
      Post = app.models.get('post');

      // A post that is known to have no image. Inserted through knex rather
      // than `Post.create()` so no hooks run and nothing else needs cleanup.
      // The seed assigns images at random, so it cannot be relied on for this.
      const now = new Date();

      await store.connection('posts').insert({
        title: FIXTURE_TITLE,
        created_at: now,
        updated_at: now
      });

      [{ id: postId }] = await store
        .connection('posts')
        .select('id')
        .where({ title: FIXTURE_TITLE });

      server = new Server({
        logger,
        router,
        cors: {
          enabled: false
        }
      });

      await new Promise<void>(resolve => server.instance.listen(PORT, resolve));
    });

    afterAll(async () => {
      await new Promise(resolve => server.instance.close(resolve));
      await store.connection('posts').where({ title: FIXTURE_TITLE }).del();
    });

    it('does not query per record for posts without an image', async () => {
      const small = await countQueries('/posts?page[size]=2');
      const large = await countQueries('/posts?page[size]=25');

      expect(large).to.equal(small);
    });

    it('answers an eager-loaded absent image without a query or a change', async () => {
      const [post] = await Post.select('id')
        .include({ image: ['id'] })
        .where({ id: postId });
      let count = 0;
      const onQuery = () => {
        count += 1;
      };

      expect(Array.from(post.absentRelationships)).to.deep.equal(['image']);

      store.connection.on('query', onQuery);

      try {
        expect(await post.image).to.equal(null);
      } finally {
        store.connection.removeListener('query', onQuery);
      }

      expect(count).to.equal(0);
      expect(post.isDirty).to.equal(false);
      expect(post.changeSets).to.have.length(1);
    });

    it('still serializes the absent image as null', async () => {
      const res = await fetch(`${DOMAIN}/posts/${postId}`);
      const { data } = await res.json();

      expect(data.relationships.image).to.have.property('data', null);
    });
  });
});
