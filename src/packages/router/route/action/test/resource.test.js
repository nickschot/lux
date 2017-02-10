// @flow
import type Controller from '../../../../controller';
import type { Request } from '../../../../request';
import type { Response } from '../../../../response';
import merge from '../../../../../utils/merge';
import { getTestApp } from '../../../../../../test/utils/get-test-app';

import resource from '../enhancers/resource';

import type { Action } from '../../../index';

const DOMAIN = 'localhost:4000';

describe('module "router/route/action"', () => {
  describe('enhancer resource()', () => {
    const createResponse = (): Response => ({
      stats: []
    });

    const createRequestBuilder = ({ path, route, params }) => (): Request => ({
      route,
      method: 'GET',
      url: {
        protocol: null,
        slashes: null,
        auth: null,
        host: null,
        port: null,
        hostname: null,
        hash: null,
        search: '',
        query: {},
        pathname: path,
        path: path,
        href: path
      },
      params: merge({
        fields: {
          posts: [
            'body',
            'title',
            'createdAt',
            'updatedAt'
          ]
        }
      }, params),
      headers: new Map([
        ['host', DOMAIN]
      ]),
      connection: {
        encrypted: false
      }
    });

    describe('- type "collection"', () => {
      let subject: Action<any>;
      let createRequest;

      beforeAll(async () => {
        const { router, controllers } = await getTestApp();
        const controller: Controller = controllers.get('posts');

        subject = resource(controller.index.bind(controller), controller);
        createRequest = createRequestBuilder({
          path: '/posts',
          route: router.get('GET:/posts'),
          params: {
            sort: 'createdAt',
            filter: {},
            page: {
              size: 25,
              number: 1
            }
          }
        });
      });

      it('returns an enhanced action', () => {
        expect(subject).toEqual(expect.any(Function));
        expect(subject).toHaveLength(2);
      });

      it('resolves with a serialized payload', async () => {
        const request = createRequest();
        const response = createResponse();

        expect(await subject(request, response)).toMatchSnapshot();
      });
    });

    describe('- type "member"', () => {
      describe('- with "root" namespace', () => {
        const path = '/posts/1';
        let subject: Action<any>;
        let createRequest;

        beforeAll(async () => {
          const { router, controllers } = await getTestApp();
          const controller: Controller = controllers.get('posts');

          subject = resource(controller.show.bind(controller), controller);
          createRequest = createRequestBuilder({
            path,
            route: router.get('GET:/posts/:dynamic'),
            params: {
              id: 1
            }
          });
        });

        it('returns an enhanced action', () => {
          expect(subject).toEqual(expect.any(Function));
          expect(subject).toHaveLength(2);
        });

        it('resolves with a serialized payload', async () => {
          const request = createRequest();
          const response = createResponse();

          expect(await subject(request, response)).toMatchSnapshot();
        });
      });

      describe('- with "admin" namespace', () => {
        const path = '/admin/posts/1';
        let subject: Action<any>;
        let createRequest;

        beforeAll(async () => {
          const { router, controllers } = await getTestApp();
          const controller: Controller = controllers.get('admin/posts');

          subject = resource(controller.show.bind(controller), controller);
          createRequest = createRequestBuilder({
            path,
            route: router.get('GET:/admin/posts/:dynamic'),
            params: {
              id: 1
            }
          });
        });

        it('returns an enhanced action', () => {
          expect(subject).toEqual(expect.any(Function));
          expect(subject).toHaveLength(2);
        });

        it('resolves with a serialized payload', async () => {
          const request = createRequest();
          const response = createResponse();

          expect(await subject(request, response)).toMatchSnapshot();
        });
      });

      describe('- with non-model data', () => {
        const path = '/posts/10000';
        let subject: Action<any>;
        let createRequest;

        beforeAll(async () => {
          const { router, controllers } = await getTestApp();
          const controller: Controller = controllers.get('posts');

          subject = resource(() => Promise.resolve(null), controller);
          createRequest = createRequestBuilder({
            path,
            route: router.get('GET:/posts/:dynamic'),
            params: {
              id: 1
            }
          });
        });

        it('returns an enhanced action', () => {
          expect(subject).toEqual(expect.any(Function));
          expect(subject).toHaveLength(2);
        });

        it('resolves with the result of the action', async () => {
          const request = createRequest();
          const response = createResponse();

          expect(await subject(request, response)).toBeNull();
        });
      });
    });
  });
});
