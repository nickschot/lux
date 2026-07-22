import { it, describe, expect } from 'vitest';

import setType from '../set-type';

describe('util setType()', () => {
  it('returns the function call of the first and only argument', () => {
    expect(setType(() => 'Test')).to.equal('Test');
  });
});
