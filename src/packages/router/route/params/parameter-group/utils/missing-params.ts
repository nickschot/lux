import { ParameterRequiredError } from '../../errors';
import type { ServerError } from '../../../../../server';
import type ParameterGroup from '../index';

/**
 * An error for each required member of `group` that `params` lacks.
 *
 * @internal
 */
export default function missingParams(
  group: ParameterGroup,
  params: Record<string, unknown>
): Array<ServerError> {
  return Array.from(group)
    .filter(([key, { required }]) => required && !(key in params))
    .map(([, { path }]) => new ParameterRequiredError(path));
}
