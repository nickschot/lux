/**
 * Determine wether or not a value is an Object.
 *
 * @example
 * const a = null;
 * const b = [];
 * const c = {};
 *
 * console.log(typeof a, typeof b, typeof c);
 * // => 'object', 'object', 'object' 👎
 *
 * console.log(isObject(a), isObject(b), isObject(c));
 * // => false, false, true 👍
 *
 * @private
 */
export default function isObject(
  value: unknown
): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
