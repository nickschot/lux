import { it, describe, expect } from 'vitest';

import { hasMediaTypeParams } from '../index';

describe('module "jsonapi"', () => {
  describe('#hasMediaTypeParams()', () => {
    it('is true if the media type has parameters', () => {
      expect(hasMediaTypeParams('application/vnd.api+json;charset=utf8')).to.be
        .true;
      expect(hasMediaTypeParams('application/vnd.api+json; charset=utf8')).to.be
        .true;
      expect(hasMediaTypeParams('application/vnd.api+json;ext=bulk')).to.be
        .true;
    });

    it('is false if the media type has no parameters', () => {
      expect(hasMediaTypeParams('application/vnd.api+json')).to.be.false;
      expect(hasMediaTypeParams('application/vnd.api+json;')).to.be.false;
    });
  });
});
