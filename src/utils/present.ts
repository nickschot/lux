import isNull from './is-null';
import isUndefined from './is-undefined';

/**
 * @private
 */
export default function present(...values: unknown[]): boolean {
  return values.every(value => !isNull(value) && !isUndefined(value));
}
