/* eslint-disable @typescript-eslint/no-explicit-any --
 * `ModelClass#table()` returns a Knex query builder, whose fluent type Lumen does
 * not model; it is `any` at this boundary (as it was `Object` in Flow).
 */
import type Logger from '../logger';
import type Serializer from '../serializer';
import type Database from './index';
import type { Model, Query } from './index';
import type { ModelHooks } from './model/interfaces';
import type { RelationshipOptions } from './relationship/interfaces';
import type { TransactionResult } from './transaction/interfaces';

export type DatabasePoolConfig =
  | number
  | {
      min: number;
      max: number;
    };

type Database$columnType =
  'floating' | 'enu' | 'bool' | 'varchar' | 'bigInteger';

export type DatabaseEnvironmentConfig = {
  host?: string;
  pool?: DatabasePoolConfig;
  debug?: boolean;
  driver: string;
  socket?: string;
  database?: string;
  username?: string;
  password?: string;
  port?: number;
  ssl?: boolean;
  url?: string;
};

export type DatabaseConfig = {
  development: DatabaseEnvironmentConfig;
  test: DatabaseEnvironmentConfig;
  production: DatabaseEnvironmentConfig;
  [environment: string]: DatabaseEnvironmentConfig | undefined;
};

export type Database$opts = {
  path: string;
  models: Map<string, ModelClass>;
  config: DatabaseConfig;
  logger: Logger;
  // Optional: `dbseed` constructs a Database without it (undefined → the
  // migration check is skipped).
  checkMigrations?: boolean;
};

export type Database$column = {
  type: Database$columnType;
  nullable: boolean;
  maxLength: string;
  columnName: string;
  defaultValue: unknown;
};

/**
 * The static-bearing model *class* (`Class<Model>` in the original Flow). The
 * `Model` base class and its subclasses satisfy this structurally; it is the
 * type app-facing code (controllers, serializers, the router) refers to when it
 * holds "a model class".
 */
export interface ModelClass<T extends Model = Model> {
  new (attrs?: Record<string, unknown>, initialize?: boolean): T;

  prototype: T;
  name: string;
  primaryKey: string;
  tableName: string;
  modelName: string;
  resourceName: string;
  serializer: Serializer<T>;
  attributes: Record<string, unknown>;
  attributeNames: Array<string>;
  relationships: Record<string, RelationshipOptions>;
  relationshipNames: Array<string>;
  hasOne: Record<string, unknown>;
  hasMany: Record<string, unknown>;
  belongsTo: Record<string, unknown>;
  scopes: Record<string, unknown>;
  validates: Record<string, unknown>;
  hooks: ModelHooks;
  store: Database;
  logger: Logger;

  table(): any;
  isInstance(value: unknown): boolean;
  initialize(store: Database, table: () => unknown): Promise<ModelClass>;
  transaction<R>(fn: (...args: Array<unknown>) => Promise<R>): Promise<R>;
  columnFor(key: string): Database$column | undefined;
  columnNameFor(key: string): string | undefined;
  relationshipFor(key: string): RelationshipOptions | undefined;
  find(primaryKey: unknown): Query<T>;
  first(): Query<T>;
  where(conditions: Record<string, unknown>): Query<Array<T>>;
  select(...columns: Array<string>): Query<Array<T>>;
  create(
    attributes?: Record<string, unknown>,
    trx?: unknown
  ): Promise<TransactionResult<T, boolean>>;
}
