import { posix } from 'path';

/**
 * The value at `key`'s name in the closest ancestor namespace of `key`
 * (`admin/users` → `users`).
 */
export default function closestAncestor<T>(
  source: { get(key: string): T | undefined },
  key: string
): T | undefined {
  const name = posix.basename(key);
  let namespace = posix.dirname(key);

  if (namespace === '.') {
    return source.get(name);
  }

  namespace = posix.dirname(namespace);

  const ancestor = source.get(posix.join(namespace, name));

  if (ancestor) {
    return ancestor;
  }

  return closestAncestor(source, posix.join(posix.dirname(namespace), name));
}
