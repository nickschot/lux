import type { ModelClass } from '../../interfaces';

/**
 * A query named something that is not an attribute of its model: a typo, or
 * a relationship where an attribute belongs. Thrown when the query is built,
 * rather than dropping the condition, which would match more records than
 * meant (in a visibility rule, every record).
 *
 * @internal
 */
class UnknownColumnError extends TypeError {
  constructor({ name }: ModelClass, attribute: string, method: string) {
    super(
      `${name} has no attribute "${attribute}" (in \`${method}()\`). Query ` +
        'methods take attribute names, camelCase as on records; for a ' +
        'relationship, use its foreign key (`userId`) or a subquery.'
    );
  }
}

export default UnknownColumnError;
