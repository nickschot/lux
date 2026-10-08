/* eslint-disable @typescript-eslint/no-explicit-any --
 * The query runner assembles results from raw Knex rows and dynamically-built
 * related sub-queries (dynamic key access over untyped column data), so
 * records, relationship descriptors and the constructed instances are genuinely
 * untyped at this layer.
 */
import { camelize, singularize } from 'inflection';

import type Model from '../../../model';
import type { ModelClass } from '../../../interfaces';
import entries from '../../../../../utils/entries';
import underscore from '../../../../../utils/underscore';
import promiseHash from '../../../../../utils/promise-hash';

/** @internal */
export default async function buildResults<T extends Model>({
  model,
  records,
  relationships,
  trx = null
}: {
  model: ModelClass<T>;
  records: Promise<Array<Record<string, any>>>;
  relationships: Record<string, any>;
  trx?: unknown;
}): Promise<Array<T>> {
  const results = await records;
  const pkPattern = new RegExp(`^.+\\.${model.primaryKey}$`);
  let related: Record<string, any> | undefined;

  if (!results.length) {
    return [];
  }

  if (Object.keys(relationships).length) {
    related = entries(relationships).reduce<Record<string, any>>(
      (obj, entry) => {
        const [name, relationship] = entry;
        let foreignKey = camelize(relationship.foreignKey, true);

        if (relationship.through) {
          const query = relationship.model
            .select(...relationship.attrs)
            .transacting(trx);

          // The join table's key for the related side: the inverse's.
          const relatedKey =
            relationship.model.relationshipFor(relationship.inverse)
              ?.foreignKey ?? `${singularize(underscore(name))}_id`;
          const baseKey = `${relationship.through.tableName}.${relatedKey}`;

          foreignKey = `${relationship.through.tableName}.${relationship.foreignKey}`;

          query.snapshots.push(
            [
              'select',
              [
                `${baseKey} as ${camelize(String(baseKey.split('.').pop()), true)}`,
                `${foreignKey} as ${camelize(String(foreignKey.split('.').pop()), true)}`
              ]
            ],
            [
              'innerJoin',
              [
                relationship.through.tableName,
                `${relationship.model.tableName}.${relationship.model.primaryKey}`,
                '=',
                baseKey
              ]
            ],
            ['whereIn', [foreignKey, results.map(({ id }) => id)]]
          );

          return { ...obj, [name]: query };
        }

        return {
          ...obj,
          [name]: relationship.model
            .select(...relationship.attrs)
            .where({
              [foreignKey]: results.map(({ id }) => id)
            })
            .transacting(trx)
        };
      },
      {}
    );

    related = await promiseHash(related);
  }

  return results.map(record => {
    if (related) {
      entries(related).forEach(
        ([name, relatedResults]: [string, Array<Model>]) => {
          const relationship = model.relationshipFor(name);

          if (relationship) {
            let { foreignKey } = relationship;

            foreignKey = camelize(foreignKey, true);

            record[name] = relatedResults.filter(({ rawColumnData }) => {
              const fk = rawColumnData[foreignKey];
              const pk = record[model.primaryKey];

              return fk === pk;
            });
          }
        }
      );
    }

    // A left-joined relationship with no match comes back as a row of nulls.
    // Drop all of its columns, not just its primary key: otherwise a record
    // is built from the remaining nulls, and the model fills in its column
    // defaults — on Postgres the primary key becomes the literal
    // `nextval('<table>_id_seq'::regclass)`, i.e. a phantom related record.
    const missing = new Set(
      entries(record)
        .filter(([key, value]) => value == null && pkPattern.test(key))
        .map(([key]) => key.split('.')[0])
    );

    // An unmatched has-one is known to be absent, so its getter must not
    // query for it again (belongs-to already skips the query on a null key).
    const absent = Array.from(missing).filter(
      name => model.relationshipFor(name)?.type === 'hasOne'
    );

    const instance = new model(
      entries(record).reduce<Record<string, any>>((r, entry) => {
        let [key, value] = entry;

        if (key.indexOf('.') >= 0 && missing.has(key.split('.')[0])) {
          return r;
        } else if (key.indexOf('.') >= 0) {
          const [a, b] = key.split('.');
          let parent: Record<string, any> = r[a];

          if (!parent) {
            parent = {};
          }

          key = a;
          value = {
            ...parent,
            [b]: value
          };
        }

        return {
          ...r,
          [key]: value
        };
      }, {})
    );

    absent.forEach(name => instance.absentRelationships.add(name));
    instance.currentChangeSet.persist();

    return instance;
  });
}
