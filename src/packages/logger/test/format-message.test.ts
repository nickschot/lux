import { it, describe, expect } from 'vitest';

import formatMessage from '../writer/utils/format-message';

describe('module "logger/writer"', () => {
  describe('util formatMessage()', () => {
    const colored = '\u001b[1m\u001b[31mHello\u001b[39m\u001b[22m world!';

    it('strips ANSI escape codes in the "json" format', () => {
      expect(formatMessage(colored, 'json')).to.equal('Hello world!');
    });

    it('strips OSC sequences terminated by ST in the "json" format', () => {
      const titled = '\u001b]0;title\u001b\\Hello world!';

      expect(formatMessage(titled, 'json')).to.equal('Hello world!');
    });

    it('keeps ANSI escape codes in the "text" format', () => {
      expect(formatMessage(colored, 'text')).to.equal(colored);
    });

    it('returns the stack of an error', () => {
      const error = new Error('Hello world!');

      expect(formatMessage(error, 'json')).to.equal(error.stack);
    });
  });
});
