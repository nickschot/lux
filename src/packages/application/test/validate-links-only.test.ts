import { it, describe, beforeAll, expect } from 'vitest';

import Router from '../../router';
import validateLinksOnly from '../utils/validate-links-only';
import type Controller from '../../controller';
import type Serializer from '../../serializer';
import type { Model } from '../../database';
import { getTestApp } from '../../../../test/utils/get-test-app';

describe('module "application"', () => {
  describe('#validateLinksOnly()', () => {
    let app;
    let controllers: Map<string, Controller>;
    let serializers: Map<string, Serializer<Model>>;

    // The app's serializers with only `key`'s `linksOnly` set (serializers
    // are frozen, so the property is shadowed rather than assigned), and
    // every controller pointing at the copies: they find serializers there.
    const routerFor = (
      key: string,
      linksOnly: Array<string>,
      routes: () => void
    ): [Router, Map<string, Serializer<Model>>] => {
      const copies = new Map(
        Array.from(serializers, ([name, serializer]) => [
          name,
          Object.create(serializer, {
            linksOnly: { value: name === key ? linksOnly : [] }
          }) as Serializer<Model>
        ])
      );
      const copyOf = (serializer: Serializer<Model>) =>
        Array.from(serializers).find(([, s]) => s === serializer)?.[0];
      const copyControllers = new Map(
        Array.from(controllers, ([name, controller]) => [
          name,
          Object.create(controller, {
            serializer: {
              value: copies.get(copyOf(controller.serializer) as string)
            },
            serializerFor: {
              value: (model: never) =>
                copies.get(copyOf(controller.serializerFor(model)) as string)
            }
          }) as Controller
        ])
      );

      return [
        new Router({
          routes,
          controllers: copyControllers,
          controller: copyControllers.get('application') as Controller
        }),
        copies
      ];
    };

    beforeAll(async () => {
      app = await getTestApp();

      controllers = new Map(app.controllers as Map<string, Controller>);
      serializers = new Map(app.serializers as Map<string, Serializer<Model>>);
    });

    it("accepts the test-app's serializers and routes", () => {
      expect(serializers.get('members/posts')?.linksOnly).to.deep.equal([
        'comments',
        'reactions'
      ]);
      expect(() => validateLinksOnly(app.router, serializers)).not.to.throw();
    });

    it('accepts a relationship with a related endpoint', () => {
      const [router, copies] = routerFor('posts', ['comments'], function () {
        this.resource('posts');
        this.resource('comments', { only: ['index'] });
      });

      expect(() => validateLinksOnly(router, copies)).not.to.throw();
    });

    it('rejects a relationship that is not one of its `hasMany`', () => {
      const [router, copies] = routerFor(
        'posts',
        ['user', 'nope'],
        function () {
          this.resource('posts');
        }
      );

      expect(() => validateLinksOnly(router, copies)).to.throw(
        TypeError,
        /posts: `nope` is not one of its `hasMany`\n.*posts: `user` is not/
      );
    });

    // Each removes the related endpoint `/posts/:id/comments`.
    const unserved: Array<[string, () => void]> = [
      [
        'whose type does not route `index`',
        function () {
          this.resource('posts');
          this.resource('comments', { only: ['create'] });
        }
      ],
      [
        'whose type has no resource',
        function () {
          this.resource('posts');
        }
      ],
      [
        'of a type that does not route `show`',
        function () {
          this.resource('posts', { only: ['index'] });
          this.resource('comments');
        }
      ],
      [
        'whose path a custom route takes',
        function () {
          this.resource('posts', function () {
            this.member(function () {
              this.get('comments', 'show');
            });
          });
          this.resource('comments');
        }
      ]
    ];

    unserved.forEach(([description, routes]) => {
      it(`rejects a relationship ${description}`, () => {
        const [router, copies] = routerFor('posts', ['comments'], routes);

        expect(() => validateLinksOnly(router, copies)).to.throw(
          TypeError,
          'posts: `comments` has no related endpoint (GET /posts/:id/comments)'
        );
      });
    });

    it('accepts a related endpoint in any namespace using the serializer', () => {
      // `admin` has no comments serializer, so `admin/comments` uses the root
      // one — routed only there.
      const [router, copies] = routerFor(
        'comments',
        ['reactions'],
        function () {
          this.namespace('admin', function () {
            this.resource('comments');
            this.resource('reactions');
          });
        }
      );

      expect(() => validateLinksOnly(router, copies)).not.to.throw();

      // Without `admin/reactions` routed, nowhere serves it.
      const [unrouted, same] = routerFor(
        'comments',
        ['reactions'],
        function () {
          this.namespace('admin', function () {
            this.resource('comments');
          });
        }
      );

      expect(() => validateLinksOnly(unrouted, same)).to.throw(
        TypeError,
        'comments: `reactions` has no related endpoint'
      );
    });
  });
});
