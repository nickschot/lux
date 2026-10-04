import type { ModelClass } from '../interfaces';

import typeForColumn from './type-for-column';

/**
 * The type of `model`'s primary key column (`'number'` for an auto-increment
 * id, `'string'` for e.g. a uuid), `'number'` when the column is unknown.
 *
 * @private
 */
export default function primaryKeyType(model: ModelClass): string {
  const column = model.columnFor(model.primaryKey);

  return (column && typeForColumn(column)) || 'number';
}
