import { posix } from 'path';

import { deepFreezeProps } from '../../freezeable';
import { closestAncestor } from '../../loader';
import { tryCatchSync } from '../../../utils/try-catch';
import type Database from '../../database';
import type { Model, ModelClass } from '../../database';
import { NAMESPACE_SETTINGS } from '../../controller';
import type Controller from '../../controller';
import type Serializer from '../../serializer';
import type { BundleNamespace } from '../../loader';
import type { ApplicationClass } from '../index';

type NamespaceSetting = (typeof NAMESPACE_SETTINGS)[number];

/**
 * The `NAMESPACE_SETTINGS` each controller, or a namespace it is in, sets
 * itself. Once inherited, a setting is an own property of every controller,
 * so this is the only record of whether anyone chose its value.
 */
const explicitSettings = new WeakMap<Controller, Set<NamespaceSetting>>();

/**
 * Whether `controller`, or the `ApplicationController` of a namespace it is
 * in, sets `setting` itself rather than leaving it at the default.
 *
 * @internal
 */
export function setsItself(
  controller: Controller,
  setting: NamespaceSetting
): boolean {
  return explicitSettings.get(controller)?.has(setting) ?? false;
}

export default function createController<T extends Controller>(
  constructor: ApplicationClass<T>,
  opts: {
    key: string;
    store: Database;
    parent?: Controller | null;
    serializers: BundleNamespace<Serializer<Model>>;
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

  const instance: T = new constructor({
    model,
    namespace,
    serializer
  });

  if (serializer) {
    if (!instance.filter.length) {
      instance.filter = [...serializer.attributes];
    }

    if (!instance.sort.length) {
      instance.sort = [...serializer.attributes];
    }
  }

  const ownBefore = instance.beforeAction.map(fn => fn.bind(instance));
  const ownAfter = instance.afterAction.map(fn => fn.bind(instance));

  // A namespace's `ApplicationController` that extends its parent namespace's
  // (`AdminApplicationController extends ApplicationController`, to build on
  // `super.visibility`) already has the parent's hooks, as the class fields it
  // inherits — adding them again would run each one twice. Its own arrays are
  // the namespace's hooks, as with any subclass.
  const inheritsHooks =
    parent !== null &&
    posix.basename(key) === 'application' &&
    instance instanceof parent.constructor;

  if (parent && !inheritsHooks) {
    // The parent's hooks are bound to it already (it was created first).
    instance.beforeAction = [...parent.beforeAction, ...ownBefore];
    instance.afterAction = [...ownAfter, ...parent.afterAction];
  } else {
    instance.beforeAction = ownBefore;
    instance.afterAction = ownAfter;
  }

  explicitSettings.set(
    instance,
    new Set(
      NAMESPACE_SETTINGS.filter(
        setting =>
          Object.hasOwn(instance, setting) ||
          (parent !== null && setsItself(parent, setting))
      )
    )
  );

  if (parent) {
    // Settings the controller does not set itself come from its namespace.
    for (const setting of NAMESPACE_SETTINGS) {
      if (!Object.hasOwn(instance, setting)) {
        Object.defineProperty(instance, setting, {
          value: parent[setting],
          writable: true,
          enumerable: true,
          configurable: true
        });
      }
    }
  }

  Object.defineProperty(instance, 'parent', {
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
