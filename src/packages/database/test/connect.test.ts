import { describe, it, expect } from 'vitest';

import { join } from 'path';

import connect, { connectionFor } from '../utils/connect';

describe('module "database" #connectionFor()', () => {
  const PATH = '/app';
  const URL = 'postgres://user:secret@db.example.com:5432/blog';
  const ssl = { rejectUnauthorized: false };

  it('builds the connection from the settings without a URL', () => {
    expect(
      connectionFor(
        PATH,
        { driver: 'pg', host: 'db', database: 'blog', username: 'u', ssl },
        undefined
      )
    ).to.include({ host: 'db', database: 'blog', user: 'u', ssl });
  });

  it('keeps `ssl` with DATABASE_URL for pg', () => {
    expect(connectionFor(PATH, { driver: 'pg', ssl }, URL)).to.deep.equal({
      connectionString: URL,
      ssl
    });
  });

  it('keeps `ssl` with an environment `url` for mysql2', () => {
    const url = 'mysql://user:secret@db.example.com:3306/blog';

    expect(
      connectionFor(PATH, { driver: 'mysql2', url, ssl: true }, undefined)
    ).to.deep.equal({ uri: url, ssl: true });
  });

  it('prefers DATABASE_URL over the environment `url`', () => {
    expect(
      connectionFor(
        PATH,
        { driver: 'pg', url: 'postgres://other/db', ssl },
        URL
      )
    ).to.deep.equal({ connectionString: URL, ssl });
  });

  it('passes a URL through as it is without `ssl`, and for SQLite', () => {
    expect(connectionFor(PATH, { driver: 'pg' }, URL)).to.equal(URL);
    expect(
      connectionFor(
        PATH,
        { driver: 'better-sqlite3', ssl: true },
        '/tmp/db.sqlite'
      )
    ).to.equal('/tmp/db.sqlite');
  });
});

// The test-app has knex installed, which connect() loads from the app.
const APP = join(import.meta.dirname, '../../../../test/test-app');

describe('module "database" #connect()', () => {
  it('uses one connection for SQLite, whatever `pool` says', async () => {
    const knex = connect(APP, {
      driver: 'better-sqlite3',
      database: 'connect_test',
      pool: 5
    });

    try {
      expect(knex.client.config.pool).to.deep.equal({ min: 1, max: 1 });
    } finally {
      await knex.destroy();
    }
  });

  it('says how to switch from sqlite3', () => {
    expect(() => connect(APP, { driver: 'sqlite3', database: 'x' }))
      .to.throw()
      .with.property('message')
      .that.includes("driver: 'better-sqlite3'")
      .and.includes('replace the sqlite3 dependency');
  });

  it("rejects drivers knex 3 doesn't have", () => {
    ['mariasql', 'strong-oracle', 'oracle'].forEach(driver => {
      expect(() => connect(APP, { driver, database: 'x' }))
        .to.throw()
        .with.property('message')
        .that.includes('Invalid database driver');
    });
  });
});
