import { posix } from 'path';

import { deepFreezeProps } from '../../freezeable';
import { tryCatchSync } from '../../../utils/try-catch';
import type Serializer from '../../serializer';
import type { Model, ModelClass } from '../../database';
import type { Application$Class, Application$factoryOpts } from '../index';

export default function createSerializer<T extends Serializer<Model>>(
  constructor: Application$Class<T>,
  opts: Application$factoryOpts<T>
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

  const instance: T = Reflect.construct(constructor, [
    {
      model,
      parent,
      namespace
    }
  ]);

  Reflect.defineProperty(instance, 'parent', {
    value: parent,
    writable: false,
    enumerable: true,
    configurable: false
  });

  return deepFreezeProps(instance, true, 'hasOne', 'hasMany', 'attributes');
}
