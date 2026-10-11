/**
 * Refuse a `maxBodySize` that isn't a size in bytes: a positive integer, or
 * `Infinity` for no limit. `where` names the setting in the error.
 *
 * @internal
 */
export default function validateMaxBodySize(
  value: unknown,
  where: string
): void {
  if (
    value !== Infinity &&
    !(typeof value === 'number' && Number.isInteger(value) && value > 0)
  ) {
    throw new TypeError(
      `${where} must be a positive whole number of bytes, or Infinity for ` +
        `no limit, not ${String(value)}.`
    );
  }
}
