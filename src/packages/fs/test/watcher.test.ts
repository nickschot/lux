import { tmpdir } from 'os';
import { join as joinPath } from 'path';
import { execSync } from 'child_process';

import { it, describe, afterAll, beforeAll, expect } from 'vitest';

import Watcher from '../watcher';

import { rmrf, mkdirRec, writeFile } from '../index';

// `fs/watcher` falls back to native fs.watch when watchman is absent (see the
// `which watchman` probe in ../watcher/initialize.ts), but this suite asserts a
// real watchman client — so probe the same way and skip when it isn't there.
// Self-configuring: runs for real in CI and the devcontainer, both of which
// install watchman, and skips on a bare machine.
const hasWatchman = (() => {
  try {
    execSync('which watchman', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();

describe('module "fs"', () => {
  const tmpDirPath = joinPath(tmpdir(), `lumen-${Date.now()}`);
  const tmpAppPath = joinPath(tmpDirPath, 'app');

  beforeAll(async () => {
    await mkdirRec(tmpAppPath);
  });

  afterAll(async () => {
    await rmrf(tmpDirPath);
  });

  describe('class Watcher', () => {
    if (hasWatchman) {
      describe('- client Watchman', () => {
        let subject;

        beforeAll(async () => {
          subject = await new Watcher(tmpDirPath);
        });

        describe('event "change"', () => {
          it('is called when a file is modified', async () => {
            subject.once('change', files => {
              expect(files).to.be.an('array');
            });

            await writeFile(joinPath(tmpAppPath, 'index.js'), '');
          });
        });

        describe('#destroy()', () => {
          it('does not throw an error', () => {
            expect(() => subject.destroy()).to.not.throw(Error);
          });
        });
      });
    }

    describe('- client FSWatcher', () => {
      let subject;

      beforeAll(async () => {
        subject = await new Watcher(tmpDirPath, false);
      });

      describe('event "change"', () => {
        it('is called when a file is modified', async () => {
          subject.once('change', files => {
            expect(files).to.be.an('array');
          });

          await writeFile(joinPath(tmpAppPath, 'index.js'), '');
        });
      });

      describe('#destroy()', () => {
        it('does not throw an error', () => {
          expect(() => subject.destroy()).to.not.throw(Error);
        });
      });
    });
  });
});
