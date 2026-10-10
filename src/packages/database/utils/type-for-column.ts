import { TYPE_ALIASES } from '../constants';
import type { DatabaseColumn } from '../interfaces';

/** @internal */
export default function typeForColumn(
  column: DatabaseColumn
): string | undefined {
  return TYPE_ALIASES.get(column.type);
}
