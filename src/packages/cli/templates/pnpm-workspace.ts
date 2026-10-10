import { SQLITE_DRIVER } from '../../database/constants';

/**
 * The `pnpm-workspace.yaml` of a new app. pnpm 12 fails an install over a
 * dependency's build script it was not told to run or skip, and reads that
 * from this file only. npm ignores it.
 *
 * - esbuild (a dependency of lumen-framework): its postinstall only links its
 *   platform binary over the `esbuild` command; the app compiler uses its
 *   JavaScript API, which finds the binary itself.
 * - better-sqlite3 ships prebuilt binaries for every platform it supports, but
 *   pnpm would run `node-gyp rebuild` for its `binding.gyp`.
 *
 * @private
 */
export default (driver: string): string => {
  const builds = [
    'esbuild',
    ...(driver === SQLITE_DRIVER ? [SQLITE_DRIVER] : [])
  ];

  return [
    '# Build scripts pnpm may skip: these packages work without them.',
    'allowBuilds:',
    ...builds.map(name => `  ${name}: false`),
    ''
  ].join('\n');
};
