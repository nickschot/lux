/**
 * The status an error is answered with: its own `statusCode`, or `500`.
 *
 * @private
 */
export default function statusForError(err: unknown): number {
  const { statusCode } = (err || {}) as { statusCode?: unknown };

  return parseInt(String(statusCode), 10) || 500;
}
