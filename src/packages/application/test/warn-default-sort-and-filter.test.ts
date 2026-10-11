import { it, describe, beforeAll, expect } from 'vitest';

import Controller from '../../controller';
import createController from '../utils/create-controller';
import resolveVisibility from '../utils/resolve-visibility';
import warnDefaultSortAndFilter from '../utils/warn-default-sort-and-filter';
import { build } from '../../loader';
import type { AfterAction } from '../../controller';
import type Database from '../../database';
import type Logger from '../../logger';
import type { BundleNamespace } from '../../loader';
import type { Model, ModelClass } from '../../database';
import type Serializer from '../../serializer';
import { getTestApp } from '../../../../test/utils/get-test-app';

describe('module "application" #warnDefaultSortAndFilter()', () => {
  let models: Map<string, ModelClass>;
  let store: Database;
  let serializers: BundleNamespace<Serializer<Model>>;
  let warnings: Array<string>;

  beforeAll(async () => {
    const app = await getTestApp();

    models = app.models as Map<string, ModelClass>;
    // The test-app's serializers, so that the defaults are filled in.
    serializers = app.serializers as unknown as BundleNamespace<
      Serializer<Model>
    >;
    store = {
      modelFor(name: string) {
        const model = { posts: 'post', comments: 'comment' }[name];

        if (model) {
          return models.get(model);
        }

        throw new Error(`no model ${name}`);
      }
    } as unknown as Database;
  });

  const posts = (query: never) => query;
  const stamp: AfterAction = async (req, res, data) => data;

  // Built and resolved the way the application boots them.
  const boot = (entries: Array<[string, typeof Controller]>) => {
    const controllers = build(
      new Map(entries) as never,
      (key, constructor, parent) =>
        createController(constructor as typeof Controller, {
          key,
          store,
          parent: (parent as Controller | undefined) ?? null,
          serializers
        })
    ) as unknown as Map<string, Controller>;

    warnings = [];
    resolveVisibility(controllers, models.values());
    warnDefaultSortAndFilter(controllers, {
      warn: (text: string) => warnings.push(text)
    } as unknown as Logger);
  };

  // A namespace with rules and an after hook: the risk the warning is for.
  class ApplicationController extends Controller {
    static override visibility = { posts };

    override afterAction: Array<AfterAction> = [stamp];
  }

  class PostsController extends Controller {}
  class CommentsController extends Controller {}

  it('warns about a namespace with rules and after hooks on the defaults', () => {
    boot([
      ['application', ApplicationController],
      ['posts', PostsController],
      ['comments', CommentsController]
    ]);

    expect(warnings).to.have.lengthOf(1);
    expect(warnings[0])
      .to.include("Namespace '/' has visibility rules and after hooks")
      .and.include('posts, comments accept the default sort and filter')
      .and.include(
        'set `defaultSortAndFilter` in app/controllers/application.js'
      );
  });

  it('warns about a controller that lists only one of them', () => {
    class ListedPostsController extends Controller {
      override sort = ['title'];
    }

    boot([
      ['application', ApplicationController],
      ['posts', ListedPostsController]
    ]);

    expect(warnings).to.have.lengthOf(1);
    expect(warnings[0]).to.include('posts accept the default');
  });

  it('names the namespace the controllers are in', () => {
    class MembersApplicationController extends ApplicationController {}

    boot([
      ['application', class extends Controller {}],
      ['members/application', MembersApplicationController],
      ['members/posts', PostsController]
    ]);

    expect(warnings).to.have.lengthOf(1);
    expect(warnings[0])
      .to.include("Namespace '/members'")
      .and.include('app/controllers/members/application.js');
  });

  describe('stays quiet', () => {
    it('when the controllers list `sort` and `filter`', () => {
      class ListedPostsController extends Controller {
        override sort = ['title'];
        override filter = ['title'];
      }

      boot([
        ['application', ApplicationController],
        ['posts', ListedPostsController]
      ]);

      expect(warnings).to.deep.equal([]);
    });

    [true, false].forEach(value => {
      it(`when the namespace sets \`defaultSortAndFilter = ${value}\``, () => {
        class Decided extends ApplicationController {
          override defaultSortAndFilter = value;
        }

        boot([
          ['application', Decided],
          ['posts', PostsController]
        ]);

        expect(warnings).to.deep.equal([]);
      });
    });

    it('when a controller sets `defaultSortAndFilter` itself', () => {
      class DecidedPostsController extends Controller {
        override defaultSortAndFilter = true;
      }

      boot([
        ['application', ApplicationController],
        ['posts', DecidedPostsController]
      ]);

      expect(warnings).to.deep.equal([]);
    });

    it('without after hooks', () => {
      class NoHooks extends Controller {
        static override visibility = { posts };
      }

      boot([
        ['application', NoHooks],
        ['posts', PostsController]
      ]);

      expect(warnings).to.deep.equal([]);
    });

    it('without rules, or with rules that narrow nothing', () => {
      class Open extends Controller {
        override afterAction: Array<AfterAction> = [stamp];
      }
      class SeesEverything extends Open {
        static override visibility = {};
      }
      class AllTrue extends Open {
        static override visibility = { posts: true as const };
      }

      [Open, SeesEverything, AllTrue].forEach(Application => {
        boot([
          ['application', Application],
          ['posts', PostsController]
        ]);

        expect(warnings, Application.name).to.deep.equal([]);
      });
    });
  });
});
