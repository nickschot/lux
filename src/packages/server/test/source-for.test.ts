import { it, describe, expect } from 'vitest';

import { sourceFor } from '../index';

describe('module "server"', () => {
  describe('#sourceFor()', () => {
    it('maps request document paths to a JSON pointer', () => {
      expect(sourceFor('data')).to.deep.equal({ pointer: '/data' });
      expect(sourceFor('data.id')).to.deep.equal({ pointer: '/data/id' });
      expect(sourceFor('data.relationships.user.data.0')).to.deep.equal({
        pointer: '/data/relationships/user/data/0'
      });
    });

    it('dasherizes member names, as responses do', () => {
      expect(sourceFor('data.attributes.isPublic')).to.deep.equal({
        pointer: '/data/attributes/is-public'
      });
    });

    it('maps anything else to a query parameter in bracket form', () => {
      expect(sourceFor('include')).to.deep.equal({ parameter: 'include' });
      expect(sourceFor('page.size')).to.deep.equal({ parameter: 'page[size]' });
      expect(sourceFor('filter.isPublic')).to.deep.equal({
        parameter: 'filter[is-public]'
      });
    });

    it('returns no source for an empty path', () => {
      expect(sourceFor('')).to.deep.equal({});
    });
  });
});
