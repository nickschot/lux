import { camelize } from 'inflection';

import type Model from '../model';

import { getHasOne, getHasMany, getBelongsTo } from './utils/getters';
import { setHasOne, setHasMany, setBelongsTo } from './utils/setters';

/**
 * @private
 */
export function set(
  owner: Model,
  key: string,
  value?: Array<Model> | Model | null
) {
  const opts = owner.constructor.relationshipFor(key);

  if (opts) {
    const { type } = opts;
    let { foreignKey } = opts;

    foreignKey = camelize(foreignKey, true);

    if (Array.isArray(value)) {
      if (type === 'hasMany') {
        setHasMany(owner, key, value, {
          ...opts,
          foreignKey
        });
      }
    } else if (type === 'hasOne') {
      setHasOne(owner, key, value, {
        ...opts,
        foreignKey
      });
    } else if (type === 'belongsTo') {
      setBelongsTo(owner, key, value, {
        ...opts,
        foreignKey
      });
    }
  }
}

/**
 * The value of `owner`'s relationship `key`: the loaded or assigned one, or
 * else read from the database — in `trx` when given.
 *
 * @private
 */
export async function get(
  owner: Model,
  key: string,
  trx: unknown = null
): Promise<Array<Model> | Model | null> {
  const opts = owner.constructor.relationshipFor(key);
  let value: Array<Model> | Model | null = null;

  if (opts) {
    const { type } = opts;
    let { foreignKey } = opts;

    value = owner.currentChangeSet.get(key);
    foreignKey = camelize(foreignKey, true);

    if (!value && owner.absentRelationships.has(key)) {
      value = null;
    } else if (!value) {
      switch (type) {
        case 'hasOne':
          value = await getHasOne(
            owner,
            {
              ...opts,
              foreignKey
            },
            trx
          );
          break;

        case 'hasMany':
          value = await getHasMany(
            owner,
            {
              ...opts,
              foreignKey
            },
            trx
          );
          break;

        case 'belongsTo':
          value = await getBelongsTo(
            owner,
            {
              ...opts,
              foreignKey
            },
            trx
          );
          break;

        default:
          throw new Error(`Unknown relationship type '${type}'.`);
      }

      set(owner, key, value);
    }
  }

  return value;
}

export { default as updateRelationship } from './utils/update-relationship';
export type { RelationshipOptions } from './interfaces';
