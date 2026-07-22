/* eslint-disable @typescript-eslint/no-explicit-any --
 * The runner drives Knex query builders (`model.table()` and the reduced
 * snapshot chain) whose types Lumen does not model; `records` and the reflected
 * method calls are genuinely untyped here.
 */
import { RecordNotFoundError } from '../errors';
import { sql } from '../../../logger';
import type Query from '../index';

import { RUNNERS } from './constants';
import getFindParam from './utils/get-find-param';
import buildResults from './utils/build-results';

/**
 * @private
 */
export function createRunner(
  target: Query<unknown>,
  opts: {
    resolve?: (value: any) => void;
    reject?: (error: Error) => void;
  }
): void {
  if (opts.resolve && opts.reject) {
    const { resolve, reject } = opts;
    let didRun = false;

    RUNNERS.set(target, async () => {
      let results;
      const {
        model,
        isFind,
        snapshots,
        collection,
        shouldCount,
        relationships
      } = target;

      if (didRun) {
        return;
      }

      didRun = true;

      if (!shouldCount && !snapshots.some(([name]) => name === 'select')) {
        target.select(...target.model.attributeNames);
      }

      const records: any = snapshots.reduce((query, snapshot) => {
        let [name, params] = snapshot;

        if (!shouldCount && name === 'includeSelect') {
          name = 'select';
        }

        const method = Reflect.get(query, name);

        if (!Array.isArray(params)) {
          params = [params];
        }

        return Reflect.apply(method, query, params);
      }, model.table() as any);

      if (model.store.debug) {
        records.on('query', () => {
          setImmediate(() => model.logger.debug(sql`${records.toString()}`));
        });
      }

      if (shouldCount) {
        let [{ countAll: count }] = await records;
        count = parseInt(count, 10);

        resolve(Number.isFinite(count) ? count : 0);
      } else {
        results = await buildResults({
          model,
          records,
          relationships
        });

        if (collection) {
          resolve(results);
        } else {
          const [result] = results;

          if (!result && isFind) {
            const err = new RecordNotFoundError(model, getFindParam(target));

            reject(err);
          }

          resolve(result);
        }
      }
    });
  }
}

export function runQuery(target: Query<unknown>): void {
  const runner = RUNNERS.get(target);

  if (runner) {
    runner();
  }
}
