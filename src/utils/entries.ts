/**
 * @private
 */
export default function entries<T>(
  source: Record<string, T>
): Array<[string, T]> {
  return Object.entries(source);
}
