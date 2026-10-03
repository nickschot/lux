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

  /**
   * Whether the parameter only accepts the given `values`. A parameter built
   * without `values` accepts any value of its type; one built with `values`
   * accepts only those — so an empty list accepts nothing. (Both used to look
   * alike as an empty set, which let e.g. `?include=anything` through on a
   * serializer without relationships, where JSON:API requires a 400.)
   */
  declare restricted: boolean;

  constructor({ path, type, values, required, sanitize }: Parameter$opts) {
    super(values);

    Object.assign(this, {
      path,
      type,
      required: Boolean(required),
      sanitize: Boolean(sanitize),
      restricted: values !== undefined
    });

    this.freeze();
  }

  validate<V>(value: V): V {
    validateType(this, value);

    if (this.restricted) {
      return validateValue(this, value);
    }

    return value;
  }
}

export default Parameter;
