import { StrictVisibilityError } from '../../controller/visibility/errors';
import type Controller from '../../controller';
import type Serializer from '../../serializer';
import type { Model, ModelClass } from '../../database';

/**
 * Enforce `strictVisibility`: for every namespace that has it, each type its
 * controllers can reach must have a visibility rule, `true` for one that may
 * be seen in full. A controller reaches its own type, and every type its
 * serializers' relationships lead to, down to its `maxIncludeDepth` and
 * always the direct ones, whose linkage every response carries and whose
 * related endpoints serve them. Throws listing each type without a rule,
 * with the shortest way it is reached. Run after `resolveVisibility()`.
 *
 * @internal
 */
export default function validateStrictVisibility(
  controllers: Map<string, Controller>
): void {
  // Per namespace, the types without a rule, and the shortest way each is
  // reached with its depth: how many relationships away it is.
  const missing = new Map<string, Map<string, [string, number]>>();

  const report = (
    controller: Controller,
    type: string,
    via: string,
    depth: number
  ) => {
    if (type in controller.visibility) {
      return;
    }

    const { namespace } = controller;
    const types = missing.get(namespace) ?? new Map<string, [string, number]>();
    const known = types.get(type);

    if (known === undefined || depth < known[1]) {
      types.set(type, [via, depth]);
    }

    missing.set(namespace, types);
  };

  controllers.forEach((controller, key) => {
    const { model, serializer, hasModel, hasSerializer } = controller;

    if (!controller.hasStrictVisibility || !hasModel || !hasSerializer) {
      return;
    }

    report(controller, model.resourceName, `controllers/${key}`, 0);

    // Breadth-first, so each type is reported through its shortest path.
    const depth = Math.max(controller.maxIncludeDepth, 1);
    let level: Array<[ModelClass, Serializer<Model>, Array<string>]> = [
      [model, serializer, []]
    ];

    for (let current = 1; current <= depth && level.length; current += 1) {
      const next: typeof level = [];

      level.forEach(([parent, parentSerializer, path]) => {
        [...parentSerializer.hasOne, ...parentSerializer.hasMany].forEach(
          name => {
            const opts = parent.relationshipFor(name);

            if (!opts) {
              return;
            }

            const nextPath = [...path, name];
            const related = opts.model;

            report(
              controller,
              related.resourceName,
              `controllers/${key} → ${nextPath.join('.')}`,
              current
            );

            const relatedSerializer = controller.serializerFor(related);

            if (relatedSerializer) {
              next.push([related, relatedSerializer, nextPath]);
            }
          }
        );
      });

      level = next;
    }
  });

  if (missing.size) {
    throw new StrictVisibilityError(
      new Map(
        Array.from(missing, ([namespace, types]) => [
          namespace,
          new Map(Array.from(types, ([type, [via]]) => [type, via]))
        ])
      )
    );
  }
}
