import type { Model } from '../index';
import type { ModelClass } from '../interfaces';

type Relationship$ref = Model | Array<Model>;

export type Relationship$refs = WeakMap<Model, Map<string, Relationship$ref>>;

/**
 * A relationship as Lumen resolves it when the app boots, from a model's
 * {@link Model.hasOne}, {@link Model.hasMany} or {@link Model.belongsTo}
 * declaration.
 */
export type RelationshipOptions = {
  /** Which kind of relationship it is. */
  type: 'hasOne' | 'hasMany' | 'belongsTo';

  /** The related model. */
  model: ModelClass;

  /** The name of the relationship on the related model that points back. */
  inverse: string;

  /** The join model of a many-to-many relationship. */
  through?: ModelClass;

  /** The foreign key column, derived from the relationship's names. */
  foreignKey: string;
};
