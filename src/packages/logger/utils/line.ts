import { insertValues } from '../../template';

/**
 * @private
 */
export default function line(
  strings: readonly string[],
  ...values: unknown[]
): string {
  return insertValues(strings, ...values)
    .replace(/(\r\n|\n|\r|)/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
}
