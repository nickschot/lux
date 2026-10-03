import { ForbiddenParameterError } from '../errors';

import Parameter from './index';

/**
 * A member the resource has but the controller does not accept. Any value for
 * it is rejected with 403 rather than the 400 an unknown member gets.
 *
 * @private
 */
class ForbiddenParameter extends Parameter {
  constructor(path: string) {
    super({ path });
  }

  override validate<V>(): V {
    throw new ForbiddenParameterError(this.path);
  }
}

export default ForbiddenParameter;
