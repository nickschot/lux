/**
 * Returns a copy of `src` containing only `keys` whose values are defined.
 *
 * The result is `Partial<T>` rather than Flow's `T`: keys may be dropped, both
 * because the caller asked for a subset and because undefined values are
 * filtered out. The cast is confined to the return, where the dynamic key
 * access makes the shape unknowable to the compiler.
 *
 * @private
 */
export default function pick<T extends object>(
  src: T,
  ...keys: string[]
): Partial<T> {
  return keys
    .map((key): [string, unknown] => [key, Reflect.get(src, key)])
    .filter(([, value]) => typeof value !== 'undefined')
    .reduce<Record<string, unknown>>(
      (result, [key, value]) => ({
        ...result,
        [key]: value
      }),
      {}
    ) as Partial<T>;
}
