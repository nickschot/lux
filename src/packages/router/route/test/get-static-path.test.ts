import { it, describe, expect } from 'vitest';

import getStaticPath from '../utils/get-static-path';

describe('module "router/route"', () => {
  describe('util getStaticPath()', () => {
    it('replaces the dynamic segments in a path', () => {
      expect(getStaticPath('/posts/:pid/comments/:cid')).to.equal(
        '/posts/:dynamic/comments/:dynamic'
      );
    });

    it('leaves a static segment that contains a segment name', () => {
      expect(getStaticPath('/videos/:id/provider')).to.equal(
        '/videos/:dynamic/provider'
      );
    });
  });
});
