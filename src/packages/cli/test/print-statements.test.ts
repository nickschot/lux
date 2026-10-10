import { EOL } from 'os';

import { it, describe, beforeAll, afterAll, expect } from 'vitest';

import printStatements from '../utils/print-statements';
import { getTestApp } from '../../../../test/utils/get-test-app';

describe('module "cli" #printStatements()', () => {
  let connection;

  beforeAll(async () => {
    ({ connection } = (await getTestApp()).store);
  });

  afterAll(async () => {
    await connection.schema.dropTableIfExists('print_statements');
  });

  it('prints each statement once, as it runs', async () => {
    // A retry runs again after a failed attempt left the table behind.
    await connection.schema.dropTableIfExists('print_statements');

    const lines: Array<string> = [];

    await printStatements(
      connection.schema.createTable('print_statements', table => {
        table.increments('id');
        table.string('title').index();
      }),
      connection,
      text => lines.push(text)
    );

    expect(lines).to.have.length(2);
    expect(lines[0]).to.match(/^create table .print_statements./);
    // `create index` on SQLite and PostgreSQL, `alter table … add index` on
    // MySQL.
    expect(lines[1]).to.match(/^(create index |alter table .+ add index )/);
    lines.forEach(text => expect(text.endsWith(`;${EOL}`)).to.equal(true));
  });
});
