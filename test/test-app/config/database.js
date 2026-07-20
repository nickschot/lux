const {
  env: {
    DATABASE_DRIVER = 'sqlite3',
    DATABASE_USERNAME,
    DATABASE_PASSWORD,
    DATABASE_HOST,
  }
} = process;

export default {
  development: {
    pool: 5,
    driver: 'sqlite3',
    database: 'lux_test'
  },
  test: {
    pool: 5,
    driver: DATABASE_DRIVER,
    database: 'lux_test',
    username: DATABASE_USERNAME,
    password: DATABASE_PASSWORD,
    // Left undefined outside CI so each driver keeps its own default. CI sets
    // it to 127.0.0.1: the service containers publish on IPv4, while "localhost"
    // can resolve to ::1 on Node 20. Ignored by sqlite3, which uses a filename.
    host: DATABASE_HOST
  },
  production: {
    pool: 5,
    driver: 'sqlite3',
    database: 'lux_test'
  }
};
