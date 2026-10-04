import { ParameterRangeError } from '../../errors';
import type Parameter from '../index';

/**
 * @private
 */
export default function validateRange(param: Parameter, value: unknown): true {
  const { min = -Infinity, max = Infinity } = param;

  if (typeof value === 'number' && (value < min || value > max)) {
    throw new ParameterRangeError(param, value);
  }

  return true;
}
