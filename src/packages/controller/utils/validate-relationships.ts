import entries from '../../../utils/entries';
import { RelatedRecordNotFoundError } from '../errors';
import type { Model, ModelClass } from '../../database';

/**
 * Check that every resource referenced from `data.relationships` exists, so a
 * write cannot leave dangling linkage. One query per relationship.
 *
 * @private
 */
export default async function validateRelationships<T extends Model>(
  model: ModelClass<T>,
  relationships: Record<string, unknown> = {}
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
      const ids = (isMany ? data : [data]).map(item =>
        Reflect.get(Object(item), 'id')
      );

      if (!ids.length) {
        return;
      }

      const column = related.columnNameFor(related.primaryKey) || 'id';
      const rows: Array<Record<string, unknown>> = await related
        .table()
        // An item without an id matches nothing and is reported below; knex
        // rejects `undefined` bindings outright.
        .whereIn(
          `${related.tableName}.${column}`,
          ids.filter(id => id != null)
        )
        .select(`${related.tableName}.${column}`);

      // Request ids may arrive as strings (to-many items) or numbers (to-one,
      // coerced by parameter validation); rows come back typed by the driver.
      const found = new Set(rows.map(row => String(Reflect.get(row, column))));
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
