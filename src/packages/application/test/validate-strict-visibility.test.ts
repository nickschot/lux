import { it, describe, beforeAll, expect } from 'vitest';

import Controller from '../../controller';
import createController from '../utils/create-controller';
import resolveVisibility from '../utils/resolve-visibility';
import validateStrictVisibility from '../utils/validate-strict-visibility';
import { build } from '../../loader';
import type Database from '../../database';
import type { BundleNamespace } from '../../loader';
import type { Model, ModelClass } from '../../database';
import type Serializer from '../../serializer';
import { getTestApp } from '../../../../test/utils/get-test-app';

describe('module "application" #validateStrictVisibility()', () => {
  let models: Map<string, ModelClass>;
  let store: Database;
  let serializers: BundleNamespace<Serializer<Model>>;
  // A `true` rule for every type the test-app has.
  let everyType: Record<string, true>;

  beforeAll(async () => {
    const app = await getTestApp();

    models = app.models as Map<string, ModelClass>;
    serializers = app.serializers as unknown as BundleNamespace<
      Serializer<Model>
    >;
    store = {
      modelFor(name: string) {
        const model = Array.from(models.values()).find(
          ({ resourceName }) => resourceName === name
        );

        if (!model) {
          throw new Error(`no model ${name}`);
        }

        return model;
      }
    } as unknown as Database;
    everyType = Object.fromEntries(
      Array.from(models.values(), ({ resourceName }) => [resourceName, true])
    );
  });

  const posts = (query: never) => query;

  // Built and resolved the way the application boots them, then checked.
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

    resolveVisibility(controllers, models.values());
    validateStrictVisibility(controllers);

    return controllers;
  };

  // The error `boot()` throws, or undefined.
  const errorOf = (entries: Array<[string, typeof Controller]>) => {
    try {
      boot(entries);
    } catch (error) {
      return (error as Error).message;
    }

    return undefined;
  };

  class PostsController extends Controller {}

  it('lets a namespace without it reach types without rules', () => {
    class ApplicationController extends Controller {
      static override visibility = { posts };
    }

    expect(
      errorOf([
        ['application', ApplicationController],
        ['posts', PostsController]
      ])
    ).to.equal(undefined);
  });

  it('refuses a type it can reach without a rule, with the path to it', () => {
    class ApplicationController extends Controller {
      static override strictVisibility = true;

      static override visibility = { posts };
    }

    const message = errorOf([
      ['application', ApplicationController],
      ['posts', PostsController]
    ]);

    expect(message)
      .to.include('Namespaces with `strictVisibility` reach types')
      .and.include('  /:')
      .and.include('- users (reached through controllers/posts → user)')
      .and.include('- comments (reached through controllers/posts → comments)')
      .and.not.include('- posts (');
  });

  it('refuses the type of a controller itself', () => {
    class ApplicationController extends Controller {
      static override strictVisibility = true;

      static override visibility = { ...everyType, posts: undefined };
    }

    // `posts: undefined` still names the type: delete it to leave it out.
    delete (ApplicationController.visibility as Record<string, unknown>).posts;

    expect(
      errorOf([
        ['application', ApplicationController],
        ['posts', PostsController]
      ])
    ).to.include('- posts (reached through controllers/posts)');
  });

  it('accepts `true` for a type that may be seen in full', () => {
    class ApplicationController extends Controller {
      static override strictVisibility = true;

      static override visibility = { ...everyType, posts };
    }

    const controllers = boot([
      ['application', ApplicationController],
      ['posts', PostsController]
    ]);

    expect(controllers.get('posts')?.hasStrictVisibility).to.equal(true);
  });

  it('reaches as deep as `maxIncludeDepth`, and always one relationship', () => {
    // Every type but users and comments has a rule.
    const rules = { ...everyType };

    delete (rules as Record<string, unknown>).users;
    delete (rules as Record<string, unknown>).comments;

    const at = (depth: number) => {
      class ApplicationController extends Controller {
        static override strictVisibility = true;

        static override visibility = rules;

        override maxIncludeDepth = depth;
      }
      // Tags reach users and comments only through posts.
      class TagsController extends Controller {}

      return errorOf([
        ['application', ApplicationController],
        ['tags', TagsController]
      ]);
    };

    expect(at(1)).to.equal(undefined);
    expect(at(0)).to.equal(undefined);
    expect(at(2))
      .to.include('- users (reached through controllers/tags → posts.user)')
      .and.include(
        '- comments (reached through controllers/tags → posts.comments)'
      );
  });

  describe('in nested namespaces', () => {
    class ApplicationController extends Controller {
      static override strictVisibility = true;

      static override visibility = { ...everyType, posts };
    }

    it('follows the parent namespace', () => {
      class MembersApplicationController extends Controller {
        static override visibility = { posts };
      }

      expect(
        errorOf([
          ['application', ApplicationController],
          ['members/application', MembersApplicationController],
          ['members/posts', PostsController]
        ])
      ).to.include('  /members:');
    });

    it('holds for one that extends the strict class and sees everything', () => {
      class AdminApplicationController extends ApplicationController {
        static override visibility = {};
      }

      expect(
        errorOf([
          ['application', ApplicationController],
          ['admin/application', AdminApplicationController],
          ['admin/posts', PostsController]
        ])
      ).to.include('  /admin:');
    });

    it('can be turned off by one that declares its own', () => {
      class AdminApplicationController extends ApplicationController {
        static override strictVisibility = false;

        static override visibility = {};
      }

      const controllers = boot([
        ['application', ApplicationController],
        ['admin/application', AdminApplicationController],
        ['admin/posts', PostsController]
      ]);

      expect(controllers.get('admin/posts')?.hasStrictVisibility).to.equal(
        false
      );
    });
  });

  it('is refused anywhere but on an ApplicationController, and when not a boolean', () => {
    class StrictPostsController extends Controller {
      static override strictVisibility = true;
    }
    class ApplicationController extends Controller {
      static override strictVisibility = 'yes' as never;
    }

    expect(
      errorOf([
        ['application', ApplicationController],
        ['posts', StrictPostsController]
      ])
    )
      .to.include(
        "posts: declare `strictVisibility` on the namespace's ApplicationController"
      )
      .and.include('application: `strictVisibility` must be true or false.');
  });
});
