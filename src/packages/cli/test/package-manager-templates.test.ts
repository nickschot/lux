import { it, describe, expect } from 'vitest';

import packageJSONTemplate from '../templates/package-json';
import pnpmWorkspaceTemplate from '../templates/pnpm-workspace';

// What `allowBuilds` decides, per package.
function allowBuildsFor(driver: string) {
  const [, block = ''] = pnpmWorkspaceTemplate(driver).split('allowBuilds:\n');

  return Object.fromEntries(
    block
      .trim()
      .split('\n')
      .map(line => line.trim().split(': '))
  );
}

describe('module "cli" templates for the package manager', () => {
  // pnpm 12 fails the install over an undecided build script.
  it('skips the build scripts of every app, with esbuild', () => {
    ['pg', 'mysql2'].forEach(driver => {
      expect(allowBuildsFor(driver)).to.deep.equal({ esbuild: 'false' });
    });
  });

  it('skips better-sqlite3 too in a SQLite app', () => {
    expect(allowBuildsFor('better-sqlite3')).to.deep.equal({
      esbuild: 'false',
      'better-sqlite3': 'false'
    });
  });

  // pnpm 12 ignores a `pnpm` field in package.json.
  it('keeps pnpm settings out of package.json', () => {
    ['better-sqlite3', 'pg', 'mysql2'].forEach(driver => {
      const pkg = JSON.parse(packageJSONTemplate('blog', driver));

      expect(pkg).not.to.have.property('pnpm');
    });
  });
});
