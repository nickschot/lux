// SQLite out of the box: each environment gets its own file in db/. To use
// PostgreSQL or MySQL instead, set `driver` to 'pg' or 'mysql2', add
// `host`/`username`/`password`, and install the driver package.
export default {
  development: {
    driver: 'better-sqlite3',
    database: 'social_network'
  },

  test: {
    driver: 'better-sqlite3',
    database: 'social_network'
  },

  production: {
    driver: 'better-sqlite3',
    database: 'social_network'
  }
};
