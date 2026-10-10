import { VERSION } from '../../../jsonapi';
import { STATUS_CODES } from '../../constants';
import * as env from '../../../../utils/env';
import type { JsonApiDocument, JsonApiErrorObject } from '../../../jsonapi';
import type { ServerError } from '../../interfaces';

const PUBLIC = /^\[public\]\s*/i;

/**
 * The error object for `err`, answered with `status`.
 *
 * @internal
 */
function errorObjectFor(
  status: number,
  err?: Partial<ServerError>
): JsonApiErrorObject {
  const title = err?.title || STATUS_CODES.get(status);
  const errData: JsonApiErrorObject = {
    status: status.toString()
  };

  if (err?.id) {
    errData.id = err.id;
  }

  if (err?.code) {
    errData.code = err.code;
  }

  if (title) {
    errData.title = title;
  }

  // `source` only ever points into the client's own request, so unlike
  // `detail` it is safe to expose in every environment — as are the members
  // an error was explicitly given.
  const source = err?.source;

  if (source && (source.pointer || source.parameter)) {
    errData.source = source;
  }

  // A message can contain anything (SQL, stored values, internals), so it is
  // shown outside development only when marked public: by the framework's own
  // client errors, which only describe the request, or with `[public]`.
  if (
    err?.message &&
    (env.isDevelopment() || err.isPublic || PUBLIC.test(err.message))
  ) {
    errData.detail = err.message.replace(PUBLIC, '');
  }

  if (err?.links?.about) {
    errData.links = { about: err.links.about };
  }

  if (err?.meta) {
    errData.meta = err.meta as JsonApiErrorObject['meta'];
  }

  return errData;
}

/** @internal */
export default function dataFor(
  status: number,
  err?: Error
): string | JsonApiDocument {
  if (status < 400 || status > 599) {
    return '';
  }

  // An `ErrorList` (several problems with one request) is one error object
  // each, at its own status; the response's status is the list's.
  const { errors } = (err || {}) as { errors?: Array<ServerError> };

  return {
    errors: Array.isArray(errors)
      ? errors.map(error => errorObjectFor(error.statusCode || status, error))
      : [errorObjectFor(status, err as Partial<ServerError> | undefined)],

    jsonapi: {
      version: VERSION
    }
  };
}
