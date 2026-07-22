import { afterEach, test, expect } from 'vitest';

import * as env from '../env';
import setEnv from '../../../test/utils/set-env';

afterEach(() => {
  setEnv('test');
});

test('isDevelopment()', () => {
  setEnv('development');
  expect(env.isDevelopment()).to.be.true;
});

test('isProduction()', () => {
  setEnv('production');
  expect(env.isProduction()).to.be.true;
});

test('isTest()', () => {
  expect(env.isTest()).to.be.true;
});
