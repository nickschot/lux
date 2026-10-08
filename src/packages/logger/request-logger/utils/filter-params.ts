import entries from '../../../../utils/entries';

/**
 * Always filtered, on top of the app's `logging.filter.params`, so a missing
 * config never leaks credentials into the logs.
 *
 * @internal
 */
export const FILTERED_PARAMS: readonly string[] = [
  'password',
  'secret',
  'token'
];

const FILTERED = '[FILTERED]';

/**
 * A key is filtered when it contains a filtered name, ignoring case — so
 * `password` also covers `passwordConfirmation` and `new-password`.
 *
 * @internal
 */
function isFiltered(key: string, filtered: readonly string[]): boolean {
  const name = key.toLowerCase();

  return filtered.some(item => name.includes(item.toLowerCase()));
}

/** @internal */
function filterValue(value: unknown, filtered: readonly string[]): unknown {
  if (Array.isArray(value)) {
    return value.map(item => filterValue(item, filtered));
  }

  if (value && typeof value === 'object') {
    return filterKeys(value as Record<string, unknown>, filtered);
  }

  return value;
}

/** @internal */
function filterKeys(
  params: Record<string, unknown>,
  filtered: readonly string[]
): Record<string, unknown> {
  return entries(params).reduce<Record<string, unknown>>(
    (result, [key, value]) => {
      result[key] = isFiltered(key, filtered)
        ? FILTERED
        : filterValue(value, filtered);

      return result;
    },
    {}
  );
}

/** @internal */
export default function filterParams(
  params: Record<string, unknown>,
  ...filtered: string[]
): Record<string, unknown> {
  return filterKeys(params, [...FILTERED_PARAMS, ...filtered]);
}
