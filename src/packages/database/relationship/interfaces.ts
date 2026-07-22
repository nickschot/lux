import type { Model } from '../index';
import type { ModelClass } from '../interfaces';

type Relationship$ref = Model | Array<Model>;

export type Relationship$refs = WeakMap<Model, Map<string, Relationship$ref>>;

export type Relationship$opts = {
  type: 'hasOne' | 'hasMany' | 'belongsTo';
  model: ModelClass;
  inverse: string;
  through?: ModelClass;
  foreignKey: string;
};
