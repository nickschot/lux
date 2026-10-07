import { it, describe, beforeAll, afterAll, expect } from 'vitest';

import Migration from '../migration';
import generateTimestamp, {
  padding
} from '../migration/utils/generate-timestamp';

import { getTestApp } from '../../../../test/utils/get-test-app';

describe('module "database/migration"', () => {
  describe('class Migration', () => {
    let store;

    beforeAll(async () => {
      const app = await getTestApp();

      store = app.store;
    });

    describe('#run()', () => {
      const tableName = 'migration_test';
      let subject;

      beforeAll(() => {
        subject = new Migration(schema => {
          return schema.createTable(tableName, table => {
            table.increments();

            table.boolean('success').index().notNullable().defaultTo(false);

            table.timestamps();
            table.index(['created_at', 'updated_at']);
          });
        });
      });

      afterAll(async () => {
        await store.schema().dropTable(tableName);
      });

      it('runs a migration function', () => {
        return subject.run(store.schema()).then(result => {
          expect(result).to.be.ok;
        });
      });
    });
  });
});

describe('module "database/migration/utils/generate-timestamp"', () => {
  describe('.generateTimestamp()', () => {
    it('generates a timestamp string', () => {
      const result = generateTimestamp();

      expect(result)
        .to.be.a('string')
        .and.match(/^\d{16}$/g);
    });

    it('is the UTC time, zero-padded to 16 digits', () => {
      const at = (iso: string) => generateTimestamp(new Date(iso));

      expect(at('2026-10-07T20:50:00.000Z')).to.equal('2026100720500000');
      expect(at('2026-01-02T03:04:05.067Z')).to.equal('2026010203040506');
      expect(at('2026-10-07T00:00:00.990Z')).to.equal('2026100700000099');
    });

    it('sorts in the order the timestamps were generated', () => {
      const times = [
        '2026-10-07T08:59:59.990Z',
        '2026-10-07T09:00:00.000Z',
        '2026-10-07T09:09:09.100Z',
        '2026-10-07T10:00:00.000Z',
        '2026-10-07T19:59:00.000Z',
        '2026-10-07T20:00:00.000Z',
        '2026-10-07T23:59:59.999Z',
        '2026-10-08T00:00:00.000Z'
      ];
      const versions = times.map(iso => generateTimestamp(new Date(iso)));

      expect([...versions].sort()).to.deep.equal(versions);
      expect(versions.every(version => /^\d{16}$/.test(version))).to.be.true;
    });
  });

  describe('.padding()', () => {
    it('yields the specified char for the specified amount', () => {
      const iter = padding('w', 3);
      let next = iter.next();

      expect(next).to.have.property('value', 'w');
      expect(next).to.have.property('done', false);

      next = iter.next();

      expect(next).to.have.property('value', 'w');
      expect(next).to.have.property('done', false);

      next = iter.next();

      expect(next).to.have.property('value', 'w');
      expect(next).to.have.property('done', false);

      next = iter.next();

      expect(next).to.have.property('value', undefined);
      expect(next).to.have.property('done', true);
    });
  });
});
