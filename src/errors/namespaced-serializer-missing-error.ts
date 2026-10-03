/**
 * Thrown at boot when a namespace that opted out of serializer fallback
 * (`serializerFallback = false` on its ApplicationController) can reach a type
 * that has no Serializer in that namespace.
 *
 * @private
 */
class NamespacedSerializerMissingError extends ReferenceError {
  /**
   * @param missing - Each missing serializer key (`admin/comments`) with an
   * example of how it is reached (`admin/posts?include=comments`).
   */
  constructor(missing: Map<string, string>) {
    const lines = Array.from(missing)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, via]) => `  - ${key} (reached from ${via})`);

    super(
      [
        'Missing namespaced serializers. These namespaces set ' +
          '`serializerFallback = false`, so every type their controllers ' +
          'can serialize or include needs a serializer of its own:',
        ...lines
      ].join('\n')
    );
  }
}

export default NamespacedSerializerMissingError;
