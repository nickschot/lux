import { it, describe, expect } from 'vitest';

import tryCatch, { tryCatchSync } from '../try-catch';

describe('util tryCatch()', () => {
  it('is a async functional equivalent of try...catch', async () => {
    let value = await tryCatch(() => Promise.resolve(false));

    expect(value).to.be.false;

    await tryCatch(
      () => {
        return Promise.reject(new Error('Test'));
      },
      () => {
        value = true;
      }
    );

    expect(value).to.be.true;
  });

  it('resolves to `undefined` by default when `fn` rejects', async () => {
    const value = await tryCatch(() => Promise.reject(new Error('Test')));

    expect(value).to.be.undefined;
  });
});

describe('util tryCatchSync()', () => {
  it('is a functional equivalent of try...catch', () => {
    let value = tryCatchSync(() => false);

    expect(value).to.be.false;

    tryCatchSync(
      () => {
        throw new Error('Test');
      },
      () => {
        value = true;
      }
    );

    expect(value).to.be.true;
  });

  it('returns `undefined` by default when `fn` throws', () => {
    const value = tryCatchSync(() => {
      throw new Error('Test');
    });

    expect(value).to.be.undefined;
  });
});
