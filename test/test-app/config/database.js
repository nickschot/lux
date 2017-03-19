import * as os from 'os';

const {
  env: {
    DATABASE_DRIVER,
    DATABASE_USERNAME,
    DATABASE_PASSWORD,
    CIRCLE_NODE_INDEX,
  },
} = process;

const SQLITE3 = 'sqlite3';

let driver;

switch (CIRCLE_NODE_INDEX) {
  case '0':
    driver = 'pg';
    break;

  case '1':
    driver = 'mysql2';
    break;

  case '2':
    driver = SQLITE3;
    break;

  default:
    driver = DATABASE_DRIVER || SQLITE3;
    break;
}

export default (
  ['development', 'test', 'production'].reduce((config, env) => (
    Object.assign(config, {
      [env]: {
        driver,
        pool: driver === SQLITE3 ? undefined : 8,
        memory: driver === SQLITE3,
        database: 'lux_test',
        username: DATABASE_USERNAME,
        password: DATABASE_PASSWORD,
      },
    })
  ), {})
);
