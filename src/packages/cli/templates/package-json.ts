import { version } from '../../../../package.json';
import { SQLITE_DRIVER } from '../../database/constants';

const LUMEN_VERSION: string = version;

// The knex client name (what `driverFor` returns) -> the npm package + version
// a generated app needs installed to actually connect. Pinned to the versions
// CI validates (see test/test-app).
const DRIVER_DEPS: Record<string, { name: string; version: string }> = {
  [SQLITE_DRIVER]: { name: SQLITE_DRIVER, version: '^13.0.3' },
  pg: { name: 'pg', version: '^8.23.1' },
  mysql2: { name: 'mysql2', version: '^3.24.5' }
};

/**
 * @private
 */
export default (name: string, driver: string): string => {
  const dbDriver = DRIVER_DEPS[driver] || DRIVER_DEPS[SQLITE_DRIVER];

  const pkg = {
    name,
    version: '0.0.1',
    description: '',
    scripts: {
      start: 'lumen serve',
      lint: 'eslint .'
    },
    author: '',
    license: 'MIT',
    dependencies: {
      knex: '^3.3.0',
      'lumen-framework': LUMEN_VERSION,
      [dbDriver.name]: dbDriver.version
    },
    devDependencies: {
      '@eslint/js': '^10.0.1',
      eslint: '^10.12.0',
      globals: '^17.13.0'
    },
    engines: {
      node: '>= 22.14'
    }
  };

  return `${JSON.stringify(pkg, null, 2)}\n`;
};
