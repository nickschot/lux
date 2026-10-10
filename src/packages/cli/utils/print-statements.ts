import { EOL } from 'os';

import type { Knex } from 'knex';

/**
 * Print each statement `builder` runs as it runs, with its values. A schema
 * builder can run several (`create table` and then each `create index`), and
 * emits `query` once per statement — so the statement comes from the event,
 * not from `builder.toString()`, which is all of them at once.
 *
 * @internal
 */
export default function printStatements<
  T extends { on(event: 'query', fn: (query: Knex.Sql) => void): unknown }
>(
  builder: T,
  connection: Knex,
  write: (text: string) => void = text => process.stdout.write(text)
): T {
  builder.on('query', ({ sql, bindings }: Knex.Sql) => {
    write(`${connection.raw(sql, bindings ?? []).toString()};${EOL}`);
  });

  return builder;
}
