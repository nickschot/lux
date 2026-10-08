import chalk from '../../../utils/chalk';
import { line } from '../../logger';

/** @internal */
class MigrationsPendingError extends Error {
  constructor(migrations: Array<string> = []) {
    const pending = migrations
      .map(str => chalk.yellow(str.substr(0, str.length - 3)))
      .join(', ');

    super(line`
      The following migrations are pending ${pending}.
      Please run ${chalk.green('lumen db:migrate')} before starting your application.
    `);
  }
}

export default MigrationsPendingError;
