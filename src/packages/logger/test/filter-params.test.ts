import { it, describe, beforeAll, expect } from 'vitest';

import filterParams from '../request-logger/utils/filter-params';

describe('module "logger"', () => {
  describe('util filterParams()', () => {
    let params;
    let filter;
    beforeAll(() => {
      params = {
        id: 1,
        username: 'test',
        password: 'test'
      };
      filter = ['username', 'password'];
    });

    it('replaces the value of filtered params', () => {
      const filtered = filterParams(params, ...filter);
      expect(filtered.username).to.not.equal(params.username);
      expect(filtered.password).to.not.equal(params.password);
    });

    it('leaves non-filtered params unchanged', () => {
      const filtered = filterParams(params, ...filter);
      expect(filtered.id).to.equal(params.id);
    });

    it('handles nested parameters', () => {
      const nestedParams = { params };
      const filtered = filterParams(nestedParams, ...filter);
      expect(filtered.params.username).to.not.equal(
        nestedParams.params.username
      );
      expect(filtered.params.password).to.not.equal(
        nestedParams.params.password
      );
    });

    it('always filters credentials, without configuration', () => {
      const filtered = filterParams({
        id: 1,
        password: 'a',
        clientSecret: 'b',
        'access-token': 'c'
      });

      expect(filtered).to.deep.equal({
        id: 1,
        password: '[FILTERED]',
        clientSecret: '[FILTERED]',
        'access-token': '[FILTERED]'
      });
    });

    it('filters keys containing a filtered name, ignoring case', () => {
      const filtered = filterParams(
        { passwordConfirmation: 'a', SSN: 'b', ssnCount: 2, name: 'c' },
        'ssn'
      );

      expect(filtered).to.deep.equal({
        passwordConfirmation: '[FILTERED]',
        SSN: '[FILTERED]',
        ssnCount: '[FILTERED]',
        name: 'c'
      });
    });

    it('filters objects inside arrays', () => {
      const filtered = filterParams({
        data: [{ id: 1, attributes: { secret: 'a', title: 'b' } }],
        include: ['author', 'comments']
      });

      expect(filtered).to.deep.equal({
        data: [{ id: 1, attributes: { secret: '[FILTERED]', title: 'b' } }],
        include: ['author', 'comments']
      });
    });
  });
});
