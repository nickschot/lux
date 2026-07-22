import { FreezeableSet } from '../../../../freezeable';
import validateType from '../utils/validate-type';

import validateValue from './utils/validate-value';
import type { Parameter$opts } from './interfaces';

/**
 * @private
 */
class Parameter extends FreezeableSet<unknown> {
  declare path: string;

  declare type: string;

  declare required: boolean;

  declare sanitize: boolean;

  constructor({ path, type, values, required, sanitize }: Parameter$opts) {
    super(values);

    Object.assign(this, {
      path,
      type,
      required: Boolean(required),
      sanitize: Boolean(sanitize)
    });

    this.freeze();
  }

  validate<V>(value: V): V {
    validateType(this, value);

    if (this.size > 0) {
      return validateValue(this, value);
    }

    return value;
  }
}

export default Parameter;
