import { it, describe, expect } from 'vitest';

import Controller from '../../controller';
import createController, { setsItself } from '../utils/create-controller';
import { build } from '../../loader';
import type Database from '../../database';
import type { BeforeAction, AfterAction } from '../../controller';
import type { BundleNamespace } from '../../loader';
import type { Model } from '../../database';
import type Serializer from '../../serializer';

describe('module "application" #createController()', () => {
  // No models or serializers: these tests are about what a controller takes
  // from its namespace's ApplicationController.
  const store = {
    modelFor() {
      throw new Error('no models');
    }
  } as unknown as Database;
  const serializers = new Map() as unknown as BundleNamespace<
    Serializer<Model>
  >;

  const create = <T extends Controller>(
    key: string,
    constructor: new (...args: Array<never>) => T,
    parent: Controller | null = null
  ) => createController(constructor, { key, store, parent, serializers });

  const calls: Array<string> = [];

  // Hooks are written inline in class fields, as apps do: each instance gets
  // its own function objects, so nothing may rely on their identity.
  class ApplicationController extends Controller {
    override beforeAction: Array<BeforeAction> = [
      async function authenticate() {
        calls.push('authenticate');
      }
    ];

    override afterAction: Array<AfterAction> = [
      async function stamp(req, res, data) {
        calls.push('stamp');
        return data;
      }
    ];

    override rejectUnlistedRelationships = false;

    override maxIncludeDepth = 2;
  }

  const runHooks = async (controller: Controller) => {
    calls.length = 0;

    for (const hook of controller.beforeAction) {
      await hook({} as never, {} as never);
    }

    for (const hook of controller.afterAction) {
      await hook({} as never, {} as never, undefined);
    }

    return [...calls];
  };

  describe('hooks', () => {
    it("runs the namespace's hooks around a controller's own", async () => {
      class PostsController extends Controller {
        override beforeAction: Array<BeforeAction> = [
          async function own() {
            calls.push('own');
          }
        ];
      }

      const application = create('application', ApplicationController);
      const posts = create('posts', PostsController, application);

      expect(await runHooks(posts)).to.deep.equal([
        'authenticate',
        'own',
        'stamp'
      ]);
    });

    it('runs them once in a namespace whose ApplicationController extends the root one', async () => {
      class AdminApplicationController extends ApplicationController {}
      class AdminPostsController extends Controller {}

      const application = create('application', ApplicationController);
      const admin = create(
        'admin/application',
        AdminApplicationController,
        application
      );
      const posts = create('admin/posts', AdminPostsController, admin);

      expect(await runHooks(admin)).to.deep.equal(['authenticate', 'stamp']);
      expect(await runHooks(posts)).to.deep.equal(['authenticate', 'stamp']);
    });

    it('lets such an ApplicationController extend the inherited hooks', async () => {
      class AdminApplicationController extends ApplicationController {
        override beforeAction: Array<BeforeAction> = [
          ...this.beforeAction,
          async function requireAdmin() {
            calls.push('requireAdmin');
          }
        ];
      }
      class AdminPostsController extends Controller {}

      const application = create('application', ApplicationController);
      const admin = create(
        'admin/application',
        AdminApplicationController,
        application
      );
      const posts = create('admin/posts', AdminPostsController, admin);

      expect(await runHooks(posts)).to.deep.equal([
        'authenticate',
        'requireAdmin',
        'stamp'
      ]);
    });

    describe('after hooks of an ApplicationController that extends the root one', () => {
      const adminMeta: AfterAction = async (req, res, data) => {
        calls.push('adminMeta');
        return data;
      };

      const hooksOf = (Admin: typeof Controller) => {
        const application = create('application', ApplicationController);
        const admin = create('admin/application', Admin, application);

        return runHooks(
          create('admin/posts', class extends Controller {}, admin)
        );
      };

      it("replace the root's when declared on their own", async () => {
        class AdminApplicationController extends ApplicationController {
          override afterAction: Array<AfterAction> = [adminMeta];
        }

        expect(await hooksOf(AdminApplicationController)).to.deep.equal([
          'authenticate',
          'adminMeta'
        ]);
      });

      it("run as a nested namespace's do when the root's are spread in last", async () => {
        class AdminApplicationController extends ApplicationController {
          override afterAction: Array<AfterAction> = [
            adminMeta,
            ...this.afterAction
          ];
        }
        // Not extending the root's class: its hooks are added around these.
        class NestedApplicationController extends Controller {
          override afterAction: Array<AfterAction> = [adminMeta];
        }

        const extending = await hooksOf(AdminApplicationController);

        expect(extending).to.deep.equal(['authenticate', 'adminMeta', 'stamp']);
        expect(extending).to.deep.equal(
          await hooksOf(NestedApplicationController)
        );
      });
    });

    it("adds the parent namespace's hooks to an ApplicationController that does not extend it", async () => {
      class AdminApplicationController extends Controller {
        override beforeAction: Array<BeforeAction> = [
          async function requireAdmin() {
            calls.push('requireAdmin');
          }
        ];
      }
      class AdminPostsController extends Controller {}

      const application = create('application', ApplicationController);
      const admin = create(
        'admin/application',
        AdminApplicationController,
        application
      );
      const posts = create('admin/posts', AdminPostsController, admin);

      expect(await runHooks(posts)).to.deep.equal([
        'authenticate',
        'requireAdmin',
        'stamp'
      ]);
    });

    it('binds hooks to the controller that declares them', async () => {
      const seen: Array<unknown> = [];

      class Root extends Controller {
        override beforeAction: Array<BeforeAction> = [
          async function capture(this: unknown) {
            seen.push(this);
          }
        ];
      }
      class PostsController extends Controller {}

      const application = create('application', Root);
      const posts = create('posts', PostsController, application);

      await application.beforeAction[0]({} as never, {} as never);
      await posts.beforeAction[0]({} as never, {} as never);

      expect(seen).to.deep.equal([application, application]);
    });
  });

  describe('namespace settings', () => {
    it("takes the namespace's settings when it sets none", () => {
      class PostsController extends Controller {}

      const application = create('application', ApplicationController);
      const posts = create('posts', PostsController, application);

      expect(posts.rejectUnlistedRelationships).to.equal(false);
      expect(posts.maxIncludeDepth).to.equal(2);
      expect(posts.rejectUnlistedAttributes).to.equal(false);
    });

    it('keeps the ones it sets itself', () => {
      class PostsController extends Controller {
        override rejectUnlistedRelationships = true;

        override rejectUnlistedAttributes = true;
      }

      const application = create('application', ApplicationController);
      const posts = create('posts', PostsController, application);

      expect(posts.rejectUnlistedRelationships).to.equal(true);
      expect(posts.rejectUnlistedAttributes).to.equal(true);
      expect(posts.maxIncludeDepth).to.equal(2);
    });

    it('passes them down through a nested namespace', () => {
      class AdminApplicationController extends Controller {
        override rejectUnlistedAttributes = true;
      }
      class AdminPostsController extends Controller {}

      const application = create('application', ApplicationController);
      const admin = create(
        'admin/application',
        AdminApplicationController,
        application
      );
      const posts = create('admin/posts', AdminPostsController, admin);

      expect(posts.rejectUnlistedAttributes).to.equal(true);
      expect(posts.rejectUnlistedRelationships).to.equal(false);
      expect(posts.maxIncludeDepth).to.equal(2);
    });

    it('records which ones a controller or its namespaces set', () => {
      class PostsController extends Controller {
        override rejectUnlistedAttributes = true;
      }

      const application = create('application', ApplicationController);
      const posts = create('posts', PostsController, application);
      const plain = create('posts', class extends Controller {});

      expect(setsItself(posts, 'rejectUnlistedAttributes')).to.equal(true);
      expect(setsItself(posts, 'maxIncludeDepth')).to.equal(true);
      expect(setsItself(application, 'rejectUnlistedAttributes')).to.equal(
        false
      );
      expect(setsItself(plain, 'maxIncludeDepth')).to.equal(false);
    });

    it('falls back to the built-in defaults', () => {
      class PostsController extends Controller {}

      const posts = create('posts', PostsController);

      expect(posts.rejectUnlistedAttributes).to.equal(false);
      expect(posts.rejectUnlistedRelationships).to.equal(true);
      expect(posts.maxIncludeDepth).to.equal(3);
    });
  });

  describe('a namespace without an ApplicationController', () => {
    // Built the way the application builds its controllers, from the loaded
    // modules: `admin` has controllers but no `admin/application.js`.
    const controllers = () =>
      build(
        new Map<string, typeof Controller>([
          ['application', ApplicationController],
          ['admin/posts', class AdminPostsController extends Controller {}],
          ['admin/reports/posts', class extends Controller {}]
        ]) as never,
        (key, constructor, parent) =>
          create(key, constructor as typeof Controller, parent ?? null)
      );

    it("runs the closest ancestor namespace's hooks", async () => {
      const built = controllers();

      expect(
        await runHooks(built.get('admin/posts') as Controller)
      ).to.deep.equal(['authenticate', 'stamp']);
      expect(
        await runHooks(built.get('admin/reports/posts') as Controller)
      ).to.deep.equal(['authenticate', 'stamp']);
    });

    it("takes the closest ancestor namespace's settings", () => {
      const posts = controllers().get('admin/posts') as Controller;

      expect(posts.rejectUnlistedRelationships).to.equal(false);
      expect(posts.maxIncludeDepth).to.equal(2);
    });
  });
});
