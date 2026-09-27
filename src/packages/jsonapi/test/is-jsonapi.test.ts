import { it, describe, expect } from 'vitest';

import { isJSONAPI } from '../index';

describe('module "jsonapi"', () => {
  describe('#isJSONAPI()', () => {
    it('is true if mime type matches application/vnd.api+json', () => {
      expect(isJSONAPI('application/vnd.api+json')).to.be.true;
      expect(isJSONAPI('application/vnd.api+json;charset=utf8')).to.be.true;
      expect(isJSONAPI('application/vnd.api+json; ext=bulk')).to.be.true;
    });

    it('matches case-insensitively', () => {
      expect(isJSONAPI('Application/VND.API+JSON')).to.be.true;
    });

    it('is false if mime type does not match application/vnd.api+json', () => {
      expect(isJSONAPI('application/json')).to.be.false;
      expect(isJSONAPI('application/vnd.api+jsonfoo')).to.be.false;
    });
  });
});
