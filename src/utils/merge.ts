import entries from './entries';
import isObject from './is-object';

/**
 * @private
 */
export default function merge<T extends object, U extends object>(
  dest: T,
  source: U
): T & U {
  return entries(source as Record<string, unknown>).reduce<
    Record<string, unknown>
  >(
    (result, [key, value]) => {
      if (Object.hasOwn(result, key) && isObject(value)) {
        const currentValue = result[key];

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
    },
    { ...dest } as Record<string, unknown>
  ) as T & U;
}
