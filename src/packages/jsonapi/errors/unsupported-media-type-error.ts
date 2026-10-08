import { MIME_TYPE } from '../constants';
import { line } from '../../logger';
import createServerError from '../../server/utils/create-server-error';

/** @internal */
class UnsupportedMediaTypeError extends TypeError {
  constructor(contentType: string) {
    super(line`
      Media type parameters are not supported in Content-Type:
      '${contentType}'. Try your request again with Content-Type:
      '${MIME_TYPE}' without parameters.
    `);
  }
}

export default createServerError(UnsupportedMediaTypeError, 415);
