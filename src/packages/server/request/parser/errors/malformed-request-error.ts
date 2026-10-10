import createServerError from '../../../utils/create-server-error';
import { line } from '../../../../logger';

/** @internal */
class MalformedRequestError extends SyntaxError {
  constructor(expected: string = 'a valid JSON API document') {
    super(line`
      There was an error parsing the request body. Please make sure that the
      request body is ${expected}.
    `);
  }
}

export default createServerError(MalformedRequestError, 400, {
  isPublic: true
});
