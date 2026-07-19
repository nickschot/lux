import { describe, it, beforeEach, expect } from 'vitest';

import sleep from '../sleep';

describe('util sleep()', () => {
  const amount = 500;
  let time;

  beforeEach(() => {
    time = Date.now();
  });

  it('resolves with undefined', async () => {
    expect(await sleep(amount)).to.be.undefined;
  });

  it('sleeps for the correct amount of time', async () => {
    await sleep(amount);
    expect(Date.now() - time).to.be.within(amount - 25, amount + 25);
  });
});
