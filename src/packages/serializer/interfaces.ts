import type Serializer from './index';
import type { Model, ModelClass } from '../database';

export type SerializerOptions<T extends Model> = {
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

/**
 * Whether the application serves `GET` at a route key path
 * (`/posts/:dynamic/relationships/user`).
 */
export type Serializer$routed = (path: string) => boolean;
