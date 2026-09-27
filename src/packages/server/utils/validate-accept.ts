import { MIME_TYPE, parseAccept, NotAcceptableError } from '../../jsonapi';

/**
 * JSON:API 1.0: respond 406 if the Accept header contains the JSON:API media
 * type and *all* instances of it are modified with media type parameters.
 * An Accept header without the JSON:API media type is left alone.
 *
 * @private
 */
export default function validateAccept(accept?: string): true {
  if (accept) {
    const ranges = parseAccept(accept).filter(({ type }) => type === MIME_TYPE);

    if (ranges.length && ranges.every(({ params }) => params.length)) {
      throw new NotAcceptableError(accept);
    }
  }

  return true;
}
