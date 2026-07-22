import { FREEZER } from '../constants';

/**
 * @private
 */
export default function isFrozen(value: unknown): boolean {
  // `WeakSet#has` returns false for non-objects rather than throwing, so this
  // keeps the original behaviour of accepting any value.
  return FREEZER.has(value as object);
}
