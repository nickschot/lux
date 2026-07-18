/**
 * @private
 */
export default function isBuffer(value: unknown): value is Buffer {
  return value instanceof Buffer;
}
