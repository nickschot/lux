import { FreezeableMap } from '../../../../freezeable';
import { InvalidParameterError } from '../errors';
import IgnoredParameter from '../parameter/ignored-parameter';
import { collectErrors } from '../../../../server/errors/error-list';
import isNull from '../../../../../utils/is-null';
import entries from '../../../../../utils/entries';
import validateType from '../utils/validate-type';
import type { ParameterLike, ParameterLike$opts } from '../index';

import missingParams from './utils/missing-params';

/** @internal */
class ParameterGroup extends FreezeableMap<string, ParameterLike> {
  declare type: string;

  declare path: string;

  declare required: boolean;

  declare sanitize: boolean;

  constructor(
    contents: Array<[string, ParameterLike]>,
    { path, required, sanitize }: ParameterLike$opts
  ) {
    super(contents);

    Object.assign(this, {
      path,
      type: 'object',
      required: Boolean(required),
      sanitize: Boolean(sanitize)
    });

    this.freeze();
  }

  validate<V>(params: V): V {
    const validated: Record<string, unknown> = {};

    if (isNull(params)) {
      return params;
    }

    validateType(this, params);

    const { sanitize } = this;
    let { path } = this;

    if (path.length) {
      path = `${path}.`;
    }

    // Every problem with the members is reported, not just the first.
    collectErrors(
      entries(params as Record<string, unknown>).map(([key, value]) => () => {
        const match = this.get(key);

        if (match instanceof IgnoredParameter) {
          return;
        } else if (match) {
          validated[key] = match.validate(value);
        } else if (!sanitize) {
          throw new InvalidParameterError(`${path}${key}`);
        }
      }),
      missingParams(this, params as Record<string, unknown>)
    );

    return validated as V;
  }
}

export default ParameterGroup;
