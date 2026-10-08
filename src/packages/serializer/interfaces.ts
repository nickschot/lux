import type Serializer from './index';
import type { Model, ModelClass } from '../database';

/**
 * What Lumen constructs a serializer with when the app boots. Apps don't
 * construct serializers themselves.
 */
export type SerializerOptions<T extends Model> = {
  /** The model of the serializer's type. */
  model: ModelClass<T>;

  /** The namespace's `application` serializer, if there is one. */
  parent: Serializer<Model> | null;

  /** The serializer's namespace (`admin`), or `''` for the root. */
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
