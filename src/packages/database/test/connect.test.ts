import { describe, it, expect } from 'vitest';

import { connectionFor } from '../utils/connect';

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

  it('passes a URL through as it is without `ssl`, and for sqlite3', () => {
    expect(connectionFor(PATH, { driver: 'pg' }, URL)).to.equal(URL);
    expect(
      connectionFor(PATH, { driver: 'sqlite3', ssl: true }, '/tmp/db.sqlite')
    ).to.equal('/tmp/db.sqlite');
  });
});
