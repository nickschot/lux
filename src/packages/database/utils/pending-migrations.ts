import { readdir } from '../../fs';

/**
 * @private
 */
export default async function pendingMigrations(
  appPath: string,
  table: () => any // eslint-disable-line @typescript-eslint/no-explicit-any
): Promise<Array<string>> {
  const migrations: Array<string> = await readdir(`${appPath}/db/migrate`);
  const versions: Array<string> = await table()
    .select()
    .then((data: Array<{ version: string }>) =>
      data.map(({ version }) => version)
    );

  return migrations.filter(
    migration => versions.indexOf(migration.replace(/^(\d{16})-.+$/g, '$1')) < 0
  );
}
