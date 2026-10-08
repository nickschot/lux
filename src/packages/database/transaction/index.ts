import { trapGet } from '../../../utils/proxy';
import Query from '../query';
import { get as getRelationship } from '../relationship';
import type { Model } from '../index';
import type { ModelClass } from '../interfaces';

import type { TransactionResult } from './interfaces';

/**
 * `target` with `create` writing in `trx`, and every static that starts a
 * query (`find`, `where`, `first`, a scope, …) returning one that runs in it.
 *
 * @internal
 */
export function createStaticTransactionProxy<T extends ModelClass>(
  target: T,
  trx: unknown
): T {
  const forward = trapGet<T>({
    create(model: T, props: Record<string, unknown> = {}) {
      return model.create(props, trx);
    }
  });

  // The proxy's target is an empty object inheriting from the model, not the
  // model: scopes are read-only, non-configurable statics, and a proxy may not
  // report a different value for such a property of its own target.
  return new Proxy(Object.create(target) as T, {
    get(_, key, receiver) {
      const model = target;
      const value = forward(model, key as string, receiver);

      if (key === 'create' || typeof value !== 'function') {
        return value;
      }

      return (...args: Array<unknown>) => {
        const result = (value as (...a: Array<unknown>) => unknown).apply(
          model,
          args
        );

        return result instanceof Query ? result.transacting(trx) : result;
      };
    }
  });
}

/** @internal */
export function createInstanceTransactionProxy<T extends Model>(
  target: T,
  trx: unknown
): T {
  const forward = trapGet<T>({
    save(model: T) {
      return model.save(trx);
    },

    update(model: T, props: Record<string, unknown> = {}) {
      return model.update(props, trx);
    },

    destroy(model: T) {
      return model.destroy(trx);
    },

    reload(model: T) {
      return model.isNew
        ? Promise.resolve(model)
        : model.constructor.find(model.getPrimaryKey()).transacting(trx);
    }
  });

  return new Proxy(target, {
    get(model, key, receiver) {
      // A relationship read (`await comment.post`) runs in `trx` too, and the
      // records it yields are bound to it as well, so `(await comment.post)
      // .user` stays in the transaction. The relationships are accessors on
      // the prototype, so returning another value for them does not break a
      // proxy invariant.
      if (typeof key === 'string' && model.constructor.relationshipFor(key)) {
        return getRelationship(model, key, trx).then(value =>
          Array.isArray(value)
            ? value.map(record => createInstanceTransactionProxy(record, trx))
            : value && createInstanceTransactionProxy(value, trx)
        );
      }

      return forward(model, key as string, receiver);
    }
  });
}

/** @internal */
export function createTransactionResultProxy<
  T extends Model,
  U extends boolean
>(record: T, didPersist: U): TransactionResult<T, U> {
  return new Proxy(record, {
    get: trapGet({
      didPersist
    })
  }) as unknown as TransactionResult<T, U>;
}

export type { TransactionResult } from './interfaces';
