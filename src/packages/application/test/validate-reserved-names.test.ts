import { it, describe, beforeAll, expect } from 'vitest';

import validateReservedNames from '../utils/validate-reserved-names';
import type Logger from '../../logger';
import type Serializer from '../../serializer';
import type { Model } from '../../database';
import { getTestApp } from '../../../../test/utils/get-test-app';

describe('module "application"', () => {
  describe('#validateReservedNames()', () => {
    let serializers: Map<string, Serializer<Model>>;
    let warnings: Array<string>;
    let logger: Logger;

    // `key`'s instance in `serializers` with `props` shadowing its own (the
    // app's serializers are frozen, so nothing is assigned).
    const withProps = (key: string, props: Record<string, unknown>) =>
      new Map(
        Array.from(serializers, ([name, value]) => [
          name,
          name === key
            ? (Object.create(
                value,
                Object.fromEntries(
                  Object.entries(props).map(([prop, v]) => [prop, { value: v }])
                )
              ) as Serializer<Model>)
            : value
        ])
      );

    beforeAll(async () => {
      const app = await getTestApp();

      serializers = new Map(app.serializers as Map<string, Serializer<Model>>);
    });

    const check = (map: Map<string, Serializer<Model>>) => {
      warnings = [];
      logger = { warn: (text: string) => warnings.push(text) } as never;

      validateReservedNames(map, logger);
    };

    it('warns about a serializer that opts out, and boots', () => {
      // The test-app's reactions keep a `type` attribute with the opt-out
      // (`admin/reactions` inherits it).
      expect(() => check(serializers)).not.to.throw();
      expect(warnings).to.have.length(2);
      expect(warnings.join('\n'))
        .to.include('serializers/reactions: `attributes` lists `type`')
        .and.include('serializers/admin/reactions');
    });

    it('refuses to boot without the opt-out, naming every field', () => {
      const copies = withProps('posts', {
        attributes: ['title', 'type'],
        hasOne: ['user', 'id']
      });

      expect(() => check(copies))
        .to.throw(TypeError)
        .with.property('message')
        .that.includes('serializers/posts: `attributes` lists `type`')
        .and.includes('serializers/posts: `hasOne` lists `id`')
        .and.includes('allowReservedNames = true');
    });

    it('names only the serializers that list a reserved name', () => {
      const copies = withProps('reactions', { allowReservedNames: false });

      expect(() => check(copies))
        .to.throw(TypeError)
        .with.property('message')
        .that.includes('serializers/reactions')
        .and.not.includes('serializers/posts');
    });
  });
});
