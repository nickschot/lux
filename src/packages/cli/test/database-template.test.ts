import { it, describe, expect } from 'vitest';

import databaseTemplate from '../templates/database';

// The config `lumen new` writes, evaluated as the app would load it.
function configFor(driver: string) {
  const source = databaseTemplate('blog', driver).replace(
    'export default',
    'return'
  );

  return new Function(source)();
}

describe('module "cli" template database', () => {
  it('gives SQLite the bare name, which connect() suffixes with the environment', () => {
    const config = configFor('better-sqlite3');

    expect(config.development.database).to.equal('blog');
    expect(config.test.database).to.equal('blog');
    expect(config.production.database).to.equal('blog');
  });

  it('gives a server database a name per environment', () => {
    ['pg', 'mysql2'].forEach(driver => {
      const config = configFor(driver);

      expect(config.development).to.include({
        driver,
        database: 'blog_dev',
        pool: 5
      });
      expect(config.test.database).to.equal('blog_test');
      expect(config.production.database).to.equal('blog_prod');
    });
  });
});
