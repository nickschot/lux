import type Model from '../../model';
import type { ModelClass } from '../../interfaces';
import type { RelationshipOptions } from '../index';
import { writeAttribute } from '../../model/utils/attribute';

/**
 * @private
 */
export function setHasManyInverse(
  owner: Model,
  value: Array<Model>,
  {
    inverse,
    foreignKey,
    inverseModel
  }: RelationshipOptions & {
    inverseModel: ModelClass;
  }
) {
  const primaryKey = owner.getPrimaryKey();
  const { type: inverseType } = inverseModel.relationshipFor(inverse)!;

  for (const record of value) {
    let { currentChangeSet: changeSet } = record;

    if (owner !== changeSet.get(inverse)) {
      if (changeSet.isPersisted) {
        changeSet = changeSet.applyTo(record);
      }

      changeSet.set(inverse, owner);

      if (inverseType === 'belongsTo') {
        writeAttribute(record, foreignKey, primaryKey);
      }
    }
  }
}

/**
 * @private
 */
export function setHasOneInverse(
  owner: Model,
  value: Model | null | undefined,
  {
    inverse,
    foreignKey,
    inverseModel
  }: RelationshipOptions & {
    inverseModel: ModelClass;
  }
) {
  if (value) {
    const { type: inverseType } = inverseModel.relationshipFor(inverse)!;
    let inverseValue = value.currentChangeSet.get(inverse);

    if (inverseType === 'hasMany') {
      if (!Array.isArray(inverseValue)) {
        inverseValue = [];
      }

      if (!inverseValue.includes(owner)) {
        inverseValue.push(owner);
      }
    } else if (owner !== inverseValue) {
      inverseValue = owner;

      if (inverseType === 'belongsTo') {
        writeAttribute(value, foreignKey, inverseValue.getPrimaryKey());
      }
    }

    let { currentChangeSet: changeSet } = value;

    if (changeSet.isPersisted) {
      changeSet = changeSet.applyTo(value);
    }

    changeSet.set(inverse, inverseValue || null);
  }
}
