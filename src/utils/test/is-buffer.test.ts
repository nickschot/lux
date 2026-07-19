import { describe, it, expect } from 'vitest';

import isBuffer from '../is-buffer';

describe('util isBuffer()', () => {
  it('returns true when a `Buffer` is passed in as an argument', () => {
    expect(isBuffer(new Buffer('', 'utf8'))).to.be.true;
  });
});
