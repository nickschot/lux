import { it, describe, beforeAll, expect } from 'vitest';

import { paramsFor, defaultParamsFor } from '../index';

import { getTestApp } from '../../../../../../test/utils/get-test-app';

import type Controller from '../../../../controller';

describe('module "router/route/params"', () => {
  describe('#paramsFor()', () => {
    let getController;

    beforeAll(async () => {
      const { controllers } = await getTestApp();

      getController = (name: string): Controller =>
        controllers.get(name) as Controller;
    });

    describe('with model-less controller', () => {
      let params;

      beforeAll(() => {
        params = paramsFor({
          type: 'custom',
          method: 'GET',
          controller: getController('custom'),
          dynamicSegments: []
        });
      });

      it('contains query', () => {
        expect(params.has('userId')).to.be.true;
      });
    });
  });

  describe('include paths', () => {
    let controller: Controller;

    // The allowed `include` values for a copy of the posts controller with
    // the given `maxIncludeDepth`.
    const includeFor = (maxIncludeDepth?: number) => {
      const subject =
        maxIncludeDepth === undefined
          ? controller
          : // Controllers are frozen, so shadow the property instead of
            // assigning it.
            (Object.create(controller, {
              maxIncludeDepth: { value: maxIncludeDepth }
            }) as Controller);

      const params = paramsFor({
        type: 'member',
        method: 'GET',
        controller: subject,
        dynamicSegments: ['id']
      });

      return Array.from(params.get('include') as unknown as Iterable<string>);
    };

    beforeAll(async () => {
      const { controllers } = await getTestApp();

      controller = controllers.get('posts') as Controller;
    });

    it('allows paths three levels deep by default', () => {
      expect(controller.maxIncludeDepth).to.equal(3);

      const values = includeFor();

      expect(values).to.include.members([
        'comments',
        'comments.user',
        'comments.reactions.user'
      ]);
      expect(values.some(path => path.split('.').length > 3)).to.be.false;
    });

    it("honours a controller's `maxIncludeDepth`", () => {
      const values = includeFor(2);

      expect(values).to.include.members(['comments', 'comments.user']);
      expect(values).to.not.include('comments.reactions.user');
    });

    it('allows no includes at depth 0', () => {
      expect(includeFor(0)).to.deep.equal([]);
    });

    it('only allows direct relationships at depth 1', () => {
      expect(includeFor(1)).to.have.members([
        'user',
        'image',
        'comments',
        'reactions',
        'tags'
      ]);
    });
  });

  describe('#defaultParamsFor()', () => {
    let getController;

    beforeAll(async () => {
      const { controllers } = await getTestApp();

      getController = (name: string): Controller =>
        controllers.get(name) as Controller;
    });

    describe('with collection route', () => {
      let params;
      let controller;

      beforeAll(() => {
        controller = getController('posts');
        params = defaultParamsFor({
          controller,
          type: 'collection'
        });
      });

      it('contains sort', () => {
        expect(params).to.include.keys('sort');
      });

      it('contains page cursor', () => {
        expect(params).to.include.keys('page');
        expect(params.page).to.include.keys('size', 'number');
      });

      it('contains model fields', () => {
        const {
          model,
          serializer: { attributes }
        } = controller;

        expect(params.fields).to.include.keys(model.resourceName);
        expect(params.fields[model.resourceName]).to.deep.equal(attributes);
      });
    });

    describe('with member route', () => {
      let params;
      let controller;

      beforeAll(() => {
        controller = getController('posts');
        params = defaultParamsFor({
          controller,
          type: 'member'
        });
      });

      it('contains model fields', () => {
        const {
          model,
          serializer: { attributes }
        } = controller;

        expect(params.fields).to.include.keys(model.resourceName);
        expect(params.fields[model.resourceName]).to.deep.equal(attributes);
      });
    });

    describe('with custom route', () => {
      it("is a collection route's, so it can call the built-in actions", () => {
        const controller = getController('posts');

        expect(defaultParamsFor({ type: 'custom', controller })).to.deep.equal(
          defaultParamsFor({ type: 'collection', controller })
        );
      });
    });

    describe('with model-less controller', () => {
      let params;

      beforeAll(() => {
        params = defaultParamsFor({
          type: 'custom',
          controller: getController('health')
        });
      });

      it('is an empty object literal', () => {
        expect(params).to.deep.equal({});
      });
    });
  });

  // ActionsSerializer declares no relationships and no attributes, so the
  // allowed `include` and `sort` values of its routes are empty lists.
  // JSON:API 1.0 requires a 400 for a relationship path the server cannot
  // identify and for an unsupported sort, so empty must mean "nothing".
  describe('with a serializer without relationships or attributes', () => {
    let params;

    beforeAll(async () => {
      const { controllers } = await getTestApp();

      params = paramsFor({
        type: 'collection',
        method: 'GET',
        controller: controllers.get('actions') as Controller,
        dynamicSegments: []
      });
    });

    it('rejects any include', () => {
      expect(() => params.get('include').validate(['zzzprobe'])).to.throw(
        TypeError
      );
    });

    it('rejects any sort', () => {
      expect(() => params.get('sort').validate('zzzprobe')).to.throw(TypeError);
    });

    it('still accepts a request without them', () => {
      expect(params.get('include').validate([])).to.deep.equal([]);
    });
  });
});
