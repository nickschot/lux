import type { ModelClass } from '../interfaces';

import typeForColumn from './type-for-column';

// Numeric column types by name, for the ones `typeForColumn` has no alias for
// (they differ per database: `bigint`, `smallint`, `serial`, `numeric`, …).
const NUMERIC = /int|serial|numeric|decimal|float|double|real/i;

/**
 * The type of `model`'s primary key column: `'number'` for an auto-increment
 * id, `'string'` for e.g. a uuid or `varchar` (PostgreSQL reports the latter
 * as `character varying`, which `typeForColumn` does not know). `'number'`
 * when the column is unknown.
 *
 * @private
 */
export default function primaryKeyType(model: ModelClass): string {
  const column = model.columnFor(model.primaryKey);

  if (!column) {
    return 'number';
  }

  return (
    typeForColumn(column) || (NUMERIC.test(column.type) ? 'number' : 'string')
  );
}
