import type Serializer from './index';
import type { Model, ModelClass } from '../database';

export type Serializer$opts<T extends Model> = {
  model: ModelClass<T>;
  parent: Serializer<Model> | null;
  namespace: string;
};

/**
 * The request's sparse fieldsets: attribute names keyed by resource type
 * (`fields[users]=name` → `{ users: ['name'] }`).
 */
export type Serializer$fields = Record<string, Array<string>>;
