import type Serializer from './index';
import type { Model, ModelClass } from '../database';

export type Serializer$opts<T extends Model> = {
  model: ModelClass<T>;
  parent: Serializer<Model> | null;
  namespace: string;
};
