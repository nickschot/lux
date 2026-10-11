import createServerError from '../../../utils/create-server-error';

/** @internal */
class PayloadTooLargeError extends Error {
  constructor(limit: number) {
    super(`The request body is larger than the ${limit} bytes it may be.`);
  }
}

export default createServerError(PayloadTooLargeError, 413, {
  isPublic: true
});
