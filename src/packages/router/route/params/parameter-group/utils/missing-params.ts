import { ParameterRequiredError } from '../../errors';
import type { Server$Error } from '../../../../../server';
import type ParameterGroup from '../index';

/**
 * An error for each required member of `group` that `params` lacks.
 *
 * @private
 */
export default function missingParams(
  group: ParameterGroup,
  params: Record<string, unknown>
): Array<Server$Error> {
  return Array.from(group)
    .filter(([key, { required }]) => required && !Reflect.has(params, key))
    .map(([, { path }]) => new ParameterRequiredError(path));
}
