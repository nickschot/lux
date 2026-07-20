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
      let params;

      beforeAll(() => {
        params = defaultParamsFor({
          type: 'custom',
          controller: getController('posts')
        });
      });

      it('is an empty object literal', () => {
        expect(params).to.deep.equal({});
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
});
