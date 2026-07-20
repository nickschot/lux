import { it, describe, beforeAll, expect } from 'vitest';

import type { Request } from '../../../../server';
import getActionName from '../utils/get-action-name';
import { getTestApp } from '../../../../../../test/utils/get-test-app';

describe('module "router/route/action"', () => {
  describe('util getActionName()', () => {
    let subject: Request;

    beforeAll(async () => {
      const { router } = await getTestApp();

      subject = {
        route: router.get('GET:/posts')
      };
    });

    it('returns the correct action name', () => {
      const result = getActionName(subject);

      expect(result).to.equal('index');
    });
  });
});
