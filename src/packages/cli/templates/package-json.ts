import { version } from '../../../../package.json';

const LUX_VERSION: string = version;

// The knex client name (what `driverFor` returns) -> the npm package + version
// a generated app needs installed to actually connect. Pinned to the versions
// CI validates (see test/test-app).
const DRIVER_DEPS: Record<string, { name: string; version: string }> = {
  sqlite3: { name: 'sqlite3', version: '^5.1.7' },
  pg: { name: 'pg', version: '^8.16.3' },
  mysql2: { name: 'mysql2', version: '^3.15.3' }
};

/**
 * @private
 */
export default (name: string, driver: string): string => {
  const dbDriver = DRIVER_DEPS[driver] || DRIVER_DEPS.sqlite3;

  const pkg: Record<string, unknown> = {
    name,
    version: '0.0.1',
    description: '',
    scripts: {
      start: 'lux serve',
      test: 'lux test',
      lint: 'eslint .'
    },
    author: '',
    license: 'MIT',
    dependencies: {
      knex: '^3.3.0',
      'lux-framework': LUX_VERSION,
      [dbDriver.name]: dbDriver.version
    },
    devDependencies: {
      '@eslint/js': '^9.39.5',
      eslint: '^9.39.5',
      globals: '^17.7.0'
    },
    engines: {
      node: '>= 20'
    }
  };

  // sqlite3 ships a native binary; pnpm needs its build approved explicitly.
  if (dbDriver.name === 'sqlite3') {
    pkg.pnpm = { onlyBuiltDependencies: ['sqlite3'] };
  }

  return `${JSON.stringify(pkg, null, 2)}\n`;
};
