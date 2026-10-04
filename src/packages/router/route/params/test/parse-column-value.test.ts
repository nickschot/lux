import { it, describe, expect } from 'vitest';

import { parseId, parserFor } from '../utils/parse-column-value';

describe('module "router/route/params" column value parsers', () => {
  describe('#parseId()', () => {
    it('turns a string of digits into a number for a numeric key', () => {
      expect(parseId('number')('42')).to.equal(42);
      expect(parseId('number')(42)).to.equal(42);
    });

    it('leaves anything else as sent', () => {
      expect(parseId('number')('4a')).to.equal('4a');
      expect(parseId('string')('42')).to.equal('42');
    });
  });

  describe('#parserFor()', () => {
    it('parses ISO 8601 strings for a date column', () => {
      const parse = parserFor('date');

      [
        '2020-01-01',
        '2020-01-01T10:20:30Z',
        '2020-01-01T10:20:30.123+02:00'
      ].forEach(value => {
        const parsed = parse?.(value);

        expect(parsed, value).to.be.an.instanceOf(Date);
        expect((parsed as Date).valueOf(), value).to.equal(
          new Date(value).valueOf()
        );
      });
    });

    it('leaves other values for validation to reject', () => {
      const parse = parserFor('date');

      expect(parse?.('yesterday')).to.equal('yesterday');
      expect(parse?.('2020-13-45')).to.equal('2020-13-45');
      expect(parse?.(5)).to.equal(5);
    });

    it('does not parse values of other columns', () => {
      expect(parserFor('string')).to.be.undefined;
      expect(parserFor('number')).to.be.undefined;
    });
  });
});
