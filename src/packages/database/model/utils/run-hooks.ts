import type Model from '../index';
import type { ModelHook } from '../interfaces';

/**
 * @private
 */
export default function runHooks(
  record: Model,
  trx: unknown,
  ...hooks: Array<ModelHook | undefined>
): Promise<unknown> {
  return hooks
    .filter((hook): hook is ModelHook => Boolean(hook))
    .reduce<Promise<unknown>>(
      (prev, next) => prev.then(() => next(record, trx)),
      Promise.resolve()
    );
}
