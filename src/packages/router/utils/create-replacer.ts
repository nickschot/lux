import { primaryKeyType } from '../../database';
import type Controller from '../../controller';

export type Replacer = (pathname: string) => {
  // The path with each id replaced by `:dynamic` (`/posts/:dynamic`).
  staticPath: string;

  // The ids, in order, as written in the path (percent-decoded).
  params: Array<string>;
};

const INTEGER = /^\d+$/;

/**
 * @private
 */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * @private
 */
function decode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * The resource name a controller's member routes are addressed by.
 *
 * @private
 */
function nameFor(controller: Controller): string {
  const { model, namespace } = controller;

  if (model) {
    return model.resourceName;
  }

  const name = controller.constructor.name
    .replace(/controller/gi, '')
    .toLowerCase();

  return namespace
    .split('/')
    .reduce((str, part) => str.replace(new RegExp(part, 'ig'), ''), name);
}

/**
 * Build the function that finds the ids in a request path: the segment after
 * a resource name. An id must be an integer unless the resource's primary key
 * is not numeric (e.g. a uuid), in which case any segment is one.
 *
 * @private
 */
export default function createReplacer(
  controllers: Map<string, Controller>
): Replacer {
  // Resources whose ids are not (necessarily) integers, lowercased.
  const anyId = new Set<string>();
  const names = new Set<string>();

  controllers.forEach(controller => {
    const name = nameFor(controller);

    names.add(name);

    if (controller.model && primaryKeyType(controller.model) !== 'number') {
      anyId.add(name.toLowerCase());
    }
  });

  if (!names.size) {
    return pathname => ({ staticPath: pathname, params: [] });
  }

  const pattern = new RegExp(
    `(^|/)(${Array.from(names, escapeRegExp).join('|')})/([^/]+)`,
    'gi'
  );

  return pathname => {
    const params: Array<string> = [];
    const staticPath = pathname.replace(
      pattern,
      (match: string, separator: string, name: string, id: string) => {
        if (!anyId.has(name.toLowerCase()) && !INTEGER.test(id)) {
          return match;
        }

        params.push(decode(id));
        return `${separator}${name}/:dynamic`;
      }
    );

    return { staticPath, params };
  };
}
