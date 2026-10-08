import {
  isJSONAPI,
  hasMediaTypeParams,
  InvalidContentTypeError,
  UnsupportedMediaTypeError
} from '../../jsonapi';

/**
 * JSON:API 1.0: respond 415 if the Content-Type is the JSON:API media type
 * with any media type parameters. A missing or different Content-Type is
 * also answered with 415, since that is the only type the server accepts.
 *
 * @internal
 */
export default function validateContentType(contentType?: string): true {
  if (!contentType || !isJSONAPI(contentType)) {
    throw new InvalidContentTypeError(contentType);
  } else if (hasMediaTypeParams(contentType)) {
    throw new UnsupportedMediaTypeError(contentType);
  }

  return true;
}
