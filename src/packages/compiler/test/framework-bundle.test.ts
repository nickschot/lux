import path from 'path';
import { createRequire } from 'module';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'fs';

import * as esbuild from 'esbuild';
import { spy } from 'sinon';
import { it, describe, beforeAll, afterAll, expect } from 'vitest';

const ROOT = path.resolve(__dirname, '../../../..');

// An app runs the framework *re-bundled*: the compiler bundles the built
// `dist/index.mjs` into the app's CommonJS `dist/bundle.js`, keeping packages
// external. That second pass changes how imports of ESM-only packages resolve
// (a default import gets Node's CommonJS semantics there), so it is bundled
// here the same way and exercised through code that colours its output.
describe('module "compiler"', () => {
  describe('the re-bundled framework', () => {
    let tmp: string;
    // The bundle exposes what the framework's entry point exports.
    let framework: typeof import('../../../index');

    beforeAll(async () => {
      // Inside the repository, so the bundle's external `require()`s resolve
      // against its node_modules.
      const cache = path.join(ROOT, 'node_modules', '.cache');

      mkdirSync(cache, { recursive: true });
      tmp = mkdtempSync(path.join(cache, 'lumen-bundle-'));

      const outfile = path.join(tmp, 'bundle.js');
      const { outputFiles } = await esbuild.build({
        stdin: {
          contents: `export * from ${JSON.stringify(
            path.join(ROOT, 'dist', 'index.mjs')
          )};`,
          resolveDir: ROOT
        },
        bundle: true,
        platform: 'node',
        format: 'cjs',
        target: 'node22',
        packages: 'external',
        write: false,
        outfile
      });

      writeFileSync(outfile, outputFiles[0].text);
      framework = createRequire(outfile)(outfile);
    });

    afterAll(() => {
      rmSync(tmp, { recursive: true, force: true });
    });

    it('can write coloured log output (chalk)', () => {
      const { Logger } = framework;
      const logger = new Logger({
        level: 'INFO',
        format: 'text',
        filter: { params: [] },
        enabled: true
      });
      const stdoutSpy = spy(process.stdout, 'write');

      try {
        logger.info('Hello world!');
      } finally {
        stdoutSpy.restore();
      }

      expect(stdoutSpy.calledOnce).to.be.true;
      expect(stdoutSpy.firstCall.args[0]).to.include('Hello world!');
    });
  });
});
