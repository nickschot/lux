import chalk from '../../../utils/chalk';
import { SQLITE_DRIVER, VALID_DRIVERS } from '../constants';
import { line } from '../../logger';

/** @internal */
class InvalidDriverError extends Error {
  constructor(driver: string) {
    super(
      driver === 'sqlite3'
        ? line`
          The database driver ${chalk.yellow('sqlite3')} is no longer
          supported: it is unmaintained. Set ${chalk.green(
            `driver: '${SQLITE_DRIVER}'`
          )} in ./config/database.js, and replace the sqlite3 dependency with
          ${chalk.green(SQLITE_DRIVER)}. The database files stay the same.
        `
        : line`
          Invalid database driver ${chalk.yellow(driver)} in
          ./config/database.js. Please use one of the following database
          drivers: ${VALID_DRIVERS.map(str => chalk.green(str)).join(', ')}.
        `
    );
  }
}

export default InvalidDriverError;
