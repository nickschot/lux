// SQLite out of the box: each environment gets its own file in db/. To use
// PostgreSQL or MySQL instead, set `driver` to 'pg' or 'mysql2', add
// `host`/`username`/`password`, and install the driver package.
//
// `pool` must be above 1: model hooks run inside the write's transaction, and
// the reads in `Action#notifyOwner` use a second connection — with SQLite's
// default single connection they would wait on the transaction forever.
export default {
  development: {
    driver: 'sqlite3',
    database: 'social_network',
    pool: 5
  },

  test: {
    driver: 'sqlite3',
    database: 'social_network',
    pool: 5
  },

  production: {
    driver: 'sqlite3',
    database: 'social_network',
    pool: 5
  }
};
