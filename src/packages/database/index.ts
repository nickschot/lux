import type Knex from 'knex';

import type Logger from '../logger';

import { ModelMissingError } from './errors';
import initialize from './initialize';
import normalizeModelName from './utils/normalize-model-name';
import type { Database$opts, ModelClass } from './interfaces';

/**
 * @private
 */
class Database {
  declare path: string;

  declare debug: boolean;

  declare logger: Logger;

  declare config: Record<string, unknown>;

  declare schema: () => Knex.SchemaBuilder;

  declare connection: Knex;

  declare models: Map<string, ModelClass>;

  constructor(opts: Database$opts) {
    // Lux databases construct asynchronously: `initialize` populates `this` and
    // resolves once the schema/migrations/models are ready, so `new Database()`
    // is awaited by callers. TS can't express a Promise-returning constructor,
    // so assert the instance type here.
    return initialize(this, opts) as unknown as Database;
  }

  modelFor(type: string): ModelClass {
    const model = this.models.get(normalizeModelName(type));

    if (!model) {
      throw new ModelMissingError(type);
    }

    return model;
  }
}

export default Database;
export { default as Model } from './model';
export { default as Query } from './query';
export { default as Migration, generateTimestamp } from './migration';
export { default as connect } from './utils/connect';
export { default as typeForColumn } from './utils/type-for-column';
export { default as createMigrations } from './utils/create-migrations';
export { default as pendingMigrations } from './utils/pending-migrations';

export type { Database$opts, Database$config, ModelClass } from './interfaces';
