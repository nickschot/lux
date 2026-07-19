import pick from '../../../../utils/pick';
import entries from '../../../../utils/entries';
import type Model from '../index';

/**
 * @private
 */
export default function getColumns(record: Model, only?: Array<string>) {
  let columns: Record<string, unknown> = record.constructor.attributes;

  if (only) {
    columns = pick(columns, ...only) as Record<string, unknown>;
  }

  return entries(columns).reduce<Record<string, unknown>>(
    (obj, [key, col]) => ({
      ...obj,
      [(col as { columnName: string }).columnName]: Reflect.get(record, key)
    }),
    {}
  );
}
