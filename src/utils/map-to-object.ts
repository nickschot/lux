export default function mapToObject<T>(
  source: Map<string, T>
): Record<string, T> {
  return Array
    .from(source)
    .reduce<Record<string, T>>((obj, [key, value]) => ({
      ...obj,
      [String(key)]: value
    }), {});
}
