import type Model from '../index';
import type { Model$Hook } from '../interfaces';

/**
 * @private
 */
export default function runHooks(
  record: Model,
  trx: unknown,
  ...hooks: Array<Model$Hook | undefined>
): Promise<unknown> {
  return hooks
    .filter((hook): hook is Model$Hook => Boolean(hook))
    .reduce<Promise<unknown>>(
      (prev, next) => prev.then(() => next(record, trx)),
      Promise.resolve()
    );
}
