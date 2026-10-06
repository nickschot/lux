import type Model from '../../model';
import { writeAttribute } from '../../model/utils/attribute';

/**
 * @private
 */
function unassociateOne<T extends Model | null | undefined>(
  value: T,
  foreignKey: string
): T {
  if (value) {
    writeAttribute(value, foreignKey, null);
  }

  return value;
}

/**
 * @private
 */
export default function unassociate<T extends Model>(
  value: Array<T>,
  foreignKey: string
): Array<T> {
  return value.map(record => unassociateOne(record, foreignKey));
}
