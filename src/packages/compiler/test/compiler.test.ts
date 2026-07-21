import path from 'path';
import { existsSync, readFileSync } from 'fs';

import * as esbuild from 'esbuild';
import { it, describe, beforeEach, expect, vi } from 'vitest';

import { getTestApp } from '../../../../test/utils/get-test-app';
import { compile } from '../index';

// `compile` resolves the framework via `path.join(__dirname, 'index.mjs')`,
// which only exists in the built `dist/` layout — so importing it from source
// here can't actually run the bundle (the same reason the old test stubbed
// Rollup). The real end-to-end path is covered by the global setup, which
// shells out to `lux db:*` and compiles the test-app through `dist/`. This test
// asserts the compiler's contract: it generates the manifest, hands esbuild the
// right config, and cleans the entry up afterward.
//
// esbuild's module namespace is non-configurable under Vitest's ESM runner, so
// `build` is replaced via `vi.mock` rather than spied.
vi.mock('esbuild', async importOriginal => {
  const actual = await importOriginal<typeof import('esbuild')>();
  return { ...actual, build: vi.fn() };
});

const buildMock = vi.mocked(esbuild.build);

describe('module "compiler"', () => {
  describe('#compile()', () => {
    beforeEach(() => {
      buildMock.mockReset();
      buildMock.mockResolvedValue({ errors: [], warnings: [] } as never);
    });

    ['use strict', 'use weak'].forEach(opt => {
      describe(`- ${opt}`, () => {
        it('generates the manifest and bundles it as CJS', async () => {
          const { path: dir } = await getTestApp();
          const entry = path.join(dir, 'dist', 'index.js');

          // The manifest entry only exists between generation and bundling, so
          // capture it from inside the mock before compile() removes it.
          let manifest = '';
          buildMock.mockImplementation((async () => {
            manifest = readFileSync(entry, 'utf8');
            return { errors: [], warnings: [] };
          }) as never);

          await compile(dir, 'test', {
            useStrict: opt === 'use strict'
          });

          expect(buildMock).toHaveBeenCalledOnce();
          const [options] = buildMock.mock.calls[0] as [esbuild.BuildOptions];

          expect(options.entryPoints).to.deep.equal([entry]);
          expect(options.outfile).to.equal(path.join(dir, 'dist', 'bundle.js'));
          expect(options.format).to.equal('cjs');
          expect(options.platform).to.equal('node');
          // keepNames replaces rollup-plugin-lux's class-name preservation.
          expect(options.keepNames).to.be.true;
          // The framework and the app tree resolve through aliases; bare deps
          // stay external.
          expect(options.packages).to.equal('external');
          expect(options.alias).to.have.property('LUX_LOCAL');
          expect(options.alias).to.have.property('app', path.join(dir, 'app'));

          // The generated manifest re-exports the app's modules...
          expect(manifest).to.match(/PostsController/);
          expect(manifest).to.match(/from '\.\.\/app\/models\/post\.js'/);
          // ...with the `'use strict'` prologue only in strict mode.
          expect(manifest.startsWith("'use strict';")).to.equal(
            opt === 'use strict'
          );

          // The entry is removed once bundled.
          expect(existsSync(entry)).to.be.false;
        });
      });
    });
  });
});
