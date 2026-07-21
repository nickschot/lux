import path from 'path';

import * as esbuild from 'esbuild';

import { rmrf, readdir, readdirRec, isJSFile } from '../fs';

import createManifest from './utils/create-manifest';
import createBootScript from './utils/create-boot-script';

/**
 * @private
 */
type CompileOptions = {
  useStrict?: boolean;
};

/**
 * @private
 */
export async function compile(
  dir: string,
  env: string,
  opts: CompileOptions = {}
): Promise<void> {
  const { useStrict = false } = opts;
  // The framework is consumed as its built ESM bundle (sibling of the CLI
  // bundle in `dist/`), not as raw source — so the app compiler is decoupled
  // from the framework's source language.
  const local = path.join(__dirname, 'index.mjs');
  const entry = path.join(dir, 'dist', 'index.js');

  const assets = await Promise.all([
    readdir(path.join(dir, 'app', 'models')),
    readdir(path.join(dir, 'db', 'migrate')),
    readdirRec(path.join(dir, 'app', 'controllers')),
    readdirRec(path.join(dir, 'app', 'serializers'))
  ]).then(types => {
    let [models, migrations, controllers, serializers] = types;

    models = models.filter(isJSFile);
    migrations = migrations.filter(isJSFile);
    controllers = controllers.filter(isJSFile);
    serializers = serializers.filter(isJSFile);

    return new Map<string, Array<string> | string>([
      ['Application', path.join('app', 'index.js')],
      ['config', path.join('config', 'environments', `${env}.js`)],
      ['controllers', controllers],
      ['database', path.join('config', 'database.js')],
      ['migrations', migrations],
      ['models', models],
      ['routes', path.join('app', 'routes.js')],
      ['seed', path.join('db', 'seed.js')],
      ['serializers', serializers]
    ]);
  });

  await Promise.all([
    createManifest(dir, assets, { useStrict }),
    createBootScript(dir, { useStrict })
  ]);

  await esbuild.build({
    entryPoints: [entry],
    outfile: path.join(dir, 'dist', 'bundle.js'),
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node20',
    sourcemap: true,
    // Reproduces `rollup-plugin-lux`: preserves each class's `.name` (Lux keys
    // models/controllers/serializers off it) against esbuild's own renaming.
    keepNames: true,
    // Bare specifiers stay external (knex, inflection, the app's own deps);
    // relative paths and the two aliases below are bundled in. This matches the
    // old `is-external` split, with the framework itself pulled in via LUX_LOCAL.
    packages: 'external',
    alias: {
      // Apps import the framework as `import { Model } from 'LUX_LOCAL'`.
      LUX_LOCAL: local,
      // ...and their own tree as `app/...`.
      app: path.join(dir, 'app')
    }
  });

  await rmrf(entry);
}
