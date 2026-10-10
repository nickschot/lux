import type { BundleNamespace } from '../../index';

/**
 * @private
 */
export default function sortByNamespace<T>(
  [a]: [string, BundleNamespace<T>],
  [b]: [string, BundleNamespace<T>]
): number {
  if (a === 'root') {
    return -1;
  } else if (b === 'root') {
    return 1;
  }

  return Math.min(Math.max(a.length - b.length, -1), 1);
}
