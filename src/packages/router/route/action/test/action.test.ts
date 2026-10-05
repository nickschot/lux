import { it, describe, beforeAll, expect } from 'vitest';

import type Controller from '../../../../controller';
import type { Request, Response } from '../../../../server';
import { getTestApp } from '../../../../../../test/utils/get-test-app';

import { createAction, createPageLinks } from '../index';
import type { Action } from '../index';

const DOMAIN = 'http://localhost:4000';
const RESOURCE = 'posts';

describe('module "router/route/action"', () => {
  describe('#createAction()', () => {
    let result;
    let createRequest;
    let createResponse;

    beforeAll(async () => {
      const { router, controllers } = await getTestApp();

      const controller: Controller = controllers.get('health');
      const action: Action<unknown> = controller.index;

      createRequest = (): Request => ({
        route: router.get('GET:/health'),
        method: 'GET',
        params: {}
      });

      createResponse = (): Response => ({
        stats: []
      });

      result = createAction('custom', action, controller);
    });

    it('returns an array of functions', () => {
      expect(result).to.be.an('array').with.lengthOf(1);
    });

    it('resolves with the expected value', async () => {
      const fn = result.slice().pop();
      const data = await fn(createRequest(), createResponse());

      expect(data).to.equal(204);
    });
  });

  describe('#createAction() for a related route', () => {
    // Plain stand-ins: only their hooks matter here.
    const hook = (name: string) => {
      const fn = (req: { calls: Array<string> }) => {
        req.calls.push(name);
      };

      Reflect.defineProperty(fn, 'name', { value: name });
      return fn;
    };
    const shared = hook('shared');
    const owner = {
      beforeAction: [shared, hook('owner')],
      afterAction: [],
      hasModel: false
    } as unknown as Controller;
    const related = {
      beforeAction: [shared, hook('related')],
      afterAction: []
    } as unknown as Controller;
    const run = async (handlers: Array<Action<unknown>>) => {
      const req = {
        calls: [] as Array<string>,
        route: { controller: owner, action: 'showRelated' }
      };

      for (const handler of handlers.slice(0, -1)) {
        await handler(req as unknown as Request, { stats: [] } as Response);
      }

      return req.calls;
    };

    it("runs the related controller's hooks after the owner's, once each", async () => {
      expect(
        await run(createAction('related', () => 204, owner, related))
      ).to.deep.equal(['shared', 'owner', 'related']);
    });

    it("runs only the owner's hooks for other routes", async () => {
      expect(
        await run(createAction('member', () => 204, owner, related))
      ).to.deep.equal(['shared', 'owner']);
    });
  });

  describe('#createPageLinks()', () => {
    // `search` is the request's raw query string, `params` its validated
    // params (only `page` is read from them).
    const getOptions = ({
      total = 100,
      params = {},
      search = ''
    }: {
      total?: number;
      params?: Record<string, unknown>;
      search?: string;
    } = {}) => ({
      total,
      params,
      search,
      domain: DOMAIN,
      pathname: `/${RESOURCE}`,
      defaultPerPage: 25
    });

    it('works with vanilla params', () => {
      const base = `${DOMAIN}/${RESOURCE}`;

      [1, 2, 3, 4].forEach(number => {
        const opts = getOptions({
          params: {
            page: {
              number
            }
          },
          search: `page[number]=${number}`
        });

        let target = {
          self: `${base}?page%5Bnumber%5D=${number}`,
          first: base,
          last: `${base}?page%5Bnumber%5D=4`,
          prev: `${base}?page%5Bnumber%5D=${number - 1}`,
          next: `${base}?page%5Bnumber%5D=${number + 1}`
        };

        switch (number) {
          case 1:
            target = {
              ...target,
              self: target.first,
              prev: null
            };
            break;

          case 2:
            target = {
              ...target,
              prev: target.first
            };
            break;

          case 4:
            target = {
              ...target,
              next: null
            };
            break;
        }

        expect(createPageLinks(opts)).to.deep.equal(target);
      });
    });

    it('works with a custom size', () => {
      const size = 10;
      const base = `${DOMAIN}/${RESOURCE}?page%5Bsize%5D=${size}`;

      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].forEach(number => {
        const opts = getOptions({
          params: {
            page: {
              size,
              number
            }
          },
          search: `page[size]=${size}&page[number]=${number}`
        });

        let target = {
          self: `${base}&page%5Bnumber%5D=${number}`,
          first: base,
          last: `${base}&page%5Bnumber%5D=10`,
          prev: `${base}&page%5Bnumber%5D=${number - 1}`,
          next: `${base}&page%5Bnumber%5D=${number + 1}`
        };

        switch (number) {
          case 1:
            target = {
              ...target,
              self: target.first,
              prev: null
            };
            break;

          case 2:
            target = {
              ...target,
              prev: target.first
            };
            break;

          case 10:
            target = {
              ...target,
              next: null
            };
            break;
        }

        expect(createPageLinks(opts)).to.deep.equal(target);
      });
    });

    it('works with complex parameter sets', () => {
      const base =
        `${DOMAIN}/${RESOURCE}?sort=-created-at&include=user&fields%5Bposts%5D=` +
        `title&fields%5Busers%5D=name`;

      [1, 2, 3, 4].forEach(number => {
        const opts = getOptions({
          params: {
            sort: '-created-at',
            include: ['user'],
            fields: {
              posts: ['title'],
              users: ['name']
            },
            page: {
              number
            }
          },
          search:
            'sort=-created-at&include=user&fields[posts]=title' +
            `&fields[users]=name&page[number]=${number}`
        });

        let target = {
          self: `${base}&page%5Bnumber%5D=${number}`,
          first: base,
          last: `${base}&page%5Bnumber%5D=4`,
          prev: `${base}&page%5Bnumber%5D=${number - 1}`,
          next: `${base}&page%5Bnumber%5D=${number + 1}`
        };

        switch (number) {
          case 1:
            target = {
              ...target,
              self: target.first,
              prev: null
            };
            break;

          case 2:
            target = {
              ...target,
              prev: target.first
            };
            break;

          case 4:
            target = {
              ...target,
              next: null
            };
            break;
        }

        expect(createPageLinks(opts)).to.deep.equal(target);
      });
    });

    it('works when the total is 0', () => {
      const base = `${DOMAIN}/${RESOURCE}`;
      const opts = getOptions({
        total: 0
      });

      expect(createPageLinks(opts)).to.deep.equal({
        self: base,
        first: base,
        last: base,
        prev: null,
        next: null
      });
    });

    it('works when the maximum page is exceeded', () => {
      const base = `${DOMAIN}/${RESOURCE}`;
      const opts = getOptions({
        params: {
          page: {
            number: 1000
          }
        },
        search: 'page[number]=1000'
      });

      // `self` is the requested page, never `null`.
      expect(createPageLinks(opts)).to.deep.equal({
        self: `${base}?page%5Bnumber%5D=1000`,
        first: base,
        last: `${base}?page%5Bnumber%5D=4`,
        prev: null,
        next: null
      });
    });

    it('keeps the query string as the client wrote it', () => {
      const base = `${DOMAIN}/${RESOURCE}`;
      const opts = getOptions({
        params: {
          page: {
            number: 2
          }
        },
        search: 'page[number]=2&sort=-created-at&include=user,comments'
      });

      // Member names stay dasherized, list commas stay unencoded, and only
      // the page number moves (to the end).
      const query = 'sort=-created-at&include=user,comments';

      expect(createPageLinks(opts)).to.deep.equal({
        self: `${base}?${query}&page%5Bnumber%5D=2`,
        first: `${base}?${query}`,
        last: `${base}?${query}&page%5Bnumber%5D=4`,
        prev: `${base}?${query}`,
        next: `${base}?${query}&page%5Bnumber%5D=3`
      });
    });

    it('accepts a percent-encoded query string', () => {
      const base = `${DOMAIN}/${RESOURCE}`;
      const opts = getOptions({
        params: {
          page: {
            number: 1
          }
        },
        search: 'fields%5Bposts%5D=title&page%5Bnumber%5D=1'
      });

      expect(createPageLinks(opts).self).to.equal(
        `${base}?fields%5Bposts%5D=title`
      );
    });
  });
});
