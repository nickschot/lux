import { it, describe, beforeAll, expect } from 'vitest';

import Controller from '../../controller';
import createController from '../utils/create-controller';
import resolveVisibility from '../utils/resolve-visibility';
import restrictOpenNamespaces from '../utils/restrict-open-namespaces';
import { build } from '../../loader';
import type Database from '../../database';
import type Logger from '../../logger';
import type { BundleNamespace } from '../../loader';
import type { Model, ModelClass } from '../../database';
import type Serializer from '../../serializer';
import { getTestApp } from '../../../../test/utils/get-test-app';

describe('module "application" #restrictOpenNamespaces()', () => {
  let Post: ModelClass;
  let store: Database;
  let models: Map<string, ModelClass>;
  let warnings: Array<string>;
  let logger: Logger;

  const serializers = new Map() as unknown as BundleNamespace<
    Serializer<Model>
  >;

  beforeAll(async () => {
    const app = await getTestApp();

    models = app.models as Map<string, ModelClass>;
    Post = models.get('post') as ModelClass;
    store = {
      modelFor(name: string) {
        if (name === 'posts') {
          return Post;
        }

        throw new Error(`no model ${name}`);
      }
    } as unknown as Database;
  });

  const posts = (query: never) => query;

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
    logger = { warn: (text: string) => warnings.push(text) } as never;

    resolveVisibility(controllers, models.values());
    restrictOpenNamespaces(controllers, logger);

    return controllers;
  };

  class PostsController extends Controller {}

  it('leaves a namespace with rules alone', () => {
    class ApplicationController extends Controller {
      static override visibility = { posts };
    }

    const controllers = boot([
      ['application', ApplicationController],
      ['posts', PostsController]
    ]);

    expect(controllers.get('posts')?.maxIncludeDepth).to.equal(3);
    expect(warnings).to.deep.equal([]);
  });

  it('counts `static visibility = {}` as rules', () => {
    class ApplicationController extends Controller {
      static override visibility = {};
    }

    const controllers = boot([
      ['application', ApplicationController],
      ['posts', PostsController]
    ]);

    expect(controllers.get('posts')?.hasVisibilityRules).to.equal(true);
    expect(controllers.get('posts')?.maxIncludeDepth).to.equal(3);
    expect(warnings).to.deep.equal([]);
  });

  it('includes 1 level deep in a namespace without rules', () => {
    class ApplicationController extends Controller {}

    const controllers = boot([
      ['application', ApplicationController],
      ['posts', PostsController]
    ]);

    expect(controllers.get('posts')?.hasVisibilityRules).to.equal(false);
    expect(controllers.get('posts')?.maxIncludeDepth).to.equal(1);
  });

  it('keeps a `maxIncludeDepth` the controller or its namespace sets', () => {
    class ApplicationController extends Controller {
      override maxIncludeDepth = 2;
    }
    class DeepPostsController extends Controller {
      override maxIncludeDepth = 3;
    }

    const controllers = boot([
      ['application', ApplicationController],
      ['posts', PostsController],
      ['admin/posts', DeepPostsController]
    ]);

    expect(controllers.get('posts')?.maxIncludeDepth).to.equal(2);
    expect(controllers.get('admin/posts')?.maxIncludeDepth).to.equal(3);
  });

  it('restricts only the namespaces that have no rules', () => {
    class ApplicationController extends Controller {}
    class AdminApplicationController extends Controller {
      static override visibility = {};
    }

    const controllers = boot([
      ['application', ApplicationController],
      ['posts', PostsController],
      ['admin/application', AdminApplicationController],
      ['admin/posts', PostsController],
      ['members/posts', PostsController]
    ]);

    expect(controllers.get('posts')?.maxIncludeDepth).to.equal(1);
    expect(controllers.get('admin/posts')?.maxIncludeDepth).to.equal(3);
    expect(controllers.get('members/posts')?.maxIncludeDepth).to.equal(1);
  });

  it('warns once per namespace without rules that serves records', () => {
    class ApplicationController extends Controller {}

    boot([
      ['application', ApplicationController],
      ['posts', PostsController],
      ['health', class HealthController extends Controller {}],
      ['members/posts', PostsController]
    ]);

    expect(warnings).to.have.lengthOf(2);
    expect(warnings[0])
      .to.include("Namespace '/' has no visibility rules")
      .and.include('app/controllers/application.js')
      .and.include('`static visibility = {}`');
    expect(warnings[1])
      .to.include("Namespace '/members'")
      .and.include('app/controllers/members/application.js');
  });
});
