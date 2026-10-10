import { dasherize, underscore } from 'inflection';

import LinksOnlyError from '../../../errors/links-only-error';
import type Router from '../../router';
import type Serializer from '../../serializer';
import type { Model } from '../../database';
import type { BundleNamespace } from '../../loader';

/**
 * Check every Serializer's `linksOnly` against the built `router`: each
 * relationship must be one of its `hasMany`, and have a related endpoint
 * (`/posts/:id/comments`) in at least one namespace where the Serializer
 * formats its type — else it could never be left without its linkage.
 * Throws listing every problem.
 *
 * Whatever removes a related endpoint counts: no controller for the related
 * type in the namespace, a related resource without `index`, an owning
 * resource without `show` (or without the relationship in its
 * `relationships`), or a custom route at that path.
 *
 * @internal
 */
export default function validateLinksOnly(
  router: Router,
  serializers:
    BundleNamespace<Serializer<Model>> | Map<string, Serializer<Model>>
): void {
  const problems: Array<string> = [];
  // The relationships each Serializer has a related endpoint for, in some
  // namespace that formats its type with it.
  const served = new Map<Serializer<Model>, Set<string>>();

  router.forEach((route, key) => {
    const { type, controller, relationship } = route;

    if (type !== 'related' || !relationship || !key.startsWith('GET:')) {
      return;
    }

    [controller.serializer, controller.serializerFor(controller.model)].forEach(
      serializer => {
        const names = served.get(serializer) || new Set<string>();

        names.add(relationship);
        served.set(serializer, names);
      }
    );
  });

  serializers.forEach((serializer, key) => {
    const { model, hasMany, linksOnly } = serializer;

    linksOnly.forEach(name => {
      const opts = model?.relationshipFor(name);

      if (!hasMany.includes(name) || opts?.type !== 'hasMany') {
        problems.push(`${key}: \`${name}\` is not one of its \`hasMany\``);
      } else if (!served.get(serializer)?.has(name)) {
        const type = opts.model.resourceName;

        problems.push(
          `${key}: \`${name}\` has no related endpoint ` +
            `(GET /${model.resourceName}/:id/${dasherize(underscore(name))}) ` +
            'where this serializer is used — that namespace needs a ' +
            `\`${type}\` resource routing \`index\`, and ` +
            `\`${model.resourceName}\` must route \`show\` with \`${name}\` ` +
            'among its `relationships`'
        );
      }
    });
  });

  if (problems.length) {
    throw new LinksOnlyError(problems);
  }
}
