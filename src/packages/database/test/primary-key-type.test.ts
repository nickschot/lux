import { it, describe, expect } from 'vitest';

import primaryKeyType from '../utils/primary-key-type';
import type { ModelClass } from '../interfaces';

// A stand-in with just what `primaryKeyType()` reads; `type` is the column
// type as the database reports it.
const modelWith = (type?: string) =>
  ({
    primaryKey: 'id',
    columnFor: () => (type === undefined ? undefined : { type })
  }) as unknown as ModelClass;

describe('module "database" #primaryKeyType()', () => {
  it('recognizes numeric keys by any database type name', () => {
    // sqlite/mysql, then PostgreSQL's names.
    [
      'integer',
      'int',
      'bigInteger',
      'bigint',
      'smallint',
      'serial',
      'numeric'
    ].forEach(type =>
      expect(primaryKeyType(modelWith(type)), type).to.equal('number')
    );
  });

  it('recognizes string keys by any database type name', () => {
    // PostgreSQL reports `varchar` as `character varying`.
    ['varchar', 'character varying', 'character', 'text', 'uuid'].forEach(
      type => expect(primaryKeyType(modelWith(type)), type).to.equal('string')
    );
  });

  it('assumes a numeric key when the column is unknown', () => {
    expect(primaryKeyType(modelWith())).to.equal('number');
  });
});
