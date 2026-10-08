/**
 * Thrown at boot when relationships are declared in a way that cannot work,
 * listing every problem.
 *
 * @internal
 */
class RelationshipConfigError extends TypeError {
  constructor(problems: Array<string>) {
    super(
      [
        'Invalid relationships. Each must name its `inverse`: the ' +
          'relationship on the related model that points back:',
        ...problems.sort().map(problem => `  - ${problem}`)
      ].join('\n')
    );
  }
}

export default RelationshipConfigError;
