import entries from '../../../../utils/entries';

/**
 * @private
 */
export default function filterParams(
  params: Record<string, unknown>,
  ...filtered: string[]
): Record<string, unknown> {
  return entries(params)
    .map(([key, value]): [string, unknown] => [
      key,
      filtered.indexOf(key) >= 0 ? '[FILTERED]' : value
    ])
    .reduce<Record<string, unknown>>(
      (result, [key, value]) => ({
        ...result,
        [key]:
          value && typeof value === 'object' && !Array.isArray(value)
            ? filterParams(value as Record<string, unknown>, ...filtered)
            : value
      }),
      {}
    );
}
