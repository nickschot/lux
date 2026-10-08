/* eslint-disable @typescript-eslint/no-explicit-any --
 * These build and run Knex insert/update/delete statements; the query builders
 * and the promises they return are not modeled by Lumen (they were `Object` in
 * Flow).
 */
import omit from '../../../../utils/omit';
import type Model from '../index';

import getColumns from './get-columns';
import { writeAttribute } from './attribute';

/** @internal */
export function create(record: Model, trx: unknown): Array<any> {
  const timestamp = new Date();

  Object.assign(record, {
    createdAt: timestamp,
    updatedAt: timestamp
  });

  Object.assign(record.rawColumnData, {
    createdAt: timestamp,
    updatedAt: timestamp
  });

  const {
    constructor: { primaryKey }
  } = record;
  const columns = omit(getColumns(record), primaryKey);

  if (record.dirtyAttributes.has(primaryKey)) {
    columns[primaryKey] = record.getPrimaryKey();
  }

  return [
    record.constructor
      .table()
      .transacting(trx)
      .returning(record.constructor.primaryKey)
      .insert(columns)
  ];
}

/** @internal */
export function update(record: Model, trx: unknown): Array<any> {
  writeAttribute(record, 'updatedAt', new Date());

  return [
    record.constructor
      .table()
      .transacting(trx)
      .where(record.constructor.primaryKey, record.getPrimaryKey())
      .update(getColumns(record, Array.from(record.dirtyAttributes.keys())))
  ];
}

/** @internal */
export function destroy(record: Model, trx: unknown): Array<any> {
  return [
    record.constructor
      .table()
      .transacting(trx)
      .where(record.constructor.primaryKey, record.getPrimaryKey())
      .del()
  ];
}

/** @internal */
export function createRunner(
  { logger, store }: Pick<typeof Model, 'logger' | 'store'>,
  statements: Array<any>
): (query: Array<any>) => Promise<Array<any>> {
  return query => {
    const promises = query.concat(statements);

    // Writes honour the database `debug` flag, as reads do: the logged SQL
    // has its values inlined.
    if (store.debug) {
      promises.forEach(promise => {
        promise.on('query', () => {
          setImmediate(() => {
            logger.debug(promise.toString());
          });
        });
      });
    }

    return Promise.all(promises);
  };
}
