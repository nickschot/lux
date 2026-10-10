import { createRequire } from 'module';
import { join } from 'path';

import { it, describe, afterAll, expect } from 'vitest';

import { serverConfigFor, statementFor } from '../utils/server-database';

// The test-app has every driver installed; a knex without a connection
// builds statements without reaching a server.
const knex = createRequire(
  join(import.meta.dirname, '../../../../test/test-app/package.json')
)('knex');
const pg = knex({ client: 'pg' });
const mysql = knex({ client: 'mysql2' });

describe('module "cli" server databases', () => {
  afterAll(() => Promise.all([pg.destroy(), mysql.destroy()]));

  it("connects to the server, not to the app's database", () => {
    const config = {
      driver: 'pg',
      database: 'blog_dev',
      host: 'db.internal',
      port: 5433,
      username: 'blog',
      password: 'secret',
      ssl: true,
      pool: 5
    };

    expect(serverConfigFor(config)).to.deep.equal({
      ...config,
      database: 'postgres',
      pool: 1
    });
    expect(serverConfigFor({ ...config, driver: 'mysql2' }).database).to.equal(
      undefined
    );
  });

  it('quotes the database name', () => {
    expect(statementFor(pg, 'create', 'pg', 'blog-dev').toString()).to.equal(
      'CREATE DATABASE "blog-dev"'
    );
    expect(
      statementFor(mysql, 'create', 'mysql2', 'blog-dev').toString()
    ).to.equal('CREATE DATABASE `blog-dev`');
  });

  it('drops a PostgreSQL database even with connections open', () => {
    expect(statementFor(pg, 'drop', 'pg', 'blog_dev').toString()).to.equal(
      'DROP DATABASE IF EXISTS "blog_dev" WITH (FORCE)'
    );
    expect(
      statementFor(mysql, 'drop', 'mysql2', 'blog_dev').toString()
    ).to.equal('DROP DATABASE IF EXISTS `blog_dev`');
  });
});
