import { it, describe, beforeAll, expect } from 'vitest';

import validateAttributes from '../utils/validate-attributes';
import type Controller from '../../controller';
import type Serializer from '../../serializer';
import type { Model } from '../../database';
import { getTestApp } from '../../../../test/utils/get-test-app';

describe('module "application"', () => {
  describe('#validateAttributes()', () => {
    let controllers: Map<string, Controller>;
    let serializers: Map<string, Serializer<Model>>;

    // `key`'s instance in `map` with `props` shadowing its own (the app's
    // controllers and serializers are frozen, so nothing is assigned).
    const withProps = <T extends object>(
      map: Map<string, T>,
      key: string,
      props: Record<string, unknown>
    ): Map<string, T> =>
      new Map(
        Array.from(map, ([name, value]) => [
          name,
          name === key
            ? (Object.create(
                value,
                Object.fromEntries(
                  Object.entries(props).map(([prop, v]) => [prop, { value: v }])
                )
              ) as T)
            : value
        ])
      );

    beforeAll(async () => {
      const app = await getTestApp();

      controllers = new Map(app.controllers as Map<string, Controller>);
      serializers = new Map(app.serializers as Map<string, Serializer<Model>>);
    });

    it("accepts the test-app's serializers and controllers", () => {
      expect(() => validateAttributes(controllers, serializers)).not.to.throw();
    });

    it('rejects a serializer attribute that is not a column', () => {
      const copies = withProps(serializers, 'posts', {
        attributes: ['title', 'excerpt']
      });

      expect(() => validateAttributes(controllers, copies))
        .to.throw(TypeError)
        .with.property('message')
        .that.includes(
          'serializers/posts: `attributes` lists `excerpt`, which is not a ' +
            'column of Post (table `posts`)'
        );
    });

    it('rejects a sort or filter name that is not a column', () => {
      const copies = withProps(controllers, 'posts', {
        sort: ['title', 'popularity'],
        filter: ['title', 'author']
      });

      expect(() => validateAttributes(copies, serializers))
        .to.throw(TypeError)
        .with.property('message')
        .that.includes('controllers/posts: `sort` lists `popularity`')
        .and.includes('controllers/posts: `filter` lists `author`');
    });

    it('reports a name once, on the serializer, when sort and filter take it from there', () => {
      const copies = withProps(serializers, 'posts', {
        attributes: ['title', 'excerpt']
      });
      // As at boot: the controller's defaults come from its serializer.
      const controllersCopies = withProps(controllers, 'posts', {
        serializer: copies.get('posts'),
        sort: ['title', 'excerpt'],
        filter: ['title', 'excerpt']
      });

      let message = '';

      try {
        validateAttributes(controllersCopies, copies);
      } catch (err) {
        message = (err as Error).message;
      }

      expect(message.match(/`excerpt`/g)).to.have.length(1);
    });

    it('accepts foreign keys, which are columns too', () => {
      const copies = withProps(controllers, 'posts', {
        filter: ['userId']
      });

      expect(() => validateAttributes(copies, serializers)).not.to.throw();
    });
  });
});
