import hasOwnProperty from './has-own-property';

type ProxyGet<T extends object> = (
  target: T,
  key: string,
  receiver: unknown
) => unknown;

/**
 * @private
 */
export function trapGet<T extends object>(
  traps: Record<string, unknown>
): ProxyGet<T> {
  return (target, key, receiver) => {
    if (key === 'unwrap') {
      return () => target;
    }

    if (hasOwnProperty(traps, key)) {
      const value = Reflect.get(traps, key);

      if (typeof value === 'function') {
        return value.bind(receiver, target);
      }

      return value;
    }

    return Reflect.get(target, key);
  };
}
