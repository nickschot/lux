import { CWD } from '../../../constants';
import Logger from '../../logger';
import Database from '../../database';
import { createLoader } from '../../loader';

/**
 * @private
 */
export function dbseed() {
  const load = createLoader(CWD);
  const { database: config } = load('config');
  const seed = load('seed');
  const models = load('models');

  // `new Database(...)` returns a promise for the initialized store at runtime
  // (async-constructor pattern), though its static type is `Database`.
  return (
    new Database({
      config,
      models,
      path: CWD,
      logger: new Logger({
        enabled: false
      } as ConstructorParameters<typeof Logger>[0])
    }) as unknown as Promise<Database>
  ).then(store => store.connection.transaction(seed));
}
