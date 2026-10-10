import { FreezeableSet } from '../../../../freezeable';
import validateType from '../utils/validate-type';
import { collectErrors } from '../../../../server/errors/error-list';

import validateRange from './utils/validate-range';
import validateValue from './utils/validate-value';
import type { ParameterOptions } from './interfaces';
import type { ParameterLike } from '../interfaces';

/** @internal */
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

  /**
   * Inclusive bounds of a `number` parameter, when given.
   */
  declare min?: number;

  declare max?: number;

  /**
   * Converts a value as the client sent it into the parameter's type before
   * it is validated (e.g. a JSON:API string id into a numeric primary key),
   * when given. Values it does not recognize are returned as is, and so fail
   * validation.
   */
  declare parse?: (value: unknown) => unknown;

  /**
   * For an `array` parameter, builds the parameter each element is validated
   * with, given the element's path (`data.relationships.tags.data.0`).
   */
  declare items?: (path: string) => ParameterLike;

  constructor({
    path,
    type,
    values,
    min,
    max,
    parse,
    items,
    required,
    sanitize
  }: ParameterOptions) {
    super(values);

    Object.assign(this, {
      path,
      type,
      min,
      max,
      parse,
      items,
      required: Boolean(required),
      sanitize: Boolean(sanitize),
      restricted: values !== undefined
    });

    this.freeze();
  }

  validate<V>(value: V): V {
    const parsed = (this.parse ? this.parse(value) : value) as V;

    validateType(this, parsed);
    validateRange(this, parsed);

    if (this.items && Array.isArray(parsed)) {
      const { items, path } = this;

      const validated: Array<unknown> = [];

      // Every invalid element is reported, not just the first.
      collectErrors(
        parsed.map((item, index) => () => {
          const param = items(`${path}.${index}`);

          // A group lets `null` through; an element must be present.
          validateType(param, item);
          validated[index] = param.validate(item);
        })
      );

      return validated as V;
    }

    if (this.restricted) {
      return validateValue(this, parsed);
    }

    return parsed;
  }
}

export default Parameter;
