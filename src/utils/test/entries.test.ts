import { it, describe, expect } from 'vitest';

import entries from '../entries';

describe('util entries()', () => {
  it('creates an `Array` of key-value pairs from an object', () => {
    expect(
      entries({
        a: 1,
        b: 2,
        c: 3
      })
    ).to.deep.equal([
      ['a', 1],
      ['b', 2],
      ['c', 3]
    ]);
  });
});
