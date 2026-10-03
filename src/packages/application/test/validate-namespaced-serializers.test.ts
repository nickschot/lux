import { it, describe, beforeAll, expect } from 'vitest';

import validateNamespacedSerializers from '../utils/validate-namespaced-serializers';
import type Controller from '../../controller';
import type Serializer from '../../serializer';
import type { Model } from '../../database';
import { getTestApp } from '../../../../test/utils/get-test-app';

describe('module "application"', () => {
  describe('#validateNamespacedSerializers()', () => {
    let controllers: Map<string, Controller>;
    let serializers: Map<string, Serializer<Model>>;

    // A copy of the app's controllers with `serializerFallback = false` on the
    // admin namespace's ApplicationController (controllers are frozen, so the
    // property is shadowed rather than assigned).
    const strictAdmin = () => {
      const copy = new Map(controllers);

      copy.set(
        'admin/application',
        Object.create(controllers.get('admin/application') as Controller, {
          serializerFallback: { value: false }
        })
      );

      return copy;
    };

    const errorFor = (fn: () => void): Error => {
      try {
        fn();
      } catch (err) {
        return err as Error;
      }

      throw new Error('Expected a NamespacedSerializerMissingError.');
    };

    beforeAll(async () => {
      const app = await getTestApp();

      controllers = new Map(app.controllers as Map<string, Controller>);
      serializers = new Map(app.serializers as Map<string, Serializer<Model>>);
    });

    it('allows fallback by default', () => {
      expect(controllers.get('admin/application')?.serializerFallback).to.be
        .true;
      expect(() =>
        validateNamespacedSerializers(controllers, serializers)
      ).not.to.throw();
    });

    it('rejects a strict namespace missing a serializer', () => {
      // The test-app has no `admin/comments` serializer.
      const err = errorFor(() =>
        validateNamespacedSerializers(strictAdmin(), serializers)
      );

      expect(err.name).to.equal('ReferenceError');
      expect(err.message).to.contain('admin/comments (reached from ');
      // Only the gap is listed, not the types that do have a serializer.
      expect(err.message).not.to.contain('admin/users ');
      expect(err.message).not.to.contain('admin/posts ');
    });

    it('reports a type through its own controller when it has one', () => {
      // `admin/comments` is also reachable through other controllers' include
      // paths, but AdminCommentsController itself is the most direct reason.
      const err = errorFor(() =>
        validateNamespacedSerializers(strictAdmin(), serializers)
      );

      expect(err.message).to.contain(
        'admin/comments (reached from admin/comments)'
      );
    });

    it('accepts a strict namespace with every serializer it needs', () => {
      const complete = new Map(serializers);

      complete.set(
        'admin/comments',
        serializers.get('comments') as Serializer<Model>
      );

      expect(() =>
        validateNamespacedSerializers(strictAdmin(), complete)
      ).not.to.throw();
    });

    it("checks included types, not only each controller's own", () => {
      // Remove a serializer only reachable through `include` from admin
      // controllers whose own serializers exist (e.g. tags via posts.tags).
      const complete = new Map(serializers);

      complete.set(
        'admin/comments',
        serializers.get('comments') as Serializer<Model>
      );
      complete.delete('admin/tags');

      const onlyPosts = new Map(
        Array.from(strictAdmin()).filter(
          ([key]) =>
            !key.startsWith('admin/') ||
            key === 'admin/application' ||
            key === 'admin/posts'
        )
      );

      const err = errorFor(() =>
        validateNamespacedSerializers(onlyPosts, complete)
      );

      expect(err.message).to.contain(
        'admin/tags (reached from admin/posts?include=tags)'
      );
    });
  });
});
