/* eslint-disable @typescript-eslint/no-explicit-any --
 * These build and run Knex insert/update/delete statements; the query builders
 * and the promises they return are not modeled by Lux (they were `Object` in
 * Flow).
 */
import { sql } from '../../../logger';
import omit from '../../../../utils/omit';
import type Logger from '../../../logger';
import type Model from '../index';

import getColumns from './get-columns';

/**
 * @private
 */
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

/**
 * @private
 */
export function update(record: Model, trx: unknown): Array<any> {
  Reflect.set(record, 'updatedAt', new Date());

  return [
    record.constructor
      .table()
      .transacting(trx)
      .where(record.constructor.primaryKey, record.getPrimaryKey())
      .update(getColumns(record, Array.from(record.dirtyAttributes.keys())))
  ];
}

/**
 * @private
 */
export function destroy(record: Model, trx: unknown): Array<any> {
  return [
    record.constructor
      .table()
      .transacting(trx)
      .where(record.constructor.primaryKey, record.getPrimaryKey())
      .del()
  ];
}

/**
 * @private
 */
export function createRunner(
  logger: Logger,
  statements: Array<any>
): (query: Array<any>) => Promise<Array<any>> {
  return query => {
    const promises = query.concat(statements);

    promises.forEach(promise => {
      promise.on('query', () => {
        setImmediate(() => {
          logger.debug(sql`${promise.toString()}`);
        });
      });
    });

    return Promise.all(promises);
  };
}
