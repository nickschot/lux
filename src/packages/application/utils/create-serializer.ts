import { posix } from 'path';

import { deepFreezeProps } from '../../freezeable';
import { tryCatchSync } from '../../../utils/try-catch';
import type Serializer from '../../serializer';
import type { Model, ModelClass } from '../../database';
import type { ApplicationClass, ApplicationFactoryOptions } from '../index';

export default function createSerializer<T extends Serializer<Model>>(
  constructor: ApplicationClass<T>,
  opts: ApplicationFactoryOptions<T>
): T {
  const { key, store } = opts;
  const namespace = posix.dirname(key).replace('.', '');
  let { parent } = opts;
  let model: ModelClass | null | undefined = tryCatchSync(() =>
    store.modelFor(posix.basename(key))
  );

  if (!model) {
    model = null;
  }

  if (!parent) {
    parent = null;
  }

  const instance: T = new constructor({
    model,
    parent,
    namespace
  });

  Object.defineProperty(instance, 'parent', {
    value: parent,
    writable: false,
    enumerable: true,
    configurable: false
  });

  return deepFreezeProps(instance, true, 'hasOne', 'hasMany', 'attributes');
}
