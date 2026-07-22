import entries from '../../../utils/entries';
import type { Model, ModelClass } from '../../database';

/**
 * @private
 */
export default function resolveRelationships<T extends Model>(
  model: ModelClass<T>,
  relationships: Record<string, unknown> = {}
): Record<string, unknown> {
  return entries(relationships).reduce<Record<string, unknown>>(
    (obj, [key, value]) => {
      let { data = null } = (value as { data?: unknown } | null) || {};

      if (data) {
        const opts = model.relationshipFor(key);

        if (opts) {
          const Related = opts.model as new (attrs: unknown) => Model;

          if (Array.isArray(data)) {
            data = data.map(item => Reflect.construct(Related, [item]));
          } else {
            data = Reflect.construct(Related, [data]);
          }
        }
      }

      return {
        ...obj,
        [key]: data
      };
    },
    {}
  );
}
