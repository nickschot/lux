import { camelize } from 'inflection';

import type Model from '../../model';
import type { RelationshipOptions } from '../index';
import { readAttribute } from '../../model/utils/attribute';

/**
 * @private
 */
async function getHasManyThrough(
  owner: Model,
  { model, inverse, through, foreignKey: baseKey }: RelationshipOptions,
  trx: unknown
): Promise<Array<Model>> {
  const inverseOpts = model.relationshipFor(inverse);
  let value: Array<Model> = [];

  if (through && inverseOpts) {
    const foreignKey = camelize(inverseOpts.foreignKey, true);
    const records = await through
      .select(baseKey, foreignKey)
      .where({
        [baseKey]: owner.getPrimaryKey()
      })
      .transacting(trx);

    if (records.length) {
      value = await model
        .where({
          [model.primaryKey]: records
            .map(record => readAttribute(record, foreignKey))
            .filter(Boolean)
        })
        .transacting(trx);
    }
  }

  return value;
}

/**
 * @private
 */
export function getHasOne(
  owner: Model,
  { model, foreignKey }: RelationshipOptions,
  trx: unknown = null
) {
  return model
    .first()
    .where({
      [foreignKey]: owner.getPrimaryKey()
    })
    .transacting(trx);
}

/**
 * @private
 */
export function getHasMany(
  owner: Model,
  opts: RelationshipOptions,
  trx: unknown = null
) {
  const { model, through, foreignKey } = opts;

  return through
    ? getHasManyThrough(owner, opts, trx)
    : model
        .where({
          [foreignKey]: owner.getPrimaryKey()
        })
        .transacting(trx);
}

/**
 * @private
 */
export function getBelongsTo(
  owner: Model,
  { model, foreignKey }: RelationshipOptions,
  trx: unknown = null
) {
  const foreignValue = readAttribute(owner, foreignKey);

  return foreignValue
    ? model.find(foreignValue).transacting(trx)
    : Promise.resolve(null);
}
