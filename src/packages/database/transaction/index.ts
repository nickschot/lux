import { trapGet } from '../../../utils/proxy';
import type { Model } from '../index';
import type { ModelClass } from '../interfaces';

import type { Transaction$ResultProxy } from './interfaces';

/**
 * @private
 */
export function createStaticTransactionProxy<T extends ModelClass>(
  target: T,
  trx: unknown
): T {
  return new Proxy(target, {
    get: trapGet({
      create(model: T, props: Record<string, unknown> = {}) {
        return model.create(props, trx);
      }
    })
  });
}

/**
 * @private
 */
export function createInstanceTransactionProxy<T extends Model>(
  target: T,
  trx: unknown
): T {
  return new Proxy(target, {
    get: trapGet({
      save(model: T) {
        return model.save(trx);
      },

      update(model: T, props: Record<string, unknown> = {}) {
        return model.update(props, trx);
      },

      destroy(model: T) {
        return model.destroy(trx);
      }
    })
  });
}

/**
 * @private
 */
export function createTransactionResultProxy<
  T extends Model,
  U extends boolean
>(record: T, didPersist: U): Transaction$ResultProxy<T, U> {
  return new Proxy(record, {
    get: trapGet({
      didPersist
    })
  }) as unknown as Transaction$ResultProxy<T, U>;
}

export type { Transaction$ResultProxy } from './interfaces';
