import { spy } from 'sinon';
import { it, describe, expect } from 'vitest';

import { createRunner } from '../model/utils/persistence';

// A stand-in for a knex statement: the runner only listens for `query`.
function statement() {
  return { on: spy(), toString: () => 'insert into `posts` values (1)' };
}

function modelWith(debug: boolean) {
  return {
    logger: { debug: spy() },
    store: { debug }
  } as unknown as Parameters<typeof createRunner>[0];
}

describe('util createRunner()', () => {
  it('logs writes when the database `debug` flag is on', async () => {
    const query = statement();

    await createRunner(modelWith(true), [])([query]);

    expect(query.on.calledOnceWith('query')).to.be.true;
  });

  it('does not log writes when the flag is off', async () => {
    const query = statement();

    await createRunner(modelWith(false), [])([query]);

    expect(query.on.called).to.be.false;
  });
});
