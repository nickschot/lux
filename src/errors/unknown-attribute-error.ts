/**
 * Thrown at boot when a serializer's `attributes`, or a controller's `sort`
 * or `filter`, names something that is not a column of the model's table.
 *
 * @internal
 */
class UnknownAttributeError extends TypeError {
  /**
   * @param problems - One line per name, saying where it is listed.
   */
  constructor(problems: Array<string>) {
    super(
      [
        "Unknown attributes. A serializer's `attributes`, and a controller's " +
          "`sort` and `filter`, may only name columns of the model's table " +
          '(camelCase). To send a computed value, add it in an `afterAction` ' +
          'hook or a custom action:',
        ...problems.sort().map(problem => `  - ${problem}`)
      ].join('\n')
    );
  }
}

export default UnknownAttributeError;
