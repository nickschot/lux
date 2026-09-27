import type { ModelClass } from '../../database';

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
 * declared by the related model's serializer — the same ones its resources are
 * serialized with. Used to build the allowed values of the `include` parameter.
 *
 * @private
 */
export function enumerateIncludePaths(
  model: ModelClass,
  names: Array<string>,
  depth: number
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

    if (!related.serializer) {
      return [...paths, name];
    }

    const { hasOne, hasMany } = related.serializer;

    return [
      ...paths,
      name,
      ...enumerateIncludePaths(related, [...hasOne, ...hasMany], depth - 1).map(
        path => `${name}.${path}`
      )
    ];
  }, []);
}
