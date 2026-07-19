import { posix } from 'path';

import type { Builder$Construct, Builder$ParentBuilder } from '../interfaces';
import type { Builder$NamespaceMeta } from '../interfaces';

import sortByNamespace from './sort-by-namespace';

export default function createParentBuilder<T>(
  construct: Builder$Construct<T>
): Builder$ParentBuilder<T> {
  return target =>
    Array.from(target)
      .sort(sortByNamespace)
      .reduce<Array<Builder$NamespaceMeta<T>>>((result, [key, value]) => {
        const parentClass = value.get('application') || null;
        let parent: T | null = null;

        if (parentClass) {
          let grandparent: T | null = null;

          if (key !== 'root') {
            const found = result.find(namespace => {
              const dirname = posix.dirname(key);

              if (namespace.key === 'root') {
                return dirname === '.';
              }

              return dirname === namespace.key;
            });

            if (found) {
              grandparent = found.parent;
            }
          }

          parent = construct(`${key}/application`, parentClass, grandparent);
        }

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
