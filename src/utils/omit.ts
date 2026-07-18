import entries from './entries';

/**
 * Returns a copy of `src` without `omitted` keys.
 *
 * Typed as `Partial<T>` rather than Flow's `T`, since the omitted keys are by
 * definition absent from the result.
 *
 * @private
 */
export default function omit<T extends object>(
  src: T,
  ...omitted: string[]
): Partial<T> {
  return entries(src as Record<string, unknown>)
    .filter(([key]) => omitted.indexOf(key) < 0)
    .reduce<Record<string, unknown>>(
      (result, [key, value]) => ({
        ...result,
        [key]: value
      }),
      {}
    ) as Partial<T>;
}
