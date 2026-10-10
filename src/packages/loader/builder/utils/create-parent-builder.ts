import { posix } from 'path';

import type { BuilderConstruct, ParentBuilder } from '../interfaces';
import type { NamespaceMeta } from '../interfaces';

import sortByNamespace from './sort-by-namespace';

/**
 * The parent of the closest ancestor namespace of `key` that has been built,
 * or `null` at the root. Walks up past ancestors with no entry of their own
 * (`members` when only `members/v2` has files).
 */
function inheritedParent<T>(
  built: Array<NamespaceMeta<T>>,
  key: string
): T | null {
  let namespace = key;

  while (namespace !== 'root') {
    const dirname = posix.dirname(namespace);

    namespace = dirname === '.' ? 'root' : dirname;

    const found = built.find(meta => meta.key === namespace);

    if (found) {
      return found.parent;
    }
  }

  return null;
}

/**
 * Build each namespace's `application` module and record it as the
 * namespace's parent, constructed with its own parent namespace's. A
 * namespace without an `application` module takes its closest ancestor's, so
 * its modules still get what the ancestors' ApplicationControllers declare
 * (hooks, settings).
 */
export default function createParentBuilder<T>(
  construct: BuilderConstruct<T>
): ParentBuilder<T> {
  return target =>
    Array.from(target)
      .sort(sortByNamespace)
      .reduce<Array<NamespaceMeta<T>>>((result, [key, value]) => {
        const parentClass = value.get('application') || null;
        const inherited = key === 'root' ? null : inheritedParent(result, key);
        const parent = parentClass
          ? construct(`${key}/application`, parentClass, inherited)
          : inherited;

        return [
          ...result,
          {
            key,
            value,
            parent
          }
        ];
      }, []);
}
