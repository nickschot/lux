import { EOL } from 'os';
import { posix } from 'path';

import { pluralize, singularize } from 'inflection';

import chalk from '../../../utils/chalk';
import { CWD } from '../../../constants';
import {
  rmrf,
  exists,
  readdir,
  readdirRec,
  readFile,
  writeFile
} from '../../fs';

function log(text: string) {
  process.stdout.write(text);
  process.stdout.write(EOL);
}

/**
 * @private
 */
export async function destroyType(
  type: string,
  name: string,
  cwd: string = CWD
) {
  const normalizedType = type.toLowerCase();
  let normalizedName = name;
  let path: string | undefined;
  let migrations: Array<string>;

  switch (normalizedType) {
    case 'model':
      // `generate` writes a model under its bare name, whatever the
      // namespace: `admin/tag` is `app/models/tag.js`.
      normalizedName = singularize(posix.basename(normalizedName));
      path = `app/${pluralize(normalizedType)}/${normalizedName}.js`;
      break;

    case 'migration':
      migrations = await readdir(`${cwd}/db/migrate`);

      // `find` may return undefined (no matching migration); pre-existing
      // behaviour lets that flow into the path as the string "undefined",
      // which then simply fails the `exists` check below.
      normalizedName = migrations.find(
        file => `${posix.basename(normalizedName)}.js` === file.substring(17)
      ) as string;

      path = `db/migrate/${normalizedName}`;
      break;

    case 'controller':
    case 'serializer':
      normalizedName = pluralize(normalizedName);
      path = `app/${pluralize(normalizedType)}/${normalizedName}.js`;
      break;

    case 'middleware':
      path = `app/${normalizedType}/${normalizedName}.js`;
      break;

    case 'util':
      path = `app/${pluralize(normalizedType)}/${normalizedName}.js`;
      break;

    default:
      return;
  }

  if (await exists(`${cwd}/${path}`)) {
    await rmrf(`${cwd}/${path}`);
    log(`${chalk.red('remove')} ${path}`);
  }
}

/**
 * The controllers, in any namespace, of the resource `name` other than its
 * own: `admin/tags` for `tags`, and the other way around.
 *
 * @private
 */
async function otherControllersOf(name: string, cwd: string) {
  const dir = `${cwd}/app/controllers`;
  const own = `${pluralize(name)}.js`;
  const file = posix.basename(own);

  if (!(await exists(dir))) {
    return [];
  }

  return (await readdirRec(dir))
    .map(path => path.split('\\').join('/'))
    .filter(path => posix.basename(path) === file && path !== own)
    .map(path => `app/controllers/${path}`);
}

/**
 * @private
 */
export async function destroy({
  type,
  name,
  cwd = CWD
}: {
  type: string;
  name: string;
  cwd?: string;
}) {
  if (type === 'resource') {
    const model = singularize(posix.basename(name));
    const others = await otherControllersOf(name, cwd);

    // One at a time, so the output lists them in a stable order.
    await destroyType('controller', name, cwd);
    await destroyType('serializer', name, cwd);

    // Another namespace's resource for the same model still needs it.
    if (others.length) {
      log(
        `${chalk.yellow('keep')} app/models/${model}.js and its migration ` +
          `(used by ${others.join(', ')})`
      );
    } else {
      await destroyType('model', model, cwd);
      await destroyType('migration', `create-${pluralize(model)}`, cwd);
    }

    // Only a root resource has a route; `generate` leaves a namespaced one
    // to the app.
    if (posix.dirname(name) === '.') {
      const path = `${cwd}/app/routes.js`;
      const before = (await readFile(path)).toString('utf8');
      const pattern = new RegExp(
        `\\s*this.resource\\(('|"|\`)${pluralize(name)}('|"|\`)\\);?`
      );
      const after = before
        .split('\n')
        .filter(line => !pattern.test(line))
        .join('\n');

      if (after !== before) {
        await writeFile(path, after);
        log(`${chalk.green('update')} app/routes.js`);
      }
    }
  } else if (type === 'model') {
    await Promise.all([
      destroyType(type, name, cwd),
      destroyType(
        'migration',
        `create-${pluralize(singularize(posix.basename(name)))}`,
        cwd
      )
    ]);
  } else {
    await destroyType(type, name, cwd);
  }
}
