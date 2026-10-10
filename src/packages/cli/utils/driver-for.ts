import { SQLITE_DRIVER } from '../../database/constants';

const drivers = new Map([
  ['postgres', 'pg'],
  ['sqlite', SQLITE_DRIVER],
  ['mysql', 'mysql2']
]);

export default function driverFor(database = 'sqlite') {
  return drivers.get(database) || SQLITE_DRIVER;
}
