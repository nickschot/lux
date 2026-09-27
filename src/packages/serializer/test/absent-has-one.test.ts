import fetch from 'node-fetch';
import { it, beforeAll, afterAll, describe, expect } from 'vitest';

import Server from '../../server';

import { getTestApp } from '../../../../test/utils/get-test-app';

const PORT = 4101;
const DOMAIN = `http://localhost:${PORT}`;

describe('module "serializer"', () => {
  describe('absent has-one relationships', () => {
    let server;
    let store;

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
    });

    it('does not query per record for posts without an image', async () => {
      const small = await countQueries('/posts?page[size]=2');
      const large = await countQueries('/posts?page[size]=25');

      expect(large).to.equal(small);
    });

    it('answers an eager-loaded absent image without a query or a change', async () => {
      const app = await getTestApp();
      const Post = app.models.get('post');
      const posts = await Post.select('id')
        .include({ image: ['id'] })
        .limit(25);
      const post = posts.find(record => record.absentRelationships.size);
      let count = 0;
      const onQuery = () => {
        count += 1;
      };

      expect(post).to.be.ok;

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
      const res = await fetch(`${DOMAIN}/posts?page[size]=25`);
      const { data } = await res.json();
      const imageData = data.map(
        ({ relationships }) => relationships?.image?.data
      );

      expect(imageData).to.include(null);
    });
  });
});
