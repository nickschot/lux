import { it, describe, expect } from 'vitest';

import { readAttribute, writeAttribute } from '../model/utils/attribute';
import type Model from '../model';

describe('module "database/attribute"', () => {
  describe('#readAttribute()', () => {
    it('reads through an accessor by name', () => {
      const record = {
        get title() {
          return 'Hello';
        }
      } as unknown as Model;

      expect(readAttribute(record, 'title')).to.equal('Hello');
      expect(readAttribute(record, 'missing')).to.be.undefined;
    });
  });

  describe('#writeAttribute()', () => {
    it('writes through an accessor by name', () => {
      let written: unknown;
      const record = {
        set title(value: unknown) {
          written = value;
        }
      } as unknown as Model;

      writeAttribute(record, 'title', 'Hello');

      expect(written).to.equal('Hello');
    });

    it('throws when the write fails', () => {
      const record = Object.freeze({ title: 'Hello' }) as unknown as Model;

      expect(() => writeAttribute(record, 'title', 'Bye')).to.throw(TypeError);
    });
  });
});
