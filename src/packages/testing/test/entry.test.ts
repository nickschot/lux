import { createRequire } from 'node:module';
import { join as joinPath } from 'path';

import { it, describe, expect } from 'vitest';

// The package's entries as a consumer resolves them: through package.json
// `exports`. The repo depends on itself (`lumen-framework: link:.`), so the
// name resolves here as it does in an app. Needs a build (`dist/`).

const nodeRequire = createRequire(__filename);
const ROOT = joinPath(__dirname, '..', '..', '..', '..');

describe('the `lumen-framework` entries', () => {
  it('resolves the main entry to the CJS build', () => {
    expect(nodeRequire.resolve('lumen-framework')).to.equal(
      joinPath(ROOT, 'dist', 'index.js')
    );
  });

  it('serves the test helpers from `lumen-framework/testing`', () => {
    expect(nodeRequire.resolve('lumen-framework/testing')).to.equal(
      joinPath(ROOT, 'dist', 'testing.js')
    );

    const testing = nodeRequire('lumen-framework/testing');

    expect(typeof testing.auditVisibility).to.equal('function');
    expect(typeof testing.startApp).to.equal('function');
  });

  it('keeps the test helpers out of the main entry', () => {
    const framework = nodeRequire('lumen-framework');

    expect(framework).to.not.have.property('auditVisibility');
    expect(typeof framework.Controller).to.equal('function');
  });

  it('exposes package.json and nothing else of the package', () => {
    expect(nodeRequire.resolve('lumen-framework/package.json')).to.equal(
      joinPath(ROOT, 'package.json')
    );

    ['lumen-framework/dist/index.js', 'lumen-framework/dist/cli.cjs'].forEach(
      path => {
        expect(() => nodeRequire.resolve(path), path)
          .to.throw()
          .with.property('code', 'ERR_PACKAGE_PATH_NOT_EXPORTED');
      }
    );
  });
});
