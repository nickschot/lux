import entries from '../../../utils/entries';
import { RelatedRecordNotFoundError } from '../errors';
import { Scope } from '../visibility';
import type { Model, ModelClass } from '../../database';

/**
 * Check that every resource referenced from `data.relationships` exists, so a
 * write cannot leave dangling linkage, or link a record `scope` hides. One
 * query per relationship.
 *
 * @private
 */
export default async function validateRelationships<T extends Model>(
  model: ModelClass<T>,
  relationships: Record<string, unknown> = {},
  scope: Scope = Scope.none
): Promise<void> {
  await Promise.all(
    entries(relationships).map(async ([key, value]) => {
      const opts = model.relationshipFor(key);
      const { data = null } = (value as { data?: unknown } | null) || {};

      if (!opts || !data) {
        return;
      }

      const { model: related } = opts;
      const isMany = Array.isArray(data);
      const ids = (isMany ? data : [data]).map(item => Object(item).id);

      if (!ids.length) {
        return;
      }

      // An item without an id matches nothing and is reported below; knex
      // rejects `undefined` bindings outright. A record hidden from the
      // request by a visibility rule is reported the same way.
      const rows = await scope.apply(
        related.select(related.primaryKey).where({
          [related.primaryKey]: ids.filter(id => id != null)
        })
      );

      // Request ids may arrive as strings (to-many items) or numbers (to-one,
      // coerced by parameter validation); rows come back typed by the driver.
      const found = new Set(rows.map(row => String(row.getPrimaryKey())));
      const missing = ids.findIndex(id => !found.has(String(id)));

      if (missing >= 0) {
        const path = `data.relationships.${key}.data`;

        throw new RelatedRecordNotFoundError(
          related,
          ids[missing],
          isMany ? `${path}.${missing}` : path
        );
      }
    })
  );
}
