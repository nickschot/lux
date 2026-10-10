import { it, beforeAll, describe, expect } from 'vitest';

import Route from '../route';
import Router from '../index';
import type Controller from '../../controller';

import { getTestApp } from '../../../../test/utils/get-test-app';

import type { Request } from '../../server';

const CONTROLLER_MISSING_MESSAGE = /Could not resolve controller by name '.+'/;

describe('module "router"', () => {
  describe('class Router', () => {
    let controller: Controller;
    let controllers;

    beforeAll(async () => {
      const app = await getTestApp();

      controllers = app.controllers;

      controller = controllers.get('application');
    });

    describe('- defining a single route', () => {
      it('works as expected', () => {
        const subject = new Router({
          controller,
          controllers,

          routes() {
            this.resource('users', {
              only: ['index']
            });
          }
        });

        expect(subject.has('GET:/users')).to.be.true;
      });
    });

    describe('- defining a complete resource', () => {
      it('works as expected', () => {
        const subject = new Router({
          controller,
          controllers,

          routes() {
            this.resource('posts');
          }
        });

        expect(subject.has('GET:/posts')).to.be.true;
        expect(subject.has('GET:/posts/:dynamic')).to.be.true;
        expect(subject.has('POST:/posts')).to.be.true;
        expect(subject.has('PATCH:/posts/:dynamic')).to.be.true;
        expect(subject.has('DELETE:/posts/:dynamic')).to.be.true;
        expect(subject.has('HEAD:/posts')).to.be.true;
        expect(subject.has('HEAD:/posts/:dynamic')).to.be.true;
        expect(subject.has('OPTIONS:/posts')).to.be.true;
        expect(subject.has('OPTIONS:/posts/:dynamic')).to.be.true;
      });

      it('throws an error when a controller is missing', () => {
        expect(() => {
          new Router({
            controller,
            controllers,

            routes() {
              this.resource('articles');
            }
          });
        }).to.throw(ReferenceError, CONTROLLER_MISSING_MESSAGE);
      });
    });

    describe('- defining a complete namespace', () => {
      it('works as expected', () => {
        const subject = new Router({
          controller,
          controllers,

          routes() {
            this.namespace('admin', function () {
              this.resource('posts');
            });
          }
        });

        expect(subject.has('GET:/admin/posts')).to.be.true;
        expect(subject.has('GET:/admin/posts/:dynamic')).to.be.true;
        expect(subject.has('POST:/admin/posts')).to.be.true;
        expect(subject.has('PATCH:/admin/posts/:dynamic')).to.be.true;
        expect(subject.has('DELETE:/admin/posts/:dynamic')).to.be.true;
        expect(subject.has('HEAD:/admin/posts')).to.be.true;
        expect(subject.has('HEAD:/admin/posts/:dynamic')).to.be.true;
        expect(subject.has('OPTIONS:/admin/posts')).to.be.true;
        expect(subject.has('OPTIONS:/admin/posts/:dynamic')).to.be.true;
      });

      it('throws an error when a controller is missing', () => {
        expect(() => {
          new Router({
            controller,
            controllers,

            routes() {
              this.namespace('v1', function () {
                this.resource('posts');
              });
            }
          });
        }).to.throw(ReferenceError, CONTROLLER_MISSING_MESSAGE);
      });
    });

    describe('- related endpoints', () => {
      it('serve a type only where it routes `index` or `show`', () => {
        const subject = new Router({
          controller,
          controllers,

          routes() {
            this.resource('posts');
            this.resource('comments', { only: ['create'] });
            this.resource('users', { only: ['index'] });
            this.resource('tags', { only: ['index'] });
          }
        });

        // A relationship endpoint needs no route of the related type.
        expect(subject.has('GET:/posts/:dynamic/relationships/comments')).to.be
          .true;
        // `comments` is not listed (create only), `user` needs `show`.
        expect(subject.has('GET:/posts/:dynamic/comments')).to.be.false;
        expect(subject.has('HEAD:/posts/:dynamic/comments')).to.be.false;
        expect(subject.has('OPTIONS:/posts/:dynamic/comments')).to.be.false;
        expect(subject.has('GET:/posts/:dynamic/user')).to.be.false;
        // `tags` routes `index`, enough for a to-many.
        expect(subject.has('GET:/posts/:dynamic/tags')).to.be.true;
        expect(subject.has('HEAD:/posts/:dynamic/tags')).to.be.true;
      });

      it('serve a type only with a controller in the same namespace', () => {
        const subject = new Router({
          controller,
          controllers,

          routes() {
            this.resource('images');
            this.namespace('members', function () {
              this.resource('posts');
            });
          }
        });

        // `members` has no images controller; the root one does not count.
        expect(subject.has('GET:/members/posts/:dynamic/image')).to.be.false;
        expect(subject.has('GET:/members/posts/:dynamic/relationships/image'))
          .to.be.true;
      });
    });

    describe('- the `relationships` option of a resource', () => {
      const routesFor = (relationships?: boolean | Array<string>) =>
        new Router({
          controller,
          controllers,

          routes() {
            this.resource('posts', { relationships });
            this.resource('users');
            this.resource('comments');
          }
        });
      const has = (router: Router, name: string) => ({
        relationship: router.has(`GET:/posts/:dynamic/relationships/${name}`),
        related: router.has(`GET:/posts/:dynamic/${name}`)
      });

      it('routes every exposed relationship by default', () => {
        const subject = routesFor();

        expect(has(subject, 'user')).to.deep.equal({
          relationship: true,
          related: true
        });
        expect(has(subject, 'comments')).to.deep.equal({
          relationship: true,
          related: true
        });
      });

      it('routes none with `false`', () => {
        const subject = routesFor(false);

        expect(subject.has('GET:/posts/:dynamic')).to.be.true;
        ['user', 'image', 'comments', 'reactions', 'tags'].forEach(name => {
          expect(has(subject, name), name).to.deep.equal({
            relationship: false,
            related: false
          });
        });
        expect(subject.has('OPTIONS:/posts/:dynamic/relationships/user')).to.be
          .false;
      });

      it('routes only the ones listed', () => {
        const subject = routesFor(['user']);

        expect(has(subject, 'user')).to.deep.equal({
          relationship: true,
          related: true
        });
        expect(has(subject, 'comments')).to.deep.equal({
          relationship: false,
          related: false
        });
      });

      describe('in a namespace without visibility rules', () => {
        // The test-app declares rules at its root, so every namespace has
        // some: shadow the flag on the posts controller instead.
        const openRoutesFor = (relationships?: boolean | Array<string>) => {
          const posts = controllers.get('posts');
          const open = new Map(controllers);

          open.set(
            'posts',
            Object.create(posts, { hasVisibilityRules: { value: false } })
          );

          return new Router({
            controller,
            controllers: open,

            routes() {
              this.resource('posts', { relationships });
              this.resource('users');
            }
          });
        };

        it('routes none by default', () => {
          const subject = openRoutesFor();

          expect(subject.has('GET:/posts/:dynamic')).to.be.true;
          expect(has(subject, 'user')).to.deep.equal({
            relationship: false,
            related: false
          });
        });

        it('routes them when the resource asks for them', () => {
          expect(has(openRoutesFor(true), 'user')).to.deep.equal({
            relationship: true,
            related: true
          });
          expect(has(openRoutesFor(['user']), 'user')).to.deep.equal({
            relationship: true,
            related: true
          });
        });
      });

      it('rejects a relationship the serializer does not expose', () => {
        expect(() => routesFor(['user', 'nope', 'categorizations'])).to.throw(
          TypeError,
          "The `relationships` of resource '/posts' must be ones its " +
            "Serializer exposes, but 'nope', 'categorizations' are not."
        );
      });
    });

    describe('#match()', () => {
      let subject: Router;

      beforeAll(() => {
        subject = new Router({
          controller,
          controllers,

          routes() {
            this.resource('posts');
          }
        });
      });

      it('can match a route for a request with a dynamic url', () => {
        const req: Request = {
          method: 'GET',
          url: {
            pathname: '/posts/1'
          }
        };

        expect(subject.match(req)).to.be.an.instanceof(Route);
      });

      it('can match a route for a request with a non-dynamic url', () => {
        const req: Request = {
          method: 'GET',
          url: {
            pathname: '/posts'
          }
        };

        expect(subject.match(req)).to.be.an.instanceof(Route);
      });
    });
  });
});
