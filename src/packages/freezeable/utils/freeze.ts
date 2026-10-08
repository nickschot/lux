import { FREEZER } from '../constants';
import insert from '../../../utils/insert';
import isObject from '../../../utils/is-object';

/**
 * Anything exposing a `freeze` method — in practice FreezeableMap/FreezeableSet.
 *
 * @internal
 */
interface Freezeable {
  freeze(deep?: boolean): unknown;
}

function isFreezeable(value: unknown): value is Freezeable {
  return Boolean(value) && typeof (value as Freezeable).freeze === 'function';
}

/** @internal */
export default function freeze<T extends object>(value: T): T {
  FREEZER.add(value);
  return value;
}

/** @internal */
export function freezeArray<T>(target: T[]): readonly T[] {
  const result = insert(new Array<T>(target.length), target);

  return Object.freeze(result);
}

/** @internal */
export function freezeValue<T>(value: T): T {
  if (isFreezeable(value)) {
    return Object.freeze(value).freeze(true) as T;
  } else if (isObject(value)) {
    return Object.freeze(value) as T;
  }

  return value;
}

/** @internal */
export function freezeProps<T extends object>(
  target: T,
  makePublic: boolean,
  ...props: string[]
): T {
  Object.defineProperties(
    target,
    props.reduce<PropertyDescriptorMap>(
      (obj, key) => ({
        ...obj,
        [key]: {
          value: (target as Record<string, unknown>)[key],
          writable: false,
          enumerable: makePublic,
          configurable: false
        }
      }),
      {}
    )
  );

  return target;
}

/** @internal */
export function deepFreezeProps<T extends object>(
  target: T,
  makePublic: boolean,
  ...props: string[]
): T {
  Object.defineProperties(
    target,
    props.reduce<PropertyDescriptorMap>((obj, key) => {
      let value = (target as Record<string, unknown>)[key];

      if (Array.isArray(value)) {
        value = freezeArray(value);
      } else {
        value = freezeValue(value);
      }

      return {
        ...obj,
        [key]: {
          value,
          writable: false,
          enumerable: makePublic,
          configurable: false
        }
      };
    }, {})
  );

  return target;
}
