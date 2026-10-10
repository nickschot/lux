import { join as joinPath } from 'path';

import type { Knex } from 'knex';

import { NODE_ENV, DATABASE_URL } from '../../../constants';
import { SQLITE_DRIVER, VALID_DRIVERS } from '../constants';
import { InvalidDriverError } from '../errors';
import type { DatabaseEnvironmentConfig } from '../interfaces';

/**
 * The knex `connection` for an environment's database config.
 *
 * A URL — `DATABASE_URL`, else the environment's `url` — gives the host,
 * credentials and database, and replaces those settings. `ssl` from the
 * config still applies on top of it (for `pg` and `mysql2`, which take the
 * URL as `connectionString` / `uri` next to their other options), so an app
 * on a platform that sets `DATABASE_URL` can configure TLS in
 * `config/database.js`. A TLS setting written in the URL itself
 * (`?sslmode=…` for `pg`, `?ssl=…` for `mysql2`) takes precedence: the
 * drivers apply what they parse from the URL last.
 *
 * @internal
 */
export function connectionFor(
  path: string,
  config: DatabaseEnvironmentConfig,
  databaseUrl: string | undefined = DATABASE_URL
): string | Record<string, unknown> {
  const { host, socket, driver, database, username, password, port, ssl, url } =
    config;
  const connectionUrl = databaseUrl || url;

  if (connectionUrl) {
    if (driver === SQLITE_DRIVER || ssl === undefined) {
      return connectionUrl;
    }

    return driver === 'pg'
      ? { connectionString: connectionUrl, ssl }
      : { uri: connectionUrl, ssl };
  }

  return {
    host,
    database,
    password,
    port,
    ssl,
    user: username,
    socketPath: socket,
    filename:
      driver === SQLITE_DRIVER
        ? joinPath(path, 'db', `${database || 'default'}_${NODE_ENV}.sqlite`)
        : undefined
  };
}

/** @internal */
export default function connect(
  path: string,
  config: DatabaseEnvironmentConfig
): Knex {
  let { pool } = config;

  const { driver } = config;

  if (VALID_DRIVERS.indexOf(driver) < 0) {
    throw new InvalidDriverError(driver);
  }

  const usingSQLite = driver === SQLITE_DRIVER;

  if (usingSQLite) {
    // One connection, whatever `pool` says. better-sqlite3 is synchronous: a
    // connection waiting on another's lock blocks the event loop, so the one
    // holding it can never finish, and the wait fails ("database is locked").
    // With one connection, writes queue in the pool instead.
    pool = { min: 1, max: 1 };
  } else if (pool && typeof pool === 'number') {
    pool = {
      min: pool > 1 ? 2 : 1,
      max: pool
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const knex = require(joinPath(path, 'node_modules', 'knex'));

  return knex({
    pool,
    connection: connectionFor(path, config),
    debug: false,
    client: driver,
    useNullAsDefault: usingSQLite
  });
}
