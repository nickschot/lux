import createServerError from '../../../../server/utils/create-server-error';
import sourceFor, { nameFor } from '../../../../server/utils/source-for';
import type { ServerErrorSource } from '../../../../server';

/** @internal */
class ParameterRequiredError extends TypeError {
  declare source: ServerErrorSource;

  constructor(path: string) {
    super(`Missing required parameter '${nameFor(path)}'.`);
    this.source = sourceFor(path);
  }
}

export default createServerError(ParameterRequiredError, 400, {
  isPublic: true
});
