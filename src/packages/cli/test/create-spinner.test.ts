import { it, describe, beforeEach, afterEach, expect } from 'vitest';

import createSpinner from '../utils/create-spinner';

describe('module "cli"', () => {
  describe('util createSpinner()', () => {
    const { stderr } = process;
    let saved: { isTTY: boolean; columns: number };

    beforeEach(() => {
      saved = { isTTY: stderr.isTTY, columns: stderr.columns };
    });

    afterEach(() => {
      Object.assign(stderr, saved);
    });

    it('carries the text', () => {
      expect(createSpinner('Building...').text).to.equal('Building...');
    });

    it('is disabled on a TTY that reports 0 columns', () => {
      // ora 9 would clear Infinity lines here and hang.
      Object.assign(stderr, { isTTY: true, columns: 0 });

      expect(createSpinner('Building...').isEnabled).to.be.false;
    });

    it('is enabled on a sized TTY', () => {
      Object.assign(stderr, { isTTY: true, columns: 80 });

      // ora also checks TERM and CI, which a CI runner sets.
      const interactive = process.env.TERM !== 'dumb' && !('CI' in process.env);

      expect(createSpinner('Building...').isEnabled).to.equal(interactive);
    });

    it('is disabled off a TTY', () => {
      Object.assign(stderr, { isTTY: false, columns: undefined });

      expect(createSpinner('Building...').isEnabled).to.be.false;
    });
  });
});
