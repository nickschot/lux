/* eslint-disable @typescript-eslint/no-explicit-any --
 * `ModelClass#table()` returns a Knex query builder, whose fluent type Lux does
 * not model; it is `any` at this boundary (as it was `Object` in Flow).
 */
import type Logger from '../logger';
import type Serializer from '../serializer';
import type Database from './index';
import type { Model, Query } from './index';
import type { Model$Hooks } from './model/interfaces';
import type { Relationship$opts } from './relationship/interfaces';
import type { Transaction$ResultProxy } from './transaction/interfaces';

type Database$pool =
  | number
  | {
      min: number;
      max: number;
    };

type Database$columnType =
  'floating' | 'enu' | 'bool' | 'varchar' | 'bigInteger';

export type Database$environment = {
  host?: string;
  pool?: Database$pool;
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

export type Database$config = {
  development: Database$environment;
  test: Database$environment;
  production: Database$environment;
};

export type Database$opts = {
  path: string;
  models: Map<string, ModelClass>;
  config: Database$config;
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
  relationships: Record<string, Relationship$opts>;
  relationshipNames: Array<string>;
  hasOne: Record<string, unknown>;
  hasMany: Record<string, unknown>;
  belongsTo: Record<string, unknown>;
  scopes: Record<string, unknown>;
  validates: Record<string, unknown>;
  hooks: Model$Hooks;
  store: Database;
  logger: Logger;

  table(): any;
  isInstance(value: unknown): boolean;
  initialize(store: Database, table: () => unknown): Promise<ModelClass>;
  transaction<R>(fn: (...args: Array<unknown>) => Promise<R>): Promise<R>;
  columnFor(key: string): Database$column | undefined;
  columnNameFor(key: string): string | undefined;
  relationshipFor(key: string): Relationship$opts | undefined;
  find(primaryKey: unknown): Query<T>;
  first(): Query<T>;
  where(conditions: Record<string, unknown>): Query<Array<T>>;
  select(...columns: Array<string>): Query<Array<T>>;
  create(
    attributes?: Record<string, unknown>,
    trx?: unknown
  ): Promise<Transaction$ResultProxy<T, boolean>>;
}
