/**
 * Thrown at boot when a Serializer's `linksOnly` names a relationship it
 * cannot serialize as links only.
 *
 * @private
 */
class LinksOnlyError extends TypeError {
  /**
   * @param problems - One line per relationship, saying what is wrong.
   */
  constructor(problems: Array<string>) {
    super(
      [
        'Invalid `linksOnly` relationships. Each must be in the ' +
          "serializer's `hasMany`, and its type must have a controller to " +
          'serve the related endpoint clients load it from:',
        ...problems.sort().map(problem => `  - ${problem}`)
      ].join('\n')
    );
  }
}

export default LinksOnlyError;
