import { posix } from 'path';

import LinksOnlyError from '../../../errors/links-only-error';
import closestAncestor from '../../loader/resolver/utils/closest-ancestor';
import type Controller from '../../controller';
import type Serializer from '../../serializer';
import type { Model } from '../../database';
import type { Bundle$Namespace } from '../../loader';

/**
 * Check every Serializer's `linksOnly`: each relationship must be one of its
 * `hasMany`, and its type must have a controller (with a model and a
 * Serializer) in the Serializer's namespace or an ancestor, the one that
 * serves the related endpoint. Otherwise the relationship could never be
 * left without its linkage. Throws listing every problem.
 *
 * @private
 */
export default function validateLinksOnly(
  controllers: Bundle$Namespace<Controller> | Map<string, Controller>,
  serializers:
    Bundle$Namespace<Serializer<Model>> | Map<string, Serializer<Model>>
): void {
  const problems: Array<string> = [];

  serializers.forEach((serializer, key) => {
    const { model, namespace, hasMany, linksOnly } = serializer;

    linksOnly.forEach(name => {
      const opts = model?.relationshipFor(name);

      if (!hasMany.includes(name) || opts?.type !== 'hasMany') {
        problems.push(`${key}: \`${name}\` is not one of its \`hasMany\``);
        return;
      }

      const type = opts.model.resourceName;
      const controllerKey = posix.join(namespace || '.', type);
      const controller =
        controllers.get(controllerKey) ||
        closestAncestor(controllers, controllerKey);

      if (!controller?.hasModel || !controller.hasSerializer) {
        problems.push(`${key}: \`${name}\` has no \`${type}\` controller`);
      }
    });
  });

  if (problems.length) {
    throw new LinksOnlyError(problems);
  }
}
