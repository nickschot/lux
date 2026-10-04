import type { ModelClass } from '../../database';

/**
 * Thrown at boot for visibility rules that cannot be applied: rules declared
 * on a controller other than a namespace's `ApplicationController`, rules for
 * an unknown type, or a rule that is not a function.
 *
 * @private
 */
export class VisibilityConfigError extends TypeError {
  constructor(problems: Array<string>) {
    super(
      [
        'Invalid `static visibility` rules:',
        ...problems.map(problem => `  - ${problem}`)
      ].join('\n')
    );
  }
}

/**
 * Thrown while serving a request when a visibility rule does something other
 * than narrow its query with conditions. A programming error, so it surfaces
 * as a `500`.
 *
 * @private
 */
export class VisibilityRuleError extends TypeError {
  constructor({ resourceName }: ModelClass, problem: string) {
    super(`The visibility rule for "${resourceName}" ${problem}`);
  }
}
