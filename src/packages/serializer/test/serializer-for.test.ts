import { it, describe, beforeAll, expect } from 'vitest';

import Serializer from '../index';
import type { Model, ModelClass } from '../../database';
import { getTestApp } from '../../../../test/utils/get-test-app';

describe('module "serializer"', () => {
  describe('#serializerFor()', () => {
    let serializers: Map<string, Serializer<Model>>;
    let Comment: ModelClass;

    const get = (key: string) => serializers.get(key) as Serializer<Model>;

    beforeAll(async () => {
      const app = await getTestApp();

      serializers = app.serializers as unknown as Map<
        string,
        Serializer<Model>
      >;
      Comment = app.models.get('comment') as ModelClass;
    });

    it('resolves in the root namespace', () => {
      expect(get('posts').serializerFor(Comment)).to.equal(get('comments'));
    });

    it("resolves in the serializer's own namespace", () => {
      expect(get('admin/posts').serializerFor(Comment)).to.equal(
        get('admin/comments')
      );
    });

    it('falls back to the root serializer when the namespace has none', () => {
      // `admin/posts`, in an application without `admin/comments`.
      const withoutAdminComments = new Map(
        Array.from(serializers).filter(([key]) => key !== 'admin/comments')
      );
      const subject = Object.create(get('admin/posts'), {
        serializers: { value: withoutAdminComments }
      }) as Serializer<Model>;

      expect(subject.serializerFor(Comment)).to.equal(get('comments'));
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
