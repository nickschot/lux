import {
  MIME_TYPE,
  isJSONAPI,
  parseMediaType,
  hasMediaTypeParams,
  InvalidContentTypeError,
  UnsupportedMediaTypeError
} from '../../jsonapi';

const JSON_TYPE = 'application/json';

/**
 * JSON:API 1.0: respond 415 if the Content-Type is the JSON:API media type
 * with any media type parameters. A missing or different Content-Type is
 * also answered with 415, since that is the only type a resource accepts.
 *
 * A plain route (`json`) takes any JSON body, so `application/json` (with
 * any parameters, such as `charset`) is accepted there too.
 *
 * @internal
 */
export default function validateContentType(
  contentType?: string,
  { json = false }: { json?: boolean } = {}
): true {
  if (json && contentType && parseMediaType(contentType).type === JSON_TYPE) {
    return true;
  }

  if (!contentType || !isJSONAPI(contentType)) {
    throw new InvalidContentTypeError(
      contentType,
      json ? [MIME_TYPE, JSON_TYPE] : [MIME_TYPE]
    );
  } else if (hasMediaTypeParams(contentType)) {
    throw new UnsupportedMediaTypeError(contentType);
  }

  return true;
}
