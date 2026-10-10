import { MIME_TYPE } from '../constants';
import { line } from '../../logger';
import createServerError from '../../server/utils/create-server-error';

/** @internal */
class InvalidContentTypeError extends TypeError {
  constructor(
    contentType: string = 'undefined',
    accepted: Array<string> = [MIME_TYPE]
  ) {
    super(line`
      Content-Type: '${contentType}' is not supported. Try your request again
      with Content-Type: ${accepted.map(type => `'${type}'`).join(' or ')}.
    `);
  }
}

export default createServerError(InvalidContentTypeError, 415, {
  isPublic: true
});
