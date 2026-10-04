import Validation, { ValidationError } from '../../validation';
import ErrorList from '../../../server/errors/error-list';
import type { Model } from '../../index';

/**
 * Run the model's validators over its dirty attributes. Every attribute that
 * fails is reported (one 422 error object each), not just the first.
 *
 * @private
 */
export default function validate(instance: Model): true {
  const failed = Array.from(instance.dirtyAttributes)
    .map(([key, value]) => ({
      key,
      value,
      validator: Reflect.get(instance.constructor.validates, key) as (
        value?: unknown
      ) => boolean
    }))
    .filter(({ validator }) => validator)
    .map(props => new Validation(props))
    .filter(validation => !validation.isValid())
    .map(({ key }) => new ValidationError(key));

  if (failed.length) {
    throw ErrorList.from(failed);
  }

  return true;
}
