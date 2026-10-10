/**
 * Thrown at boot when a serializer lists a field named `type` or `id`, which
 * JSON:API forbids, without `allowReservedNames`.
 *
 * @internal
 */
class ReservedFieldNameError extends TypeError {
  /**
   * @param problems - One line per name, saying where it is listed.
   */
  constructor(problems: Array<string>) {
    super(
      [
        'Reserved field names. JSON:API forbids an attribute or relationship ' +
          "named `type` or `id`: they share a namespace with the resource's " +
          'own `type` and `id`. Rename the column, or set ' +
          '`allowReservedNames = true` on the serializer to send it anyway:',
        ...problems.sort().map(problem => `  - ${problem}`)
      ].join('\n')
    );
  }
}

export default ReservedFieldNameError;
