import { CWD } from '../../../constants';
import Database from '../../database';
import Logger from '../../logger';
import { readdir } from '../../fs';
import { createLoader } from '../../loader';
import printStatements from '../utils/print-statements';

/**
 * @private
 */
export async function dbrollback() {
  const load = createLoader(CWD);

  const { database: config } = load('config');
  const models = load('models');
  const migrations = load('migrations');

  const { connection, schema } = await new Database({
    config,
    models,
    path: CWD,
    checkMigrations: false,
    checkRelationships: false,

    logger: new Logger({ enabled: false } as ConstructorParameters<
      typeof Logger
    >[0])
  });

  const migrationFiles = await readdir(`${CWD}/db/migrate`);

  if (migrationFiles.length) {
    let migration;
    let version = await connection('migrations')
      .orderBy('version', 'desc')
      .first();

    if (version && version.version) {
      version = version.version;
    }

    const target = migrationFiles.find(m => m.indexOf(version) === 0);

    if (target) {
      migration = target.replace(new RegExp(`${version}-(.+)\\.js`), '$1');
      migration = migrations.get(`${migration}-down`);

      if (migration) {
        await printStatements(migration.run(schema()), connection);

        await connection('migrations')
          .where({
            version
          })
          .del();
      }
    }
  }
}
