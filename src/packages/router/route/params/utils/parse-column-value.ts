const INTEGER = /^-?\d+$/;

// ISO 8601: a date, optionally with a time (seconds and fraction optional)
// and an offset.
const ISO_8601 =
  /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/;

/**
 * Parse an id from a request document. JSON:API ids are strings, so a numeric
 * primary key takes the number a string of digits spells; anything else is
 * returned as is (a number still passes, for lenient clients).
 *
 * @private
 */
export function parseId(type: string | undefined) {
  return (value: unknown): unknown => {
    if (type === 'number' && typeof value === 'string' && INTEGER.test(value)) {
      return Number.parseInt(value, 10);
    }

    return value;
  };
}

/**
 * The parser for attribute values written to a column of `type`, if it needs
 * one. JSON has no dates, so a date column takes an ISO 8601 string; every
 * other value is typed by JSON already and is validated as sent.
 *
 * @private
 */
export function parserFor(
  type: string | undefined
): ((value: unknown) => unknown) | undefined {
  if (type !== 'date') {
    return undefined;
  }

  return (value: unknown): unknown => {
    if (typeof value === 'string' && ISO_8601.test(value)) {
      const date = new Date(value);

      if (!Number.isNaN(date.valueOf())) {
        return date;
      }
    }

    return value;
  };
}
