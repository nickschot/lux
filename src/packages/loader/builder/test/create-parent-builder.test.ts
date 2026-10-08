import { posix } from 'path';

import { describe, it, beforeEach, expect } from 'vitest';

import Controller from '../../../controller';
import Serializer from '../../../serializer';
import { FreezeableMap } from '../../../freezeable';
import createParentBuilder from '../utils/create-parent-builder';

describe('module "loader/builder"', () => {
  describe('util createParentBuilder()', () => {
    let subject;

    class ApplicationController extends Controller {}
    class ApiApplicationController extends Controller {}
    class ApiV1ApplicationController extends Controller {}

    beforeEach(() => {
      subject = createParentBuilder((key, target, parent) => {
        const namespace = posix.dirname(key).replace('.', '');

        const serializer = new Serializer({
          namespace,
          model: null,
          parent: null
        });

        return new target({
          parent,
          namespace,
          serializer,
          model: null
        });
      });
    });

    it('correctly builds parent objects', () => {
      subject(
        new FreezeableMap([
          ['root', new FreezeableMap([['application', ApplicationController]])],
          [
            'api',
            new FreezeableMap([['application', ApiApplicationController]])
          ],
          [
            'api/v1',
            new FreezeableMap([['application', ApiV1ApplicationController]])
          ]
        ])
      ).forEach(({ key, parent }) => {
        switch (key) {
          case 'root':
            expect(parent).to.be.an.instanceOf(ApplicationController);
            break;

          case 'api':
            expect(parent).to.be.an.instanceOf(ApiApplicationController);
            break;

          case 'api/v1':
            expect(parent).to.be.an.instanceOf(ApiV1ApplicationController);
            break;

          default:
            throw new Error(`Unexpected key "${key}".`);
        }
      });
    });

    describe('a namespace without an ApplicationController', () => {
      // Records what each ApplicationController was built with.
      const built: Array<[string, unknown]> = [];
      const build = createParentBuilder<{ key: string }>((key, _, parent) => {
        built.push([key, parent]);
        return { key };
      });

      const parents = () => {
        built.length = 0;

        return new Map(
          build(
            new FreezeableMap([
              ['root', new FreezeableMap([['application', class {}]])],
              ['admin', new FreezeableMap([['posts', class {}]])],
              ['admin/reports', new FreezeableMap([['application', class {}]])],
              // No `members` namespace at all: only a nested one.
              ['members/v2', new FreezeableMap([['posts', class {}]])]
            ])
          ).map(({ key, parent }) => [key, parent])
        );
      };

      it("takes the closest ancestor namespace's", () => {
        const result = parents();

        expect(result.get('admin')).to.deep.equal({ key: 'root/application' });
        expect(result.get('members/v2')).to.deep.equal({
          key: 'root/application'
        });
      });

      it("passes it on to a nested namespace's ApplicationController", () => {
        parents();

        expect(built).to.deep.equal([
          ['root/application', null],
          ['admin/reports/application', { key: 'root/application' }]
        ]);
      });
    });
  });
});
