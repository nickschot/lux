import { FreezeableMap } from '../../freezeable';
import type { BundleNamespace, BundleNamespaceGroup } from '../index';

/**
 * @private
 */
export function resolve<T>(group: BundleNamespace<T>): BundleNamespaceGroup<T> {
  return Array.from(group)
    .map(([key, value]): [string, T, string] => {
      const parts = key.split('/');
      const namespace = parts.slice(0, Math.max(parts.length - 1, 0)).join('/');

      if (namespace) {
        return [key.substr(namespace.length + 1), value, namespace];
      }

      return [key, value, 'root'];
    })
    .reduce<BundleNamespaceGroup<T>>((map, [key, value, namespace]) => {
      let nsValue = map.get(namespace);

      if (!nsValue) {
        nsValue = new FreezeableMap();
      }

      return map.set(namespace, nsValue.set(key, value));
    }, new FreezeableMap());
}

export { default as closestAncestor } from './utils/closest-ancestor';
export { default as closestChild } from './utils/closest-child';
