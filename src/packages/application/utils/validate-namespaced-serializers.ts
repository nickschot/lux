import { posix } from 'path';

import NamespacedSerializerMissingError from '../../../errors/namespaced-serializer-missing-error';
import type Controller from '../../controller';
import type Serializer from '../../serializer';
import type { Model, ModelClass } from '../../database';
import type { Bundle$Namespace } from '../../loader';

// How many relationships away from a controller's own resource `via` is:
// `admin/comments` is 0, `admin/posts?include=comments` is 1.
const distance = (via: string): number => {
  const [, include] = via.split('?include=');

  return include ? include.split('.').length : 0;
};

/**
 * Enforce `serializerFallback = false`: for every namespace whose
 * ApplicationController sets it, each type its controllers can serialize — the
 * resource itself, and everything reachable through `include` (and so
 * `fields`) down to the controller's `maxIncludeDepth` — must have a
 * Serializer in exactly that namespace. Throws listing every gap, so a missing
 * serializer fails the boot instead of silently falling back to the root one.
 *
 * @internal
 */
export default function validateNamespacedSerializers(
  controllers: Bundle$Namespace<Controller> | Map<string, Controller>,
  serializers:
    Bundle$Namespace<Serializer<Model>> | Map<string, Serializer<Model>>
): void {
  const missing = new Map<string, string>();

  controllers.forEach((controller, key) => {
    const { namespace, model } = controller;

    if (!namespace || !model) {
      return;
    }

    const application = controllers.get(posix.join(namespace, 'application'));

    if (!application || application.serializerFallback !== false) {
      return;
    }

    const require = (type: string, via: string) => {
      const serializerKey = posix.join(namespace, type);
      const serializer = serializers.get(serializerKey);

      // Report the most direct way a type is reached: by its own controller,
      // else through the shortest include path of any controller.
      if (!serializer) {
        const known = missing.get(serializerKey);

        if (known === undefined || distance(via) < distance(known)) {
          missing.set(serializerKey, via);
        }
      }

      return serializer;
    };

    const own = require(model.resourceName, key);

    if (!own) {
      return;
    }

    // Breadth-first, so each gap is reported through its shortest include
    // path. Direct relationships are always includable (and
    // `fields`-selectable), even with a `maxIncludeDepth` below 1.
    const depth = Math.max(controller.maxIncludeDepth, 1);
    let level: Array<[ModelClass, Serializer<Model>, Array<string>]> = [
      [model, own, []]
    ];

    for (let current = 1; current <= depth && level.length; current += 1) {
      const next: typeof level = [];

      level.forEach(([parent, serializer, path]) => {
        [...serializer.hasOne, ...serializer.hasMany].forEach(name => {
          const opts = parent.relationshipFor(name);

          if (!opts) {
            return;
          }

          const nextPath = [...path, name];
          const related = require(opts.model
            .resourceName, `${key}?include=${nextPath.join('.')}`);

          if (related) {
            next.push([opts.model, related, nextPath]);
          }
        });
      });

      level = next;
    }
  });

  if (missing.size) {
    throw new NamespacedSerializerMissingError(missing);
  }
}
