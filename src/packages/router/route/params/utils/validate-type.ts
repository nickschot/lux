import ParameterTypeError from '../errors/parameter-type-error';
import ParameterNotNullableError from '../errors/parameter-not-nullable-error';
import isNull from '../../../../../utils/is-null';
import isObject from '../../../../../utils/is-object';
import isBuffer from '../../../../../utils/is-buffer';
import type { ParameterLike } from '../index';

/**
 * The type of `value` as an error message should name it: unlike `typeof`,
 * telling arrays and dates apart from other objects.
 *
 * @internal
 */
function describeType(value: unknown): string {
  if (Array.isArray(value)) {
    return 'array';
  } else if (value instanceof Date) {
    return 'date';
  }

  return typeof value;
}

/** @internal */
export default function validateType(
  param: ParameterLike,
  value: unknown
): true {
  const { type, required } = param;
  const valueIsNull = isNull(value);

  if (required && valueIsNull) {
    throw new ParameterNotNullableError(param);
  } else if (valueIsNull || !type) {
    return true;
  }

  const valueType = typeof value;
  let isValid: boolean;

  switch (type) {
    case 'array':
      isValid = Array.isArray(value);
      break;

    case 'buffer':
      isValid = isBuffer(value);
      break;

    case 'object':
      isValid = isObject(value) || isNull(value);
      break;

    case 'date':
      isValid = value instanceof Date;
      break;

    default:
      isValid = type === valueType;
  }

  if (!isValid) {
    throw new ParameterTypeError(param, describeType(value));
  }

  return true;
}
