import isNull from '../../../../utils/is-null';
import type { ModelClass } from '../../interfaces';

function validateOne(model: ModelClass, value: unknown) {
  return isNull(value) || model.isInstance(value);
}

export default function validateType(model: ModelClass, value: unknown) {
  if (Array.isArray(value)) {
    return value.every(item => validateOne(model, item));
  }

  return validateOne(model, value);
}
