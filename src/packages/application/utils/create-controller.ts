import { posix } from 'path';

import { deepFreezeProps } from '../../freezeable';
import { closestAncestor } from '../../loader';
import { tryCatchSync } from '../../../utils/try-catch';
import type Database from '../../database';
import type { Model, ModelClass } from '../../database';
import type Controller from '../../controller';
import type Serializer from '../../serializer';
import type { Bundle$Namespace } from '../../loader';
import type { Application$Class } from '../index';

export default function createController<T extends Controller>(
  constructor: Application$Class<T>,
  opts: {
    key: string;
    store: Database;
    parent?: Controller | null;
    serializers: Bundle$Namespace<Serializer<Model>>;
  }
): T {
  const { key, store, serializers } = opts;
  const namespace = posix.dirname(key).replace('.', '');
  let { parent } = opts;
  let model: ModelClass | null | undefined = tryCatchSync(() =>
    store.modelFor(posix.basename(key))
  );
  let serializer = serializers.get(key);

  if (!model) {
    model = null;
  }

  if (!parent) {
    parent = null;
  }

  if (!serializer) {
    serializer = closestAncestor(serializers, key);
  }

  const instance: T = Reflect.construct(constructor, [
    {
      model,
      namespace,
      serializer
    }
  ]);

  if (serializer) {
    if (!instance.filter.length) {
      instance.filter = [...serializer.attributes];
    }

    if (!instance.sort.length) {
      instance.sort = [...serializer.attributes];
    }
  }

  if (parent) {
    instance.beforeAction = [
      ...parent.beforeAction.map(fn => fn.bind(parent)),
      ...instance.beforeAction.map(fn => fn.bind(instance))
    ];

    instance.afterAction = [
      ...instance.afterAction.map(fn => fn.bind(instance)),
      ...parent.afterAction.map(fn => fn.bind(parent))
    ];
  }

  Reflect.defineProperty(instance, 'parent', {
    value: parent,
    writable: false,
    enumerable: true,
    configurable: false
  });

  return deepFreezeProps(
    instance,
    true,
    'query',
    'sort',
    'filter',
    'params',
    'beforeAction',
    'afterAction'
  );
}
