import { it, describe, beforeAll, expect } from 'vitest';

import { getTestApp } from '../../../../test/utils/get-test-app';
import createReplacer from '../utils/create-replacer';

describe('module "router"', () => {
  describe('util createReplacer()', () => {
    let subject;

    beforeAll(async () => {
      const app = await getTestApp();
      const healthController = app.controllers.get('health');
      const { constructor: HealthController } = healthController;

      class AdminHealthController extends HealthController {}

      subject = createReplacer(
        new Map([
          ['posts', app.controllers.get('posts')],
          ['health', healthController],
          ['admin/posts', app.controllers.get('admin/posts')],
          ['languages', app.controllers.get('languages')],
          [
            'admin/health',
            new AdminHealthController({
              namespace: 'admin'
            })
          ]
        ])
      );
    });

    it('replaces an integer id after a resource name', () => {
      expect(subject('/posts/1')).to.deep.equal({
        staticPath: '/posts/:dynamic',
        params: ['1']
      });

      expect(subject('/health/1')).to.deep.equal({
        staticPath: '/health/:dynamic',
        params: ['1']
      });
    });

    it('leaves a non-integer segment of a numeric resource alone', () => {
      expect(subject('/posts/abc')).to.deep.equal({
        staticPath: '/posts/abc',
        params: []
      });
    });

    it('accepts any id of a resource with a non-numeric key', () => {
      expect(subject('/languages/pt-BR')).to.deep.equal({
        staticPath: '/languages/:dynamic',
        params: ['pt-BR']
      });

      expect(subject('/languages/a%2Fb')).to.deep.equal({
        staticPath: '/languages/:dynamic',
        params: ['a/b']
      });
    });

    it('only matches whole segments', () => {
      expect(subject('/blogposts/1')).to.deep.equal({
        staticPath: '/blogposts/1',
        params: []
      });
    });
  });
});
