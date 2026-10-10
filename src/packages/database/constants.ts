// Driver error codes and messages for a unique-constraint violation: pg
// (`23505`, "duplicate key value violates unique constraint"), mysql
// (`ER_DUP_ENTRY`), sqlite ("UNIQUE constraint failed") and mssql
// ("Violation of UNIQUE KEY constraint"). No `g` flag — `.test()` on a
// global regex is stateful and would miss every other match.
export const UNIQUE_CONSTRAINT_CODES = new Set(['23505', 'ER_DUP_ENTRY']);
export const UNIQUE_CONSTRAINT = /unique(\s+key)?\s+constraint|duplicate key/i;

// The SQLite client. (`sqlite3`, node-sqlite3, is unmaintained since its
// 6.0.0; `InvalidDriverError` says how to switch.)
export const SQLITE_DRIVER = 'better-sqlite3';

// knex 3 clients Lumen accepts.
export const VALID_DRIVERS = ['pg', SQLITE_DRIVER, 'mssql', 'mysql', 'mysql2'];

export const TYPE_ALIASES = new Map([
  ['enu', 'array'],
  ['enum', 'array'],

  ['json', 'object'],
  ['jsonb', 'object'],

  ['binary', 'buffer'],

  ['bool', 'boolean'],
  ['boolean', 'boolean'],

  ['time', 'date'],
  ['date', 'date'],
  ['datetime', 'date'],

  ['text', 'string'],
  ['uuid', 'string'],
  ['string', 'string'],
  ['varchar', 'string'],

  ['int', 'number'],
  ['float', 'number'],
  ['integer', 'number'],
  ['decimal', 'number'],
  ['floating', 'number'],
  ['bigInteger', 'number']
]);
