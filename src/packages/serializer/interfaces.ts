import type Serializer from './index';
import type { Model, ModelClass } from '../database';

export type Serializer$opts<T extends Model> = {
  model: ModelClass<T>;
  parent: Serializer<Model> | null;
  namespace: string;
};

/**
 * The request's sparse fieldsets: field (attribute and relationship) names
 * keyed by resource type (`fields[users]=name,posts` →
 * `{ users: ['name', 'posts'] }`). An empty list selects no fields.
 */
export type Serializer$fields = Record<string, Array<string>>;
