import { MIME_TYPE } from '../constants';
import { line } from '../../logger';
import createServerError from '../../server/utils/create-server-error';

/** @internal */
class NotAcceptableError extends TypeError {
  constructor(accept: string) {
    super(line`
      Every '${MIME_TYPE}' in Accept: '${accept}' has media type parameters,
      which are not supported. Try your request again with '${MIME_TYPE}'
      without parameters.
    `);
  }
}

export default createServerError(NotAcceptableError, 406, { isPublic: true });
