import { EOL } from 'os';

import type { Knex } from 'knex';

import { connect } from '../../database';
import type { DatabaseEnvironmentConfig } from '../../database';

/**
 * `config` pointed at the server instead of the app's database, which may not
 * exist yet (`db:create`) or is about to go (`db:drop`): PostgreSQL's
 * `postgres` maintenance database, or no database for MySQL. Every other
 * setting (host, port, credentials, ssl) is kept.
 *
 * @internal
 */
export function serverConfigFor(
  config: DatabaseEnvironmentConfig
): DatabaseEnvironmentConfig {
  return {
    ...config,
    pool: 1,
    database: config.driver === 'pg' ? 'postgres' : undefined
  };
}

/**
 * The statement that creates or drops `database`, its name quoted as an
 * identifier. A PostgreSQL drop is `WITH (FORCE)` (PostgreSQL 13+), so a
 * server or console still connected doesn't block it; MySQL drops a database
 * with open connections anyway.
 *
 * @internal
 */
export function statementFor(
  connection: Knex,
  action: 'create' | 'drop',
  driver: string,
  database: string
): Knex.Raw {
  if (action === 'create') {
    return connection.raw('CREATE DATABASE ??', [database]);
  }

  return connection.raw(
    driver === 'pg'
      ? 'DROP DATABASE IF EXISTS ?? WITH (FORCE)'
      : 'DROP DATABASE IF EXISTS ??',
    [database]
  );
}

/**
 * Create or drop the database of `config` on its server, printing the
 * statement.
 *
 * @internal
 */
export default async function provision(
  path: string,
  config: DatabaseEnvironmentConfig,
  action: 'create' | 'drop'
): Promise<void> {
  const connection = connect(path, serverConfigFor(config));

  try {
    const statement = statementFor(
      connection,
      action,
      config.driver,
      config.database as string
    );

    process.stdout.write(`${statement.toString()};${EOL}`);
    await statement;
  } finally {
    await connection.destroy();
  }
}
