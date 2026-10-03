import { it, describe, beforeAll, expect } from 'vitest';

import Serializer from '../index';
import type { Model, ModelClass } from '../../database';
import { getTestApp } from '../../../../test/utils/get-test-app';

describe('module "serializer"', () => {
  describe('#serializerFor()', () => {
    let serializers: Map<string, Serializer<Model>>;
    let Comment: ModelClass;
    let User: ModelClass;

    const get = (key: string) => serializers.get(key) as Serializer<Model>;

    beforeAll(async () => {
      const app = await getTestApp();

      serializers = app.serializers as unknown as Map<
        string,
        Serializer<Model>
      >;
      Comment = app.models.get('comment') as ModelClass;
      User = app.models.get('user') as ModelClass;
    });

    it('resolves in the root namespace', () => {
      expect(get('posts').serializerFor(Comment)).to.equal(get('comments'));
    });

    it("resolves in the serializer's own namespace by default", () => {
      expect(get('admin/posts').serializerFor(User)).to.equal(
        get('admin/users')
      );
    });

    it('falls back to the root serializer when the namespace has none', () => {
      // The test-app has no `admin/comments` serializer.
      expect(serializers.has('admin/comments')).to.be.false;
      expect(get('admin/posts').serializerFor(Comment)).to.equal(
        get('comments')
      );
    });

    // Regression: a namespaced controller without its own serializer is given
    // the root one, whose namespace is "". The request's namespace must win,
    // or everything it includes resolves to root serializers.
    it('resolves in an explicitly given namespace', () => {
      expect(get('comments').serializerFor(User, 'admin')).to.equal(
        get('admin/users')
      );
      expect(get('admin/posts').serializerFor(User, '')).to.equal(get('users'));
    });

    it("falls back to the model's serializer outside an application", () => {
      const subject = new Serializer({
        model: Comment,
        parent: null,
        namespace: 'admin'
      });

      expect(subject.serializerFor(Comment)).to.equal(Comment.serializer);
    });
  });
});
