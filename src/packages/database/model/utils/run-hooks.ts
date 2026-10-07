import { createInstanceTransactionProxy } from '../../transaction';
import type Model from '../index';
import type { ModelHook } from '../interfaces';

/**
 * Run `hooks` in order. Each receives the record bound to the write's
 * transaction — so its relationship reads, `update`, `save` and `reload` join
 * it — and the transaction itself, for queries on other models.
 *
 * @private
 */
export default function runHooks(
  target: Model,
  trx: unknown,
  ...hooks: Array<ModelHook | undefined>
): Promise<unknown> {
  const record = trx ? createInstanceTransactionProxy(target, trx) : target;

  return hooks
    .filter((hook): hook is ModelHook => Boolean(hook))
    .reduce<Promise<unknown>>(
      (prev, next) => prev.then(() => next(record, trx)),
      Promise.resolve()
    );
}
