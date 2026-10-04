import { VERSION } from '../../../jsonapi';
import { STATUS_CODES } from '../../constants';
import * as env from '../../../../utils/env';
import type { JSONAPI$Document, JSONAPI$ErrorObject } from '../../../jsonapi';
import type { Server$Error } from '../../interfaces';

const PUBLIC = /^\[public\]/i;

/**
 * The error object for `err`, answered with `status`.
 *
 * @private
 */
function errorObjectFor(
  status: number,
  err?: Partial<Server$Error>
): JSONAPI$ErrorObject {
  const title = err?.title || STATUS_CODES.get(status);
  const errData: JSONAPI$ErrorObject = {
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

  if (err?.message && (env.isDevelopment() || PUBLIC.test(err.message))) {
    errData.detail = err.message.replace(PUBLIC, '');
  }

  if (err?.links?.about) {
    errData.links = { about: err.links.about };
  }

  if (err?.meta) {
    errData.meta = err.meta as JSONAPI$ErrorObject['meta'];
  }

  return errData;
}

/**
 * @private
 */
export default function dataFor(
  status: number,
  err?: Error
): string | JSONAPI$Document {
  if (status < 400 || status > 599) {
    return '';
  }

  // An `ErrorList` (several problems with one request) is one error object
  // each, at its own status; the response's status is the list's.
  const { errors } = (err || {}) as { errors?: Array<Server$Error> };

  return {
    errors: Array.isArray(errors)
      ? errors.map(error => errorObjectFor(error.statusCode || status, error))
      : [errorObjectFor(status, err as Partial<Server$Error> | undefined)],

    jsonapi: {
      version: VERSION
    }
  };
}
