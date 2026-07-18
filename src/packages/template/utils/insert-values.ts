/**
 * @private
 */
export default function insertValues(
  strings: readonly string[],
  ...values: unknown[]
): string {
  if (values.length) {
    return strings.reduce((result, part, idx): string => {
      const raw: unknown = values[idx];
      let value = '';

      if (
        raw &&
        typeof (raw as { toString?: unknown }).toString === 'function'
      ) {
        value = (raw as { toString(): string }).toString();
      }

      return result + part + value;
    }, '');
  }

  return strings.join('');
}
