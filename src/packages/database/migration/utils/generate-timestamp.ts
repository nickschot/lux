const pad = (int: number): string => String(int).padStart(2, '0');

export function* padding(
  char: string,
  amount: number
): Generator<string, void, void> {
  for (let i = 0; i < amount; i += 1) {
    yield char;
  }
}

/**
 * A migration's version: `YYYYMMDDHHmmssCC` in UTC (`CC` are hundredths of a
 * second), 16 digits. Fixed-width and zero-padded, so versions sort in the
 * order they were generated — `lumen db:migrate` runs migrations in that
 * order.
 *
 * @private
 */
export default function generateTimestamp(now: Date = new Date()): string {
  return (
    String(now.getUTCFullYear()) +
    pad(now.getUTCMonth() + 1) +
    pad(now.getUTCDate()) +
    pad(now.getUTCHours()) +
    pad(now.getUTCMinutes()) +
    pad(now.getUTCSeconds()) +
    pad(Math.floor(now.getUTCMilliseconds() / 10))
  );
}
