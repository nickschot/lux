const {
  env: {
    DATABASE_DRIVER = 'better-sqlite3',
    DATABASE_USERNAME,
    DATABASE_PASSWORD,
    DATABASE_HOST,
  }
} = process;

export default {
  development: {
    pool: 5,
    driver: 'better-sqlite3',
    database: 'lumen_test'
  },
  test: {
    pool: 5,
    driver: DATABASE_DRIVER,
    database: 'lumen_test',
    username: DATABASE_USERNAME,
    password: DATABASE_PASSWORD,
    // Left undefined outside CI so each driver keeps its own default. CI sets
    // it to 127.0.0.1: the service containers publish on IPv4, while "localhost"
    // can resolve to ::1 on modern Node. Ignored by better-sqlite3, which uses a
    // filename.
    host: DATABASE_HOST
  },
  production: {
    pool: 5,
    driver: 'better-sqlite3',
    database: 'lumen_test'
  }
};
