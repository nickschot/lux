import { spy } from 'sinon';
import { it, describe, beforeAll, expect } from 'vitest';

import Controller from '../../../controller';
import { getTestApp } from '../../../../../test/utils/get-test-app';
import {
  createResponse,
  createRequestBuilder
} from '../../../../../test/utils/mocks';

import Route from '../index';

describe('module "router/route"', () => {
  describe('class Route', () => {
    describe('#constructor()', () => {
      let controller: Controller;

      beforeAll(async () => {
        const { controllers } = await getTestApp();

        controller = controllers.get('posts');
      });

      it('creates an instance of route', () => {
        const result = new Route({
          controller,
          type: 'collection',
          path: 'posts',
          action: 'index',
          method: 'GET'
        });

        expect(result).to.be.an.instanceOf(Route);
      });

      it('throws when a handler is not found', () => {
        expect(() => {
          new Route({
            controller,
            type: 'collection',
            path: 'posts',
            action: 'invalidHandler',
            method: 'GET'
          });
        }).to.throw(TypeError);
      });

      it('throws when an an action is not provided', () => {
        expect(() => {
          new Route({
            controller,
            type: 'collection',
            path: 'posts',
            method: 'GET'
          });
        }).to.throw(TypeError);
      });

      it('throws when an an controller is not provided', () => {
        expect(() => {
          new Route({
            type: 'collection',
            path: 'posts',
            action: 'index',
            method: 'GET'
          });
        }).to.throw(TypeError);
      });
    });

    describe('#parseParams()', () => {
      let staticRoute: Route;
      let dynamicRoute: Route;

      beforeAll(async () => {
        const { controllers } = await getTestApp();
        const controller: Controller = controllers.get('posts');

        staticRoute = new Route({
          controller,
          type: 'collection',
          path: 'posts',
          action: 'index',
          method: 'GET'
        });
        dynamicRoute = new Route({
          controller,
          type: 'member',
          path: 'posts/:id',
          action: 'show',
          method: 'GET'
        });
      });

      it('is empty for static paths', () => {
        expect(staticRoute.parseParams(['1'])).to.be.empty;
      });

      it('contains params matching dynamic segments', () => {
        expect(dynamicRoute.parseParams(['1'])).to.deep.equal({ id: 1 });
      });

      it('does not contain params for unmatched dynamic segments', () => {
        expect(dynamicRoute.parseParams(['1', '2'])).to.deep.equal({ id: 1 });
      });
    });

    describe('#execHandlers()', () => {
      let subject: Route;
      let createRequest;

      describe('- with action only', () => {
        beforeAll(async () => {
          class TestController extends Controller {
            index = async () => ({
              meta: {
                success: true
              }
            });
          }

          subject = new Route({
            type: 'collection',
            path: 'tests',
            action: 'index',
            method: 'GET',
            controller: new TestController({
              namespace: ''
            })
          });

          createRequest = createRequestBuilder({
            path: '/tests',
            route: subject,
            params: {}
          });
        });

        it('resolves with the correct data', async () => {
          const result = await subject.execHandlers(
            createRequest(),
            createResponse()
          );

          expect(result).to.deep.equal({
            meta: {
              success: true
            }
          });
        });
      });

      describe('- with `beforeAction`', () => {
        beforeAll(async () => {
          class TestController extends Controller {
            beforeAction = [
              async () => ({
                meta: {
                  beforeSuccess: true
                }
              })
            ];

            index = async () => ({
              meta: {
                success: true
              }
            });
          }

          subject = new Route({
            type: 'collection',
            path: 'tests',
            action: 'index',
            method: 'GET',
            controller: new TestController({
              namespace: ''
            })
          });

          createRequest = createRequestBuilder({
            path: '/tests',
            route: subject,
            params: {}
          });
        });

        it('resolves with the correct data', async () => {
          const result = await subject.execHandlers(
            createRequest(),
            createResponse()
          );

          expect(result).to.deep.equal({
            meta: {
              beforeSuccess: true
            }
          });
        });
      });

      describe('- with `afterAction`', () => {
        beforeAll(async () => {
          class TestController extends Controller {
            index = async () => ({
              meta: {
                success: true,
                afterSuccess: true
              }
            });
          }

          subject = new Route({
            type: 'collection',
            path: 'tests',
            action: 'index',
            method: 'GET',
            controller: new TestController({
              namespace: ''
            })
          });

          createRequest = createRequestBuilder({
            path: '/tests',
            route: subject,
            params: {}
          });
        });

        it('resolves with the correct data', async () => {
          const result = await subject.execHandlers(
            createRequest(),
            createResponse()
          );

          expect(result).to.deep.equal({
            meta: {
              success: true,
              afterSuccess: true
            }
          });
        });
      });

      describe('- with `beforeAction` and `afterAction`', () => {
        let beforeSpy;

        beforeAll(async () => {
          const beforeHooks = {
            call: async () => undefined
          };

          beforeSpy = spy(beforeHooks, 'call');

          class TestController extends Controller {
            beforeAction = [beforeHooks.call];

            afterAction = [
              async (req, res, { meta }) => ({
                meta: {
                  ...meta,
                  afterSuccess: true
                }
              })
            ];

            index = async () => ({
              meta: {
                success: true
              }
            });
          }

          subject = new Route({
            type: 'collection',
            path: 'tests',
            action: 'index',
            method: 'GET',
            controller: new TestController({
              namespace: ''
            })
          });

          createRequest = createRequestBuilder({
            path: '/tests',
            route: subject,
            params: {}
          });
        });

        it('resolves with the correct data', async () => {
          const result = await subject.execHandlers(
            createRequest(),
            createResponse()
          );

          expect(beforeSpy.calledOnce).to.be.true;
          expect(result).to.deep.equal({
            meta: {
              success: true,
              afterSuccess: true
            }
          });
        });
      });
    });

    describe('#visit', () => {
      let controller: Controller;

      beforeAll(async () => {
        const { controllers } = await getTestApp();

        controller = await controllers.get('posts');
      });

      ['GET', 'OPTIONS'].forEach(method => {
        describe(`- method "${method}"`, () => {
          let subject;
          let createRequest;

          beforeAll(async () => {
            subject = new Route({
              method,
              controller,
              type: 'collection',
              path: 'posts',
              action: 'preflight'
            });
          });

          describe('- with params', () => {
            beforeAll(() => {
              createRequest = createRequestBuilder({
                method,
                controller,
                path: '/posts',
                route: subject,
                params: {
                  filter: {
                    title: 'New Post'
                  }
                }
              });
            });

            it('works', async () => {
              const result = await subject.visit(
                createRequest(),
                createResponse()
              );

              expect(result).to.be.ok;
            });
          });

          describe('- without params', () => {
            beforeAll(() => {
              createRequest = createRequestBuilder({
                method,
                path: '/posts',
                route: subject
              });
            });

            it('works', async () => {
              const result = await subject.visit(
                createRequest(),
                createResponse()
              );

              expect(result).to.be.ok;
            });
          });
        });
      });
    });
  });
});
