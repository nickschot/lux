import type { Model, ModelClass } from '../../database';
import type Serializer from '../index';

/**
 * A parsed `include` parameter: each relationship name maps to the tree of
 * relationships to include from the records it points to.
 *
 * @private
 */
export type IncludeTree = Map<string, IncludeTree>;

/**
 * Parse relationship paths (`['comments', 'comments.user', 'user']`) into an
 * include tree. Every prefix of a path is part of the tree, because JSON:API
 * requires the intermediate resources of a multi-part path to be included
 * along with its leaves (`comments.user` includes the comments too).
 *
 * @private
 */
export function createIncludeTree(paths: Array<string> = []): IncludeTree {
  const tree: IncludeTree = new Map();

  paths.forEach(path => {
    path
      .split('.')
      .filter(Boolean)
      .reduce((node, name) => {
        let child = node.get(name);

        if (!child) {
          child = new Map();
          node.set(name, child);
        }

        return child;
      }, tree);
  });

  return tree;
}

/**
 * Enumerate every include path available from `names` (relationships of
 * `model`), down to `depth` levels. Each level continues with the relationships
 * declared by the related model's serializer as `serializerFor` resolves it —
 * the same one its included resources are serialized with (namespaced, with a
 * fallback to the root). Used to build the allowed values of the `include`
 * parameter.
 *
 * @private
 */
export function enumerateIncludePaths(
  model: ModelClass,
  names: Array<string>,
  depth: number,
  serializerFor: (
    model: ModelClass
  ) => Serializer<Model> | undefined = related => related.serializer
): Array<string> {
  if (depth < 1) {
    return [];
  }

  return names.reduce<Array<string>>((paths, name) => {
    const opts = model.relationshipFor(name);

    if (!opts) {
      return paths;
    }

    const { model: related } = opts;
    const serializer = serializerFor(related);

    if (!serializer) {
      return [...paths, name];
    }

    const { hasOne, hasMany } = serializer;

    return [
      ...paths,
      name,
      ...enumerateIncludePaths(
        related,
        [...hasOne, ...hasMany],
        depth - 1,
        serializerFor
      ).map(path => `${name}.${path}`)
    ];
  }, []);
}
