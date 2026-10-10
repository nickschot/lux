import { MIME_TYPE } from '../../../jsonapi';
import isObject from '../../../../utils/is-object';

const JSON_TYPE = 'application/json';

// Members only a JSON:API document has at its top level. Every document Lumen
// builds carries `jsonapi`; one an `afterAction` hook rebuilds keeps it when
// it spreads the original (`{ ...payload, meta }`).
const DOCUMENT_MEMBERS = ['jsonapi', 'data', 'errors'];

/**
 * The `Content-Type` of a response body, before it is serialized: the
 * JSON:API media type for a JSON:API document, `application/json` for any
 * other object or array, plain text for a string, and none for an empty body.
 *
 * @internal
 */
export default function contentTypeFor(body: unknown): string | undefined {
  if (typeof body === 'string') {
    return body ? 'text/plain; charset=utf-8' : undefined;
  }

  if (isObject(body)) {
    return DOCUMENT_MEMBERS.some(key => Object.hasOwn(body, key))
      ? MIME_TYPE
      : JSON_TYPE;
  }

  if (Array.isArray(body)) {
    return JSON_TYPE;
  }

  return undefined;
}
