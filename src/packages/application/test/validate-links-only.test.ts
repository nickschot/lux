import { it, describe, beforeAll, expect } from 'vitest';

import validateLinksOnly from '../utils/validate-links-only';
import type Controller from '../../controller';
import type Serializer from '../../serializer';
import type { Model } from '../../database';
import { getTestApp } from '../../../../test/utils/get-test-app';

describe('module "application"', () => {
  describe('#validateLinksOnly()', () => {
    let controllers: Map<string, Controller>;
    let serializers: Map<string, Serializer<Model>>;

    // A copy of the app's serializers with `linksOnly` on `posts` (serializers
    // are frozen, so the property is shadowed rather than assigned).
    const withLinksOnly = (linksOnly: Array<string>) => {
      const copy = new Map(serializers);

      copy.set(
        'posts',
        Object.create(serializers.get('posts') as Serializer<Model>, {
          linksOnly: { value: linksOnly }
        })
      );

      return copy;
    };

    beforeAll(async () => {
      const app = await getTestApp();

      controllers = new Map(app.controllers as Map<string, Controller>);
      serializers = new Map(app.serializers as Map<string, Serializer<Model>>);
    });

    it("accepts the test-app's serializers", () => {
      expect(serializers.get('members/posts')?.linksOnly).to.deep.equal([
        'comments',
        'reactions'
      ]);
      expect(() => validateLinksOnly(controllers, serializers)).not.to.throw();
    });

    it('rejects a relationship that is not one of its `hasMany`', () => {
      expect(() =>
        validateLinksOnly(controllers, withLinksOnly(['user', 'nope']))
      ).to.throw(
        TypeError,
        /posts: `nope` is not one of its `hasMany`\n.*posts: `user` is not/
      );
    });

    it('rejects a relationship whose type has no controller', () => {
      const copy = new Map(controllers);

      copy.delete('comments');

      expect(() =>
        validateLinksOnly(copy, withLinksOnly(['comments']))
      ).to.throw(TypeError, /posts: `comments` has no `comments` controller/);
    });
  });
});
