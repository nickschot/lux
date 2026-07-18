// TEMPORARY type shim for the not-yet-converted `database` package (Flow .js).
// Describes ONLY the surface the rest of the framework consumes. Delete this
// file when `database` is converted to TypeScript — see CLAUDE.md "Phase 3
// status". Runtime is unaffected: Babel/esbuild ignore `.d.ts`, so the real
// `database/index.js` is what loads.
import type Serializer from '../serializer';

export interface Database$column {
  type: string;
  nullable: boolean;
  defaultValue: unknown;
}

export interface Database$relationship {
  type: string;
  model: ModelClass;
}

/** A `Model` instance. */
export interface Model {
  id: number | string;
  resourceName: string;
  rawColumnData: Record<string, unknown>;
  didPersist: boolean;
  constructor: ModelClass;

  getPrimaryKey(): number | string;
  getAttributes(...keys: Array<string>): Record<string, unknown>;
  update(attributes: Record<string, unknown>): Promise<Model>;
  destroy(): Promise<Model>;
  unwrap(): Model;
}

/** The static-bearing model *class* (`Class<Model>` in Flow). */
export interface ModelClass<T extends Model = Model> {
  primaryKey: string;
  resourceName: string;
  serializer: Serializer<T>;
  relationships: Record<string, Database$relationship>;

  columnFor(key: string): Database$column | undefined;
  relationshipFor(key: string): Database$relationship | undefined;
  find(primaryKey: unknown): Query<T>;
  select(...columns: Array<string>): Query<Array<T>>;
  create(attributes: Record<string, unknown>): Promise<T>;

  new (data?: Record<string, unknown>): T;
}

export class Query<T = unknown> extends Promise<T> {
  static from(query: Query<unknown>): Query<unknown>;
  select(...columns: Array<string>): Query<T>;
  include(relationships: unknown): Query<T>;
  limit(amount: number): Query<T>;
  page(num: number): Query<T>;
  where(conditions: unknown): Query<T>;
  order(...columns: Array<string>): Query<T>;
  find(primaryKey: unknown): Query<T>;
  count(): Query<number>;
}

export function typeForColumn(column: Database$column): string | undefined;
