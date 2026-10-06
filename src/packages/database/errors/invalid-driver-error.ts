import chalk from '../../../utils/chalk';
import { VALID_DRIVERS } from '../constants';
import { line } from '../../logger';

/**
 * @private
 */
class InvalidDriverError extends Error {
  constructor(driver: string) {
    super(line`
      Invalid database driver ${chalk.yellow(driver)} in ./config/database.js.
      Please use one of the following database drivers:
      ${VALID_DRIVERS.map(str => chalk.green(str)).join(', ')}.
    `);
  }
}

export default InvalidDriverError;
