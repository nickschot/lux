import entries from './entries';
import isObject from './is-object';

function hasOwnProperty(target: object, key: string): boolean {
  return Reflect.apply(Object.prototype.hasOwnProperty, target, [key]);
}

/**
 * @private
 */
export default function merge<T extends object, U extends object>(
  dest: T,
  source: U
): T & U {
  return entries(source as Record<string, unknown>)
    .reduce<Record<string, unknown>>((result, [key, value]) => {
      if (hasOwnProperty(result, key) && isObject(value)) {
        const currentValue = Reflect.get(result, key);

        if (isObject(currentValue)) {
          return {
            ...result,
            [key]: merge(currentValue, value)
          };
        }
      }

      return {
        ...result,
        [key]: value
      };
    }, { ...dest } as Record<string, unknown>) as T & U;
}
