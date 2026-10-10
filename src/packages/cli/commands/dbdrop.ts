import { EOL } from 'os';

import { CWD, NODE_ENV, DATABASE_URL } from '../../../constants';
import { CONNECTION_STRING_MESSAGE } from '../constants';
import DatabaseConfigMissingError from '../errors/database-config-missing';
import { rmrf } from '../../fs';
import { createLoader } from '../../loader';
import { SQLITE_DRIVER } from '../../database/constants';
import provision from '../utils/server-database';

/**
 * @private
 */
export function dbdrop() {
  const load = createLoader(CWD);
  const config = load('config').database[NODE_ENV];

  if (!config) {
    throw new DatabaseConfigMissingError(NODE_ENV);
  }

  if (config.driver === SQLITE_DRIVER) {
    return rmrf(`${CWD}/db/${config.database}_${NODE_ENV}.sqlite`);
  }

  if (DATABASE_URL || config.url) {
    process.stderr.write(CONNECTION_STRING_MESSAGE);
    process.stderr.write(EOL);
    return Promise.resolve();
  }

  return provision(CWD, config, 'drop');
}
