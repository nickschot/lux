import isNull from './is-null';
import entries from './entries';
import isUndefined from './is-undefined';

/**
 * Removes null/undefined entries from an array or object.
 *
 * Overloaded because the two inputs behave differently: an array keeps its
 * element type, while an object may lose keys — hence `Partial<T>` rather than
 * Flow's `T`.
 *
 * @private
 */
export default function compact<T>(source: T[]): T[];
export default function compact<T extends object>(source: T): Partial<T>;
export default function compact(
  source: object | unknown[]
): object | unknown[] {
  if (Array.isArray(source)) {
    return source.filter(value => !isNull(value) && !isUndefined(value));
  }

  return entries(source as Record<string, unknown>)
    .filter(([, value]) => !isNull(value) && !isUndefined(value))
    .reduce<Record<string, unknown>>(
      (result, [key, value]) => ({
        ...result,
        [key]: value
      }),
      {}
    );
}
