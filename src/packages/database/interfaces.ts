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

/**
 * The size of the connection pool, per process: a maximum (the minimum is
 * then 2, or 1 for a pool of 1), or both bounds.
 */
export type DatabasePoolConfig =
  | number
  | {
      /** The fewest connections kept open. */
      min: number;

      /** The most connections open at once. */
      max: number;
    };

type DatabaseColumnType =
  'floating' | 'enu' | 'bool' | 'varchar' | 'bigInteger';

/**
 * The database connection of one environment, in `config/database.js`.
 *
 * ```javascript
 * production: {
 *   driver: 'pg',
 *   host: 'db.internal',
 *   database: 'blog_prod',
 *   username: 'blog',
 *   password: process.env.DATABASE_PASSWORD,
 *   pool: 10
 * }
 * ```
 *
 * A `url`, or the `DATABASE_URL` environment variable, replaces the host,
 * credentials and database settings; `driver`, `pool`, `debug` and `ssl`
 * still apply.
 */
export type DatabaseEnvironmentConfig = {
  /** The database server's host name. */
  host?: string;

  /** The connection pool size, per process. */
  pool?: DatabasePoolConfig;

  /**
   * Log every SQL statement, with its values, at `DEBUG`. Defaults to `true`
   * in development only.
   */
  debug?: boolean;

  /** The client: `'pg'`, `'mysql2'` or `'better-sqlite3'`. */
  driver: string;

  /** A Unix socket to connect through instead of `host` and `port`. */
  socket?: string;

  /**
   * The database name. With SQLite, the file is
   * `db/<database>_<NODE_ENV>.sqlite` in the app.
   */
  database?: string;

  /** The user to connect as. */
  username?: string;

  /** The user's password. */
  password?: string;

  /** The database server's port. */
  port?: number;

  /**
   * Connect over TLS: `true`, or the driver's TLS options
   * (`{ rejectUnauthorized: false }` for a certificate Node doesn't trust,
   * as on Heroku Postgres). Applies with a `url` or `DATABASE_URL` too,
   * unless the URL sets TLS itself (`?sslmode=…`).
   */
  ssl?: boolean | Record<string, unknown>;

  /**
   * A connection string (`postgres://user:pass@host:5432/db`) that replaces
   * the host, credentials and database settings. `DATABASE_URL` takes
   * precedence over it.
   */
  url?: string;
};

/**
 * The contents of `config/database.js`: a connection per environment,
 * chosen by `NODE_ENV` or the CLI's `--environment`.
 */
export type DatabaseConfig = {
  /** The connection used by `lumen serve` and the `db:` commands by default. */
  development: DatabaseEnvironmentConfig;

  /** The connection used when `NODE_ENV` is `test`. */
  test: DatabaseEnvironmentConfig;

  /** The connection used when `NODE_ENV` is `production`. */
  production: DatabaseEnvironmentConfig;
  [environment: string]: DatabaseEnvironmentConfig | undefined;
};

export type DatabaseOptions = {
  path: string;
  models: Map<string, ModelClass>;
  config: DatabaseConfig;
  logger: Logger;
  // Optional: `dbseed` constructs a Database without it (undefined → the
  // migration check is skipped).
  checkMigrations?: boolean;
  // Off for `db:migrate`/`db:rollback`: a foreign key column a pending
  // migration adds must not keep that migration from running.
  checkRelationships?: boolean;
};

export type DatabaseColumn = {
  type: DatabaseColumnType;
  nullable: boolean;
  maxLength: string;
  columnName: string;
  defaultValue: unknown;
};

/**
 * A model class — {@link Model} or a subclass — as a value: what
 * `Post` is, where a `Post` record is a {@link Model}. Framework APIs that
 * take or return a model use it.
 */
export interface ModelClass<T extends Model = Model> {
  /** @internal */
  new (attrs?: Record<string, unknown>, initialize?: boolean): T;

  /** @internal */
  prototype: T;

  /** The class name (`BlogPost`). */
  name: string;

  /** See {@link Model.primaryKey}. */
  primaryKey: string;

  /** See {@link Model.tableName}. */
  tableName: string;

  /** See {@link Model.modelName}. */
  modelName: string;

  /** See {@link Model.resourceName}. */
  resourceName: string;

  /** @internal */
  serializer: Serializer<T>;

  /** @internal */
  attributes: Record<string, unknown>;

  /** @internal */
  attributeNames: Array<string>;

  /** @internal */
  relationships: Record<string, RelationshipOptions>;

  /** @internal */
  relationshipNames: Array<string>;

  /** See {@link Model.hasOne}. */
  hasOne: Record<string, unknown>;

  /** See {@link Model.hasMany}. */
  hasMany: Record<string, unknown>;

  /** See {@link Model.belongsTo}. */
  belongsTo: Record<string, unknown>;

  /** See {@link Model.scopes}. */
  scopes: Record<string, unknown>;

  /** See {@link Model.validates}. */
  validates: Record<string, unknown>;

  /** See {@link Model.hooks}. */
  hooks: ModelHooks;

  /** @internal */
  store: Database;

  /** See {@link Model.logger}. */
  logger: Logger;

  /** @internal */
  table(): any;

  /** See {@link Model.isInstance}. */
  isInstance(value: unknown): boolean;

  /** @internal */
  initialize(store: Database, table: () => unknown): Promise<ModelClass>;

  /** See {@link Model.transaction}. */
  transaction<R>(fn: (...args: Array<unknown>) => Promise<R>): Promise<R>;

  /** @internal */
  columnFor(key: string): DatabaseColumn | undefined;

  /** @internal */
  columnNameFor(key: string): string | undefined;

  /** @internal */
  relationshipFor(key: string): RelationshipOptions | undefined;

  /** See {@link Model.find}. */
  find(primaryKey: unknown): Query<T>;

  /** See {@link Model.first}. */
  first(): Query<T>;

  /** See {@link Model.where}. */
  where(conditions: Record<string, unknown>): Query<Array<T>>;

  /** See {@link Model.select}. */
  select(...columns: Array<string>): Query<Array<T>>;

  /** See {@link Model.create}. */
  create(
    attributes?: Record<string, unknown>,
    trx?: unknown
  ): Promise<TransactionResult<T, boolean>>;
}
