import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from 'fs';
import { join as joinPath } from 'path';

export const TEST_APP = joinPath(__dirname, '..', 'test-app');

/**
 * A copy of the compiled test-app, as an app of its own that a test can boot
 * next to the shared one (`getTestApp()`): it is loaded from `dist/bundle`
 * under its path, its database driver from `node_modules` and its SQLite file
 * from `db`, which link to the test-app's.
 *
 * The bundle is copied, not required from the test-app: booting defines
 * properties on the model classes, so each booted app needs its own. The copy
 * lives in the test-app's (ignored) `dist/`, so it resolves its dependencies
 * as the original does.
 *
 * `bundle`, when given, is the copy's `dist/bundle.js`: it can require the
 * original as `./original` and change what it exports. Remove the copy with
 * `remove()` when done.
 */
export function copyTestApp(
  name: string,
  bundle = "module.exports = require('./original');\n"
): { path: string; remove: () => void } {
  const path = mkdtempSync(joinPath(TEST_APP, 'dist', `${name}-`));

  mkdirSync(joinPath(path, 'dist'));
  ['db', 'node_modules'].forEach(dir =>
    symlinkSync(joinPath(TEST_APP, dir), joinPath(path, dir))
  );
  copyFileSync(
    joinPath(TEST_APP, 'dist', 'bundle.js'),
    joinPath(path, 'dist', 'original.js')
  );
  writeFileSync(joinPath(path, 'dist', 'bundle.js'), bundle);

  return {
    path,
    remove: () => rmSync(path, { recursive: true, force: true })
  };
}
